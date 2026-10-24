/** @file Shared native tracing command used by real contracts and the one-shot recorder. */
'use strict';
const path = require('node:path');
const settings = require('./constants/trace.json');

/**
 * Build one real sampler command without loading its selected DOM package.
 * @param {object} options - Absolute executable, verified sampler, manifest, output and treatment.
 * @returns {string[]} Executable followed by its exact arguments.
 */
function createTraceCommand({ node, diagnosticRoot, manifestPath, directory, phase, engine, label }) {
  return [node, '--expose-gc', `--trace-event-categories=${settings.categories.join(',')}`,
    `--trace-event-file-pattern=${path.join(directory, 'trace.json')}`, path.join(diagnosticRoot, 'worker.cjs'),
    manifestPath, phase, engine, String(settings.position), label, path.join(directory, 'report.json')];
}
module.exports = { createTraceCommand };
