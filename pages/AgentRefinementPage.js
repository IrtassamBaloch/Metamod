'use strict';

const { compareCanvasState, normalizeLabels } = require('../utils/refinement');
const { RefinementCanvasSection } = require('./refinement/RefinementCanvasSection');
const { PlaygroundPanel } = require('./refinement/PlaygroundPanel');
const { SystemPromptEditor } = require('./refinement/SystemPromptEditor');

class AgentRefinementPage {
    constructor(page) {
        this.page = page;
        this.canvas = new RefinementCanvasSection(page);
        this.systemPromptEditor = new SystemPromptEditor(page, this.canvas);
        this.playgroundPanel = new PlaygroundPanel(page, this.canvas);
    }

    normalizeLabels(labels = []) {
        return normalizeLabels(labels);
    }

    hasCanvasChanged(beforePrompt, afterPrompt, beforeLabels, afterLabels) {
        return compareCanvasState(beforePrompt, afterPrompt, beforeLabels, afterLabels);
    }

    async openLatestPlaygroundCapableFlow(options) {
        return this.canvas.openLatestPlaygroundCapableFlow(options);
    }

    async waitForCanvasReady(timeout = 60000) {
        return this.canvas.waitForCanvasReady(timeout);
    }

    async connectAllVisibleNodes() {
        return this.canvas.connectAllVisibleNodes();
    }

    async collectVisibleNodeLabels() {
        return this.canvas.collectVisibleNodeLabels();
    }

    async runEachNode() {
        return this.canvas.runEachNode();
    }

    async runGlobalHeader() {
        return this.canvas.runGlobalHeader();
    }

    async readSystemPrompt() {
        return this.systemPromptEditor.readSystemPrompt();
    }

    async writeSystemPrompt(nextPrompt) {
        return this.systemPromptEditor.writeSystemPrompt(nextPrompt);
    }

    async collectPlaygroundState() {
        return this.playgroundPanel.collectPlaygroundState();
    }

    async ensurePlaygroundOpen() {
        return this.playgroundPanel.ensurePlaygroundOpen();
    }

    async sendPromptToPlayground(prompt) {
        return this.playgroundPanel.sendPromptToPlayground(prompt);
    }

    async openFreshPlaygroundChat() {
        return this.playgroundPanel.openFreshPlaygroundChat();
    }

    async runAiGuidedPlaygroundSession(options) {
        return this.playgroundPanel.runAiGuidedPlaygroundSession(options);
    }

    async closePlaygroundWidget() {
        return this.playgroundPanel.closePlaygroundWidget();
    }

    async hasPlaygroundInterface() {
        return this.canvas.hasPlaygroundInterface();
    }

    async captureCanvasScreenshot(outputPath) {
        return this.canvas.captureCanvasScreenshot(outputPath);
    }

    async applyRefinement(refinementText, timeout = 180000) {
        return this.canvas.applyRefinement(refinementText, timeout);
    }
}

module.exports = { AgentRefinementPage };
