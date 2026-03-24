'use strict';

const { expect } = require('@playwright/test');

class BaseCanvasPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    get walkthroughStepLabel() {
        return this.page.getByText(/^Step \d+ of \d+$/i).first();
    }

    get walkthroughSkipButton() {
        return this.page.getByRole('button', { name: /^Skip$/i }).last();
    }

    /**
     * @param {import('@playwright/test').Locator} locator
     */
    async isVisible(locator) {
        return locator.isVisible().catch(() => false);
    }

    async dismissWalkthroughIfPresent(timeout = 5000) {
        const stepVisible = await this.isVisible(this.walkthroughStepLabel);
        const skipVisible = await this.isVisible(this.walkthroughSkipButton);

        if (!stepVisible && !skipVisible) {
            return false;
        }

        if (!skipVisible) {
            return false;
        }

        await this.walkthroughSkipButton.click({ force: true });
        await this.walkthroughStepLabel.waitFor({ state: 'hidden', timeout }).catch(() => {});
        await this.page.waitForTimeout(250).catch(() => {});
        return true;
    }

    /**
     * @param {import('@playwright/test').Locator[]} locators
     * @param {number} timeout
     * @param {string} errorMessage
     */
    async waitForAnyVisible(locators, timeout, errorMessage) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            await this.dismissWalkthroughIfPresent().catch(() => {});

            for (const locator of locators) {
                if (await this.isVisible(locator)) {
                    return locator;
                }
            }

            await this.page.waitForTimeout(500);
        }

        throw new Error(errorMessage);
    }

    /**
     * React Flow frequently keeps nodes in the DOM but outside the viewport via transforms.
     * Fall back to a DOM click when Playwright cannot physically click a visible control.
     *
     * @param {import('@playwright/test').Locator} locator
     * @param {{ timeout?: number }} [options]
     */
    async clickLocatorReliably(locator, { timeout = 30000 } = {}) {
        await this.dismissWalkthroughIfPresent().catch(() => {});
        await expect(locator).toBeVisible({ timeout });

        try {
            await locator.click({ timeout });
            return;
        } catch (error) {
            if (!this.isRecoverableClickError(error)) {
                throw error;
            }
        }

        await this.dismissWalkthroughIfPresent().catch(() => {});

        try {
            await locator.click({ timeout: 5000, force: true });
            return;
        } catch (error) {
            if (!this.isRecoverableClickError(error)) {
                throw error;
            }
        }

        const handle = await locator.elementHandle();
        if (!handle) {
            throw new Error('The target element detached before a fallback click could be attempted.');
        }

        try {
            await handle.evaluate((element) => {
                element.scrollIntoView?.({ block: 'center', inline: 'center' });
                element.click();
            });
        } finally {
            await handle.dispose().catch(() => {});
        }
    }

    isRecoverableClickError(error) {
        const message = String(error?.message || error || '');

        return (
            /outside of the viewport/i.test(message) ||
            /another element would receive the click/i.test(message) ||
            /intercepts pointer events/i.test(message) ||
            /retrying click action/i.test(message) ||
            /Timeout .*locator\.click/i.test(message)
        );
    }
}

module.exports = { BaseCanvasPage };
