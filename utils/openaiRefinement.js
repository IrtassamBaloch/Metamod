'use strict';

const { getEnv, getOptionalEnv } = require('./env');
const { normalizeText, stripCodeFences } = require('./refinement');

const DEFAULT_OPENAI_MODELS = ['gpt-4.1-mini', 'gpt-4o-mini'];

class OpenAIRefinementClient {
    constructor(apiKey = getEnv('OPENAI_API_KEY'), model = getOptionalEnv('OPENAI_MODEL')) {
        this.apiKey = apiKey;
        this.preferredModel = model;
        this.activeModel = null;
        this.loggedFallbackReason = false;
    }

    getModelCandidates() {
        return [...new Set([this.activeModel, this.preferredModel, ...DEFAULT_OPENAI_MODELS].filter(Boolean))];
    }

    shouldTryNextModel(status, errorBody) {
        const errorText = String(errorBody || '');

        return (
            [400, 403, 404].includes(status) &&
            /(model_not_found|does not exist|do not have access to it|unsupported model)/i.test(errorText)
        );
    }

    shouldUseLocalFallback(error) {
        const message = String(error?.message || error || '');

        return (
            /insufficient_quota/i.test(message) ||
            /billing/i.test(message) ||
            /rate limit/i.test(message) ||
            /invalid_api_key/i.test(message) ||
            /authentication/i.test(message) ||
            /quota/i.test(message)
        );
    }

    logFallback(reason) {
        if (this.loggedFallbackReason) {
            return;
        }

        this.loggedFallbackReason = true;
        console.warn(`[refinement] Falling back to local heuristics: ${reason}`);
    }

    inferScenario(text) {
        const normalized = normalizeText(text).toLowerCase();

        if (/weather|temperature|humidity|wind|forecast|imperial|fahrenheit/.test(normalized)) {
            return {
                agentContext: 'Weather assistant that returns concise summaries and structured weather details.',
                testPrompt:
                    'Get current weather for Seattle in Imperial units and return both a short summary and structured JSON.',
                expectedOutputKeywords: ['seattle', 'temperature', 'humidity', 'wind', 'json'],
            };
        }

        if (/support|ticket|incident|escalation|customer/.test(normalized)) {
            return {
                agentContext: 'Support operations agent that summarizes customer issues and escalation signals.',
                testPrompt:
                    'Summarize two urgent customer support issues, highlight escalation risk, and return a concise structured report.',
                expectedOutputKeywords: ['summary', 'escalation', 'risk', 'issue'],
            };
        }

        if (/csv|analysis|report|dataset|visualization|statistics/.test(normalized)) {
            return {
                agentContext: 'Data analysis agent that validates inputs and returns concise analytical results.',
                testPrompt:
                    'Analyze a sample CSV dataset, summarize key findings, and provide a structured results section.',
                expectedOutputKeywords: ['summary', 'analysis', 'findings', 'data'],
            };
        }

        return {
            agentContext: 'General-purpose workflow agent that should return a concise, structured result.',
            testPrompt: 'Process the provided input and return a concise summary plus any structured output you support.',
            expectedOutputKeywords: ['summary', 'result'],
        };
    }

    localAnalyzeAgent(systemPrompt, visibleNodeLabels) {
        const scenario = this.inferScenario(`${systemPrompt} ${visibleNodeLabels.join(' ')}`);

        return {
            agentContext: scenario.agentContext,
            testPrompt: scenario.testPrompt,
            expectedOutputKeywords: scenario.expectedOutputKeywords,
        };
    }

    localValidateAgentResponse(analysis, responseText) {
        const normalizedResponse = normalizeText(responseText);
        const lowerResponse = normalizedResponse.toLowerCase();
        const keywordMatches = analysis.expectedOutputKeywords.filter((keyword) =>
            lowerResponse.includes(String(keyword).toLowerCase())
        );
        const hasStructuredOutput =
            /[{[]/.test(normalizedResponse) || /json|summary|temperature|humidity|analysis|risk/.test(lowerResponse);

        let score = 0;
        if (normalizedResponse.length >= 80) {
            score += 0.55;
        } else if (normalizedResponse.length >= 20) {
            score += 0.35;
        }

        score += Math.min(keywordMatches.length * 0.1, 0.3);

        if (hasStructuredOutput) {
            score += 0.1;
        }

        score = Math.min(score, 0.95);

        const valid = score >= 0.75;

        return {
            valid,
            score,
            reason: valid
                ? `Local heuristic accepted the response with ${keywordMatches.length} expected keyword matches.`
                : `Local heuristic found the response too weak or incomplete with only ${keywordMatches.length} keyword matches.`,
            missingElements: valid
                ? []
                : analysis.expectedOutputKeywords.filter(
                      (keyword) => !lowerResponse.includes(String(keyword).toLowerCase())
                  ),
            suggestedRefinement: valid
                ? ''
                : 'Clarify the required output fields, structured response format, and error handling expectations.',
        };
    }

    localImproveSystemPrompt(currentSystemPrompt, validatorOutput) {
        const refinements = [
            currentSystemPrompt,
            'Refinement requirements:',
            'Return a concise user-facing summary plus structured output when applicable.',
            'Include required fields consistently and use null for unavailable values instead of omitting them.',
        ];

        if (validatorOutput?.suggestedRefinement) {
            refinements.push(validatorOutput.suggestedRefinement);
        } else if (validatorOutput?.reason) {
            refinements.push(validatorOutput.reason);
        }

        return refinements.join('\n\n');
    }

    async jsonCompletion(systemPrompt, userPrompt, outputKey) {
        let lastError;

        for (const model of this.getModelCandidates()) {
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify({
                        model,
                        temperature: 0.2,
                        response_format: { type: 'json_object' },
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt },
                        ],
                    }),
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    const modelError = new Error(
                        `OpenAI chat completion failed for model "${model}" (${response.status}): ${errorBody}`
                    );

                    if (this.shouldTryNextModel(response.status, errorBody)) {
                        lastError = modelError;
                        break;
                    }

                    throw modelError;
                }

                const payload = await response.json();
                const content = payload?.choices?.[0]?.message?.content;
                if (!content) {
                    throw new Error('OpenAI returned an empty completion payload.');
                }

                try {
                    const parsed = JSON.parse(stripCodeFences(content));
                    if (!(outputKey in parsed)) {
                        throw new Error(`Missing required key "${outputKey}".`);
                    }

                    this.activeModel = model;
                    return parsed;
                } catch (error) {
                    lastError = new Error(
                        `OpenAI returned malformed JSON for model "${model}" after attempt ${attempt}: ${error.message}`
                    );

                    if (attempt === 3) {
                        break;
                    }
                }
            }
        }

        throw lastError || new Error('OpenAI completion failed for all configured model candidates.');
    }

    async analyzeAgent(systemPrompt, visibleNodeLabels) {
        try {
            const result = await this.jsonCompletion(
                [
                    'You analyze an existing agent for automated QA.',
                    'Return only valid JSON with keys: agentContext, testPrompt, expectedOutputKeywords.',
                    'agentContext must be concise.',
                    'testPrompt must be a realistic user request that exercises the system prompt.',
                    'expectedOutputKeywords must be an array of 3 to 10 short strings.',
                ].join(' '),
                JSON.stringify({
                    systemPrompt,
                    visibleNodeLabels,
                }),
                'agentContext'
            );

            return {
                agentContext: normalizeText(result.agentContext),
                testPrompt: normalizeText(result.testPrompt),
                expectedOutputKeywords: Array.isArray(result.expectedOutputKeywords)
                    ? result.expectedOutputKeywords.map(normalizeText).filter(Boolean)
                    : String(result.expectedOutputKeywords || '')
                          .split(',')
                          .map(normalizeText)
                          .filter(Boolean),
            };
        } catch (error) {
            if (!this.shouldUseLocalFallback(error)) {
                throw error;
            }

            this.logFallback(error.message);
            return this.localAnalyzeAgent(systemPrompt, visibleNodeLabels);
        }
    }

    async validateAgentResponse(analysis, systemPrompt, responseText) {
        try {
            const result = await this.jsonCompletion(
                [
                    'You validate whether an agent response satisfies the intended behavior.',
                    'Return only valid JSON with keys: valid, score, reason, missingElements, suggestedRefinement.',
                    'valid must be boolean.',
                    'score must be a number from 0 to 1.',
                    'reason must be a concise explanation.',
                    'missingElements must be an array of strings.',
                    'suggestedRefinement must be a short actionable refinement instruction.',
                ].join(' '),
                JSON.stringify({
                    agentContext: analysis.agentContext,
                    expectedOutputKeywords: analysis.expectedOutputKeywords,
                    testPrompt: analysis.testPrompt,
                    systemPrompt,
                    actualResponse: responseText,
                }),
                'valid'
            );

            return {
                valid: Boolean(result.valid),
                score: Number(result.score) || 0,
                reason: normalizeText(result.reason),
                missingElements: Array.isArray(result.missingElements)
                    ? result.missingElements.map(normalizeText).filter(Boolean)
                    : String(result.missingElements || '')
                          .split(',')
                          .map(normalizeText)
                          .filter(Boolean),
                suggestedRefinement: normalizeText(result.suggestedRefinement),
            };
        } catch (error) {
            if (!this.shouldUseLocalFallback(error)) {
                throw error;
            }

            this.logFallback(error.message);
            return this.localValidateAgentResponse(analysis, responseText);
        }
    }

    async improveSystemPrompt(currentSystemPrompt, analysis, validatorOutput, responseText) {
        try {
            const result = await this.jsonCompletion(
                [
                    'You rewrite system prompts for agent refinement.',
                    'Return only valid JSON with the single key improvedSystemPrompt.',
                    'Produce a complete replacement prompt, not a diff.',
                    'Preserve the intent of the agent while addressing the validation failures.',
                ].join(' '),
                JSON.stringify({
                    currentSystemPrompt,
                    agentContext: analysis.agentContext,
                    testPrompt: analysis.testPrompt,
                    expectedOutputKeywords: analysis.expectedOutputKeywords,
                    validatorOutput,
                    actualResponse: responseText,
                }),
                'improvedSystemPrompt'
            );

            return normalizeText(result.improvedSystemPrompt);
        } catch (error) {
            if (!this.shouldUseLocalFallback(error)) {
                throw error;
            }

            this.logFallback(error.message);
            return this.localImproveSystemPrompt(currentSystemPrompt, validatorOutput);
        }
    }
}

module.exports = { OpenAIRefinementClient };
