/**
 * ChatPage.js
 * Page Object Model for the Metamod Chat / Agent-creation prompt page.
 */

'use strict';

const { expect } = require('@playwright/test');

class ChatPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    /**
     * Fill the prompt input and click Submit.
     * @param {string} promptText
     */
    async fillAndSubmitPrompt(promptText) {
        const input = this.page.getByRole('textbox', { name: 'Create an agent that can...' });
        await input.fill(promptText);
        // The UI hint says "Press Enter to send" — more reliable than clicking the animated button
        await input.press('Enter');
    }

    /**
     * Submit a prompt and wait until the required quick-question screen is visible.
     * @param {string} promptText
     * @param {{ responseStartTimeout?: number, quickQuestionTimeout?: number }} [options]
     */
    async submitPromptAndWaitForQuickQuestion(
        promptText,
        { responseStartTimeout = 15000, quickQuestionTimeout = 90000 } = {}
    ) {
        await this.fillAndSubmitPrompt(promptText);
        await this.waitForResponseToStartOrAdvance(responseStartTimeout);
        await this.waitForQuickQuestionScreen({ timeout: quickQuestionTimeout });
    }

    /**
     * Wait for Metamod to acknowledge the prompt by either showing a response indicator
     * or reaching a terminal UI state faster than the indicator becomes visible.
     * @param {number} timeout
     */
    async waitForResponseToStartOrAdvance(timeout = 15000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            if (
                (await this.isResponseInProgress()) ||
                (await this.isVisible(this.questionHeader)) ||
                (await this.isEnhancedPromptReady())
            ) {
                return;
            }

            await this.page.waitForTimeout(250);
        }

        throw new Error(
            `Metamod never acknowledged the prompt submission within ${timeout} ms.`
        );
    }

    /**
     * Wait until the required quick-question screen appears or fail with a targeted diagnosis.
     * @param {{ timeout?: number }} [options]
     */
    async waitForQuickQuestionScreen({ timeout = 90000 } = {}) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            if (await this.isVisible(this.questionHeader)) {
                return;
            }

            if (await this.isEnhancedPromptReady()) {
                throw new Error(
                    'Metamod skipped the required quick-question screen. "Use This Prompt" or the enhanced prompt UI appeared before "A quick question for you".'
                );
            }

            await this.page.waitForTimeout(500);
        }

        if (await this.isEnhancedPromptReady()) {
            throw new Error(
                'Metamod skipped the required quick-question screen. "Use This Prompt" or the enhanced prompt UI appeared before "A quick question for you".'
            );
        }

        if (await this.isResponseInProgress()) {
            throw new Error(
                `Metamod did not reach the required quick-question screen within ${timeout} ms. The response was still generating when the wait expired.`
            );
        }

        throw new Error(
            `Metamod did not reach the required quick-question screen within ${timeout} ms after prompt submission.`
        );
    }

    /**
     * Wait for either the next quick-question round or the final enhanced prompt UI.
     * @param {{ timeout?: number }} [options]
     * @returns {Promise<'question' | 'enhanced-prompt'>}
     */
    async waitForQuestionRoundOrEnhancedPrompt({ timeout = 60000 } = {}) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            if (await this.isEnhancedPromptReady()) {
                return 'enhanced-prompt';
            }

            if (await this.isVisible(this.questionHeader)) {
                return 'question';
            }

            await this.page.waitForTimeout(500);
        }

        if (await this.isEnhancedPromptReady()) {
            return 'enhanced-prompt';
        }

        if (await this.isResponseInProgress()) {
            throw new Error(
                `Metamod did not surface the next quick-question round or the enhanced prompt within ${timeout} ms. The response was still generating when the wait expired.`
            );
        }

        throw new Error(
            `Metamod did not surface the next quick-question round or the enhanced prompt within ${timeout} ms.`
        );
    }

    /**
     * Wait for at least two selectable answer options or for the enhanced prompt to become ready.
     * @param {{ timeout?: number }} [options]
     * @returns {Promise<'question' | 'enhanced-prompt'>}
     */
    async waitForSelectableOptionsOrEnhancedPrompt({ timeout = 30000 } = {}) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            if (await this.isEnhancedPromptReady()) {
                return 'enhanced-prompt';
            }

            if ((await this.getOptionButtons().count()) >= 2) {
                return 'question';
            }

            await this.page.waitForTimeout(250);
        }

        if (await this.isEnhancedPromptReady()) {
            return 'enhanced-prompt';
        }

        throw new Error(
            'The quick-question screen never exposed at least two selectable options, so the final option could not be excluded safely.'
        );
    }

    /**
     * Select an answer option by 0-based index, excluding the Continue button.
     * @param {number} index
     */
    async selectOptionByIndex(index) {
        await this.page
            .getByText('A quick question for you')
            .waitFor({ state: 'visible' });

        await this.getOptionButtons().nth(index).click();
    }

    /** Click the Continue button inside the quick-question form. */
    async clickContinue() {
        await this.page.getByRole('button', { name: 'Continue' }).click();
    }

    /** Assert that the Enhanced Prompt textarea and "Use This Prompt" button are visible. */
    async assertEnhancedPromptVisible() {
        await expect(this.enhancedPromptInput).toBeVisible({ timeout: 30000 });
        await expect(this.useThisPromptButton).toBeVisible();
    }

    /** Click "Use This Prompt" to proceed to agent canvas generation. */
    async useThisPrompt() {
        await this.useThisPromptButton.click();
    }

    get chatInput() {
        return this.page.getByRole('textbox', { name: 'Create an agent that can...' });
    }

    get questionHeader() {
        return this.page.getByText('A quick question for you').first();
    }

    getOptionButtons() {
        return this.page
            .locator('form button:not([disabled]):visible')
            .filter({ hasNotText: 'Continue' });
    }

    get continueButton() {
        return this.page.getByRole('button', { name: 'Continue' });
    }

    get multiSelectHint() {
        return this.page.getByText('Select multiple').first();
    }

    get selectAllHint() {
        return this.page.getByText('Select all that apply').first();
    }

    get thinkingIndicator() {
        return this.page.getByText('Thinking...').first();
    }

    get processingIndicator() {
        return this.page.getByText('Processing your request...').first();
    }

    get stopResponseButton() {
        return this.page.getByRole('button', { name: 'Stop response' }).first();
    }

    get enhancedPromptInput() {
        return this.page.getByRole('textbox', { name: 'Enhanced prompt input' }).first();
    }

    get useThisPromptButton() {
        return this.page.getByRole('button', { name: 'Use This Prompt' }).first();
    }

    getUseThisPromptButton() {
        return this.useThisPromptButton;
    }

    /**
     * Complete all question rounds until the enhanced prompt is ready.
     * @param {number} maxRounds - Maximum number of rounds to attempt (default 10).
     */
    async completeAllQuestionRounds(maxRounds = 10) {
        for (let round = 0; round < maxRounds; round++) {
            const state = await this.waitForQuestionRoundOrEnhancedPrompt({ timeout: 60000 });
            if (state === 'enhanced-prompt') {
                return;
            }

            const selectableState = await this.waitForSelectableOptionsOrEnhancedPrompt();
            if (selectableState === 'enhanced-prompt') {
                return;
            }

            const options = this.getOptionButtons();
            const count = await options.count();
            const selectableCount = count - 1;

            if (await this.isMultiSelectQuestion()) {
                for (let index = 0; index < selectableCount; index++) {
                    await options.nth(index).click();
                }
            } else {
                const randomIndex = Math.floor(Math.random() * selectableCount);
                await options.nth(randomIndex).click();
            }

            await expect(this.continueButton).toBeEnabled({ timeout: 10000 });
            await this.clickContinue();
        }

        throw new Error(
            `The enhanced prompt UI did not become ready after ${maxRounds} quick-question rounds.`
        );
    }

    /**
     * @param {import('@playwright/test').Locator} locator
     */
    async isVisible(locator) {
        return locator.isVisible().catch(() => false);
    }

    async isEnhancedPromptReady() {
        return (
            (await this.isVisible(this.enhancedPromptInput)) ||
            (await this.isVisible(this.useThisPromptButton))
        );
    }

    async isMultiSelectQuestion() {
        return (
            (await this.isVisible(this.multiSelectHint)) ||
            (await this.isVisible(this.selectAllHint))
        );
    }

    async isResponseInProgress() {
        return (
            (await this.isVisible(this.thinkingIndicator)) ||
            (await this.isVisible(this.processingIndicator)) ||
            (await this.isVisible(this.stopResponseButton))
        );
    }
}

module.exports = { ChatPage };
