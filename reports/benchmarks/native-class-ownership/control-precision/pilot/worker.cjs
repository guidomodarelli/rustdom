/** @module pilot-functional-worker Qualifies the shared worker engine without enabling a scientific sequence. */
'use strict';
const assert = require('node:assert/strict');
const { workerArguments, run } = require('./worker-engine.cjs');
const { failureView } = require('../../owner-batch-study/batches.cjs');
const policy = require('./constants/worker.json');
const method = require('./constants/capture.json');

/** @param {string[]} args - Manifest, calendar tuple and new report path. @param {function(object):void} [onProgress] - Scalar observer. @returns {Promise<object>} Functional report, never scientific observations. */
function main(args, onProgress = () => {}) { return run(args, method.functionalMode, onProgress); }

if (require.main === module) {
  Promise.resolve().then(() => {
    const args = process.argv.slice(2);
    assert.equal(args[0], policy.functionalOption, 'Pilot worker: only explicit functional mode is implemented; scientific capture is disabled');
    return main(args.slice(1));
  }).catch((error) => {
    process.stderr.write(JSON.stringify({ operation: 'Pilot functional worker', ...failureView(error) }) + '\n');
    process.exitCode = policy.failureExitCode;
  });
}
module.exports = { workerArguments, main };
