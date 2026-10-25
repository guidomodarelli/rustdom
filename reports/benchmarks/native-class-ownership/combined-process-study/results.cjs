/** @module combined-process-results Authenticates derived code and raw worker behavior using current readers; never executes archived implementations. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const frozen = require('../cold-cleanup-study/results.cjs');
const model = require('./model.cjs');
const policy = require('./constants/protocol.json');
const { estimatorView } = require('../shared-fixture-study/study.cjs');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/** @param {string} directory - Data tree, never a module root for offline execution. @param {object} harness - Independently authenticated source graph. @param {string} sourceCommit - Actual method Git commit. @returns {object} Verified derivation receipt. */
function verifyDerived(directory, harness, sourceCommit) {
  assert.equal(harness.sha256, policy.sourceHarnessSha256); assert.equal(harness.files.length, policy.sourceHarnessFiles);
  const root = fs.realpathSync.native(directory);
  const receipt = read(path.join(root, 'preparation.json'));
  assert.equal(receipt.complete, true); assert.equal(receipt.failure, undefined);
  assert.equal(receipt.revision, policy.revision); assert.equal(receipt.purpose, 'derivation-only');
  assert.equal(receipt.sourceCommit, sourceCommit); assert.equal(typeof receipt.sourceChangesRaw, 'string');
  assert.deepEqual(receipt.sourceGitErrors, []);
  assert.equal(receipt.samplerSettingsRevision, policy.samplerRevision);
  assert.equal(receipt.measurementExecuted, false); assert.equal(receipt.performanceAccepted, null); assert.equal(receipt.gateReevaluated, false);
  assert.equal(receipt.samplerSha256, policy.derivation.samplerSha256);
  const base = path.join(root, policy.derivation.baseDirectory);
  assert.equal(fs.lstatSync(base).isSymbolicLink(), false); assert.ok(fs.lstatSync(base).isDirectory());
  const original = read(path.join(base, 'preparation.json'));
  frozen.verifyDerived(base, original, harness, sourceCommit);
  assert.equal(hash(path.join(base, 'preparation.json')), receipt.basePreparationSha256);
  const manifest = path.join(root, 'source-manifest.json');
  assert.deepEqual(read(manifest), { commit: sourceCommit, harnessSha256: harness.sha256, files: harness.files });
  assert.equal(hash(manifest), receipt.sourceManifestSha256);
  assert.equal(hash(manifest), hash(path.join(base, 'source-manifest.json')));
  const controls = Object.fromEntries(policy.derivation.controlFiles.map((name) => [name, hash(path.join(__dirname, name))]));
  assert.deepEqual(receipt.controlFiles, controls, 'Combined results: derived controls differ from current independently reviewed sources');
  const names = [];
  /** @param {string} current - Owned control directory. @returns {void} Require regular physical files and no unlisted control code. */
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filename = path.join(current, entry.name);
      if (filename === base) continue;
      assert.equal(entry.isSymbolicLink(), false, 'Combined results: linked derived control');
      if (entry.isDirectory()) visit(filename);
      else { assert.ok(entry.isFile()); names.push(path.relative(root, filename).split(path.sep).join('/')); }
    }
  }
  visit(root);
  assert.deepEqual(names.sort(), ['preparation.json', 'source-manifest.json', ...policy.derivation.controlFiles].sort());
  for (const [name, expected] of Object.entries(controls)) assert.equal(hash(path.join(root, name)), expected);
  return receipt;
}

/** @param {object} report - Genuine raw worker output. @param {object} manifest - Independently verified physical packages. @param {object} input - Fixed scheduled tuple. @param {object} observed - Actual process outcome. @param {object} metadata - Raw sidecar. @param {string} derivationSha256 - Verified receipt hash. @param {string} sourceCommit - Actual authenticated derivation/index commit. @param {boolean} functionalOnly - Qualification and capture must never be interchanged. @returns {object} Unchanged validated report. */
function validateReport(report, manifest, input, observed, metadata, derivationSha256, sourceCommit, functionalOnly = false) {
  assert.equal(typeof functionalOnly, 'boolean');
  for (const value of [report, metadata]) {
    assert.equal(value.revision, policy.revision);
    assert.equal(value.purpose, functionalOnly ? policy.functionalQualification.purpose : policy.purpose);
    assert.equal(value.functionalOnly, functionalOnly);
    assert.equal(value.performanceAccepted, null); assert.equal(value.gateReevaluated, false);
    assert.equal(value.sourceSamplerRevision, policy.samplerRevision);
  }
  assert.equal(metadata.complete, true); assert.equal(metadata.failure, undefined); assert.equal(metadata.samplerInvoked, true);
  assert.equal(metadata.pid, observed.pid); assert.equal(metadata.node, observed.node);
  assert.equal(metadata.derivationSha256, derivationSha256);
  assert.match(sourceCommit, /^[a-f0-9]{40}$/); assert.equal(metadata.sourceCommit, sourceCommit);
  model.validateWorker({ ...report, revision: report.sourceSamplerRevision }, manifest, { ...input, pid: observed.pid, node: observed.node });
  assert.deepEqual(metadata.adapter, report.integration);
  return frozen.validateObservations(report);
}
module.exports = { verifyDerived, validateReport, estimatorView };
