/** @module confirmation-bound-worker Shared functional/scientific entry; unreviewed capture is rejected before DOM or binding reads. */
'use strict';
const assert = require('node:assert/strict');
const { run } = require('./worker-engine.cjs');
const { requireMode } = require('./binding.cjs');
const { failureView } = require('../owner-batch-study/batches.cjs');
const policy = require('./constants/capture.json');
const worker = require('./constants/worker.json');
if (require.main === module) {
  Promise.resolve().then(() => {
    const [option, ...args] = process.argv.slice(2);
    assert.ok([policy.functionalOption, policy.captureOption].includes(option), 'Confirmation bound worker: provide explicit --functional or --capture');
    const mode = option === policy.functionalOption ? policy.functionalMode : policy.captureMode;
    requireMode(mode);
    return run(args, mode, () => {}, { bound: true });
  }).catch((error) => {
    process.stderr.write(JSON.stringify({ operation: 'Confirmation bound worker', ...failureView(error) }) + '\n');
    process.exitCode = worker.failureExitCode;
  });
}
