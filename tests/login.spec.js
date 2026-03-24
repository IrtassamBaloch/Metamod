/**
 * login.spec.js
 * Login test suite for Metamod Staging.
 *
 * Tags: @smoke @login
 * Run:  npx playwright test tests/login.spec.js
 */

const { test, expect } = require('../fixtures/pages');
const { getCredentials } = require('../utils/env');

test.describe('Login Page — @smoke @login', () => {
    test.beforeEach(async ({ loginPage }) => {
        await loginPage.navigate();
    });

    // ──────────────────────────────────────────────
    // TC-001: Successful login with valid credentials
    // ──────────────────────────────────────────────
    test('TC-001 | should login successfully with valid credentials', async ({ page, loginPage }) => {
        const { username, password } = getCredentials();

        await loginPage.login(username, password);

        // Assert URL changed away from /login
        await expect(page).not.toHaveURL(/.*\/login/);

        // Assert dashboard heading is visible — confirms successful session
        await expect(loginPage.dashboardHeading).toBeVisible({ timeout: 15000 });
    });

    // ──────────────────────────────────────────────
    // TC-002: Login page renders correct elements
    // ──────────────────────────────────────────────
    test('TC-002 | should display login form elements correctly', async ({ loginPage }) => {
        await expect(loginPage.usernameInput).toBeVisible();
        await expect(loginPage.passwordInput).toBeVisible();
        await expect(loginPage.signInButton).toBeVisible();
        await expect(loginPage.signInButton).toBeEnabled();
    });

    // ──────────────────────────────────────────────
    // TC-003: Login fails with invalid credentials
    // ──────────────────────────────────────────────
    test('TC-003 | should show error with invalid credentials', async ({ page, loginPage }) => {
        await loginPage.login('invalid_user', 'WrongPassword!');

        // Should remain on login page
        await expect(page).toHaveURL(/.*\/login/);

        // Assert some form of error feedback is visible
        const errorFeedback = page.locator(
            '[role="alert"], .error, [class*="error"], [class*="invalid"], [class*="Error"]'
        ).first();
        await expect(errorFeedback).toBeVisible({ timeout: 8000 });
    });
});
