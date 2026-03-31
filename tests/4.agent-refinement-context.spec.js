'use strict';

const { test, expect } = require('../fixtures/refinement');
const { parsePositiveInteger } = require('../utils/refinement');
const { writeRefinementSessionArtifacts } = require('../utils/refinementArtifacts');

const DEFAULT_MAX_PLAYGROUND_TURNS = 8;

test.describe('Agent Refinement Context Flow', () => {
    test('TC-01: Run a single context-aware refinement cycle and verify the updated agent', async ({
        authenticatedPage,
        authenticatedLoginPage,
        dashboardPage,
        flowsPage,
        agentRefinementPage,
        openAIRefinementClient,
    }, testInfo) => {
        test.setTimeout(900000);

        const maxPlaygroundTurns = parsePositiveInteger(
            process.env.MAX_PLAYGROUND_TURNS,
            DEFAULT_MAX_PLAYGROUND_TURNS
        );
        const sessionRecord = {
            finalStatus: 'in_progress',
            failureReason: '',
            maxPlaygroundTurns,
            selectedFlowLabel: '',
            selectedFlowRecencyOffset: -1,
            artifacts: {
                beforeCanvasScreenshot: '',
                afterCanvasScreenshot: '',
            },
            initial: {
                systemPrompt: '',
                nodeLabels: [],
                analysis: null,
                playground: null,
            },
            refinement: {
                improvedSystemPrompt: '',
                widgetPrompt: '',
                result: null,
            },
            refined: {
                systemPrompt: '',
                nodeLabels: [],
                analysis: null,
                playground: null,
                canvasChange: null,
            },
        };

        try {
            await expect(authenticatedPage).not.toHaveURL(/.*\/login/);
            await authenticatedLoginPage.assertLoginSuccess(30000);

            const selectedFlow = await agentRefinementPage.openLatestPlaygroundCapableFlow({
                dashboardPage,
                flowsPage,
            });
            sessionRecord.selectedFlowLabel = selectedFlow.flowLabel;
            sessionRecord.selectedFlowRecencyOffset = selectedFlow.recencyOffset;

            await agentRefinementPage.connectAllVisibleNodes();
            await agentRefinementPage.runEachNode();
            await agentRefinementPage.runGlobalHeader();

            const initialSystemPrompt = await agentRefinementPage.readSystemPrompt();
            if (!initialSystemPrompt) {
                throw new Error('The initial Agent system prompt is empty or could not be read.');
            }

            const initialNodeLabels =
                selectedFlow.nodeLabels?.length > 0
                    ? selectedFlow.nodeLabels
                    : await agentRefinementPage.collectVisibleNodeLabels();
            if (initialNodeLabels.length === 0) {
                throw new Error('No visible node labels were found before refinement.');
            }

            sessionRecord.initial.systemPrompt = initialSystemPrompt;
            sessionRecord.initial.nodeLabels = initialNodeLabels;

            const initialAnalysis = await openAIRefinementClient.analyzeAgent(
                initialSystemPrompt,
                initialNodeLabels
            );
            if (!initialAnalysis.testPrompt) {
                throw new Error('The analyzer did not produce an initial playground prompt.');
            }
            sessionRecord.initial.analysis = initialAnalysis;

            const initialPlayground = await agentRefinementPage.runAiGuidedPlaygroundSession({
                initialPrompt: initialAnalysis.testPrompt,
                maxTurns: maxPlaygroundTurns,
                openAIRefinementClient,
                systemPrompt: initialSystemPrompt,
                agentContext: initialAnalysis.agentContext,
                visibleNodeLabels: initialNodeLabels,
            });
            sessionRecord.initial.playground = initialPlayground;

            const beforeCanvasScreenshot = testInfo.outputPath('canvas-before-refinement.png');
            sessionRecord.artifacts.beforeCanvasScreenshot =
                await agentRefinementPage.captureCanvasScreenshot(beforeCanvasScreenshot);
            await testInfo.attach('canvas-before-refinement', {
                path: beforeCanvasScreenshot,
                contentType: 'image/png',
            });

            if (initialPlayground.outputCompleted) {
                sessionRecord.finalStatus = 'passed';
                return;
            }

            await agentRefinementPage.closePlaygroundWidget();

            const refinementReason =
                initialPlayground.failureReason ||
                'Improve the workflow so the To-Do Timeline Output step completes reliably.';
            const refinementPayload = {
                reason: refinementReason,
                suggestedRefinement: refinementReason,
            };
            const improvedSystemPrompt = await openAIRefinementClient.improveSystemPrompt(
                initialSystemPrompt,
                initialAnalysis,
                refinementPayload,
                initialPlayground.transcriptText || initialPlayground.timelineSummary || refinementReason
            );
            if (!improvedSystemPrompt) {
                throw new Error('The prompt improver did not return a refined system prompt.');
            }
            sessionRecord.refinement.improvedSystemPrompt = improvedSystemPrompt;
            sessionRecord.refinement.widgetPrompt = refinementReason;

            await agentRefinementPage.writeSystemPrompt(improvedSystemPrompt);
            const refinementResult = await agentRefinementPage.applyRefinement(refinementReason);
            sessionRecord.refinement.result = refinementResult;
            expect(refinementResult.completed).toBe(true);
            expect(refinementResult.statusVisible).toBe(true);

            await agentRefinementPage.connectAllVisibleNodes();
            await agentRefinementPage.runEachNode();
            await agentRefinementPage.runGlobalHeader();

            const refinedSystemPrompt = await agentRefinementPage.readSystemPrompt();
            if (!refinedSystemPrompt) {
                throw new Error('The refined Agent system prompt is empty or could not be read.');
            }

            const refinedNodeLabels = await agentRefinementPage.collectVisibleNodeLabels();
            if (refinedNodeLabels.length === 0) {
                throw new Error('No visible node labels were found after refinement.');
            }

            sessionRecord.refined.systemPrompt = refinedSystemPrompt;
            sessionRecord.refined.nodeLabels = refinedNodeLabels;
            sessionRecord.refined.canvasChange = agentRefinementPage.hasCanvasChanged(
                initialSystemPrompt,
                refinedSystemPrompt,
                initialNodeLabels,
                refinedNodeLabels
            );

            const afterCanvasScreenshot = testInfo.outputPath('canvas-after-refinement.png');
            sessionRecord.artifacts.afterCanvasScreenshot =
                await agentRefinementPage.captureCanvasScreenshot(afterCanvasScreenshot);
            await testInfo.attach('canvas-after-refinement', {
                path: afterCanvasScreenshot,
                contentType: 'image/png',
            });

            expect(sessionRecord.refined.canvasChange.changed).toBe(true);

            const refinedAnalysis = await openAIRefinementClient.analyzeAgent(
                refinedSystemPrompt,
                refinedNodeLabels,
                {
                    priorAnalysis: initialAnalysis,
                    priorTestPrompt: initialAnalysis.testPrompt,
                    priorAgentContext: initialAnalysis.agentContext,
                    priorTranscript: initialPlayground.messages,
                }
            );
            if (!refinedAnalysis.testPrompt) {
                throw new Error('The analyzer did not produce a post-refinement playground prompt.');
            }
            sessionRecord.refined.analysis = refinedAnalysis;

            const refinedPlayground = await agentRefinementPage.runAiGuidedPlaygroundSession({
                initialPrompt: refinedAnalysis.testPrompt,
                maxTurns: maxPlaygroundTurns,
                openAIRefinementClient,
                systemPrompt: refinedSystemPrompt,
                agentContext: refinedAnalysis.agentContext,
                visibleNodeLabels: refinedNodeLabels,
            });
            sessionRecord.refined.playground = refinedPlayground;

            expect(refinedPlayground.outputCompleted).toBe(true);
            expect(refinedPlayground.finalAssistantResponse || refinedPlayground.transcriptText).toBeTruthy();

            sessionRecord.finalStatus = 'passed';
        } catch (error) {
            sessionRecord.finalStatus = 'failed';
            sessionRecord.failureReason = error.message;
            throw error;
        } finally {
            let artifactPaths = {};
            try {
                artifactPaths = await writeRefinementSessionArtifacts(testInfo, sessionRecord);
            } catch (artifactError) {
                console.error(`[refinement-artifacts] ${artifactError.message || artifactError}`);
            }

            console.log(
                JSON.stringify(
                    {
                        finalStatus: sessionRecord.finalStatus,
                        failureReason: sessionRecord.failureReason,
                        initialOutputCompleted: Boolean(sessionRecord.initial.playground?.outputCompleted),
                        refinedOutputCompleted: Boolean(sessionRecord.refined.playground?.outputCompleted),
                        artifacts: {
                            ...sessionRecord.artifacts,
                            ...artifactPaths,
                        },
                    },
                    null,
                    2
                )
            );
        }
    });
});
