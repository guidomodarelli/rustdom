/** @file Exercises the original public workloads and affinity contract against real A, B and jsdom runtimes. */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const settings = require('./constants/main-affinity.cjs');
const { validateWorker, summarize, run } = require('./main-affinity-experiment.cjs');
const candidate = process.env.RUSTDOM_MAIN_AFFINITY_CANDIDATE;
const baseline = process.env.RUSTDOM_MAIN_AFFINITY_BASELINE;
assert.ok(candidate && baseline, 'Set actual frozen candidate and baseline package roots');
const output = process.env.RUSTDOM_MAIN_AFFINITY_TEST_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-main-affinity-tests-'));
if (process.env.RUSTDOM_MAIN_AFFINITY_TEST_OUTPUT) fs.mkdirSync(output);
const results = {};

/** Run actual workers once for behavioral validation; none of these timings belong to the performance study. */
before(() => {
  for (const [label, engine, root] of [['A', 'rustdom', baseline], ['B', 'rustdom', candidate], ['J', 'jsdom', candidate]]) {
    const metadataPath = path.join(output, `${label}.affinity.json`);
    const result = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'main-affinity-worker.cjs'),
      candidate, root, engine, metadataPath], { encoding: 'utf8', timeout: settings.workerTimeoutMs, maxBuffer: 4 * 1024 * 1024 });
    fs.writeFileSync(path.join(output, `${label}.stdout.json`), result.stdout || '');
    fs.writeFileSync(path.join(output, `${label}.stderr.log`), result.stderr || '');
    assert.equal(result.status, 0, `${label}: ${result.stderr}`);
    const observation = JSON.parse(result.stdout);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const expected = { pid: result.pid, node: process.version, engine, harnessRoot: candidate, runtimeRoot: root };
    validateWorker(observation, metadata, expected);
    results[label] = { observation, metadata, expected };
  }
});

test('both real Rust runtimes and independent jsdom execute all eight public workloads with identical outputs', () => {
  const hashes = (label) => results[label].observation.workloads.map((row) => ({ key: `${row.name}/${row.rows}`, hash: row.outputHash }));
  assert.deepEqual(hashes('A'), hashes('B')); assert.deepEqual(hashes('A'), hashes('J'));
});

test('the verifier rejects an unpinned main thread and absent background affinity evidence', () => {
  for (const alter of [
    (metadata) => { metadata.affinity.configured.find((entry) => entry.tid === metadata.pid).mask = '0-15'; },
    (metadata) => { metadata.affinity.configured = metadata.affinity.configured.filter((entry) => entry.tid === metadata.pid); },
    (metadata) => { metadata.affinity.configured.find((entry) => entry.tid !== metadata.pid && !entry.disappeared).mask = '2'; },
  ]) {
    const metadata = structuredClone(results.B.metadata); alter(metadata);
    assert.throws(() => validateWorker(results.B.observation, metadata, results.B.expected));
  }
});

test('the verifier rejects wrong runtime identity, incomplete work and omitted public rows', () => {
  const metadata = structuredClone(results.B.metadata); metadata.runtimeRoot = baseline;
  assert.throws(() => validateWorker(results.B.observation, metadata, results.B.expected));
  metadata.runtimeRoot = candidate; metadata.complete = false;
  assert.throws(() => validateWorker(results.B.observation, metadata, results.B.expected));
  const observation = structuredClone(results.B.observation); observation.workloads.pop();
  assert.throws(() => validateWorker(observation, results.B.metadata, results.B.expected));
});

test('aggregation preserves budgets and detects control drift using copies of real observations', () => {
  // Repeated observations here test arithmetic only; they are never archived as independent measurements.
  const entries = settings.order.flatMap((label, position) => settings.engines.map((engine, slot) => ({ label, position, engine, slot,
    observation: structuredClone(results[engine === 'jsdom' ? 'J' : 'A'].observation) })));
  const identity = summarize(entries, 'AA');
  assert.ok(identity.every((row) => row.calibrated && row.rustdomChangePercent === 0 && row.jsdomControlChangePercent === 0));
  for (const entry of entries.filter((entry) => entry.label === 'B' && entry.engine === 'jsdom')) {
    for (const row of entry.observation.workloads) row.samplesMs = row.samplesMs.map((value) => value * 1.1);
  }
  assert.ok(summarize(entries, 'AB').every((row) => !row.calibrated && !row.withinBudget));
  assert.throws(() => summarize(entries.slice(1), 'AB'));
});

test('the driver refuses an existing result directory without altering its contents', () => {
  const directory = path.join(output, 'preserved'); fs.mkdirSync(directory);
  const sentinel = path.join(directory, 'partial.json'); fs.writeFileSync(sentinel, 'existing evidence\n');
  assert.throws(() => run(candidate, baseline, directory), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'existing evidence\n');
  assert.deepEqual(fs.readdirSync(directory), ['partial.json']);
});

test('the worker refuses an existing affinity sidecar before loading or executing a workload', () => {
  const metadataPath = path.join(output, 'B.affinity.json');
  const bytes = fs.readFileSync(metadataPath);
  const result = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'main-affinity-worker.cjs'),
    candidate, candidate, 'rustdom', metadataPath], { encoding: 'utf8', timeout: settings.workerTimeoutMs });
  assert.equal(result.status, 1); assert.match(result.stderr, /EEXIST/); assert.equal(result.stdout, '');
  assert.deepEqual(fs.readFileSync(metadataPath), bytes);
});
