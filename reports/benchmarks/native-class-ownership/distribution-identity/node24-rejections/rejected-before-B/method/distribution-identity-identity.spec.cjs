/** @file Checks real compiled-package drift at preflight, completion and offline archive verification. */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const settings = require('../constants/main-affinity.cjs');
const original = require('../constants/hosted.cjs');
const { captureSourceIdentity } = require('../../../../benchmarks/sources.cjs');
const { captureDistributions, validateDistributions, verify } = require('../main-affinity-experiment.cjs');
const roots = { A: process.env.RUSTDOM_MAIN_AFFINITY_BASELINE, B: process.env.RUSTDOM_MAIN_AFFINITY_CANDIDATE };
assert.ok(roots.A && roots.B, 'Set actual frozen candidate and baseline package roots');
const historical = JSON.parse(fs.readFileSync(path.join(__dirname, '../paired/2026-10-21/index.json'), 'utf8'));
const output = process.env.RUSTDOM_DISTRIBUTION_IDENTITY_TEST_OUTPUT;
let directory;
const copies = {};
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Copy the real measured sources and distribution without modifying originals or copying dependencies. */
before(() => {
  if (output) fs.mkdirSync(output);
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-distribution-identity-'));
  const dependencies = fs.realpathSync(path.join(roots.B, 'node_modules'));
  for (const [label, root] of Object.entries(roots)) {
    const target = path.join(directory, label);
    const sources = captureSourceIdentity(root);
    assert.equal(sources.sourceHash, original.sourceHashes[label]);
    for (const file of sources.measuredSources) {
      fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
      fs.copyFileSync(path.join(root, file), path.join(target, file));
    }
    for (const part of settings.distributionParts) fs.cpSync(path.join(root, part), path.join(target, part), { recursive: true });
    fs.symlinkSync(dependencies, path.join(target, 'node_modules'), 'dir');
    copies[label] = target;
  }
});
after(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }); });

/** Temporarily alter real compiled JavaScript while preserving both source digest and native addon. */
function changedDistribution(label, operation) {
  const root = copies[label];
  const file = path.join(root, 'dist/index.cjs');
  const bytes = fs.readFileSync(file);
  const source = captureSourceIdentity(root).sourceHash;
  const binary = sha256(path.join(root, 'dist/rustdom.node'));
  try {
    fs.appendFileSync(file, '\n');
    assert.equal(captureSourceIdentity(root).sourceHash, source);
    assert.equal(sha256(path.join(root, 'dist/rustdom.node')), binary);
    operation();
  } finally { fs.writeFileSync(file, bytes); }
}

/** Minimal invalid archive metadata exercises rejection before any timing evidence is consumed. */
function archiveIndex(distributions) {
  return { complete: true, settings, node: process.version, binaries: settings.binaryHashes,
    sources: Object.fromEntries(Object.entries(original.sourceHashes).map(([label, sourceHash]) => [label, { sourceHash }])),
    distributions, distributionsAfter: structuredClone(distributions) };
}

/** Invoke the actual offline verifier on deliberately invalid metadata, never on invented benchmark observations. */
function verifyInvalidIndex(name, index, expectedError) {
  const target = path.join(output || directory, name);
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  assert.throws(() => verify(target), expectedError);
}

test('complete real package manifests equal the independently published A0/B distributions', () => {
  const distributions = captureDistributions(copies);
  assert.deepEqual(distributions, { A: historical.packages.distributions.A0, B: historical.packages.distributions.B });
  assert.deepEqual(settings.distributionHashes, { A: distributions.A.sha256, B: distributions.B.sha256 });
  validateDistributions(distributions, 'before');
  validateDistributions(captureDistributions(copies), 'after', distributions);
});

for (const label of ['A', 'B']) {
  test(`the real driver rejects altered compiled ${label} bytes before starting any worker`, () => {
    changedDistribution(label, () => {
      const target = path.join(output || directory, `rejected-before-${label}`);
      const result = spawnSync(process.execPath, [path.join(__dirname, '../main-affinity-experiment.cjs'),
        copies.B, copies.A, target], { encoding: 'utf8', timeout: settings.workerTimeoutMs });
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`MainAffinity:before distribution identity differs for ${label}`));
      assert.equal(result.stdout, '');
      const index = JSON.parse(fs.readFileSync(path.join(target, 'index.json'), 'utf8'));
      assert.equal(index.complete, false); assert.notEqual(index.accepted, true);
      assert.deepEqual(index.runs, []);
      assert.deepEqual(index.distributions, captureDistributions(copies));
      assert.match(index.failure.message, /distribution identity differs/);
      assert.equal(index.sources[label].sourceHash, original.sourceHashes[label]);
      assert.equal(index.binaries[label], settings.binaryHashes[label]);
    });
  });

  test(`the completion guard rejects compiled ${label} bytes changed after a valid preflight`, () => {
    const before = captureDistributions(copies);
    validateDistributions(before, 'before');
    changedDistribution(label, () => {
      const after = captureDistributions(copies);
      assert.notEqual(after[label].sha256, before[label].sha256);
      assert.throws(() => validateDistributions(after, 'after', before),
        new RegExp(`MainAffinity:after distribution identity differs for ${label}`));
    });
    validateDistributions(captureDistributions(copies), 'after', before);
  });
}

test('the offline verifier rejects a changed initial file manifest even with a pinned digest field', () => {
  const index = archiveIndex(captureDistributions(copies));
  index.distributions.B.files.find((file) => file.path === 'dist/index.cjs').sha256 = '0'.repeat(64);
  verifyInvalidIndex('invalid-initial-manifest', index, /MainAffinity:archive distribution manifest differs for B/);
});

test('the offline verifier rejects final compiled bytes changed after the initial manifest', () => {
  const index = archiveIndex(captureDistributions(copies));
  changedDistribution('B', () => { index.distributionsAfter = captureDistributions(copies); });
  verifyInvalidIndex('invalid-final-manifest', index, /MainAffinity:archive-after distribution identity differs for B/);
});

test('the offline verifier requires both initial and final complete manifests', () => {
  const index = archiveIndex(captureDistributions(copies));
  delete index.distributionsAfter;
  verifyInvalidIndex('missing-final-manifest', index, /MainAffinity:archive-after missing distribution manifest for A/);
});

test('the offline verifier rejects digest-only metadata without its complete file list', () => {
  const index = archiveIndex(captureDistributions(copies));
  delete index.distributionsAfter.B.files;
  verifyInvalidIndex('digest-only-manifest', index, /MainAffinity:archive-after incomplete distribution manifest for B/);
});

test('the offline verifier rejects v1 instead of reusing its missing distribution evidence as v2', () => {
  const index = archiveIndex(captureDistributions(copies));
  index.settings = { ...settings, revision: 'main-affinity-public-v1' };
  delete index.distributions; delete index.distributionsAfter;
  verifyInvalidIndex('invalid-v1-method', index, (error) => error.code === 'ERR_ASSERTION' &&
    error.actual.revision === 'main-affinity-public-v1' && error.expected.revision === 'main-affinity-public-v2');
});
