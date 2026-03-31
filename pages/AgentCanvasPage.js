/**
 * AgentCanvasPage.js
 * Page Object Model for the Metamod Agent Canvas page.
 */

'use strict';

const { expect } = require('@playwright/test');
const { BaseCanvasPage } = require('./BaseCanvasPage');

class AgentCanvasPage extends BaseCanvasPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        super(page);
    }

    get doneButton() {
        return this.page.getByRole('button', { name: /^Done(?: \(\d+ steps\))?$/ }).first();
    }

    get completedStepsButton() {
        return this.page.getByRole('button', { name: /^Completed \d+ steps$/ }).first();
    }

    get buildCompletedMessage() {
        return this.page.getByText(/Done\s+[—-]\s+the .* agent is built\./i).first();
    }

    get canvasArea() {
        return this.page.getByRole('application').first();
    }

    get flowDescriptionInput() {
        return this.page.getByRole('textbox', { name: 'Flow description input' }).first();
    }

    get refineLabel() {
        return this.page.getByText('Refine').first();
    }

    get viewDraftButton() {
        return this.page.getByRole('button', { name: 'View Draft' }).first();
    }

    get logsButton() {
        return this.page.getByRole('button', { name: 'Logs' }).first();
    }

    get stopResponseButton() {
        return this.page.getByRole('button', { name: 'Stop response' }).first();
    }

    get processStatus() {
        return this.page.getByRole('status').first();
    }

    get chatInputNode() {
        return this.page.locator('[data-testid^="ChatInput-"][data-testid$="-main-node"]').first();
    }

    get chatInputLabel() {
        return this.canvasArea.getByText('Chat Input').first();
    }

    get chatInputTextarea() {
        return this.page.getByTestId('textarea_str_input_value').first();
    }

    get flowSuccessMessage() {
        return this.page.getByText(/Flow built successfully/).first();
    }

    /** Skip the tutorial overlay if it appears. */
    async skipTutorial() {
        if (await this.dismissWalkthroughIfPresent().catch(() => false)) {
            return;
        }

        const skipBtn = this.page.getByRole('button', { name: 'Skip' });
        const isVisible = await this.isVisible(skipBtn);
        if (isVisible) {
            await this.clickLocatorReliably(skipBtn);
        }
    }

    async skipPostPromptPopupIfPresent() {
        const skipButton = this.page.getByRole('button', { name: 'Skip' });
        if (await this.isVisible(skipButton)) {
            await this.clickLocatorReliably(skipButton);
        }
    }

    /** Assert that the current build shell has rendered and is ready for refinement. */
    async assertAgentCreatedOnCanvas() {
        await this.skipTutorial();
        await expect(this.flowDescriptionInput).toBeVisible({ timeout: 30000 });
        await expect(this.refineLabel).toBeVisible({ timeout: 30000 });
    }

    /** Assert that the sidebar shows the running process, Refine label, and View Draft button. */
    async assertSidebarProcessRunning() {
        await this.skipTutorial();
        await expect(this.refineLabel).toBeVisible({ timeout: 30000 });
        await expect(this.viewDraftButton).toBeVisible({ timeout: 30000 });
        await this.waitForAnyVisible(
            [this.processStatus, this.stopResponseButton, this.doneButton],
            120000,
            'The refine/build process did not expose a running or completed state indicator in time.'
        );
    }

    /** Assert that the canvas toolbar is visible on the generated agent page. */
    async assertCanvasToolsVisible() {
        await this.waitForAnyVisible(
            [this.logsButton, this.canvasArea, this.doneButton],
            180000,
            'The canvas workbench did not become visible in time.'
        );
    }

    /** Assert the Metamod logo mark is visible on the canvas page. */
    async assertMetamodLogoVisible() {
        await expect(this.page.getByRole('button', { name: 'Metamod logo' })).toBeVisible({
            timeout: 30000,
        });
    }

    /** Wait until the refine builder is ready to finalize. */
    async waitForRefineDoneButton() {
        await this.skipTutorial();
        await this.waitForAnyVisible(
            [
                this.doneButton,
                this.completedStepsButton,
                this.buildCompletedMessage,
                this.chatInputNode,
                this.chatInputLabel,
            ],
            180000,
            'The refine builder never reached a completed state.'
        );
    }

    /** Click Done once the refine builder has finished its steps. */
    async finishRefineBuild() {
        await this.waitForRefineDoneButton();

        if (await this.isVisible(this.doneButton)) {
            await this.clickLocatorReliably(this.doneButton);
        }

        await this.waitForChatInputNode();
    }

    /** Wait until the first Chat Input node is available on the canvas. */
    async waitForChatInputNode() {
        const nodeVisible = await this.isVisible(this.chatInputNode);
        if (nodeVisible) {
            await expect(this.chatInputNode).toBeVisible({ timeout: 60000 });
            return;
        }

        await expect(this.chatInputLabel).toBeVisible({ timeout: 60000 });
    }

    /** Open the first Chat Input node on the canvas. */
    async openFirstChatInputNode() {
        await this.skipTutorial();
        await this.waitForChatInputNode();

        const nodeVisible = await this.isVisible(this.chatInputNode);
        if (!nodeVisible) {
            await this.clickLocatorReliably(this.chatInputLabel);
            return;
        }

        await expect(this.chatInputNode).toContainText('Chat Input');

        const nodeCard = this.chatInputNode.getByTestId('div-generic-node').first();
        const cardVisible = await this.isVisible(nodeCard);
        if (cardVisible) {
            await this.clickLocatorReliably(nodeCard);
        } else {
            await this.clickLocatorReliably(this.chatInputNode);
        }
    }

    /** Assert the opened node is the Chat Input card. */
    async assertChatInputCardOpened() {
        const nodeVisible = await this.isVisible(this.chatInputNode);
        if (nodeVisible) {
            await expect(this.chatInputNode).toContainText('Chat Input');
        } else {
            await expect(this.chatInputLabel).toBeVisible({ timeout: 30000 });
        }
        await expect(this.chatInputTextarea).toBeVisible({ timeout: 30000 });
    }

    /**
     * Fill the Chat Input card with a runnable prompt.
     * @param {string} promptText
     */
    async fillChatInput(promptText) {
        await expect(this.chatInputTextarea).toBeVisible({ timeout: 30000 });
        await this.chatInputTextarea.click();
        await this.chatInputTextarea.press('ControlOrMeta+a');
        await this.chatInputTextarea.fill(promptText);
    }

    /** Run the flow from the Chat Input node. */
    async runFlowFromChatInput() {
        const runButton = this.chatInputNode.locator('button:not([disabled])').first();
        await expect(runButton).toBeVisible({ timeout: 30000 });
        await this.clickLocatorReliably(runButton);
    }

    /** Assert the flow run completed successfully. */
    async assertFlowRunSuccessful() {
        await expect(this.flowSuccessMessage).toBeVisible({ timeout: 60000 });
    }
}

module.exports = { AgentCanvasPage };
