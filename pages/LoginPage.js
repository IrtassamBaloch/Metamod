/**
 * LoginPage.js
 * Page Object Model for the Metamod Login page.
 * URL: /login
 */

'use strict';

class LoginPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;

        // Locators
        this.usernameInput = page.getByPlaceholder('Username');
        this.passwordInput = page.getByPlaceholder('Password');
        this.signInButton = page.getByRole('button', { name: 'Sign In' });

        // Post-login indicators
        this.dashboardHeading = page.getByText('What would you like to build today?');
        this.userProfile = page.getByText('zeeshan.sabir');
        this.homeLink = page.getByRole('link', { name: 'Home' });
        this.agentPromptInput = page.getByRole('textbox', {
            name: /Create an agent|have a conversation/i,
        });
    }

    /** Navigate to the login page. */
    async navigate() {
        try {
            await this.page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
        } catch (error) {
            if (!/interrupted by another navigation/i.test(String(error?.message || error || ''))) {
                throw error;
            }

            await this.page.waitForURL('**/login', { timeout: 15000 }).catch(() => {
                throw error;
            });
        }
    }

    /** Navigate to the login page using Playwright's configured baseURL. */
    async goto() {
        await this.navigate();
    }

    /**
     * Fill credentials and click Sign In.
     * @param {string} username
     * @param {string} password
     */
    async login(username, password) {
        await this.usernameInput.waitFor({ state: 'visible', timeout: 15000 });
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);
        await this.signInButton.waitFor({ state: 'visible', timeout: 15000 });
        await this.signInButton.click();
    }

    /**
     * Full login flow: navigate + login.
     * @param {string} username
     * @param {string} password
     */
    async navigateAndLogin(username, password) {
        await this.navigate();
        await this.login(username, password);
    }

    /**
     * Assert login was successful by checking for any stable authenticated-app signal.
     * @param {number} timeout
     */
    async assertLoginSuccess(timeout = 45000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const profileVisible = await this.userProfile.isVisible().catch(() => false);
            const dashboardVisible = await this.dashboardHeading.isVisible().catch(() => false);
            const homeVisible = await this.homeLink.isVisible().catch(() => false);
            const agentPromptVisible = await this.agentPromptInput.isVisible().catch(() => false);
            const onLoginPage = /\/login(?:$|[?#])/.test(this.page.url());

            if (!onLoginPage && (profileVisible || dashboardVisible || homeVisible || agentPromptVisible)) {
                return;
            }

            await this.page.waitForTimeout(500);
        }

        throw new Error(`Login did not reach an authenticated state within ${timeout} ms.`);
    }

    /** Assert the current URL is the login page. */
    async assertOnLoginPage() {
        await this.page.waitForURL('**/login', { timeout: 10000 });
    }

    /**
     * Retry the sign-in flow until the authenticated app is visible.
     * @param {string} username
     * @param {string} password
     * @param {{ attempts?: number, authTimeout?: number }} [options]
     */
    async loginUntilAuthenticated(
        username,
        password,
        { attempts = 3, authTimeout = 45000 } = {}
    ) {
        let lastError;

        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                await this.page.context().clearCookies();
                await this.goto();
                await this.login(username, password);
                await this.assertLoginSuccess(authTimeout);
                return;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError;
    }
}

module.exports = { LoginPage };
