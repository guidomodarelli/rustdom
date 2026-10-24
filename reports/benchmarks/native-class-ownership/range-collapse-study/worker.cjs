/** @file Executes the existing qualified sampler only inside the declared new hosted study. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const policy = require('./constants/protocol.json');

/** @returns {object} Actual verified factory configuration, without loading a runtime or invoking a sample. */
function configuration() {
  const receiptBytes = fs.readFileSync(require.resolve('./preparation.json'));
  const receipt = JSON.parse(receiptBytes);
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.samplerSettingsRevision, policy.samplerRevision);
  const { bindSettings } = require('./settings.cjs');
  const original = require('./base/harness/reports/benchmarks/native-class-ownership/constants/current-ownership.cjs');
  const identity = require('./constants/identity.json'); const settings = bindSettings(original, identity);
  const { createSinglePackageWorker } = require('./base/harness/reports/benchmarks/native-class-ownership/single-package-worker.cjs');
  return { receiptBytes, settings, sampler: createSinglePackageWorker(settings) };
}

/**
 * Runs one fixed row and preserves partial output without retries.
 * @param {string[]} args - Manifest, phase, engine, position, label, output and row.
 * @returns {Promise<void>} Completes after the real sampler and scalar provenance are saved.
 * @throws {Error} When host, derivation, actual operation or cleanup fails.
 */
async function main(args) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Range study worker: requires the declared hosted runner');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'Range study worker: no retries');
  assert.equal(args.length, 7, 'Range study worker: provide the complete fixed row');
  const output = args[5]; const sidecar = output + policy.sidecarSuffix;
  assert.ok(!fs.existsSync(output) && !fs.existsSync(sidecar), 'Range study worker: preserve existing evidence');
  const { receiptBytes, settings, sampler } = configuration();
  const { annotate } = require('./base/legacy-worker.cjs');
  const metadata = { revision: policy.revision, sourceSamplerRevision: settings.revision, purpose: policy.purpose,
    functionalOnly: false, performanceAccepted: null, gateReevaluated: false, complete: false, samplerInvoked: false,
    pid: process.pid, node: process.version, derivationSha256: createHash('sha256').update(receiptBytes).digest('hex') };
  fs.writeFileSync(sidecar, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
  let failure;
  try { metadata.samplerInvoked = true; await sampler.main(...args); }
  catch (error) { failure = error; metadata.failure = { message: error.message, stack: error.stack }; }
  finally {
    metadata.adapter = require('./base/harness/benchmarks/shared-ownership-fixtures/adapter.cjs').statistics();
    if (fs.existsSync(output)) {
      const report = annotate(JSON.parse(fs.readFileSync(output, 'utf8')), metadata, metadata.adapter);
      fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      metadata.complete = report.complete && failure === undefined;
    }
    fs.writeFileSync(sidecar, JSON.stringify(metadata, null, 2) + '\n');
  }
  if (failure) throw failure;
}
if (require.main === module) {
  if (process.argv[2] === policy.operations.workerInspect) {
    assert.equal(process.argv.length, 3);
    const { settings, sampler } = configuration();
    console.log(JSON.stringify({ revision: policy.revision, settings, samplerInvoked: false,
      workerArguments: settings.v8Seeds.map((seed, position) => sampler.workerArguments(position)) }));
  } else main(process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = policy.failureExitCode; });
}
module.exports = { main };
