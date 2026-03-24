'use strict';

const { expect } = require('@playwright/test');
const { normalizeText } = require('../utils/refinement');
const { BaseCanvasPage } = require('./BaseCanvasPage');

class AgentRefinementPage extends BaseCanvasPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        super(page);
    }

    get canvasNodes() {
        return this.page.locator('[data-testid^="rf__node-"]');
    }

    get refineButton() {
        return this.page.getByText('Refine').first();
    }

    get flowDescriptionInput() {
        return this.page.getByRole('textbox', { name: 'Flow description input' }).first();
    }

    get headerRunButton() {
        return this.page
            .getByTestId('header_right_section_wrapper')
            .getByRole('button')
            .filter({ hasText: /^$/ })
            .first();
    }

    get systemPromptModalButton() {
        return this.page.getByTestId('button_open_text_area_modal_textarea_str_system_prompt');
    }

    get systemPromptModal() {
        return this.page.getByTestId('text-area-modal');
    }

    get systemPromptSaveButton() {
        return this.page.getByTestId('genericModalBtnSave');
    }

    get playgroundInput() {
        return this.page.getByTestId('input-chat-playground').last();
    }

    get playgroundSendButton() {
        return this.page.getByTestId('button-send').last();
    }

    get doneButton() {
        return this.page.getByRole('button', { name: /^Done(?: \(\d+ steps\))?$/ }).first();
    }

    get stopRunButton() {
        return this.page.getByRole('button', { name: /^Stop$/i }).last();
    }

    get agentNodeContainers() {
        return this.page.locator(
            '[data-testid^="rf__node-Agent-"], [data-testid^="Agent-"][data-testid$="-main-node"]'
        );
    }

    async findFirstVisible(locator) {
        const count = await locator.count();
        for (let index = 0; index < count; index += 1) {
            const candidate = locator.nth(index);
            if (await candidate.isVisible().catch(() => false)) {
                return candidate;
            }
        }

        return null;
    }

    async waitForFirstVisible(locator, timeout = 30000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const candidate = await this.findFirstVisible(locator);
            if (candidate) {
                return candidate;
            }

            await this.page.waitForTimeout(500);
        }

        throw new Error(`No visible matching element was found within ${timeout} ms.`);
    }

    async findFirstVisibleEnabled(locator) {
        const count = await locator.count();
        for (let index = 0; index < count; index += 1) {
            const candidate = locator.nth(index);
            if (!(await candidate.isVisible().catch(() => false))) {
                continue;
            }

            const disabled =
                (await candidate.getAttribute('disabled').catch(() => null)) !== null ||
                (await candidate.getAttribute('aria-disabled').catch(() => null)) === 'true';

            if (!disabled) {
                return candidate;
            }
        }

        return null;
    }

    async approveHumanApprovalIfNeeded() {
        const approveButton = this.page.locator('button').filter({ hasText: /^Approve$/ }).last();
        if (await approveButton.isVisible().catch(() => false)) {
            await this.clickLocatorReliably(approveButton);
            await this.page.waitForTimeout(500);
            return true;
        }

        return false;
    }

    async isBusy() {
        const busyLocators = [
            this.page.getByRole('button', { name: /Stop/i }),
            this.page.getByRole('button', { name: /^Working\.\.\./i }),
            this.page.getByText(/^Processing your request/i),
        ];

        for (const locator of busyLocators) {
            if (await this.findFirstVisible(locator)) {
                return true;
            }
        }

        return false;
    }

    async waitForBusyStart(timeout = 10000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            await this.dismissWalkthroughIfPresent().catch(() => {});
            await this.approveHumanApprovalIfNeeded();

            if (await this.isBusy()) {
                return true;
            }

            await this.page.waitForTimeout(500);
        }

        return false;
    }

    async waitForIdle(timeout = 120000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            await this.dismissWalkthroughIfPresent().catch(() => {});
            await this.approveHumanApprovalIfNeeded();

            if (!(await this.isBusy())) {
                return;
            }

            await this.page.waitForTimeout(1000);
        }

        throw new Error(`The page did not become idle within ${timeout} ms.`);
    }

    async stopCurrentRunIfNeeded(timeout = 15000) {
        const stopButton = await this.findFirstVisible(this.page.getByRole('button', { name: /^Stop$/i }));
        if (!stopButton) {
            return false;
        }

        await this.clickLocatorReliably(stopButton, { timeout: 5000 });

        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            await this.dismissWalkthroughIfPresent().catch(() => {});
            await this.approveHumanApprovalIfNeeded();

            if (!(await this.isBusy())) {
                return true;
            }

            await this.page.waitForTimeout(500);
        }

        return !(await this.isBusy());
    }

    async waitForCanvasReady(timeout = 60000) {
        const deadline = Date.now() + timeout;
        const readyLocators = [
            this.canvasNodes.first(),
            this.refineButton,
            this.flowDescriptionInput,
            this.page.getByTestId('header_right_section_wrapper').first(),
        ];

        while (Date.now() < deadline) {
            await this.dismissWalkthroughIfPresent().catch(() => {});

            for (const locator of readyLocators) {
                if (await locator.isVisible().catch(() => false)) {
                    return;
                }
            }

            await this.page.waitForTimeout(500);
        }

        throw new Error('The flow canvas did not become ready after opening the latest flow.');
    }

    async maybeHandleConnectPicker() {
        await this.page.waitForTimeout(750);

        const dialog = this.page.getByRole('dialog').last();
        if (!(await dialog.isVisible().catch(() => false))) {
            return false;
        }

        const optionGroups = [
            dialog.locator('[data-testid^="list_item_"]'),
            dialog.getByRole('option'),
            dialog.getByRole('button'),
        ];

        for (const group of optionGroups) {
            const count = await group.count();
            for (let index = 0; index < count; index += 1) {
                const option = group.nth(index);
                if (!(await option.isVisible().catch(() => false))) {
                    continue;
                }

                const text = normalizeText(await option.innerText().catch(() => ''));
                if (/^close$|^cancel$/i.test(text)) {
                    continue;
                }

                await option.click();

                const closeButton = dialog.getByTestId('close_dialog_button');
                if (await closeButton.isVisible().catch(() => false)) {
                    await closeButton.click();
                } else {
                    await this.page.keyboard.press('Escape').catch(() => {});
                }

                return true;
            }
        }

        return false;
    }

    async connectAllVisibleNodes() {
        let connectClicks = 0;

        for (let guard = 0; guard < 25; guard += 1) {
            const connectButton = await this.findFirstVisibleEnabled(
                this.page.getByRole('button', { name: /^Connect$/i })
            );

            if (!connectButton) {
                return connectClicks;
            }

            await connectButton.scrollIntoViewIfNeeded().catch(() => {});
            await this.clickLocatorReliably(connectButton);
            connectClicks += 1;

            await this.maybeHandleConnectPicker();
            await this.waitForIdle(30000).catch(() => {});
        }

        throw new Error('Connect button scan exceeded the safety limit of 25 iterations.');
    }

    async collectVisibleNodeIds() {
        const ids = [];
        const seen = new Set();
        const count = await this.canvasNodes.count();

        for (let index = 0; index < count; index += 1) {
            const node = this.canvasNodes.nth(index);
            if (!(await node.isVisible().catch(() => false))) {
                continue;
            }

            const testId = await node.getAttribute('data-testid');
            if (!testId) {
                continue;
            }

            const nodeId = testId.replace(/^rf__node-/, '');
            if (nodeId && !seen.has(nodeId)) {
                ids.push(nodeId);
                seen.add(nodeId);
            }
        }

        return ids;
    }

    async collectVisibleNodeLabels() {
        const labels = [];
        const seen = new Set();
        const count = await this.canvasNodes.count();

        for (let index = 0; index < count; index += 1) {
            const node = this.canvasNodes.nth(index);
            if (!(await node.isVisible().catch(() => false))) {
                continue;
            }

            const text = normalizeText(await node.innerText().catch(() => ''));
            if (!text) {
                continue;
            }

            const label = text.split(/\s{2,}|\n/)[0].trim();
            if (label && !seen.has(label)) {
                labels.push(label);
                seen.add(label);
            }
        }

        return labels;
    }

    async runNodeById(nodeId) {
        const mainNode = this.page.getByTestId(`${nodeId}-main-node`);
        if (!(await mainNode.isVisible().catch(() => false))) {
            return false;
        }

        const runButton = mainNode.getByRole('button').filter({ hasText: /^$/ }).first();
        if (!(await runButton.isVisible().catch(() => false))) {
            return false;
        }

        const disabled =
            (await runButton.getAttribute('disabled').catch(() => null)) !== null ||
            (await runButton.getAttribute('aria-disabled').catch(() => null)) === 'true';

        if (disabled) {
            return false;
        }

        await this.clickLocatorReliably(runButton);
        const busyStarted = await this.waitForBusyStart(5000);
        if (!busyStarted) {
            return true;
        }

        try {
            await this.waitForIdle(30000);
        } catch (error) {
            const stopped = await this.stopCurrentRunIfNeeded(15000);
            if (!stopped) {
                throw error;
            }
        }

        return true;
    }

    async runEachNode() {
        const nodeIds = await this.collectVisibleNodeIds();
        let runCount = 0;

        for (const nodeId of nodeIds) {
            if (await this.runNodeById(nodeId)) {
                runCount += 1;
            }
        }

        return runCount;
    }

    async runGlobalHeader() {
        await expect(this.headerRunButton).toBeVisible({ timeout: 30000 });
        const previousTexts = await this.collectPlaygroundTexts().catch(() => []);
        await this.clickLocatorReliably(this.headerRunButton);
        const busyStarted = await this.waitForBusyStart();

        if (busyStarted) {
            try {
                await this.waitForIdle(45000);
            } catch {
                await this.stopCurrentRunIfNeeded(15000).catch(() => {});
            }
        }

        await this.waitForPlaygroundActivity(previousTexts, 120000);
    }

    async openAgentNode() {
        const candidateLocators = [
            this.agentNodeContainers.first(),
            this.page.getByText(/^Agent$/).first(),
        ];

        for (const candidate of candidateLocators) {
            if (await candidate.isVisible().catch(() => false)) {
                await this.clickLocatorReliably(candidate, { timeout: 10000 });
                await this.waitForAgentEditor();
                const agentNode = await this.findFirstVisible(this.agentNodeContainers);
                if (agentNode) {
                    return agentNode;
                }
            }
        }

        throw new Error('The Agent node could not be located on the canvas.');
    }

    async waitForAgentEditor(timeout = 30000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const inlineHandle = await this.findInlineAgentInstructionsHandle().catch(() => null);
            if (inlineHandle) {
                await inlineHandle.dispose().catch(() => {});
                return;
            }

            const readyLocators = [
                this.systemPromptModalButton.first(),
                this.page.getByText(/^Agent Instructions$/).first(),
                this.page.getByText(/Define the agent's instructions/i).first(),
            ];

            for (const locator of readyLocators) {
                if (await locator.isVisible().catch(() => false)) {
                    return;
                }
            }

            await this.page.waitForTimeout(500);
        }

        throw new Error('The Agent editor did not become ready after opening the Agent node.');
    }

    async findInlineAgentInstructionsHandle(agentNode = null) {
        const rootHandle = agentNode ? await agentNode.elementHandle().catch(() => null) : null;
        const bodyHandle = rootHandle || (await this.page.locator('body').elementHandle().catch(() => null));

        if (!bodyHandle) {
            return null;
        }

        const candidateHandle = await bodyHandle.evaluateHandle((root) => {
            const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
            const isVisible = (element) => {
                if (!element) {
                    return false;
                }

                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return (
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    rect.width > 0 &&
                    rect.height > 0
                );
            };
            const isEditable = (element) => {
                if (!element) {
                    return false;
                }

                const tag = element.tagName.toLowerCase();
                const isTextboxRole = element.getAttribute('role') === 'textbox';
                const isContentEditable = element.getAttribute('contenteditable') === 'true';
                return tag === 'textarea' || tag === 'input' || isTextboxRole || isContentEditable;
            };
            const isDisabled = (element) =>
                element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
            const isIgnored = (element) => {
                const placeholder = normalize(element.getAttribute('placeholder') || '');
                if (/^send a message|^receiving input$/i.test(placeholder)) {
                    return true;
                }

                const dialogText = normalize(element.closest('[role="dialog"]')?.textContent || '');
                if (/playground|default session|to-do timeline/i.test(dialogText)) {
                    return true;
                }

                return false;
            };
            const getValue = (element) => normalize(element.value || element.textContent || '');
            const collectInputs = (searchRoot) =>
                Array.from(
                    searchRoot.querySelectorAll('textarea, input, [role="textbox"], [contenteditable="true"]')
                ).filter(
                    (element) =>
                        isEditable(element) &&
                        isVisible(element) &&
                        !isDisabled(element) &&
                        !isIgnored(element)
                );
            const scoreInput = (element, bonus = 0) => getValue(element).length + bonus;

            let best = null;
            let bestScore = -1;

            const labels = Array.from(root.querySelectorAll('*')).filter((element) => {
                const text = normalize(element.textContent || '');
                return text === 'Agent Instructions';
            });

            for (const label of labels) {
                const searchRoots = [
                    label.parentElement,
                    label.parentElement?.parentElement,
                    label.parentElement?.nextElementSibling,
                    label.parentElement?.parentElement?.nextElementSibling,
                    label.closest('[data-testid^="rf__node-Agent-"]'),
                    label.closest('[data-testid^="Agent-"]'),
                ].filter(Boolean);

                for (const searchRoot of searchRoots) {
                    for (const input of collectInputs(searchRoot)) {
                        const score = scoreInput(input, 100000);
                        if (score > bestScore) {
                            best = input;
                            bestScore = score;
                        }
                    }
                }
            }

            if (best) {
                return best;
            }

            for (const input of collectInputs(root)) {
                const scopeText = normalize(
                    input.closest('[data-testid^="rf__node-Agent-"], [data-testid^="Agent-"], .react-flow__node')
                        ?.textContent || ''
                );
                const bonus = /agent instructions|define the agent's instructions|model provider/i.test(scopeText)
                    ? 50000
                    : 0;
                const score = scoreInput(input, bonus);
                if (score > bestScore) {
                    best = input;
                    bestScore = score;
                }
            }

            return best;
        });

        await rootHandle?.dispose().catch(() => {});
        await bodyHandle.dispose().catch(() => {});

        const candidate = candidateHandle.asElement();
        if (!candidate) {
            await candidateHandle.dispose().catch(() => {});
            return null;
        }

        return candidate;
    }

    async readTextElementValue(elementHandle) {
        try {
            return await elementHandle.inputValue();
        } catch {
            return await elementHandle.evaluate((element) => element.value || element.textContent || '');
        }
    }

    async writeTextElementValue(elementHandle, nextPrompt) {
        const tagName = await elementHandle.evaluate((element) => element.tagName.toLowerCase());

        if (tagName === 'textarea' || tagName === 'input') {
            await elementHandle.click({ force: true });
            await elementHandle.press('ControlOrMeta+a').catch(() => {});
            await elementHandle.fill(nextPrompt);
            return;
        }

        await elementHandle.evaluate((element, value) => {
            element.focus();
            if (element.isContentEditable) {
                element.textContent = value;
            } else if ('value' in element) {
                element.value = value;
            } else {
                element.textContent = value;
            }

            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.blur();
        }, nextPrompt);
    }

    async closeTextModal() {
        const visibleModal = await this.findFirstVisible(this.systemPromptModal);
        const closeTargets = [
            this.page.getByRole('button', { name: /^Close$/i }).last(),
            this.page.getByTestId('close_dialog_button'),
        ];

        for (const target of closeTargets) {
            if (await target.isVisible().catch(() => false)) {
                await this.clickLocatorReliably(target);
                await visibleModal?.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
                return;
            }
        }

        await this.page.keyboard.press('Escape').catch(() => {});
        await visibleModal?.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    }

    async dismissBlockingDialogs(maxAttempts = 5) {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const closeButtons = this.page.getByRole('button', { name: /^Close$/i });
            const count = await closeButtons.count();
            let clicked = false;

            for (let index = count - 1; index >= 0; index -= 1) {
                const closeButton = closeButtons.nth(index);
                if (!(await closeButton.isVisible().catch(() => false))) {
                    continue;
                }

                await this.clickLocatorReliably(closeButton, { timeout: 5000 });
                await this.page.waitForTimeout(500);
                clicked = true;
                break;
            }

            if (!clicked) {
                return;
            }
        }
    }

    async readSystemPrompt() {
        await this.dismissBlockingDialogs();
        const agentNode = await this.openAgentNode();
        const inlineInput = await this.findInlineAgentInstructionsHandle(agentNode);

        let prompt = '';
        if (inlineInput) {
            prompt = await this.readTextElementValue(inlineInput);
            await inlineInput.dispose().catch(() => {});
            return String(prompt || '').trim();
        }

        await this.clickLocatorReliably(this.systemPromptModalButton.first(), { timeout: 10000 });
        const systemPromptModal = await this.waitForFirstVisible(this.systemPromptModal, 5000).catch(
            () => null
        );

        if (systemPromptModal) {
            prompt = await this.readTextElementValue(systemPromptModal);
            await this.closeTextModal();
            return String(prompt || '').trim();
        }

        throw new Error('The Agent instructions input could not be located on the canvas.');
    }

    async writeSystemPrompt(nextPrompt) {
        await this.dismissBlockingDialogs();
        const agentNode = await this.openAgentNode();
        const inlineInput = await this.findInlineAgentInstructionsHandle(agentNode);

        if (inlineInput) {
            await this.writeTextElementValue(inlineInput, nextPrompt);
            await inlineInput.dispose().catch(() => {});
            return;
        }

        await this.clickLocatorReliably(this.systemPromptModalButton.first(), { timeout: 10000 });
        const systemPromptModal = await this.waitForFirstVisible(this.systemPromptModal, 5000).catch(
            () => null
        );

        if (systemPromptModal) {
            await this.writeTextElementValue(systemPromptModal, nextPrompt);
            const saveButton = await this.waitForFirstVisible(this.systemPromptSaveButton, 30000);
            await this.clickLocatorReliably(saveButton);
            await systemPromptModal.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
            return;
        }

        throw new Error('The Agent instructions input could not be located for prompt updates.');
    }

    async ensurePlaygroundOpen() {
        if (await this.playgroundInput.isVisible().catch(() => false)) {
            return this.playgroundInput;
        }

        const openButtons = [
            this.page.getByRole('button', { name: /^Explore$/i }).first(),
            this.page.getByRole('button', { name: /Playground/i }).first(),
        ];

        for (const button of openButtons) {
            if (await button.isVisible().catch(() => false)) {
                await this.clickLocatorReliably(button);
                await expect(this.playgroundInput).toBeVisible({ timeout: 30000 });
                return this.playgroundInput;
            }
        }

        throw new Error('The playground input could not be opened.');
    }

    async collectPlaygroundTexts() {
        const messageLocator = this.page.locator('.markdown, [class*="chat-text-position"] div');
        const texts = [];
        const count = await messageLocator.count();

        for (let index = 0; index < count; index += 1) {
            const candidate = messageLocator.nth(index);
            if (!(await candidate.isVisible().catch(() => false))) {
                continue;
            }

            const text = normalizeText(await candidate.innerText().catch(() => ''));
            if (text) {
                texts.push(text);
            }
        }

        return texts;
    }

    isIgnorablePlaygroundText(text, sentPrompt = '') {
        const normalized = normalizeText(text);
        const normalizedPrompt = normalizeText(sentPrompt);

        return (
            !normalized ||
            normalized === normalizedPrompt ||
            /^thinking$/i.test(normalized) ||
            /^processing your request/i.test(normalized) ||
            /^send a message$/i.test(normalized) ||
            /^default session$/i.test(normalized)
        );
    }

    async waitForPlaygroundActivity(previousTexts = [], timeout = 120000, sentPrompt = '') {
        const baseline = previousTexts.map(normalizeText).join('\n');
        const previousSet = new Set(previousTexts.map(normalizeText));
        const deadline = Date.now() + timeout;
        let sawChange = false;
        let lastSnapshot = baseline;
        let stablePolls = 0;

        while (Date.now() < deadline) {
            await this.approveHumanApprovalIfNeeded();

            const texts = await this.collectPlaygroundTexts();
            const snapshot = texts.map(normalizeText).join('\n');
            const meaningfulCandidates = texts.filter((text) => {
                const normalized = normalizeText(text);

                return (
                    !this.isIgnorablePlaygroundText(normalized, sentPrompt) &&
                    !previousSet.has(normalized)
                );
            });

            if (!sawChange && snapshot !== baseline) {
                sawChange = true;
                lastSnapshot = snapshot;
                stablePolls = 0;
            } else if (sawChange) {
                if (snapshot === lastSnapshot) {
                    stablePolls += 1;
                } else {
                    lastSnapshot = snapshot;
                    stablePolls = 0;
                }

                if (meaningfulCandidates.length > 0 && stablePolls >= 2) {
                    return texts;
                }

                if (!(await this.isBusy()) && stablePolls >= 2) {
                    return texts;
                }
            }

            await this.page.waitForTimeout(1000);
        }

        throw new Error('The playground did not show a new stable response within the expected time.');
    }

    async waitForPlaygroundResponse(previousTexts, sentPrompt, timeout = 120000) {
        const previousSet = new Set(previousTexts.map(normalizeText));
        const texts = await this.waitForPlaygroundActivity(previousTexts, timeout, sentPrompt);
        const candidates = texts.filter((text) => {
            const normalized = normalizeText(text);

            return !this.isIgnorablePlaygroundText(normalized, sentPrompt) && !previousSet.has(normalized);
        });

        if (candidates.length > 0) {
            return candidates[candidates.length - 1];
        }

        throw new Error('No new meaningful playground response was detected before the timeout expired.');
    }

    async sendPromptToPlayground(prompt) {
        await this.ensurePlaygroundOpen();
        const previousTexts = await this.collectPlaygroundTexts();

        await this.playgroundInput.click();
        await this.playgroundInput.press('ControlOrMeta+a').catch(() => {});
        await this.playgroundInput.fill(prompt);
        await this.clickLocatorReliably(this.playgroundSendButton);

        return this.waitForPlaygroundResponse(previousTexts, prompt);
    }

    async makeRefineAccessible() {
        if (await this.refineButton.isVisible().catch(() => false)) {
            return this.refineButton;
        }

        for (let attempt = 0; attempt < 4; attempt += 1) {
            const closeButton = await this.findFirstVisible(
                this.page.getByRole('button', { name: /^Close$/i })
            );

            if (!closeButton) {
                break;
            }

            await closeButton.click();
            if (await this.refineButton.isVisible().catch(() => false)) {
                return this.refineButton;
            }
        }

        await expect(this.refineButton).toBeVisible({ timeout: 30000 });
        return this.refineButton;
    }

    async applyRefinement(refinementText, timeout = 180000) {
        const refineButton = await this.makeRefineAccessible();
        await this.clickLocatorReliably(refineButton);

        await expect(this.flowDescriptionInput).toBeVisible({ timeout: 30000 });
        await this.flowDescriptionInput.fill(refinementText);

        const submitButton = this.page.locator('form').getByRole('button').nth(2);
        await expect(submitButton).toBeVisible({ timeout: 30000 });
        await this.clickLocatorReliably(submitButton);
        const busySeen = await this.waitForBusyStart(15000);

        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            await this.approveHumanApprovalIfNeeded();

            if (await this.doneButton.isVisible().catch(() => false)) {
                await this.clickLocatorReliably(this.doneButton);
                await this.waitForCanvasReady(60000);
                return;
            }

            if (
                busySeen &&
                !(await this.isBusy()) &&
                (await this.canvasNodes.first().isVisible().catch(() => false))
            ) {
                return;
            }

            await this.page.waitForTimeout(1000);
        }

        throw new Error('The built-in Refine workflow did not complete within the expected time.');
    }
}

module.exports = { AgentRefinementPage };
