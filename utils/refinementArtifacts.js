'use strict';

const fs = require('fs/promises');

const { normalizeText } = require('./refinement');

function formatMessageBlock(messages = []) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return '(no messages recorded)';
    }

    return messages
        .map((entry, index) => `[${index + 1}] ${entry.role || 'unknown'}: ${normalizeText(entry.text)}`)
        .join('\n');
}

function buildSessionTranscriptText(sessionRecord = {}) {
    const lines = [
        'Agent Refinement Context Flow',
        `Final status: ${sessionRecord.finalStatus || 'unknown'}`,
        `Failure reason: ${sessionRecord.failureReason || '(none)'}`,
        '',
        'Initial agent context',
        `Agent context: ${sessionRecord.initial?.analysis?.agentContext || ''}`,
        `Initial test prompt: ${sessionRecord.initial?.analysis?.testPrompt || ''}`,
        `Expected keywords: ${(sessionRecord.initial?.analysis?.expectedOutputKeywords || []).join(', ')}`,
        `Node labels: ${(sessionRecord.initial?.nodeLabels || []).join(', ')}`,
        '',
        'Initial playground messages',
        formatMessageBlock(sessionRecord.initial?.playground?.messages),
        '',
        'Initial validation',
        JSON.stringify(sessionRecord.initial?.validation || {}, null, 2),
        '',
        'Refinement',
        `Widget refinement prompt: ${sessionRecord.refinement?.widgetPrompt || ''}`,
        `Completion indicator: ${sessionRecord.refinement?.result?.completionIndicator || ''}`,
        `Completion status visible: ${String(sessionRecord.refinement?.result?.statusVisible || false)}`,
        '',
        'Refined agent context',
        `Updated test prompt: ${sessionRecord.refined?.analysis?.testPrompt || ''}`,
        `Expected keywords: ${(sessionRecord.refined?.analysis?.expectedOutputKeywords || []).join(', ')}`,
        `Node labels: ${(sessionRecord.refined?.nodeLabels || []).join(', ')}`,
        '',
        'Post-refinement playground messages',
        formatMessageBlock(sessionRecord.refined?.playground?.messages),
        '',
        'Post-refinement validation',
        JSON.stringify(sessionRecord.refined?.validation || {}, null, 2),
        '',
        'Artifacts',
        `Before screenshot: ${sessionRecord.artifacts?.beforeCanvasScreenshot || ''}`,
        `After screenshot: ${sessionRecord.artifacts?.afterCanvasScreenshot || ''}`,
    ];

    return `${lines.join('\n')}\n`;
}

async function writeRefinementSessionArtifacts(testInfo, sessionRecord) {
    const jsonPath = testInfo.outputPath('agent-refinement-context.json');
    const transcriptPath = testInfo.outputPath('agent-refinement-context.txt');

    await fs.writeFile(jsonPath, JSON.stringify(sessionRecord, null, 2), 'utf8');
    await fs.writeFile(transcriptPath, buildSessionTranscriptText(sessionRecord), 'utf8');

    await testInfo.attach('agent-refinement-context-json', {
        path: jsonPath,
        contentType: 'application/json',
    });
    await testInfo.attach('agent-refinement-context-transcript', {
        path: transcriptPath,
        contentType: 'text/plain',
    });

    return {
        jsonPath,
        transcriptPath,
    };
}

module.exports = {
    buildSessionTranscriptText,
    writeRefinementSessionArtifacts,
};
