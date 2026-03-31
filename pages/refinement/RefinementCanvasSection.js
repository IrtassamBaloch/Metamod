'use strict';

const { expect } = require('@playwright/test');

const { normalizeText } = require('../../utils/refinement');
const { BaseCanvasPage } = require('../BaseCanvasPage');

class RefinementCanvasSection extends BaseCanvasPage {
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

    get doneButton() {
        return this.page.getByRole('button', { name: /^Done(?: \(\d+ steps\))?$/ }).first();
    }

    async openLatestPlaygroundCapableFlow({ dashboardPage, flowsPage }) {
        await dashboardPage.skipPopup();
        await dashboardPage.navigateToFlows();
        const flowLabel = await flowsPage.openLatestFlow();
        await this.waitForCanvasReady(60000);
        await dashboardPage.skipPopup();

        const nodeLabels = await this.collectVisibleNodeLabels().catch(() => []);

        return {
            flowLabel,
            recencyOffset: 0,
            nodeLabels,
        };
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

    async waitForEnabledPlaygroundInput(timeout = 240000) {
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
            this.page.getByRole('application').first(),
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
            await this.waitForIdle(60000);
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

module.exports = { RefinementCanvasSection };
