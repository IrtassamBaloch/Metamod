/**
 * DashboardPage.js
 * Page Object Model for the Metamod Dashboard page.
 */

'use strict';

const { expect } = require('@playwright/test');

class DashboardPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    /**
     * Dismiss the onboarding popup by clicking Skip — safe if no popup appears.
     */
    async skipPopup() {
        try {
            const skipBtn = this.page.getByRole('button', { name: 'Skip' });
            await skipBtn.waitFor({ state: 'visible', timeout: 5000 });
            await skipBtn.click();
        } catch {
            // No popup visible — continue
        }
    }

    /**
     * Assert that the main navigation sidebar links are visible.
     * Based on actual UI: sidebar shows "Home" and "Project" (not "Flows").
     */
    async assertNavigation() {
        await expect(this.page.getByRole('link', { name: 'Home' })).toBeVisible({ timeout: 10000 });
        await expect(this.page.getByRole('button', { name: 'Project' })).toBeVisible({ timeout: 10000 });
    }

    /** Assert the main chat input is visible on the dashboard. */
    async assertChatInputVisible() {
        await expect(
            this.page.getByRole('textbox', { name: /Create an agent|have a conversation/i })
        ).toBeVisible({ timeout: 10000 });
    }

    async openHome() {
        const { pathname } = new URL(this.page.url());
        if (pathname !== '/') {
            await this.page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90000 });
        }
    }

    /**
     * Open the Starter Project "…" context menu and navigate to Flows.
     */
    async navigateToFlows() {
        await this.openHome();
        await this.skipPopup();

        // Click the "…" (three-dot) button next to "Starter Project"
        await this.page
            .locator('a')
            .filter({ hasText: 'Starter Project' })
            .getByRole('button')
            .click();
        await this.page.getByRole('menuitem', { name: 'Flows' }).click();
    }

    /** Click the "Build with Chat" button inside the Flows modal. */
    async clickNewAgentButton() {
        const buildWithChatBtn = this.page.locator('#new-agent-btn').nth(2);
        await buildWithChatBtn.waitFor({ state: 'visible', timeout: 100000 });
        await buildWithChatBtn.click();
    }
}

module.exports = { DashboardPage };
