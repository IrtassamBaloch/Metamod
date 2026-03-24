/**
 * environments.js
 * Maps environment names to base URLs for easy switching.
 * Usage: BASE_URL=https://staging.metamod.ai npx playwright test
 */

const environments = {
    dev: 'https://dev.metamod.ai',
    qa: 'https://qa.metamod.ai',
    staging: 'https://staging.metamod.ai',
    production: 'https://metamod.ai',
};

module.exports = { environments };
