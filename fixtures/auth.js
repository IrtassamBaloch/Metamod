'use strict';

const { test: base, expect, createPageObjects } = require('./pages');
const { getBaseUrl, getCredentials } = require('../utils/env');

const AUTH_OPTIONS = {
    attempts: 3,
    authTimeout: 45000,
};

const test = base.extend({
    authenticatedSession: [
        async ({ browser }, use) => {
            const context = await browser.newContext({
                baseURL: getBaseUrl(),
                viewport: { width: 1440, height: 900 },
            });
            const page = await context.newPage();
            const pageObjects = createPageObjects(page);
            const { username, password } = getCredentials();

            await pageObjects.loginPage.loginUntilAuthenticated(username, password, AUTH_OPTIONS);
            await pageObjects.loginPage.assertLoginSuccess(30000);

            await use({
                context,
                page,
                ...pageObjects,
            });

            await context.close();
        },
        { scope: 'worker', timeout: 180000 },
    ],

    authenticatedPage: async ({ authenticatedSession }, use) => {
        await use(authenticatedSession.page);
    },

    authenticatedLoginPage: async ({ authenticatedSession }, use) => {
        await use(authenticatedSession.loginPage);
    },

    dashboardPage: async ({ authenticatedSession }, use) => {
        await use(authenticatedSession.dashboardPage);
    },

    flowsPage: async ({ authenticatedSession }, use) => {
        await use(authenticatedSession.flowsPage);
    },

    chatPage: async ({ authenticatedSession }, use) => {
        await use(authenticatedSession.chatPage);
    },

    agentCanvasPage: async ({ authenticatedSession }, use) => {
        await use(authenticatedSession.agentCanvasPage);
    },

    agentRefinementPage: async ({ authenticatedSession }, use) => {
        await use(authenticatedSession.agentRefinementPage);
    },
});

module.exports = { test, expect };
