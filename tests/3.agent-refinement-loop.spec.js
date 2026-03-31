'use strict';

const { test, expect } = require('../fixtures/refinement');
const { parsePositiveInteger, truncate } = require('../utils/refinement');

const DEFAULT_MAX_CYCLES = 5;
const DEFAULT_MAX_PLAYGROUND_TURNS = 8;

test.describe.serial('Agent Refinement Loop', () => {
    let maxCycles;
    let maxPlaygroundTurns;
    let report;
    let systemPrompt = '';
    let nodeLabels = [];
    let analysis;
    let latestCycleResult;
    let initialCycleRecord;

    test.beforeAll(async () => {
        maxCycles = parsePositiveInteger(process.env.MAX_CYCLES, DEFAULT_MAX_CYCLES);
        maxPlaygroundTurns = parsePositiveInteger(
            process.env.MAX_PLAYGROUND_TURNS,
            DEFAULT_MAX_PLAYGROUND_TURNS
        );
        report = {
            totalCycles: 0,
            finalStatus: 'not_started',
            finalReason: '',
            finalOutputCompleted: false,
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

    test('TC-06: Generate the initial AI prompt and complete the first playground session', async ({
        agentRefinementPage,
        openAIRefinementClient,
    }) => {
        test.setTimeout(300000);
        analysis = await openAIRefinementClient.analyzeAgent(systemPrompt, nodeLabels);
        if (!analysis.testPrompt) {
            throw new Error('The analyzer did not produce a usable playground prompt.');
        }

        initialCycleRecord = {
            cycle: 1,
            generatedPrompt: analysis.testPrompt,
            transcriptExcerpt: '',
            timelineSnapshot: '',
            outputCompleted: false,
            appliedRefinement: '',
            status: 'in_progress',
            failureReason: '',
            systemPromptSaved: false,
            turnsUsed: 0,
        };

        latestCycleResult = await agentRefinementPage.runAiGuidedPlaygroundSession({
            initialPrompt: analysis.testPrompt,
            maxTurns: maxPlaygroundTurns,
            openAIRefinementClient,
            systemPrompt,
            agentContext: analysis.agentContext,
            visibleNodeLabels: nodeLabels,
        });

        initialCycleRecord.transcriptExcerpt = truncate(latestCycleResult.transcriptText, 600);
        initialCycleRecord.timelineSnapshot = truncate(latestCycleResult.timelineSummary, 600);
        initialCycleRecord.outputCompleted = latestCycleResult.outputCompleted;
        initialCycleRecord.status = latestCycleResult.outputCompleted ? 'passed' : 'needs_refinement';
        initialCycleRecord.failureReason = latestCycleResult.failureReason;
        initialCycleRecord.turnsUsed = latestCycleResult.turnCount;
    });

    test('TC-07: Record the first playground-cycle result', async () => {
        report.cycleHistory.push(initialCycleRecord);
        report.totalCycles = report.cycleHistory.length;
        report.finalOutputCompleted = initialCycleRecord.outputCompleted;
        report.finalReason =
            initialCycleRecord.failureReason ||
            (initialCycleRecord.outputCompleted
                ? 'The To-Do Timeline Output step completed successfully.'
                : 'The first playground session did not complete the Output step.');

        if (initialCycleRecord.outputCompleted) {
            report.finalStatus = 'passed';
        }
    });

    test('TC-08: Execute refinement cycles until the Output step completes', async ({
        agentRefinementPage,
        openAIRefinementClient,
    }) => {
        test.setTimeout(600000);

        if (report.finalStatus === 'passed') {
            return;
        }

        for (let cycle = 2; cycle <= maxCycles; cycle += 1) {
            const refinementReason =
                latestCycleResult?.failureReason ||
                'The Output step did not complete. Improve the workflow to finish the timeline successfully.';
            const refinementPayload = {
                reason: refinementReason,
                suggestedRefinement: refinementReason,
            };
            const improvedPrompt = await openAIRefinementClient.improveSystemPrompt(
                systemPrompt,
                analysis,
                refinementPayload,
                latestCycleResult?.transcriptText || latestCycleResult?.timelineSummary || refinementReason
            );

            if (!improvedPrompt) {
                throw new Error('The prompt improver did not return a replacement system prompt.');
            }

            const cycleRecord = {
                cycle,
                generatedPrompt: '',
                transcriptExcerpt: '',
                timelineSnapshot: '',
                outputCompleted: false,
                appliedRefinement: refinementReason,
                status: 'in_progress',
                failureReason: '',
                systemPromptSaved: false,
                turnsUsed: 0,
            };

            await agentRefinementPage.writeSystemPrompt(improvedPrompt);
            cycleRecord.systemPromptSaved = true;
            await agentRefinementPage.applyRefinement(refinementReason);
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

            cycleRecord.generatedPrompt = analysis.testPrompt;
            latestCycleResult = await agentRefinementPage.runAiGuidedPlaygroundSession({
                initialPrompt: analysis.testPrompt,
                maxTurns: maxPlaygroundTurns,
                openAIRefinementClient,
                systemPrompt,
                agentContext: analysis.agentContext,
                visibleNodeLabels: nodeLabels,
            });

            cycleRecord.transcriptExcerpt = truncate(latestCycleResult.transcriptText, 600);
            cycleRecord.timelineSnapshot = truncate(latestCycleResult.timelineSummary, 600);
            cycleRecord.outputCompleted = latestCycleResult.outputCompleted;
            cycleRecord.status = latestCycleResult.outputCompleted ? 'passed' : 'needs_refinement';
            cycleRecord.failureReason = latestCycleResult.failureReason;
            cycleRecord.turnsUsed = latestCycleResult.turnCount;

            report.cycleHistory.push(cycleRecord);
            report.totalCycles = report.cycleHistory.length;
            report.finalOutputCompleted = cycleRecord.outputCompleted;
            report.finalReason =
                cycleRecord.failureReason ||
                (cycleRecord.outputCompleted
                    ? 'The To-Do Timeline Output step completed successfully.'
                    : 'The refinement cycle ended before the Output step completed.');

            if (cycleRecord.outputCompleted) {
                report.finalStatus = 'passed';
                return;
            }
        }

        report.finalStatus = 'failed';
    });

    test('TC-09: Print the final JSON report and assert the Output step outcome', async () => {
        report.totalCycles = report.cycleHistory.length;

        if (report.finalStatus !== 'passed' || !report.finalOutputCompleted) {
            throw new Error(
                `Refinement loop did not complete the To-Do Timeline Output step after ${report.totalCycles} cycles: ${report.finalReason}`
            );
        }

        expect(report.finalStatus).toBe('passed');
        expect(report.finalOutputCompleted).toBe(true);
    });
});
