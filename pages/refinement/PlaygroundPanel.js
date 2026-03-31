'use strict';

const { expect } = require('@playwright/test');

const { normalizeText } = require('../../utils/refinement');

class PlaygroundPanel {
    constructor(page, canvas) {
        this.page = page;
        this.canvas = canvas;
    }

    async ensurePlaygroundOpen() {
        await this.canvas.dismissBlockingDialogs().catch(() => {});
        const existingInput = await this.canvas.findVisiblePlaygroundInput();
        if (existingInput) {
            return existingInput;
        }

        await this.canvas.runGlobalHeader().catch(() => {});
        const inputAfterHeader = await this.canvas.findVisiblePlaygroundInput();
        if (inputAfterHeader) {
            return inputAfterHeader;
        }

        const openButtons = [
            this.page.getByRole('button', { name: /^Explore$/i }),
            this.page.getByRole('button', { name: /Playground/i }),
            this.page.getByRole('button', { name: /^Test$/i }),
            this.page.getByRole('button', { name: /Test Draft/i }),
            this.page.locator('button').filter({ hasText: /Test/i }),
        ];

        for (const button of openButtons) {
            const target = await this.canvas.findLastVisibleEnabled(button);
            if (target) {
                await this.canvas.clickLocatorReliably(target);
                return this.canvas.waitForVisiblePlaygroundInput(30000).catch(async () => {
                    await this.canvas.dismissBlockingDialogs().catch(() => {});
                    return this.canvas.waitForVisiblePlaygroundInput(10000);
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
            await this.canvas.approveHumanApprovalIfNeeded();

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

                if (!(await this.canvas.isBusy()) && stablePolls >= 2) {
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
        const input = await this.canvas.waitForEnabledPlaygroundInput(240000);

        await input.click();
        await input.press('ControlOrMeta+a').catch(() => {});
        await input.fill(prompt);
        const sendButton = await this.canvas.waitForVisiblePlaygroundSendButton(30000);
        await this.canvas.clickLocatorReliably(sendButton);

        return this.waitForPlaygroundResponse(previousTexts, prompt);
    }

    async getVisiblePlaygroundRootHandle(timeout = 30000) {
        const input = await this.canvas.waitForVisiblePlaygroundInput(timeout);
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
            const newChatButton = await this.canvas.findLastVisibleEnabled(candidate);
            if (!newChatButton) {
                continue;
            }

            await this.canvas.clickLocatorReliably(newChatButton);
            await this.page.waitForTimeout(1000);
            break;
        }

        const input = await this.canvas.waitForVisiblePlaygroundInput(30000);
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
                        if (/(^|\\s)user(\\s|$)/i.test(scopeText)) {
                            role = 'user';
                            break;
                        }

                        if (/(^|\\s)ai(\\s|$)/i.test(scopeText)) {
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
        const approvalPending = await this.canvas.hasPendingHumanApproval();
        const busy = await this.canvas.isBusy().catch(() => false);
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

    async waitForPlaygroundStateChange(previousState = null, timeout = 240000) {
        const deadline = Date.now() + timeout;
        let lastChangedSnapshot = '';
        let stablePolls = 0;

        while (Date.now() < deadline) {
            await this.canvas.dismissWalkthroughIfPresent().catch(() => {});
            await this.canvas.approveHumanApprovalIfNeeded();

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

        const finalState = await this.collectPlaygroundState();
        if (finalState?.busy) {
            await this.canvas.waitForIdle(120000).catch(() => {});
            return this.collectPlaygroundState();
        }

        return finalState;
    }

    async sendMessageToVisiblePlayground(message) {
        const previousState = await this.collectPlaygroundState();
        const input = await this.canvas.waitForEnabledPlaygroundInput(240000);

        await input.click();
        await input.press('ControlOrMeta+a').catch(() => {});
        await input.fill(message);
        const sendButton = await this.canvas.waitForVisiblePlaygroundSendButton(30000);
        await this.canvas.clickLocatorReliably(sendButton);

        return this.waitForPlaygroundStateChange(previousState, 240000);
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
                await this.canvas.approveHumanApprovalIfNeeded();
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
            const closeButton = await this.canvas.findLastVisible(locator);
            if (!closeButton) {
                continue;
            }

            await this.canvas.clickLocatorReliably(closeButton, { timeout: 5000 });
            await this.page.waitForTimeout(1000);
            return true;
        }

        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(1000);
        return !(await this.canvas.findVisiblePlaygroundInput());
    }
}

module.exports = { PlaygroundPanel };
