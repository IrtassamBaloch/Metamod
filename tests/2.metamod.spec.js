/**
 * metamod.spec.js
 * End-to-end test suite: Metamod Agent Creation Flow (13 test cases).
 *
 * Uses test.describe.serial — all tests share a single browser session.
 * Page objects live in /pages/ per skill.md project structure.
 *
 * Run: npx playwright test tests/metamod.spec.js
 */

const { test, expect } = require('../fixtures/auth');
const FLOW_RUN_QUERY = 'What is the weather in Islamabad today?';

test.describe.serial('Metamod Agent Creation Flow', () => {
    // ─────────────────────────────────────────────────────────────────────────
    // TC-01: Shared authenticated session is ready
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-01: Shared authenticated session is ready', async ({
        authenticatedPage,
        authenticatedLoginPage,
    }) => {
        await expect(authenticatedPage).not.toHaveURL(/.*\/login/);
        await authenticatedLoginPage.assertLoginSuccess(30000);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-02: Skip popup and verify navigation menu
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-02: Skip popup and verify navigation menu', async ({ dashboardPage }) => {
        await dashboardPage.openHome();
        await dashboardPage.skipPopup();
        await dashboardPage.assertNavigation();
        await dashboardPage.assertChatInputVisible();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-03: Navigate to Flows and click New Agent
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-03: Navigate to Flows and click New Agent', async ({
        dashboardPage,
        chatPage,
    }) => {
        await dashboardPage.navigateToFlows();
        await dashboardPage.clickNewAgentButton();
        await chatPage.assertPromptComposerVisible();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-04: Submit weather agent prompt
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-04: Submit weather agent prompt', async ({ chatPage }) => {
        await chatPage.submitPromptAndWaitForQuickQuestion(
            'Create an agent that returns current weather information of provided city.'
        );
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-05: Complete all question rounds by selecting random options until "Use This Prompt" is visible
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-05: Complete all question rounds by selecting random options until "Use This Prompt" is visible', async ({
        chatPage,
    }) => {
        await chatPage.completeAllQuestionRounds(10);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-06: Assert enhanced prompt and use it
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-06: Assert enhanced prompt and use it', async ({ chatPage }) => {
        await chatPage.assertEnhancedPromptVisible();
        await chatPage.useThisPrompt();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-07: Skip any post-prompt popup
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-07: Skip any post-prompt popup', async ({ agentCanvasPage }) => {
        await agentCanvasPage.skipPostPromptPopupIfPresent();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-08: Verify agent created on canvas and sidebar shows process
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-08: Verify agent created on canvas and sidebar shows process', async ({
        agentCanvasPage,
    }) => {
        test.setTimeout(240000);
        await agentCanvasPage.assertAgentCreatedOnCanvas();
        await agentCanvasPage.assertSidebarProcessRunning();
        await agentCanvasPage.assertCanvasToolsVisible();
        await agentCanvasPage.assertMetamodLogoVisible();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-09: Wait for refine build completion and click Done
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-09: Wait for refine build completion and click Done', async ({ agentCanvasPage }) => {
        test.setTimeout(240000);
        await agentCanvasPage.waitForRefineDoneButton();
        await agentCanvasPage.finishRefineBuild();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-10: Open the first canvas agent and verify it is Chat Input
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-10: Open the first canvas agent and verify it is Chat Input', async ({
        agentCanvasPage,
    }) => {
        await agentCanvasPage.openFirstChatInputNode();
        await agentCanvasPage.assertChatInputCardOpened();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-11: Enter a weather query in the Chat Input card
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-11: Enter a weather query in the Chat Input card', async ({ agentCanvasPage }) => {
        await agentCanvasPage.fillChatInput(FLOW_RUN_QUERY);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-12: Run the flow from the Chat Input card
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-12: Run the flow from the Chat Input card', async ({ agentCanvasPage }) => {
        await agentCanvasPage.runFlowFromChatInput();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TC-13: Verify the flow run completed successfully
    // ─────────────────────────────────────────────────────────────────────────
    test('TC-13: Verify the flow run completed successfully', async ({ agentCanvasPage }) => {
        await agentCanvasPage.assertFlowRunSuccessful();
    });
});
