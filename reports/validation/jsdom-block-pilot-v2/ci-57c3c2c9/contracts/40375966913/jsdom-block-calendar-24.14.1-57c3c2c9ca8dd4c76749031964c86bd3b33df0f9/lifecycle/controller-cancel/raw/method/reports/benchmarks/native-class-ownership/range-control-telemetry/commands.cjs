/** @module range-telemetry-commands Uses the same recorded process command for execution and relocated replay. */
'use strict';
const path = require('node:path');
const { policy } = require('./context.cjs');
const { workerArguments } = require('../current-ownership-worker.cjs');

/** @param {object} input - Fixed plan entry. @param {number} ordinal - Global fixed position. @param {string} captureRoot - Original capture root, preserved during replay. @param {object} runtime - Pinned executable identity. @returns {object} Exact argument array and working/output directory. */
function commandFor(input, ordinal, captureRoot, runtime) {
  const directory = path.join(captureRoot, String(ordinal).padStart(policy.workerOrdinalDigits, '0'));
  return { input, node: input.node, directory,
    argv: [runtime.executable, ...workerArguments(input.position), ...policy.nodeFlagsByMode[input.mode],
      path.join(captureRoot, policy.paths.derivedPrefix + input.mode, policy.paths.worker), path.join(captureRoot, policy.paths.manifest),
      input.phase, input.engine, String(input.position), input.label, path.join(directory, policy.paths.report), String(input.rowIndex)] };
}
module.exports = { commandFor };
