'use strict';

class FlowsPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
    }

    get flowListDialog() {
        return this.page.locator('[role="dialog"]').last();
    }

    get loadingOverlay() {
        return this.page
            .locator('.fixed.inset-0.z-50[data-aria-hidden="true"] .animate-pulse')
            .first();
    }

    async waitForFlowListToSettle(timeout = 30000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const overlayVisible = await this.loadingOverlay.isVisible().catch(() => false);
            const dialogVisible = await this.flowListDialog.isVisible().catch(() => false);

            if (dialogVisible && !overlayVisible) {
                return;
            }

            await this.page.waitForTimeout(500);
        }

        throw new Error('The flow list dialog did not become ready in time.');
    }

    async findLatestFlowHandle() {
        return this.findFlowHandleByRecency(0);
    }

    async findFlowHandleByRecency(recencyOffset = 0) {
        const dialogVisible = await this.flowListDialog.isVisible().catch(() => false);
        if (!dialogVisible) {
            return null;
        }

        const dialogHandle = await this.flowListDialog.elementHandle();
        if (!dialogHandle) {
            return null;
        }

        const candidateHandle = await dialogHandle.evaluateHandle((dialog, offset) => {
            const elements = Array.from(dialog.querySelectorAll('*'));
            const metadataNodes = elements.filter((element) => {
                const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
                return /edited\s.+/i.test(text);
            });
            const candidates = [];
            const seen = new Set();

            for (const metadataNode of metadataNodes) {
                let candidate = metadataNode;

                while (candidate && candidate !== dialog) {
                    const text = (candidate.textContent || '').replace(/\s+/g, ' ').trim();
                    const style = window.getComputedStyle(candidate);
                    const rect = candidate.getBoundingClientRect();

                    if (
                        !/upload|build with chat|use a template|blank flow|delete|search flows|of \d+ flows/i.test(
                            text
                        ) &&
                        style.cursor === 'pointer' &&
                        rect.width > 0 &&
                        rect.height > 0
                    ) {
                        if (!seen.has(candidate)) {
                            candidates.push(candidate);
                            seen.add(candidate);
                        }

                        break;
                    }

                    candidate = candidate.parentElement;
                }
            }

            return candidates[offset] || null;
        }, recencyOffset);

        const candidate = candidateHandle.asElement();
        if (!candidate) {
            await candidateHandle.dispose().catch(() => {});
            return null;
        }

        return candidate;
    }

    async openLatestFlow() {
        await this.openFlowByRecency(0);
    }

    async openFlowByRecency(recencyOffset = 0) {
        await this.flowListDialog.waitFor({ state: 'visible', timeout: 30000 });
        await this.waitForFlowListToSettle();

        const deadline = Date.now() + 30000;
        let flowHandle = null;
        while (Date.now() < deadline) {
            flowHandle = await this.findFlowHandleByRecency(recencyOffset);
            if (flowHandle) {
                break;
            }

            await this.page.waitForTimeout(500);
        }

        if (!flowHandle) {
            throw new Error(
                `No clickable flow rows were found for recency offset ${recencyOffset} after opening the Flows listing.`
            );
        }

        const flowLabel = ((await flowHandle.innerText().catch(() => '')) || '')
            .replace(/\s+/g, ' ')
            .trim();
        await flowHandle.scrollIntoViewIfNeeded().catch(() => {});
        await flowHandle.click();
        await flowHandle.dispose().catch(() => {});

        return flowLabel;
    }
}

module.exports = { FlowsPage };
