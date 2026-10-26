/** @file Run the current authenticated reader with the existing bounded process-group controller; no DOM execution. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execute } = require('../owner-batch-study/process.cjs');
const { failureView } = require('../owner-batch-study/batches.cjs');
const settings = require('./constants/exports.json');
const capture = require('../owner-batch-study/constants/capture.json');

/** Own the reader lifecycle, forwarding catchable cancellation and awaiting termination before publishing its receipt. */
async function invokeReader(argv, destination) {
  const controller = new AbortController();
  let interruptedBy = null;
  const handlers = new Map(['SIGINT', 'SIGTERM'].map((signal) => [signal, () => {
    interruptedBy ??= signal;
    controller.abort(new Error('Owner batch export: reader interrupted by ' + signal));
  }]));
  for (const [signal, handler] of handlers) process.on(signal, handler);
  let record;
  try {
    record = await execute(argv, path.join(destination, settings.commandDirectory),
      { timeoutMs: settings.maximumCommandSeconds * 1000, signal: controller.signal });
    record.interruptedBy = interruptedBy;
  } finally {
    for (const [signal, handler] of handlers) process.removeListener(signal, handler);
  }
  fs.writeFileSync(path.join(destination, settings.invocationFilename), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ exitCode: record.exitCode, timedOut: record.timedOut,
    cancelled: record.cancelled, DOMExecuted: false }) + '\n');
  return record;
}
async function main() {
  const [operation, binding, collection, destination] = process.argv.slice(2);
  assert.equal(process.argv.length, 6);
  assert.ok(['--functional', '--verify'].includes(operation));
  const repository = path.resolve(__dirname, '../../../..');
  const record = await invokeReader([process.execPath, path.join(repository, settings.decisionFile), operation,
    binding, collection, path.join(destination, settings.verifiedDirectory)], destination);
  process.exitCode = record.interruptedBy || record.cancelled || record.timedOut ? capture.failureExitCode
    : Number.isInteger(record.exitCode) && record.exitCode >= 0 ? record.exitCode : capture.failureExitCode;
}
module.exports = { invokeReader };
if (require.main === module) main().catch((error) => { process.stderr.write(JSON.stringify(failureView(error)) + '\n'); process.exitCode = capture.failureExitCode; });
