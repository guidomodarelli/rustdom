/** @module cold-study-results Verifies derived code and real observations, reusing the historical estimator. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const model = require('./model.cjs');
const policy = require('./constants/protocol.json');
const identity = require('../cold-cleanup-transport/constants/transport.json').preparationIdentity;
const historical = require('../shared-fixture-study/study.cjs');
const qualification = require('../shared-fixture-worker/constants/protocol.json');
const legacyPolicy = require('../shared-fixture-study/constants/protocol.json');
const repository = path.resolve(__dirname, '../../../..');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/**
 * Requires exactly the source bytes and metadata produced by the unchanged legacy derivation.
 * @param {string} root - New derived tree, never a location from which replay executes code.
 * @param {object} receipt - Actual final derivation receipt.
 * @param {object} harness - Current canonical frozen harness.
 * @param {string} sourceCommit - Actual declared method checkout commit.
 * @returns {void} Throws on a resealed executable or altered metadata.
 */
function verifyDerived(root, receipt, harness, sourceCommit) {
  assert.equal(harness.sha256, policy.sourceHarnessSha256); assert.equal(harness.files.length, policy.sourceHarnessFiles);
  const manifest = read(path.join(root, 'source-manifest.json'));
  assert.equal(manifest.commit, sourceCommit); assert.equal(manifest.harnessSha256, harness.sha256);
  assert.deepEqual(manifest.files, harness.files);
  const manifestHash = hash(path.join(root, 'source-manifest.json'));
  const base = structuredClone(read(path.join(repository, policy.derivation.baseReceipt)));
  base.sourceCommit = sourceCommit; base.sourceManifestSha256 = manifestHash;
  base.derivedFiles['source-manifest.json'] = manifestHash;
  assert.deepEqual(read(path.join(root, 'base-preparation.json')), base, 'Cold study: original span derivation metadata differs');
  const qualified = structuredClone(read(path.join(repository, policy.derivation.qualifiedReceipt)));
  qualified.sourceCommit = sourceCommit; qualified.sourceManifestSha256 = manifestHash;
  qualified.derivedFiles['source-manifest.json'] = manifestHash;
  qualified.derivedFiles['base-preparation.json'] = hash(path.join(root, 'base-preparation.json'));
  assert.deepEqual(read(path.join(root, 'qualification-preparation.json')), qualified, 'Cold study: shared fixture derivation differs');
  const legacy = structuredClone(qualified);
  Object.assign(legacy, { revision: legacyPolicy.revision, purpose: legacyPolicy.purpose, functionalOnly: false,
    performanceAccepted: null, gateReevaluated: false });
  legacy.derivedFiles['qualification-preparation.json'] = hash(path.join(root, 'qualification-preparation.json'));
  legacy.derivedFiles['qualification-worker.cjs'] = hash(path.join(repository, policy.derivation.qualifiedWorker));
  legacy.derivedFiles['worker.cjs'] = hash(path.join(repository, policy.derivation.legacyWorker));
  assert.deepEqual(read(path.join(root, 'legacy-study-preparation.json')), legacy, 'Cold study: legacy study derivation differs');
  const expected = structuredClone(legacy);
  Object.assign(expected, { revision: policy.revision, purpose: policy.purpose, functionalOnly: false,
    performanceAccepted: null, gateReevaluated: false, samplerSettingsRevision: policy.samplerRevision, preparationIdentity: identity });
  expected.changes.push(policy.derivation.changeDescription);
  expected.derivedFiles['legacy-study-preparation.json'] = hash(path.join(root, 'legacy-study-preparation.json'));
  expected.derivedFiles['legacy-worker.cjs'] = hash(path.join(repository, policy.derivation.legacyWorker));
  for (const name of ['worker.cjs', 'settings.cjs', 'constants/protocol.json']) {
    expected.derivedFiles[name] = hash(path.join(__dirname, name));
  }
  assert.deepEqual(read(path.join(root, 'identity.json')), identity, 'Cold study: derived package identity differs');
  expected.derivedFiles['identity.json'] = createHash('sha256').update(JSON.stringify(identity, null, 2) + '\n').digest('hex');
  assert.deepEqual(receipt, expected, 'Cold study: final derivation declaration differs');
  const names = [];
  /** @param {string} directory - Owned directory. @returns {void} Records only real regular files. */
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      assert.equal(entry.isSymbolicLink(), false, 'Cold study: derived code must not use symbolic links');
      if (entry.isDirectory()) visit(filename);
      else { assert.ok(entry.isFile()); names.push(path.relative(root, filename).split(path.sep).join('/')); }
    }
  }
  visit(root);
  assert.deepEqual(names.filter((name) => name !== 'preparation.json').sort(), Object.keys(expected.derivedFiles).sort());
  for (const [name, expectedHash] of Object.entries(expected.derivedFiles)) {
    assert.equal(hash(path.join(root, name)), expectedHash, `Cold study: derived file differs: ${name}`);
  }
  const sampler = harness.files.find((entry) => entry.path === 'benchmarks/worker.cjs');
  assert.equal(receipt.samplerBeforeSha256, sampler.sha256);
  assert.equal(receipt.samplerAfterSha256, policy.derivation.samplerSha256);
}

/**
 * Validates new provenance before applying the existing public behavior/resource contract.
 * @param {object} report - Raw completed worker report.
 * @param {object} manifest - Independently authenticated five-package manifest.
 * @param {object} input - Fixed scheduled row.
 * @param {object} observed - Actual child PID, runtime and process outcome.
 * @param {object} metadata - Saved sidecar, never a fabricated replacement for raw data.
 * @param {string} derivationSha256 - Authenticated derivation receipt digest.
 * @returns {object} Original report without normalization or mutation.
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
  return validateObservations(report);
}

/**
 * Checks saved spans, public outputs and separate owner observations without granting study provenance.
 * @param {object} report - Completed saved observations, including genuine historical controls.
 * @returns {object} Unmodified input; this alone cannot accept a study or bind a candidate.
 */
function validateObservations(report) {
  assert.equal(report.complete, true);
  const batch = report.batches[0];
  const reference = read(path.join(repository, qualification.referenceFile)).results.find((entry) => entry.node === report.node);
  assert.equal(batch.outputHash, reference.summaries.AA.find((entry) => entry.key === `${batch.name}/${batch.size}`).outputHash);
  const samples = model.settings.warmupSamples + model.settings.measuredSamples;
  assert.equal(batch.sampleTimings.length, samples);
  for (const [index, span] of batch.sampleTimings.entries()) {
    assert.equal(span.index, index); assert.equal(span.stage, index < model.settings.warmupSamples ? 'warmup' : 'measured');
    assert.ok(Number.isFinite(span.startMs) && span.startMs > 0); assert.ok(Number.isFinite(span.durationMs) && span.durationMs > 0);
  }
  assert.deepEqual(batch.samplesMs, batch.sampleTimings.slice(model.settings.warmupSamples).map((span) => span.durationMs));
  const fixtures = samples * (1 + model.settings.withinRealmWarmupRounds);
  const mutationCount = batch.name === qualification.mutationWorkload ? fixtures : 0;
  const deliveryCount = batch.name === qualification.deliveryWorkload ? fixtures : 0;
  assert.deepEqual(report.integration, { mutationCreated: mutationCount, mutationSharedMethods: mutationCount,
    deliveryCreated: deliveryCount, deliverySharedMethods: deliveryCount });
  for (const endpoint of batch.cleanupTrace) {
    assert.deepEqual(Object.keys(endpoint.survivors).sort(), ['document', 'window']);
    for (const value of Object.values(endpoint.survivors)) assert.ok(Number.isSafeInteger(value) && value >= 0);
  }
  return report;
}

/**
 * Recalculates the original decision only after both complete schedules are present.
 * @param {object[]} entriesByNode - Validated scalar observations per fixed runtime.
 * @returns {object} Independent new-study decision; historical rejections remain untouched.
 */
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
module.exports = { verifyDerived, validateReport, validateObservations, decide, estimatorView: historical.estimatorView };
