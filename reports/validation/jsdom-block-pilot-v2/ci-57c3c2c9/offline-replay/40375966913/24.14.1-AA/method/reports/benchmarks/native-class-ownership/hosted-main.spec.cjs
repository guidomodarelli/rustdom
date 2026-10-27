/** @file Exercises actual official packages and rejects stale identities before collecting any timing samples. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const study = require('./hosted-main-experiment.cjs');
const settings = require('./constants/hosted-main.cjs');
const method = require('./constants/hosted-main-study.cjs');
const { schedule, inspectDistributions } = require('./paired-main-worker.cjs');
const { loadRuntime } = require('./paired-worker.cjs');
const { proveSymmetricIsolation } = require('./balanced-worker.cjs');
const archive = process.env.RUSTDOM_HOSTED_BUILD_ARCHIVE;
assert.ok(archive, 'Use the authenticated official RUSTDOM_HOSTED_BUILD_ARCHIVE');

/** @param {import('node:test').TestContext} context - Owns temporary evidence. @returns {string} Fresh parent directory. */
function temporaryDirectory(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-hosted-main-check-'));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('rustdom-hosted-main-check-'));
    fs.rmSync(root, { recursive: true });
  });
  return root;
}

test('the actual official preparation matches the receipt and remains distinct from local historical packages', () => {
  assert.deepEqual(study.inspectPreparation(archive), method.preparation.identity);
  const local = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    '../../validation/native-class-ownership/hosted-build/preparation-index.json')));
  assert.throws(() => study.validateDistribution(local.distributions.B, settings.distributionHashes.B), /unpinned package/);
});

test('all scheduled labels resolve to intact real packages for both engines and phases', () => {
  const manifest = study.createManifest(archive);
  assert.equal(new Set(Object.values(manifest.copies).map((root) => fs.realpathSync(root))).size, 5);
  for (const input of study.processSchedule()) {
    const plan = schedule(manifest, input.phase, input.engine, input.position, settings);
    const actual = inspectDistributions(manifest, plan, input.engine, settings);
    assert.equal(Object.keys(actual).length, 2);
    assert.deepEqual(new Set(plan.batches.map((batch) => `${batch.name}/${batch.size}`)), new Set(settings.rows));
  }
});

test('official package bindings execute real Range operations with independent native allocations', () => {
  const manifest = study.createManifest(archive);
  for (const [engine, physical] of [['rustdom', ['A0', 'A1']], ['rustdom', ['A0', 'B']], ['jsdom', ['J0', 'J1']]]) {
    const runtimes = Object.fromEntries(['A', 'B'].map((label, index) => [label, loadRuntime(manifest.copies[physical[index]], engine)]));
    const results = proveSymmetricIsolation(runtimes, ['A', 'B']);
    assert.deepEqual(results.map((entry) => entry.text), ['isolation', 'isolation']);
    assert.deepEqual(results.map((entry) => entry.ownCreated), engine === 'rustdom' ? [1, 1] : [null, null]);
  }
});

test('a different preparation UUID cannot reuse otherwise intact official files', (context) => {
  const root = temporaryDirectory(context);
  const copy = path.join(root, 'copy'); fs.cpSync(archive, copy, { recursive: true, verbatimSymlinks: true });
  const filename = path.join(copy, 'index.json'); const index = JSON.parse(fs.readFileSync(filename));
  index.preparationId = 'another-preparation'; fs.writeFileSync(filename, JSON.stringify(index));
  assert.throws(() => study.inspectPreparation(copy), /official pinned artifact/);
});

test('changed runtime dependencies fail before the driver creates reports or launches workers', (context) => {
  const root = temporaryDirectory(context);
  const copy = path.join(root, 'copy'); fs.cpSync(archive, copy, { recursive: true, verbatimSymlinks: true });
  fs.appendFileSync(path.join(copy, 'node_modules/tough-cookie/package.json'), '\n');
  const output = path.join(root, 'output');
  assert.throws(() => study.run(copy, output, path.join(root, 'unused-provenance.json')));
  assert.equal(fs.existsSync(output), false); assert.equal(fs.existsSync(`${output}.manifest.json`), false);
});

test('the real driver preserves an incomplete report and starts no workers for an unreviewed harness', (context) => {
  const root = temporaryDirectory(context); const provenance = path.join(root, 'provenance.json');
  fs.writeFileSync(provenance, JSON.stringify({ harnessSha256: '0'.repeat(64),
    reviewedCommit: method.preparation.headSha,
    receiptUrl: 'https://github.com/guidomodarelli/rustdom/pull/80',
    purpose: 'Negative contract fixture; not an approval.' }));
  const output = path.join(root, 'output');
  assert.throws(() => study.run(archive, output, provenance), /harness differs from reviewed sources/);
  const index = JSON.parse(fs.readFileSync(path.join(output, 'index.json')));
  assert.equal(index.complete, false); assert.deepEqual(index.runs, []);
  assert.deepEqual(index.manifest.preparationBefore, method.preparation.identity);
});

test('preexisting evidence is preserved byte for byte', (context) => {
  const root = temporaryDirectory(context); const output = path.join(root, 'output'); fs.mkdirSync(output);
  const sentinel = path.join(output, 'sentinel'); fs.writeFileSync(sentinel, 'retain evidence');
  assert.throws(() => study.run(archive, output, 'unused'), /preserve existing study output/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'retain evidence');
});

test('an output alias into the official preparation is rejected without modifying its files', (context) => {
  const root = temporaryDirectory(context); const alias = path.join(root, 'alias'); fs.symlinkSync(archive, alias, 'dir');
  const output = path.join(alias, 'new-study');
  assert.throws(() => study.run(archive, output, 'unused'), /must not modify the official preparation/);
  assert.equal(fs.existsSync(output), false); assert.equal(fs.existsSync(`${output}.manifest.json`), false);
});

test('the real hosted CLI cannot relabel the existing failed WSL study as hosted evidence', () => {
  const previous = path.join(__dirname, 'paired-inline/2026-10-22/node-22');
  const filename = path.join(previous, 'index.json');
  const before = createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  const result = spawnSync(process.execPath, [path.join(__dirname, 'hosted-main-experiment.cjs'), '--verify', previous],
    { encoding: 'utf8', timeout: method.workerTimeoutMs });
  assert.equal(result.status, 2); assert.equal(result.stdout, ''); assert.match(result.stderr, /AssertionError/);
  assert.equal(createHash('sha256').update(fs.readFileSync(filename)).digest('hex'), before);
});
