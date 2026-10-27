/** @module range-study-results Binds complete observations to the new candidate without changing the estimator. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const frozen = require('../cold-cleanup-study/results.cjs');
const model = require('./model.cjs');
const policy = require('./constants/protocol.json');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/**
 * Verify the unchanged complete base and only the declared current control wrappers.
 * @param {string} root - Derived tree, never a source of executable code for offline replay.
 * @param {object} receipt - Saved new derivation receipt.
 * @param {object} harness - Independently authenticated frozen source graph.
 * @param {string} sourceCommit - Actual method checkout commit.
 * @returns {void} Throws on replacement of a sampler, control, metadata or path type.
 */
function verifyDerived(root, receipt, harness, sourceCommit) {
  assert.equal(harness.sha256, policy.sourceHarnessSha256); assert.equal(harness.files.length, policy.sourceHarnessFiles);
  const base = path.join(root, policy.derivation.baseDirectory);
  assert.ok(fs.lstatSync(base).isDirectory()); assert.equal(fs.lstatSync(base).isSymbolicLink(), false);
  frozen.verifyDerived(base, read(path.join(base, 'preparation.json')), harness, sourceCommit);
  const manifest = read(path.join(root, 'source-manifest.json'));
  assert.deepEqual(manifest, { commit: sourceCommit, harnessSha256: harness.sha256, files: harness.files });
  assert.equal(hash(path.join(root, 'source-manifest.json')), hash(path.join(base, 'source-manifest.json')));
  const controls = Object.fromEntries(policy.derivation.controlFiles.map((name) => [name, hash(path.join(__dirname, name))]));
  const expected = { revision: policy.revision, purpose: policy.purpose, sourceCommit,
    samplerSettingsRevision: policy.samplerRevision,
    sourceManifestSha256: hash(path.join(root, 'source-manifest.json')),
    basePreparationSha256: hash(path.join(base, 'preparation.json')), samplerSha256: policy.derivation.samplerSha256,
    measurementExecuted: false, performanceAccepted: null, gateReevaluated: false, controlFiles: controls };
  assert.deepEqual(receipt, expected, 'Range study: controls differ from the current independently reviewed method');
  const files = [];
  /** @param {string} directory - Current control directory. @returns {void} Inspect regular controls, excluding the already verified frozen base. */
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (filename === base) continue;
      assert.equal(entry.isSymbolicLink(), false);
      if (entry.isDirectory()) visit(filename);
      else { assert.ok(entry.isFile()); files.push(path.relative(root, filename).split(path.sep).join('/')); }
    }
  }
  visit(root);
  assert.deepEqual(files.sort(), ['preparation.json', 'source-manifest.json', ...policy.derivation.controlFiles].sort());
  for (const [name, expectedHash] of Object.entries(controls)) assert.equal(hash(path.join(root, name)), expectedHash);
}

/**
 * Verify actual process/provenance before applying the unchanged behavior and resource contract.
 * @param {object} report - Original complete report.
 * @param {object} manifest - Independently authenticated five-package manifest.
 * @param {object} input - Fixed scheduled row.
 * @param {object} observed - Real child outcome and identity.
 * @param {object} metadata - Original sidecar.
 * @param {string} derivationSha256 - Independently verified derivation receipt.
 * @returns {object} Unchanged input; never relabels an older measurement.
 */
function validateReport(report, manifest, input, observed, metadata, derivationSha256) {
  for (const value of [report, metadata]) {
    assert.equal(value.revision, policy.revision); assert.equal(value.purpose, policy.purpose);
    assert.equal(value.functionalOnly, false); assert.equal(value.performanceAccepted, null);
    assert.equal(value.sourceSamplerRevision, policy.samplerRevision);
  }
  assert.equal(metadata.samplerInvoked, true); assert.equal(metadata.complete, true);
  assert.equal(metadata.gateReevaluated, false); assert.equal(metadata.failure, undefined);
  assert.equal(metadata.pid, observed.pid); assert.equal(metadata.node, observed.node);
  assert.equal(metadata.derivationSha256, derivationSha256);
  model.validateWorker({ ...report, revision: report.sourceSamplerRevision }, manifest, { ...input, pid: observed.pid, node: observed.node });
  assert.deepEqual(metadata.adapter, report.integration);
  return frozen.validateObservations(report);
}

/** @param {object[]} entriesByNode - Every original observation in its declared order. @returns {object} Original pooled-median decision, restricted to this complete new study. */
function decide(entriesByNode) {
  assert.deepEqual(entriesByNode.map((entry) => entry.node), model.settings.nodeVersions);
  const results = entriesByNode.map(({ node, entries }) => {
    assert.deepEqual(entries.map(({ observation, ...input }) => input), model.plan());
    for (const { observation } of entries) {
      assert.equal(observation.revision, policy.revision); assert.equal(observation.purpose, policy.purpose);
      assert.equal(observation.functionalOnly, false); assert.equal(observation.node, node);
    }
    model.validateSeedProbes(entries);
    const summaries = Object.fromEntries(model.settings.phases.map((phase) => [phase,
      model.summarize(entries.filter((entry) => entry.phase === phase), phase)]));
    assert.deepEqual(summaries.AA.map((row) => row.outputHash), summaries.AB.map((row) => row.outputHash));
    return { node, accepted: summaries.AA.every((row) => row.calibrated) && summaries.AB.every((row) => row.withinBudget), summaries };
  });
  return { accepted: results.every((entry) => entry.accepted), results };
}
module.exports = { verifyDerived, validateReport, decide, validateObservations: frozen.validateObservations, estimatorView: frozen.estimatorView };
