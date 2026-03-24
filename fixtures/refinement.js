'use strict';

const { test: base, expect } = require('./auth');
const { OpenAIRefinementClient } = require('../utils/openaiRefinement');

const test = base.extend({
    openAIRefinementClient: async ({}, use) => {
        await use(new OpenAIRefinementClient());
    },
});

module.exports = { test, expect };
