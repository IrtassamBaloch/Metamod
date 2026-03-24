'use strict';

const { devices } = require('@playwright/test');
const { getBaseUrl } = require('../utils/env');

function createPlaywrightConfig() {
    const reporter = [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
    ];

    if (process.env.CI) {
        reporter.push(['junit', { outputFile: 'test-results/junit.xml' }]);
    }

    return {
        testDir: './tests',
        outputDir: 'test-results',
        timeout: 90000,
        fullyParallel: false,
        forbidOnly: !!process.env.CI,
        retries: process.env.CI ? 1 : 0,
        workers: process.env.CI ? 2 : 1,
        reporter,
        use: {
            baseURL: getBaseUrl(),
            headless: !!process.env.CI,
            viewport: { width: 1440, height: 900 },
            navigationTimeout: 90000,
            actionTimeout: 30000,
            screenshot: 'only-on-failure',
            trace: 'on-first-retry',
            video: 'retain-on-failure',
        },
        projects: [
            {
                name: 'chromium',
                use: { ...devices['Desktop Chrome'] },
            },
        ],
    };
}

module.exports = { createPlaywrightConfig };
