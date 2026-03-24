/**
 * env.js
 * Utility to safely read and validate required environment variables.
 */

const { environments } = require('../config/environments');

function getOptionalEnv(key, defaultValue) {
    const value = process.env[key];
    return value === undefined || value === '' ? defaultValue : value;
}

/**
 * Gets an environment variable value, throws if it's missing and required.
 * @param {string} key - The env variable name
 * @param {string} [defaultValue] - Optional fallback value
 * @returns {string}
 */
function getEnv(key, defaultValue) {
    const value = getOptionalEnv(key, defaultValue);
    if (!value) {
        throw new Error(
            `[env] Missing required environment variable: "${key}". ` +
            `Please check your .env file.`
        );
    }
    return value;
}

function getFirstEnv(keys, defaultValue) {
    for (const key of keys) {
        const value = getOptionalEnv(key);
        if (value) {
            return value;
        }
    }

    if (defaultValue !== undefined) {
        return defaultValue;
    }

    throw new Error(
        `[env] Missing required environment variable. Checked: ${keys
            .map((key) => `"${key}"`)
            .join(', ')}. Please check your .env file.`
    );
}

function getCredentials() {
    return {
        username: getFirstEnv(['METAMOD_USERNAME', 'NAME']),
        password: getFirstEnv(['METAMOD_PASSWORD', 'PASSWORD']),
    };
}

function getBaseUrl() {
    const configuredBaseUrl = getOptionalEnv('BASE_URL');
    if (configuredBaseUrl) {
        return configuredBaseUrl;
    }

    const targetEnvironment = getOptionalEnv('TEST_ENV', 'staging');
    const baseUrl = environments[targetEnvironment];

    if (!baseUrl) {
        throw new Error(
            `[env] Unsupported TEST_ENV "${targetEnvironment}". ` +
            `Supported values: ${Object.keys(environments).join(', ')}.`
        );
    }

    return baseUrl;
}

module.exports = {
    getBaseUrl,
    getCredentials,
    getEnv,
    getFirstEnv,
    getOptionalEnv,
};
