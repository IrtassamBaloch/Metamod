'use strict';

class SystemPromptEditor {
    constructor(page, canvas) {
        this.page = page;
        this.canvas = canvas;
    }

    get agentNodeContainers() {
        return this.page.locator(
            '[data-testid^="rf__node-Agent-"], [data-testid^="Agent-"][data-testid$="-main-node"]'
        );
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

    async openAgentNode() {
        const candidateLocators = [
            this.agentNodeContainers.first(),
            this.page.getByText(/^Agent$/).first(),
        ];

        for (const candidate of candidateLocators) {
            if (await candidate.isVisible().catch(() => false)) {
                await this.canvas.clickLocatorReliably(candidate, { timeout: 10000 });
                await this.waitForAgentEditor();
                const agentNode = await this.canvas.findFirstVisible(this.agentNodeContainers);
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
        const visibleModal = await this.canvas.findFirstVisible(this.systemPromptModal);
        const closeTargets = [
            this.page.getByRole('button', { name: /^Close$/i }).last(),
            this.page.getByTestId('close_dialog_button'),
        ];

        for (const target of closeTargets) {
            if (await target.isVisible().catch(() => false)) {
                await this.canvas.clickLocatorReliably(target);
                await visibleModal?.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
                return;
            }
        }

        await this.page.keyboard.press('Escape').catch(() => {});
        await visibleModal?.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    }

    async readSystemPrompt() {
        await this.canvas.dismissBlockingDialogs();
        const agentNode = await this.openAgentNode();
        const inlineInput = await this.findInlineAgentInstructionsHandle(agentNode);

        let prompt = '';
        if (inlineInput) {
            prompt = await this.readTextElementValue(inlineInput);
            await inlineInput.dispose().catch(() => {});
            return String(prompt || '').trim();
        }

        await this.canvas.clickLocatorReliably(this.systemPromptModalButton.first(), { timeout: 10000 });
        const systemPromptModal = await this.canvas.waitForFirstVisible(this.systemPromptModal, 5000).catch(
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
        await this.canvas.dismissBlockingDialogs();
        const agentNode = await this.openAgentNode();
        const inlineInput = await this.findInlineAgentInstructionsHandle(agentNode);

        if (inlineInput) {
            await this.writeTextElementValue(inlineInput, nextPrompt);
            await inlineInput.dispose().catch(() => {});
            return;
        }

        await this.canvas.clickLocatorReliably(this.systemPromptModalButton.first(), { timeout: 10000 });
        const systemPromptModal = await this.canvas.waitForFirstVisible(this.systemPromptModal, 5000).catch(
            () => null
        );

        if (systemPromptModal) {
            await this.writeTextElementValue(systemPromptModal, nextPrompt);
            const saveButton = await this.canvas.waitForFirstVisible(this.systemPromptSaveButton, 30000);
            await this.canvas.clickLocatorReliably(saveButton);
            await systemPromptModal.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
            return;
        }

        throw new Error('The Agent instructions input could not be located for prompt updates.');
    }
}

module.exports = { SystemPromptEditor };
