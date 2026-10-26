/** @module pilot-capture-worker Scientific entry point; the unpublished method rejects before any DOM operation. */
'use strict';
const assert = require('node:assert/strict');
const { run } = require('../worker-engine.cjs');
const { failureView } = require('../../../owner-batch-study/batches.cjs');
const policy = require('../constants/capture.json');
const worker = require('../constants/worker.json');

if (require.main === module) {
  Promise.resolve().then(() => {
    const args = process.argv.slice(2);
    assert.equal(args[0], policy.captureOption, 'Pilot capture worker: provide explicit --capture');
    return run(args.slice(1), policy.captureMode);
  }).catch((error) => {
    process.stderr.write(JSON.stringify({ operation: 'Pilot capture worker', ...failureView(error) }) + '\n');
    process.exitCode = worker.failureExitCode;
  });
}
