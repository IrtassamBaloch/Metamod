'use strict';

const { test: base, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { DashboardPage } = require('../pages/DashboardPage');
const { FlowsPage } = require('../pages/FlowsPage');
const { ChatPage } = require('../pages/ChatPage');
const { AgentCanvasPage } = require('../pages/AgentCanvasPage');
const { AgentRefinementPage } = require('../pages/AgentRefinementPage');

function createPageObjects(page) {
    return {
        loginPage: new LoginPage(page),
        dashboardPage: new DashboardPage(page),
        flowsPage: new FlowsPage(page),
        chatPage: new ChatPage(page),
        agentCanvasPage: new AgentCanvasPage(page),
        agentRefinementPage: new AgentRefinementPage(page),
    };
}

const test = base.extend({
    pageObjects: async ({ page }, use) => {
        await use(createPageObjects(page));
    },

    loginPage: async ({ pageObjects }, use) => {
        await use(pageObjects.loginPage);
    },

    dashboardPage: async ({ pageObjects }, use) => {
        await use(pageObjects.dashboardPage);
    },

    flowsPage: async ({ pageObjects }, use) => {
        await use(pageObjects.flowsPage);
    },

    chatPage: async ({ pageObjects }, use) => {
        await use(pageObjects.chatPage);
    },

    agentCanvasPage: async ({ pageObjects }, use) => {
        await use(pageObjects.agentCanvasPage);
    },

    agentRefinementPage: async ({ pageObjects }, use) => {
        await use(pageObjects.agentRefinementPage);
    },
});

module.exports = {
    createPageObjects,
    expect,
    test,
};
