require('dotenv').config();

const { defineConfig } = require('@playwright/test');
const { createPlaywrightConfig } = require('./config/playwright');

module.exports = defineConfig(createPlaywrightConfig());
