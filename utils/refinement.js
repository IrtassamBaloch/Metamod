'use strict';

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
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
    normalizeText,
    truncate,
    parsePositiveInteger,
    stripCodeFences,
};
