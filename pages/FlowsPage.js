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
            const latestFlowHandle = await this.findLatestFlowHandle();

            if (!overlayVisible && latestFlowHandle) {
                await latestFlowHandle.dispose().catch(() => {});
                return;
            }

            await latestFlowHandle?.dispose().catch(() => {});
            await this.page.waitForTimeout(500);
        }

        throw new Error('The flow list did not settle into a clickable state in time.');
    }

    async findLatestFlowHandle() {
        const dialogVisible = await this.flowListDialog.isVisible().catch(() => false);
        if (!dialogVisible) {
            return null;
        }

        const dialogHandle = await this.flowListDialog.elementHandle();
        if (!dialogHandle) {
            return null;
        }

        const candidateHandle = await dialogHandle.evaluateHandle((dialog) => {
            const elements = Array.from(dialog.querySelectorAll('*'));
            const metadataNodes = elements.filter((element) => {
                const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
                return /edited\s.+/i.test(text);
            });

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
                        return candidate;
                    }

                    candidate = candidate.parentElement;
                }
            }

            return null;
        });

        const candidate = candidateHandle.asElement();
        if (!candidate) {
            await candidateHandle.dispose().catch(() => {});
            return null;
        }

        return candidate;
    }

    async openLatestFlow() {
        await this.flowListDialog.waitFor({ state: 'visible', timeout: 30000 });
        await this.waitForFlowListToSettle();

        const flowHandle = await this.findLatestFlowHandle();
        if (!flowHandle) {
            throw new Error('No clickable flow rows were found after opening the Flows listing.');
        }

        await flowHandle.scrollIntoViewIfNeeded().catch(() => {});
        await flowHandle.click();
        await flowHandle.dispose().catch(() => {});
    }
}

module.exports = { FlowsPage };
