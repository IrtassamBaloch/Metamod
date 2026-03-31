'use strict';

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLabels(labels = []) {
    return labels.map(normalizeText).filter(Boolean).sort();
}

function compareCanvasState(beforePrompt, afterPrompt, beforeLabels = [], afterLabels = []) {
    const promptChanged = normalizeText(beforePrompt) !== normalizeText(afterPrompt);
    const labelsChanged =
        JSON.stringify(normalizeLabels(beforeLabels)) !== JSON.stringify(normalizeLabels(afterLabels));

    return {
        changed: promptChanged || labelsChanged,
        promptChanged,
        labelsChanged,
    };
}

function selectPreferredQuickQuestionEntries(entries = []) {
    const selectableEntries = entries.filter(({ label }) => {
        const normalized = normalizeText(label);
        return normalized && !/^continue$/i.test(normalized) && !/^skip$/i.test(normalized);
    });
    const preferredEntries = selectableEntries.filter(
        ({ label }) => !/^other\b/i.test(normalizeText(label))
    );

    return preferredEntries.length > 0 ? preferredEntries : selectableEntries;
}

function truncate(value, maxLength = 400) {
    const text = normalizeText(value);
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 3)}...`;
}

function parsePositiveInteger(rawValue, fallbackValue) {
    const parsed = Number.parseInt(rawValue, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function stripCodeFences(value) {
    const text = String(value || '').trim();
    if (!text.startsWith('```')) {
        return text;
    }

    return text
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim();
}

module.exports = {
    compareCanvasState,
    normalizeLabels,
    normalizeText,
    truncate,
    parsePositiveInteger,
    selectPreferredQuickQuestionEntries,
    stripCodeFences,
};
