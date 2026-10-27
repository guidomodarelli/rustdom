/** @file Validates the prospective warmup worker with all five real official packages and immutable legacy replay. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const study = require('./realm-warmup-experiment.cjs');
const legacy = require('./independent-order-experiment.cjs');
const worker = require('./realm-warmup-worker.cjs');
const settings = require('./constants/realm-warmup.cjs');
const original = require('./constants/independent-order.cjs');
const method = require('./constants/realm-warmup-study.cjs');
const preparation = require('./hosted-main-experiment.cjs');
const archive = process.env.RUSTDOM_HOSTED_BUILD_ARCHIVE;
const prior = process.env.RUSTDOM_PRIOR_INDEPENDENT_ARCHIVE;
const output = process.env.RUSTDOM_REALM_WARMUP_TEST_OUTPUT;
assert.ok(archive && prior && output, 'Set preparation, prior complete archive, and fresh preserved output paths');
const manifest = preparation.createManifest(archive);
const manifestPath = path.join(output, 'manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });

test('prospective method preserves all original positions, packages, rows, samples and budgets', () => {
  assert.deepEqual(study.processSchedule(), legacy.processSchedule());
  assert.equal(study.processSchedule().length, 128);
  for (const key of ['rows', 'distributionHashes', 'warmupSamples', 'measuredSamples',
    'cleanupRounds', 'requiredClearRounds', 'controlBudgetPercent', 'rustBudgetPercent']) {
    assert.deepEqual(settings[key], original[key]);
  }
});

test('historical full study remains verified and rejected and cannot be relabeled', () => {
  const result = legacy.verifySet(['node-22', 'node-24'].map((node) => path.join(prior, node)));
  assert.equal(result.verified, true); assert.equal(result.accepted, false);
  const child = spawnSync(process.execPath, [path.join(__dirname, 'realm-warmup-experiment.cjs'),
    '--verify-set', path.join(prior, 'node-22'), path.join(prior, 'node-24')], { encoding: 'utf8' });
  assert.equal(child.status, 2); assert.equal(child.stdout, ''); assert.match(child.stderr, /AssertionError/);
});

const reports = [];
const inputs = [
  { phase: 'AA', engine: 'rustdom', position: 0, label: 'A' },
  { phase: 'AA', engine: 'rustdom', position: 2, label: 'A' },
  { phase: 'AB', engine: 'rustdom', position: 15, label: 'B' },
  { phase: 'AA', engine: 'jsdom', position: 0, label: 'A' },
  { phase: 'AA', engine: 'jsdom', position: 2, label: 'A' },
];
for (const input of inputs) {
  test(`real ${input.phase}/${input.engine}/${input.position}/${input.label} worker preserves output and ownership`, () => {
    const prefix = `${input.phase}-${input.engine}-${input.position}-${input.label}`;
    const filename = path.join(output, `${prefix}.json`);
    const environment = { ...process.env }; delete environment.NODE_OPTIONS;
    const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, method.workerFilename), manifestPath,
      input.phase, input.engine, String(input.position), input.label, filename],
    { env: environment, encoding: 'utf8', timeout: method.workerTimeoutMs });
    fs.writeFileSync(path.join(output, `${prefix}.stdout.log`), child.stdout ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(output, `${prefix}.stderr.log`), child.stderr ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(output, `${prefix}.process.json`), `${JSON.stringify({ ...input, pid: child.pid,
      exitCode: child.status, signal: child.signal, error: child.error?.message ?? null })}\n`, { flag: 'wx' });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
    const report = JSON.parse(fs.readFileSync(filename, 'utf8'));
    study.validateWorker(report, manifest, { ...input, node: process.version, pid: child.pid });
    assert.equal(Object.values(report.loadedAfter).filter((filenames) => filenames.length).length, 1);
    reports.push(report);
  });
}

test('all five packages preserve historical hashes for every public workload', () => {
  assert.equal(reports.length, inputs.length);
  assert.equal(new Set(reports.map((report) => report.schedule.physical)).size, 5);
  const oracle = JSON.parse(fs.readFileSync(path.join(prior, 'node-22/AA-0-jsdom-A.json'), 'utf8'));
  for (const report of reports) for (const batch of report.batches) {
    const expected = oracle.batches.find((row) => row.name === batch.name && row.size === batch.size);
    assert.equal(batch.outputHash, expected.outputHash);
  }
});

test('verifier rejects omitted warmup and false release metadata from actual reports', () => {
  const report = reports[0]; assert.ok(report);
  const expected = { ...inputs[0], node: process.version, pid: report.pid };
  const cold = structuredClone(report); delete cold.batches[0].withinRealmWarmupRounds;
  assert.throws(() => study.validateWorker(cold, manifest, expected));
  const retained = structuredClone(report); retained.batches[0].cleanupTrace.at(-1).survivors.window = 1;
  assert.throws(() => study.validateWorker(retained, manifest, expected));
});
