/** @module combined-process-worker Executes the unchanged sampler in a verified fresh namespace, with explicit qualification versus capture provenance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const policy = require('./constants/protocol.json');

/** @returns {object} Declared settings and real sampler factory; this does not load a DOM or collect a sample. */
function configuration() {
  const bytes = fs.readFileSync(require.resolve('./preparation.json'));
  const receipt = JSON.parse(bytes);
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.complete, true);
  assert.equal(receipt.samplerSettingsRevision, policy.samplerRevision);
  assert.equal(receipt.measurementExecuted, false);
  const { bindSettings } = require('./settings.cjs');
  const settings = bindSettings(require('./base/harness/reports/benchmarks/native-class-ownership/constants/current-ownership.cjs'),
    require('./constants/identity.json'));
  const { createSinglePackageWorker } = require('./base/harness/reports/benchmarks/native-class-ownership/single-package-worker.cjs');
  return { receipt, sha256: createHash('sha256').update(bytes).digest('hex'), settings, sampler: createSinglePackageWorker(settings) };
}

/** @param {object} report - Genuine raw output from this process. @param {object} metadata - Explicit worker purpose. @param {object} adapter - Actual fixture counts. @returns {object} New provenance, preserving every original span and failure. */
function annotate(report, metadata, adapter) {
  assert.equal(report.pid, metadata.pid); assert.equal(report.node, metadata.node);
  assert.equal(report.revision, metadata.sourceSamplerRevision);
  return { ...report, sourceSamplerRevision: report.revision, revision: metadata.revision,
    purpose: metadata.purpose, functionalOnly: metadata.functionalOnly,
    performanceAccepted: null, gateReevaluated: false, integration: adapter };
}

/** @param {string[]} args - Exactly the original seven row arguments. @param {boolean} functionalOnly - Standalone behavioral qualification, never capture acceptance. @returns {Promise<void>} Preserve all partial reports and scalar provenance on errors. */
async function main(args, functionalOnly = false) {
  assert.equal(typeof functionalOnly, 'boolean');
  assert.equal(args.length, 7, 'Combined worker: provide manifest, phase, engine, position, label, report and row');
  if (!functionalOnly) {
    assert.equal(policy.executionReady, true, 'Combined worker: complete method publication is not enabled');
    assert.equal(process.env.GITHUB_ACTIONS, 'true');
    assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1');
    assert.equal(process.env.GITHUB_REPOSITORY, policy.apiRepository);
    assert.equal(process.env.GITHUB_WORKFLOW, policy.workflowName);
  }
  const output = args[5]; const sidecar = output + policy.sidecarSuffix;
  assert.ok(!fs.existsSync(output) && !fs.existsSync(sidecar), 'Combined worker: preserve existing evidence');
  const { receipt, sha256, settings, sampler } = configuration();
  const metadata = { revision: policy.revision, sourceSamplerRevision: settings.revision,
    purpose: functionalOnly ? policy.functionalQualification.purpose : policy.purpose,
    functionalOnly, performanceAccepted: null, gateReevaluated: false, complete: false, samplerInvoked: false,
    pid: process.pid, node: process.version, hosted: process.env.GITHUB_ACTIONS === 'true',
    sourceCommit: receipt.sourceCommit, derivationSha256: sha256 };
  fs.writeFileSync(sidecar, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
  let failure;
  try {
    metadata.samplerInvoked = true; await sampler.main(...args);
    metadata.adapter = require('./base/harness/benchmarks/shared-ownership-fixtures/adapter.cjs').statistics();
    if (fs.existsSync(output)) {
      const report = annotate(JSON.parse(fs.readFileSync(output, 'utf8')), metadata, metadata.adapter);
      fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      metadata.complete = report.complete === true;
    }
    assert.equal(metadata.complete, true, 'Combined worker: sampler did not finish a complete report');
  } catch (error) { failure = error; metadata.failure = { message: error.message, stack: error.stack }; }
  finally {
    fs.writeFileSync(sidecar, JSON.stringify(metadata, null, 2) + '\n');
  }
  if (failure) throw failure;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === policy.operations.workerInspect) {
      assert.equal(args.length, 1);
      const { settings, sampler, sha256 } = configuration();
      console.log(JSON.stringify({ revision: policy.revision, settings, derivationSha256: sha256,
        workerArguments: settings.v8Seeds.map((unusedSeed, position) => sampler.workerArguments(position)), samplerInvoked: false }));
    } else {
      const functionalOnly = args[0] === policy.operations.functional;
      main(functionalOnly ? args.slice(1) : args, functionalOnly).catch((error) => {
        process.stderr.write(error.stack + '\n'); process.exitCode = policy.failureExitCode;
      });
    }
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = policy.failureExitCode; }
}
module.exports = { configuration, annotate, main };
