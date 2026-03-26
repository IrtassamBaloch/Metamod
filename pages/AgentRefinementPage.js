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
        return this.page.getByRole('button', { name: /^Refine$/i }).first();
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

    async findLastVisible(locator) {
        const count = await locator.count();
        for (let index = count - 1; index >= 0; index -= 1) {
            const candidate = locator.nth(index);
            if (await candidate.isVisible().catch(() => false)) {
                return candidate;
            }
        }

        return null;
    }

    async waitForLastVisible(locator, timeout = 30000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const candidate = await this.findLastVisible(locator);
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

    async findLastVisibleEnabled(locator) {
        const count = await locator.count();
        for (let index = count - 1; index >= 0; index -= 1) {
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
        const requestButtons = [
            this.page.getByRole('button', { name: /Request Hitl Approval/i }),
            this.page.locator('button').filter({ hasText: /Request Hitl Approval/i }),
        ];
        const decisionButtons = [
            this.page.getByRole('button', { name: /^(Approve|Allow)$/i }),
            this.page.locator('button').filter({ hasText: /^(Approve|Allow)$/i }),
        ];

        for (const locator of requestButtons) {
            const requestButton = await this.findLastVisibleEnabled(locator);
            if (requestButton) {
                await this.clickLocatorReliably(requestButton);
                await this.page.waitForTimeout(1000);
                break;
            }
        }

        for (const locator of decisionButtons) {
            const decisionButton = await this.findLastVisibleEnabled(locator);
            if (decisionButton) {
                await this.clickLocatorReliably(decisionButton);
                await this.page.waitForTimeout(1000);
                return true;
            }
        }

        return false;
    }

    async hasPendingHumanApproval() {
        const approvalSignals = [
            this.page.getByText(/Human Approval Required/i),
            this.page.locator('button').filter({ hasText: /Request Hitl Approval/i }),
            this.page.locator('button').filter({ hasText: /^(Approve|Allow)$/i }),
        ];

        for (const signal of approvalSignals) {
            if (await this.findLastVisible(signal)) {
                return true;
            }
        }

        return false;
    }

    async findVisiblePlaygroundInput() {
        const candidates = [
            this.page.getByTestId('input-chat-playground'),
            this.page.getByPlaceholder('Send a message...'),
            this.page.getByRole('textbox', { name: /Send a message/i }),
        ];

        for (const candidate of candidates) {
            const visible = await this.findLastVisible(candidate);
            if (visible) {
                return visible;
            }
        }

        return null;
    }

    async waitForVisiblePlaygroundInput(timeout = 30000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const input = await this.findVisiblePlaygroundInput();
            if (input) {
                return input;
            }

            await this.page.waitForTimeout(500);
        }

        throw new Error(`No visible playground input was found within ${timeout} ms.`);
    }

    async waitForEnabledPlaygroundInput(timeout = 120000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const input = await this.findVisiblePlaygroundInput();
            if (input) {
                const disabled =
                    (await input.getAttribute('disabled').catch(() => null)) !== null ||
                    (await input.getAttribute('aria-disabled').catch(() => null)) === 'true';

                if (!disabled) {
                    return input;
                }
            }

            await this.approveHumanApprovalIfNeeded();
            await this.page.waitForTimeout(1000);
        }

        throw new Error(`No enabled playground input was found within ${timeout} ms.`);
    }

    async findVisiblePlaygroundSendButton() {
        const candidates = [
            this.page.getByTestId('button-send'),
            this.page.getByRole('button', { name: /^Send$/i }),
        ];

        for (const candidate of candidates) {
            const visible = await this.findLastVisibleEnabled(candidate);
            if (visible) {
                return visible;
            }
        }

        return null;
    }

    async waitForVisiblePlaygroundSendButton(timeout = 30000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const button = await this.findVisiblePlaygroundSendButton();
            if (button) {
                return button;
            }

            await this.page.waitForTimeout(500);
        }

        throw new Error(`No visible playground send button was found within ${timeout} ms.`);
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
        const wrapperButtons = this.page
            .getByTestId('header_right_section_wrapper')
            .getByRole('button');
        const count = await wrapperButtons.count();

        for (let index = 0; index < count; index += 1) {
            const candidate = wrapperButtons.nth(index);
            if (!(await candidate.isVisible().catch(() => false))) {
                continue;
            }

            const disabled =
                (await candidate.getAttribute('disabled').catch(() => null)) !== null ||
                (await candidate.getAttribute('aria-disabled').catch(() => null)) === 'true';
            if (disabled) {
                continue;
            }

            const label = normalizeText(await candidate.innerText().catch(() => ''));
            if (/^view draft$/i.test(label)) {
                continue;
            }

            await this.clickLocatorReliably(candidate);

            const input = await this.waitForVisiblePlaygroundInput(5000).catch(() => null);
            if (input) {
                return true;
            }

            const playgroundSignals = [
                this.page.getByText(/^Playground$/i),
                this.page.getByRole('button', { name: /Test Draft/i }),
                this.page.getByRole('button', { name: /^Test$/i }),
            ];

            for (const signal of playgroundSignals) {
                if (await this.findLastVisible(signal)) {
                    return true;
                }
            }

            if (await this.findLastVisible(this.page.getByText(/Project Files Manager/i))) {
                await this.dismissBlockingDialogs().catch(() => {});
                continue;
            }

            const busyStarted = await this.waitForBusyStart(5000);
            if (busyStarted) {
                try {
                    await this.waitForIdle(45000);
                } catch {
                    await this.stopCurrentRunIfNeeded(15000).catch(() => {});
                }

                return true;
            }
        }

        return false;
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
        await this.dismissBlockingDialogs().catch(() => {});
        const existingInput = await this.findVisiblePlaygroundInput();
        if (existingInput) {
            return existingInput;
        }

        await this.runGlobalHeader().catch(() => {});
        const inputAfterHeader = await this.findVisiblePlaygroundInput();
        if (inputAfterHeader) {
            return inputAfterHeader;
        }

        const openButtons = [
            this.page.getByRole('button', { name: /Playground/i }),
            this.page.getByRole('button', { name: /^Test$/i }),
            this.page.getByRole('button', { name: /Test Draft/i }),
            this.page.locator('button').filter({ hasText: /Test/i }),
        ];

        for (const button of openButtons) {
            const target = await this.findLastVisibleEnabled(button);
            if (target) {
                await this.clickLocatorReliably(target);
                return this.waitForVisiblePlaygroundInput(30000).catch(async () => {
                    await this.dismissBlockingDialogs().catch(() => {});
                    return this.waitForVisiblePlaygroundInput(10000);
                });
            }
        }

        throw new Error('The playground input could not be opened.');
    }

    async collectPlaygroundTexts() {
        const messageLocator = this.page.locator('p');
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
        const input = await this.waitForEnabledPlaygroundInput(120000);

        await input.click();
        await input.press('ControlOrMeta+a').catch(() => {});
        await input.fill(prompt);
        const sendButton = await this.waitForVisiblePlaygroundSendButton(30000);
        await this.clickLocatorReliably(sendButton);

        return this.waitForPlaygroundResponse(previousTexts, prompt);
    }

    async getVisiblePlaygroundRootHandle(timeout = 30000) {
        const input = await this.waitForVisiblePlaygroundInput(timeout);
        const inputHandle = await input.elementHandle();
        if (!inputHandle) {
            throw new Error('The visible playground input detached before its container could be resolved.');
        }

        const rootHandle = await inputHandle.evaluateHandle((element) => {
            const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
            const isPlaygroundRoot = (node) => {
                const text = normalize(node.textContent || '');
                return /playground|default session|to-do timeline|new chat|send a message/i.test(text);
            };

            let candidate = element.parentElement;
            while (candidate && candidate !== document.body) {
                if (isPlaygroundRoot(candidate)) {
                    return candidate;
                }

                candidate = candidate.parentElement;
            }

            return element.closest('div') || element;
        });

        await inputHandle.dispose().catch(() => {});
        const root = rootHandle.asElement();
        if (!root) {
            await rootHandle.dispose().catch(() => {});
            throw new Error('The playground root container could not be resolved.');
        }

        return root;
    }

    async openFreshPlaygroundChat() {
        await this.ensurePlaygroundOpen();

        const newChatCandidates = [
            this.page.getByTestId('new-chat'),
            this.page.getByRole('button', { name: /New chat/i }),
        ];

        for (const candidate of newChatCandidates) {
            const newChatButton = await this.findLastVisibleEnabled(candidate);
            if (!newChatButton) {
                continue;
            }

            await this.clickLocatorReliably(newChatButton);
            await this.page.waitForTimeout(1000);
            break;
        }

        const input = await this.waitForVisiblePlaygroundInput(30000);
        await input.click();
        await input.press('ControlOrMeta+a').catch(() => {});
        await input.fill('');
    }

    async collectPlaygroundMessages() {
        const rootHandle = await this.getVisiblePlaygroundRootHandle();

        try {
            return await rootHandle.evaluate((root) => {
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

                const timelineHeading = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')).find(
                    (element) => normalize(element.textContent) === 'To-Do Timeline' && isVisible(element)
                );
                const timelineLeft = timelineHeading
                    ? timelineHeading.getBoundingClientRect().left - 20
                    : root.getBoundingClientRect().right - 420;

                const messages = [];
                const paragraphs = Array.from(root.querySelectorAll('p')).filter(
                    (paragraph) => isVisible(paragraph) && paragraph.getBoundingClientRect().left < timelineLeft
                );

                for (const paragraph of paragraphs) {
                    const text = normalize(paragraph.textContent || '');
                    if (!text) {
                        continue;
                    }

                    let role = 'unknown';
                    let candidate = paragraph;
                    for (let guard = 0; guard < 4 && candidate; guard += 1) {
                        const scopeText = normalize(candidate.textContent || '');
                        if (/(^|\s)user(\s|$)/i.test(scopeText)) {
                            role = 'user';
                            break;
                        }

                        if (/(^|\s)ai(\s|$)/i.test(scopeText)) {
                            role = 'assistant';
                            break;
                        }

                        candidate = candidate.parentElement;
                    }

                    const lastMessage = messages[messages.length - 1];
                    if (!lastMessage || lastMessage.role !== role || lastMessage.text !== text) {
                        messages.push({ role, text });
                    }
                }

                return messages;
            });
        } finally {
            await rootHandle.dispose().catch(() => {});
        }
    }

    async collectTimelineSteps() {
        const rootHandle = await this.getVisiblePlaygroundRootHandle();

        try {
            return await rootHandle.evaluate((root) => {
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
                const isGreenish = (value) => {
                    if (!value) {
                        return false;
                    }

                    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
                    if (!match) {
                        return /green|emerald|lime/i.test(value);
                    }

                    const [, red, green, blue] = match.map(Number);
                    return green >= 100 && green > red + 20 && green > blue + 20;
                };

                const timelineHeading = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')).find(
                    (element) => normalize(element.textContent) === 'To-Do Timeline' && isVisible(element)
                );
                if (!timelineHeading) {
                    return [];
                }

                const boundary = timelineHeading.getBoundingClientRect().left - 30;
                const steps = [];
                const seen = new Set();

                const headingCandidates = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(
                    (element) =>
                        isVisible(element) &&
                        normalize(element.textContent) &&
                        element.getBoundingClientRect().left >= boundary
                );

                for (const heading of headingCandidates) {
                    const label = normalize(heading.textContent || '');
                    if (!label || label === 'To-Do Timeline' || seen.has(label)) {
                        continue;
                    }

                    let row = heading;
                    for (let index = 0; index < 3; index += 1) {
                        if (row.parentElement && normalize(row.parentElement.textContent || '').includes(label)) {
                            row = row.parentElement;
                        }
                    }

                    const rowText = normalize(row.textContent || '');
                    const iconNodes = Array.from(
                        row.querySelectorAll('svg, [data-testid], [aria-label], [class*="lucide"]')
                    );
                    const labelRect = heading.getBoundingClientRect();
                    const indicatorCandidates = [row, ...Array.from(row.querySelectorAll('*'))].filter(
                        (element) => {
                            if (!isVisible(element)) {
                                return false;
                            }

                            const rect = element.getBoundingClientRect();
                            const verticallyAligned =
                                rect.bottom >= labelRect.top - 24 && rect.top <= labelRect.bottom + 24;
                            const onIndicatorSide = rect.right <= labelRect.left + 28;
                            const compact =
                                rect.width > 0 && rect.width <= 96 && rect.height > 0 && rect.height <= 96;

                            return verticallyAligned && onIndicatorSide && compact;
                        }
                    );
                    const iconMeta = iconNodes
                        .map((element) => {
                            const className =
                                typeof element.className === 'string'
                                    ? element.className
                                    : element.className?.baseVal || '';

                            return [
                                className,
                                element.getAttribute('data-testid') || '',
                                element.getAttribute('aria-label') || '',
                            ].join(' ');
                        })
                        .join(' ');
                    const indicatorMeta = indicatorCandidates
                        .map((element) => {
                            const className =
                                typeof element.className === 'string'
                                    ? element.className
                                    : element.className?.baseVal || '';

                            return [
                                className,
                                element.getAttribute('data-testid') || '',
                                element.getAttribute('aria-label') || '',
                            ].join(' ');
                        })
                        .join(' ');
                    const hasGreen = iconNodes.some((element) => {
                        const style = window.getComputedStyle(element);
                        return [style.color, style.fill, style.stroke].some(isGreenish);
                    });
                    const hasGreenIndicator = indicatorCandidates.some((element) => {
                        const style = window.getComputedStyle(element);
                        return [
                            style.color,
                            style.fill,
                            style.stroke,
                            style.borderColor,
                            style.backgroundColor,
                            style.outlineColor,
                        ].some(isGreenish);
                    });
                    const hasCheckLike = /check|success|done|completed/i.test(
                        `${iconMeta} ${indicatorMeta}`
                    );
                    const hasDuration = /\b\d+(?:\.\d+)?s\b/i.test(rowText);
                    const hasPendingLike =
                        /loader|loading|spinner|progress|clock|pending/i.test(iconMeta) ||
                        /in progress/i.test(rowText);
                    const completed = hasGreenIndicator && (hasCheckLike || hasDuration || hasGreen);

                    steps.push({
                        label,
                        text: rowText,
                        completed,
                        greenIndicator: hasGreenIndicator,
                        checkIndicator: hasCheckLike || hasGreen,
                        status: completed ? 'completed' : hasPendingLike ? 'pending' : 'unknown',
                    });
                    seen.add(label);
                }

                return steps;
            });
        } finally {
            await rootHandle.dispose().catch(() => {});
        }
    }

    summarizeTimeline(timelineSteps = []) {
        return timelineSteps.map((step) => `${step.label} [${step.status}]`).join(' | ');
    }

    async getOutputTimelineState() {
        const rootHandle = await this.getVisiblePlaygroundRootHandle();

        try {
            return await rootHandle.evaluate((root) => {
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
                const isGreenish = (value) => {
                    if (!value) {
                        return false;
                    }

                    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
                    if (!match) {
                        return /green|emerald|lime/i.test(value);
                    }

                    const [, red, green, blue] = match.map(Number);
                    return green >= 100 && green > red + 20 && green > blue + 20;
                };

                const allVisible = Array.from(root.querySelectorAll('*')).filter(isVisible);
                const timelineLabel = allVisible.find(
                    (element) => normalize(element.textContent) === 'To-Do Timeline'
                );
                const boundary = timelineLabel
                    ? timelineLabel.getBoundingClientRect().left - 30
                    : root.getBoundingClientRect().right - 420;
                let timelinePanel = timelineLabel?.parentElement || null;

                let ancestor = timelineLabel?.parentElement || null;
                while (ancestor && ancestor !== root) {
                    const rect = ancestor.getBoundingClientRect();
                    const text = normalize(ancestor.textContent || '');
                    if (text.includes('To-Do Timeline') && rect.left >= boundary - 40 && rect.width <= 520) {
                        timelinePanel = ancestor;
                        break;
                    }

                    ancestor = ancestor.parentElement;
                }

                const panelElements = timelinePanel
                    ? [timelinePanel, ...Array.from(timelinePanel.querySelectorAll('*')).filter(isVisible)]
                    : allVisible;
                const outputLabels = panelElements.filter((element) => {
                    const text = normalize(element.textContent || '');
                    if (text !== 'Output') {
                        return false;
                    }

                    const rect = element.getBoundingClientRect();
                    return rect.left >= boundary;
                });

                if (outputLabels.length === 0) {
                    return {
                        visible: false,
                        completed: false,
                        greenIndicator: false,
                        checkIndicator: false,
                        text: '',
                    };
                }

                const outputLabel = outputLabels.sort(
                    (left, right) =>
                        left.getBoundingClientRect().width * left.getBoundingClientRect().height -
                        right.getBoundingClientRect().width * right.getBoundingClientRect().height
                )[0];
                const labelRect = outputLabel.getBoundingClientRect();
                let row = outputLabel;
                for (let index = 0; index < 4; index += 1) {
                    if (!row.parentElement) {
                        break;
                    }

                    const parentText = normalize(row.parentElement.textContent || '');
                    if (!parentText.includes('Output')) {
                        break;
                    }

                    row = row.parentElement;
                }

                const rowText = normalize(row.textContent || '');
                const iconNodes = Array.from(
                    row.querySelectorAll('svg, [data-testid], [aria-label], [class*="lucide"]')
                );
                const indicatorCandidates = [row, ...Array.from(row.querySelectorAll('*'))].filter((element) => {
                    if (!isVisible(element)) {
                        return false;
                    }

                    const rect = element.getBoundingClientRect();
                    const verticallyAligned =
                        rect.bottom >= labelRect.top - 24 && rect.top <= labelRect.bottom + 24;
                    const onIndicatorSide = rect.right <= labelRect.left + 28;
                    const compact =
                        rect.width > 0 && rect.width <= 96 && rect.height > 0 && rect.height <= 96;

                    return verticallyAligned && onIndicatorSide && compact;
                });
                const combinedMeta = [...iconNodes, ...indicatorCandidates]
                    .map((element) => {
                        const className =
                            typeof element.className === 'string'
                                ? element.className
                                : element.className?.baseVal || '';

                        return [
                            className,
                            element.getAttribute('data-testid') || '',
                            element.getAttribute('aria-label') || '',
                        ].join(' ');
                    })
                    .join(' ');
                const greenIndicator = indicatorCandidates.some((element) => {
                    const style = window.getComputedStyle(element);
                    return [
                        style.color,
                        style.fill,
                        style.stroke,
                        style.borderColor,
                        style.backgroundColor,
                        style.outlineColor,
                    ].some(isGreenish);
                });
                const iconGreen = iconNodes.some((element) => {
                    const style = window.getComputedStyle(element);
                    return [style.color, style.fill, style.stroke].some(isGreenish);
                });
                const checkIndicator = /check|success|done|completed/i.test(combinedMeta) || iconGreen;
                const hasDuration = /\b\d+(?:\.\d+)?s\b/i.test(rowText);
                const completed = hasDuration || greenIndicator || checkIndicator;

                return {
                    visible: true,
                    completed,
                    greenIndicator,
                    checkIndicator,
                    text: rowText,
                };
            });
        } finally {
            await rootHandle.dispose().catch(() => {});
        }
    }

    findOutputTimelineStep(timelineSteps = []) {
        return (
            timelineSteps.find(
                (step) =>
                    /^output$/i.test(step.label) || /return both text and json outputs/i.test(step.label)
            ) || null
        );
    }

    isOutputStepCompleted(timelineSteps = []) {
        const outputStep = this.findOutputTimelineStep(timelineSteps);
        return Boolean(outputStep && outputStep.completed && outputStep.greenIndicator);
    }

    async assertOutputTimelineCompleted(timeout = 30000) {
        await expect
            .poll(
                async () => Boolean((await this.collectPlaygroundState().catch(() => null))?.outputCompleted),
                {
                    timeout,
                    message: 'Expected the To-Do Timeline Output step to show a completed state.',
                }
            )
            .toBe(true);
    }

    async collectPlaygroundState() {
        const messages = await this.collectPlaygroundMessages().catch(() => []);
        const timelineSteps = await this.collectTimelineSteps().catch(() => []);
        const outputState = await this.getOutputTimelineState().catch(() => null);
        const outputCompleted = this.isOutputStepCompleted(timelineSteps) || Boolean(outputState?.completed);
        const approvalPending = await this.hasPendingHumanApproval();
        const busy = await this.isBusy().catch(() => false);
        const assistantMessages = messages.filter((entry) => entry.role === 'assistant');
        const mergedTimelineSteps = [...timelineSteps];

        if (outputState?.visible && !this.findOutputTimelineStep(mergedTimelineSteps)) {
            mergedTimelineSteps.push({
                label: 'Output',
                text: outputState.text || 'Output',
                completed: Boolean(outputState.completed),
                greenIndicator: Boolean(outputState.greenIndicator),
                checkIndicator: Boolean(outputState.checkIndicator),
                status: outputState.completed ? 'completed' : 'unknown',
            });
        }

        return {
            messages,
            timelineSteps: mergedTimelineSteps,
            outputCompleted,
            approvalPending,
            busy,
            transcriptText: messages.map((entry) => `${entry.role}: ${entry.text}`).join('\n'),
            timelineText: this.summarizeTimeline(mergedTimelineSteps),
            finalAssistantResponse: assistantMessages.at(-1)?.text || '',
            snapshot: JSON.stringify({
                outputCompleted,
                approvalPending,
                busy,
                messages: messages.slice(-6),
                timeline: mergedTimelineSteps.map((step) => `${step.label}:${step.status}`),
            }),
        };
    }

    async waitForPlaygroundStateChange(previousState = null, timeout = 120000) {
        const deadline = Date.now() + timeout;
        let lastChangedSnapshot = '';
        let stablePolls = 0;

        while (Date.now() < deadline) {
            await this.dismissWalkthroughIfPresent().catch(() => {});
            await this.approveHumanApprovalIfNeeded();

            const state = await this.collectPlaygroundState().catch(() => null);
            if (!state) {
                await this.page.waitForTimeout(1000);
                continue;
            }

            if (state.outputCompleted) {
                return state;
            }

            if (state.approvalPending) {
                await this.page.waitForTimeout(1000);
                continue;
            }

            if (!previousState) {
                if (!state.busy) {
                    return state;
                }

                await this.page.waitForTimeout(1000);
                continue;
            }

            if (state.snapshot !== previousState.snapshot) {
                if (state.snapshot === lastChangedSnapshot) {
                    stablePolls += 1;
                } else {
                    lastChangedSnapshot = state.snapshot;
                    stablePolls = 0;
                }

                if (!state.busy && stablePolls >= 1) {
                    return state;
                }
            } else if (!state.busy) {
                return state;
            }

            await this.page.waitForTimeout(1000);
        }

        return this.collectPlaygroundState();
    }

    async sendMessageToVisiblePlayground(message) {
        const previousState = await this.collectPlaygroundState();
        const input = await this.waitForEnabledPlaygroundInput(120000);

        await input.click();
        await input.press('ControlOrMeta+a').catch(() => {});
        await input.fill(message);
        const sendButton = await this.waitForVisiblePlaygroundSendButton(30000);
        await this.clickLocatorReliably(sendButton);

        return this.waitForPlaygroundStateChange(previousState, 120000);
    }

    async runAiGuidedPlaygroundSession({
        initialPrompt,
        maxTurns,
        openAIRefinementClient,
        systemPrompt,
        agentContext,
        visibleNodeLabels,
    }) {
        await this.openFreshPlaygroundChat();

        const sentMessages = [];
        let currentState = await this.collectPlaygroundState();
        let lastFailureReason = '';
        const normalizedInitialPrompt = normalizeText(initialPrompt);
        const alreadySeeded = currentState.messages.some(
            (entry) => entry.role === 'user' && normalizeText(entry.text) === normalizedInitialPrompt
        );

        if (alreadySeeded) {
            sentMessages.push(initialPrompt);
            currentState = await this.waitForPlaygroundStateChange(currentState, 120000);
        } else {
            currentState = await this.sendMessageToVisiblePlayground(initialPrompt);
            sentMessages.push(initialPrompt);
        }

        for (let turn = 1; turn <= maxTurns; turn += 1) {
            if (currentState.outputCompleted) {
                await this.assertOutputTimelineCompleted(30000);
                return {
                    outputCompleted: true,
                    turnCount: turn,
                    transcriptText: currentState.transcriptText,
                    timelineSummary: currentState.timelineText,
                    timelineSteps: currentState.timelineSteps,
                    finalAssistantResponse: currentState.finalAssistantResponse,
                    messages: currentState.messages,
                    failureReason: '',
                    sentMessages,
                };
            }

            if (currentState.approvalPending) {
                await this.approveHumanApprovalIfNeeded();
                currentState = await this.waitForPlaygroundStateChange(currentState, 60000);
                if (currentState.outputCompleted) {
                    await this.assertOutputTimelineCompleted(30000);
                    return {
                        outputCompleted: true,
                        turnCount: turn,
                        transcriptText: currentState.transcriptText,
                        timelineSummary: currentState.timelineText,
                        timelineSteps: currentState.timelineSteps,
                        finalAssistantResponse: currentState.finalAssistantResponse,
                        messages: currentState.messages,
                        failureReason: '',
                        sentMessages,
                    };
                }
            }

            const nextAction = await openAIRefinementClient.generateNextPlaygroundMessage({
                systemPrompt,
                agentContext,
                visibleNodeLabels,
                transcript: currentState.messages,
                timelineSteps: currentState.timelineSteps,
                outputCompleted: currentState.outputCompleted,
                pendingApproval: currentState.approvalPending,
                sentMessages,
                turnIndex: turn,
                maxTurns,
            });

            if (nextAction.action === 'stop') {
                lastFailureReason =
                    nextAction.reason || 'The playground session stopped before the Output step completed.';
                break;
            }

            if (!nextAction.nextMessage) {
                lastFailureReason =
                    nextAction.reason || 'The AI guidance did not return a follow-up playground message.';
                break;
            }

            currentState = await this.sendMessageToVisiblePlayground(nextAction.nextMessage);
            sentMessages.push(nextAction.nextMessage);
            lastFailureReason = nextAction.reason || '';
        }

        return {
            outputCompleted: currentState.outputCompleted,
            turnCount: sentMessages.length,
            transcriptText: currentState.transcriptText,
            timelineSummary: currentState.timelineText,
            timelineSteps: currentState.timelineSteps,
            finalAssistantResponse: currentState.finalAssistantResponse,
            messages: currentState.messages,
            failureReason:
                lastFailureReason ||
                'The playground session exhausted the allowed chat turns before the Output step completed.',
            sentMessages,
        };
    }

    async closePlaygroundWidget() {
        const closeButtons = [
            this.page.getByRole('button', { name: /^Close$/i }),
            this.page.getByTestId('close_dialog_button'),
        ];

        for (const locator of closeButtons) {
            const closeButton = await this.findLastVisible(locator);
            if (!closeButton) {
                continue;
            }

            await this.clickLocatorReliably(closeButton, { timeout: 5000 });
            await this.page.waitForTimeout(1000);
            return true;
        }

        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(1000);
        return !(await this.findVisiblePlaygroundInput());
    }

    async hasPlaygroundInterface() {
        if (await this.findVisiblePlaygroundInput()) {
            return true;
        }

        const triggers = [
            this.page.getByRole('button', { name: /^Explore$/i }),
            this.page.getByRole('button', { name: /Playground/i }),
            this.page.getByRole('button', { name: /^Test$/i }),
        ];

        for (const locator of triggers) {
            if (await this.findLastVisible(locator)) {
                return true;
            }
        }

        return false;
    }

    async captureCanvasScreenshot(outputPath) {
        await this.page.screenshot({ path: outputPath, fullPage: true });
        return outputPath;
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
                return { completed: true, statusVisible: true };
            }

            if (
                busySeen &&
                !(await this.isBusy()) &&
                (await this.canvasNodes.first().isVisible().catch(() => false))
            ) {
                return { completed: true, statusVisible: true };
            }

            await this.page.waitForTimeout(1000);
        }

        throw new Error('The built-in Refine workflow did not complete within the expected time.');
    }
}

module.exports = { AgentRefinementPage };
