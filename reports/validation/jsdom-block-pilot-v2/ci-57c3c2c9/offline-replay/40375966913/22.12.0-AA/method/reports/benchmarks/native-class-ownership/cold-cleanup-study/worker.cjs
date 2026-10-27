/** @file Executes the existing qualified sampler only inside the declared new hosted study. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const policy = require('./constants/protocol.json');

/**
 * Runs one fixed row and preserves partial output without retries.
 * @param {string[]} args - Manifest, phase, engine, position, label, output and row.
 * @returns {Promise<void>} Completes after the real sampler and scalar provenance are saved.
 * @throws {Error} When host, derivation, actual operation or cleanup fails.
 */
async function main(args) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Cold study worker: requires the declared hosted runner');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'Cold study worker: no retries');
  assert.equal(args.length, 7, 'Cold study worker: provide the complete fixed row');
  const output = args[5]; const sidecar = output + policy.sidecarSuffix;
  assert.ok(!fs.existsSync(output) && !fs.existsSync(sidecar), 'Cold study worker: preserve existing evidence');
  const receiptBytes = fs.readFileSync(require.resolve('./preparation.json'));
  const receipt = JSON.parse(receiptBytes);
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.samplerSettingsRevision, policy.samplerRevision);
  const { bindSettings } = require('./settings.cjs');
  const original = require('./harness/reports/benchmarks/native-class-ownership/constants/current-ownership.cjs');
  const identity = require('./identity.json');
  const settings = bindSettings(original, identity);
  const { createSinglePackageWorker } = require('./harness/reports/benchmarks/native-class-ownership/single-package-worker.cjs');
  const sampler = createSinglePackageWorker(settings);
  const { annotate } = require('./legacy-worker.cjs');
  const metadata = { revision: policy.revision, sourceSamplerRevision: settings.revision, purpose: policy.purpose,
    functionalOnly: false, performanceAccepted: null, gateReevaluated: false, complete: false, samplerInvoked: false,
    pid: process.pid, node: process.version, derivationSha256: createHash('sha256').update(receiptBytes).digest('hex') };
  fs.writeFileSync(sidecar, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
  let failure;
  try { metadata.samplerInvoked = true; await sampler.main(...args); }
  catch (error) { failure = error; metadata.failure = { message: error.message, stack: error.stack }; }
  finally {
    metadata.adapter = require('./harness/benchmarks/shared-ownership-fixtures/adapter.cjs').statistics();
    if (fs.existsSync(output)) {
      const report = annotate(JSON.parse(fs.readFileSync(output, 'utf8')), metadata, metadata.adapter);
      fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      metadata.complete = report.complete && failure === undefined;
    }
    fs.writeFileSync(sidecar, JSON.stringify(metadata, null, 2) + '\n');
  }
  if (failure) throw failure;
}
if (require.main === module) main(process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = policy.failureExitCode; });
module.exports = { main };
