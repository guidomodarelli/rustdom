/** @module range-telemetry-context Authenticates current Git sources, runtimes and exact prepared packages. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const policy = require('./constants/protocol.json');
const repository = path.resolve(__dirname, '../../../..');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const write = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');

/** @returns {object} Real source observations; a dirty preparation is never represented as clean. */
function sourceContext() {
  assert.ok(fs.lstatSync(path.join(repository, '.git')).isDirectory(), 'Range telemetry: use a real Git checkout, not a Windows gitfile');
  const git = (args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' });
  return { sourceCommit: git(['rev-parse', 'HEAD']).trim(), sourceChanges: git(['status', '--porcelain', '--untracked-files=all']).split(/\r?\n/).filter(Boolean), sourceGitErrors: [] };
}

/** @param {string} commit - Actual capture source. @returns {object} Exact clean source context for execution/replay. */
function requireClean(commit) {
  const current = sourceContext();
  assert.equal(current.sourceCommit, commit, 'Range telemetry: source checkout differs from capture');
  assert.deepEqual(current.sourceChanges, [], 'Range telemetry: capture/replay needs the clean actual source');
  return current;
}

/** @returns {object} Independently reviewed historical pins, verified before any producer is loaded. */
function historicalPins() {
  const filename = path.join(repository, policy.historicalReceipt.path);
  assert.equal(hash(filename), policy.historicalReceipt.sha256);
  const receipt = read(filename); assert.equal(Object.keys(receipt.files).length, policy.historicalPins);
  for (const [name, expected] of Object.entries(receipt.files)) assert.equal(hash(path.join(repository, name)), expected, name);
  return receipt.files;
}

/** @returns {object} Full current implementation graph; a rewritten local receipt cannot redefine code. */
function sourceFiles() {
  const files = { ...historicalPins() };
  files[policy.historicalReceipt.path] = policy.historicalReceipt.sha256;
  const provenance = require('./constants/provenance.json');
  for (const [name, expected] of Object.entries(provenance.references)) {
    assert.equal(hash(path.join(repository, name)), expected, name); files[name] = expected;
  }
  const fixture = require('./constants/fixtures.json').index;
  assert.equal(hash(path.join(repository, fixture.path)), fixture.sha256); files[fixture.path] = fixture.sha256;
  const names = [...policy.methodFiles.map((name) => `${policy.methodDirectory}/${name}`), ...Object.values(policy.codeMaps), ...policy.workflowSources];
  for (const name of names) files[name] = hash(path.join(repository, name));
  return files;
}

/** @returns {void} Verify the actual reader/collector runtime, without executing DOM or profiling. */
function requireRuntime() {
  assert.equal(process.platform, 'linux', 'Range telemetry: Linux/WSL is required');
  const runtimes = require('../constants/current-ownership.json').runtimeExecutableHashes;
  assert.ok(policy.nodeVersions.includes(process.version));
  assert.equal(hash(process.execPath), runtimes[process.version], 'Range telemetry: executable hash differs');
}

/** @returns {object} A real isolated sampler validator, sharing the unchanged behavior/resource contract. */
function createModel() {
  const identity = require('../range-collapse-study/constants/identity.json');
  const original = require('../range-collapse-study/model.cjs');
  const { createSinglePackageStudy } = require('../single-package-experiment.cjs');
  const settings = { ...original.settings, revision: policy.samplerRevision };
  return { settings, model: createSinglePackageStudy({ settings, method: { sourceHashes: identity.inputs.sources, methodFiles: [], preparation: { identity } } }) };
}

/** @param {string} preparation - Exact extracted qualified package tree. @returns {object} Read-only readiness data, never authorization to capture. */
function preflight(preparation) {
  requireRuntime();
  const current = sourceContext(); const files = sourceFiles();
  const packages = require('../range-collapse-study/preparation.cjs'); packages.assertRuntimeContext();
  const harness = require('../current-ownership-experiment.cjs').captureHarness();
  assert.equal(harness.sha256, policy.sourceHarnessSha256);
  assert.deepEqual(harness.identity.sourceChanges, []); assert.deepEqual(harness.identity.sourceGitErrors, []);
  return { revision: policy.revision, captureImplemented: policy.captureImplemented, diagnosticOnly: true,
    performanceAccepted: null, gateReevaluated: false, samplerInvoked: false, context: current, files, harness,
    manifest: packages.createManifest(preparation) };
}

/** @returns {object} A zero-finding review over the exact current graph and capture capability. */
function publication() {
  const receipt = read(path.join(repository, policy.publicationReceipt));
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.actionableFindings, 0);
  assert.equal(receipt.captureImplemented, policy.captureImplemented);
  assert.deepEqual(receipt.files, sourceFiles(), 'Range telemetry: current graph differs from reviewed publication');
  return receipt;
}
module.exports = { repository, policy, read, hash, write, sourceContext, requireClean, historicalPins, sourceFiles, requireRuntime, createModel, preflight, publication };
