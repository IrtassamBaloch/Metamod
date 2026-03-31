'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeLabels,
    compareCanvasState,
    selectPreferredQuickQuestionEntries,
} = require('../utils/refinement');

test('normalizeLabels sorts trimmed non-empty labels', () => {
    assert.deepEqual(normalizeLabels(['  Output  ', '', 'Agent', 'Output', '  Agent  ']), [
        'Agent',
        'Agent',
        'Output',
        'Output',
    ]);
});

test('compareCanvasState reports prompt and label changes', () => {
    assert.deepEqual(
        compareCanvasState('prompt one', 'prompt two', ['Agent'], ['Agent', 'Output']),
        {
            changed: true,
            promptChanged: true,
            labelsChanged: true,
        }
    );
});

test('selectPreferredQuickQuestionEntries prefers non-other options', () => {
    const entries = [
        { label: 'Other' },
        { label: 'Current weather only' },
        { label: 'Skip' },
    ];

    assert.deepEqual(selectPreferredQuickQuestionEntries(entries), [{ label: 'Current weather only' }]);
});

test('selectPreferredQuickQuestionEntries falls back to other when needed', () => {
    const entries = [{ label: 'Other' }];

    assert.deepEqual(selectPreferredQuickQuestionEntries(entries), [{ label: 'Other' }]);
});
