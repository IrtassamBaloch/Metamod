'use strict';

const { test, expect } = require('../fixtures/refinement');
const { parsePositiveInteger, truncate } = require('../utils/refinement');

const DEFAULT_MAX_CYCLES = 5;

test.describe.serial('Agent Refinement Loop', () => {
    let maxCycles;
    let report;
    let systemPrompt = '';
    let nodeLabels = [];
    let analysis;
    let responseText = '';
    let validatorOutput;
    let initialCycleRecord;

    test.beforeAll(async () => {
        maxCycles = parsePositiveInteger(process.env.MAX_CYCLES, DEFAULT_MAX_CYCLES);
        report = {
            totalCycles: 0,
            finalStatus: 'not_started',
            finalScore: 0,
            finalReason: '',
            cycleHistory: [],
        };
    });

    test.afterAll(async () => {
        console.log(JSON.stringify(report, null, 2));
    });

    test('TC-01: Shared authenticated refinement session is ready', async ({
        authenticatedPage,
        authenticatedLoginPage,
    }) => {
        await expect(authenticatedPage).not.toHaveURL(/.*\/login/);
        await authenticatedLoginPage.assertLoginSuccess(30000);
    });

    test('TC-02: Open the latest existing flow and verify canvas readiness', async ({
        dashboardPage,
        flowsPage,
        agentRefinementPage,
    }) => {
        test.setTimeout(240000);
        await dashboardPage.skipPopup();
        await dashboardPage.navigateToFlows();
        await flowsPage.openLatestFlow();
        await agentRefinementPage.waitForCanvasReady(60000);
        await dashboardPage.skipPopup();
    });

    test('TC-03: Connect any unresolved nodes', async ({ agentRefinementPage }) => {
        await agentRefinementPage.connectAllVisibleNodes();
    });

    test('TC-04: Run node cards and trigger the global header run', async ({
        agentRefinementPage,
    }) => {
        test.setTimeout(240000);
        await agentRefinementPage.runEachNode();
        await agentRefinementPage.runGlobalHeader();
    });

    test('TC-05: Read the current system prompt and visible node labels', async ({
        dashboardPage,
        agentRefinementPage,
    }) => {
        await dashboardPage.skipPopup();
        systemPrompt = await agentRefinementPage.readSystemPrompt();
        if (!systemPrompt) {
            throw new Error('The Agent system prompt is empty or could not be read.');
        }

        nodeLabels = await agentRefinementPage.collectVisibleNodeLabels();
        if (nodeLabels.length === 0) {
            throw new Error('No visible node labels were found on the canvas.');
        }
    });

    test('TC-06: Generate the AI test prompt and send it through the playground', async ({
        agentRefinementPage,
        openAIRefinementClient,
    }) => {
        test.setTimeout(240000);
        analysis = await openAIRefinementClient.analyzeAgent(systemPrompt, nodeLabels);
        if (!analysis.testPrompt) {
            throw new Error('The analyzer did not produce a usable playground prompt.');
        }

        initialCycleRecord = {
            cycle: 1,
            generatedTestPrompt: analysis.testPrompt,
            responseExcerpt: '',
            validatorOutput: null,
            appliedRefinement: '',
            systemPromptSaved: false,
        };

        responseText = await agentRefinementPage.sendPromptToPlayground(analysis.testPrompt);
        initialCycleRecord.responseExcerpt = truncate(responseText);
    });

    test('TC-07: Validate the response and record the initial cycle result', async ({
        openAIRefinementClient,
    }) => {
        validatorOutput = await openAIRefinementClient.validateAgentResponse(
            analysis,
            systemPrompt,
            responseText
        );

        initialCycleRecord.validatorOutput = validatorOutput;
        report.cycleHistory.push(initialCycleRecord);
        report.totalCycles = report.cycleHistory.length;
        report.finalScore = validatorOutput.score;
        report.finalReason = validatorOutput.reason;

        if (validatorOutput.valid && validatorOutput.score >= 0.75) {
            report.finalStatus = 'passed';
        }
    });

    test('TC-08: Execute the refinement loop if the initial validation failed', async ({
        agentRefinementPage,
        openAIRefinementClient,
    }) => {
        test.setTimeout(300000);

        if (report.finalStatus === 'passed') {
            return;
        }

        for (let cycle = 2; cycle <= maxCycles; cycle += 1) {
            const improvedPrompt = await openAIRefinementClient.improveSystemPrompt(
                systemPrompt,
                analysis,
                validatorOutput,
                responseText
            );

            if (!improvedPrompt) {
                throw new Error('The prompt improver did not return a replacement system prompt.');
            }

            const refinementText =
                validatorOutput.suggestedRefinement ||
                validatorOutput.reason ||
                'Improve the flow based on the failed validation.';

            const cycleRecord = {
                cycle,
                generatedTestPrompt: '',
                responseExcerpt: '',
                validatorOutput: null,
                appliedRefinement: refinementText,
                systemPromptSaved: false,
            };

            await agentRefinementPage.writeSystemPrompt(improvedPrompt);
            cycleRecord.systemPromptSaved = true;
            await agentRefinementPage.applyRefinement(refinementText);
            await agentRefinementPage.connectAllVisibleNodes();
            await agentRefinementPage.runEachNode();
            await agentRefinementPage.runGlobalHeader();

            systemPrompt = await agentRefinementPage.readSystemPrompt();
            if (!systemPrompt) {
                throw new Error('The refined system prompt is empty or could not be read.');
            }

            nodeLabels = await agentRefinementPage.collectVisibleNodeLabels();
            if (nodeLabels.length === 0) {
                throw new Error('No visible node labels were found after refinement.');
            }

            analysis = await openAIRefinementClient.analyzeAgent(systemPrompt, nodeLabels);
            if (!analysis.testPrompt) {
                throw new Error('The analyzer did not produce a usable prompt after refinement.');
            }

            cycleRecord.generatedTestPrompt = analysis.testPrompt;
            responseText = await agentRefinementPage.sendPromptToPlayground(analysis.testPrompt);
            cycleRecord.responseExcerpt = truncate(responseText);

            validatorOutput = await openAIRefinementClient.validateAgentResponse(
                analysis,
                systemPrompt,
                responseText
            );

            cycleRecord.validatorOutput = validatorOutput;
            report.cycleHistory.push(cycleRecord);
            report.totalCycles = report.cycleHistory.length;
            report.finalScore = validatorOutput.score;
            report.finalReason = validatorOutput.reason;

            if (validatorOutput.valid && validatorOutput.score >= 0.75) {
                report.finalStatus = 'passed';
                return;
            }
        }

        report.finalStatus = 'failed';
    });

    test('TC-09: Print the final JSON report and assert the refinement outcome', async () => {
        report.totalCycles = report.cycleHistory.length;

        if (report.finalStatus !== 'passed') {
            throw new Error(
                `Refinement loop did not reach acceptance after ${report.totalCycles} cycles: ${report.finalReason}`
            );
        }

        expect(report.finalStatus).toBe('passed');
        expect(report.finalScore).toBeGreaterThanOrEqual(0.75);
    });
});
