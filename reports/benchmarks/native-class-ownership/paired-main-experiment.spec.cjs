/** @file Verifies the actual recorded paired workers and orchestration failures without collecting new performance samples. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { processSchedule, captureHarness, validateDistribution, validateWorker, summarize, verifyHarness, verify, verifySet, run } =
  require('./paired-main-experiment.cjs');
const settings = require('./constants/paired-main.cjs');
const evidence = path.resolve(__dirname, '../../validation/native-class-ownership/paired-main-sampler');
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const metadata = readJson(path.join(evidence, 'validation.json'));
const workers = metadata.pairedWorkers.map((entry) => {
  const report = readJson(path.join(evidence, entry.path));
  return { report, expected: { node: report.node, phase: report.phase, position: report.position, engine: report.engine,
    pid: report.affinity.configured[0].tid } };
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Remove only an owned test directory whose resolved parent and prefix have been verified. */
function withDirectory(operation) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-paired-study-test-'));
  try { return operation(root); }
  finally {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('rustdom-paired-study-test-'));
    fs.rmSync(resolved, { recursive: true });
  }
}

test('the declared process order covers both phases and every factor position once per engine', () => {
  const schedule = processSchedule(); assert.equal(schedule.length, 32);
  for (const phase of settings.phases) {
    const phaseEntries = schedule.filter((entry) => entry.phase === phase);
    assert.equal(phaseEntries.length, 16);
    assert.equal(phaseEntries.filter((entry, index) => index % 2 === 0 && entry.engine === 'jsdom').length, 4);
    for (const engine of settings.engines) assert.deepEqual(phaseEntries.filter((entry) => entry.engine === engine)
      .map((entry) => entry.position), Array.from({ length: settings.workerCount }, (_, position) => position));
  }
});

test('all four independently recorded real workers pass offline behavioral, affinity and resource verification', () => {
  for (const { report, expected } of workers) validateWorker(report, metadata.runtimeManifest, expected);
});

test('the verifier rejects removed rows, changed treatment, malformed samples and public output divergence', () => {
  const source = workers.find(({ report }) => report.engine === 'rustdom');
  for (const change of [
    (report) => { report.batches.pop(); },
    (report) => { report.schedule.physical.B = 'A0'; },
    (report) => { report.batches[0].samplesMs.pop(); },
    (report) => { report.batches[0].samplesMs[0] = NaN; },
    (report) => { report.batches[0].outputHash = '0'.repeat(64); },
    (report) => { report.batches[0].complete = false; },
  ]) {
    const report = structuredClone(source.report); change(report);
    assert.throws(() => validateWorker(report, metadata.runtimeManifest, source.expected));
  }
});

test('the verifier recomputes native release and weak survivors instead of trusting a clear flag', () => {
  const source = workers.find(({ report }) => report.engine === 'rustdom');
  for (const change of [
    (endpoint) => { endpoint.A.survivors.window = 1; },
    (endpoint) => { endpoint.B.survivors.document = 1; },
    (endpoint) => { endpoint.A.nativeTree.rangeStates.live += 1; },
    (endpoint) => { endpoint.B.nativeTree.napiClasses.live += 1; },
  ]) {
    const report = structuredClone(source.report); change(report.batches[0].cleanupTrace.at(-1));
    assert.throws(() => validateWorker(report, metadata.runtimeManifest, source.expected), /falsely declared resource endpoint/);
  }
});

test('unpinned principal, narrowed background masks and false isolation are rejected', () => {
  const source = workers.find(({ report }) => report.engine === 'rustdom');
  for (const change of [
    (report) => { report.affinitiesAfter.find((entry) => entry.tid === source.expected.pid).mask = '0-15'; },
    (report) => { report.affinity.configured.find((entry) => entry.tid !== source.expected.pid && !entry.disappeared).mask = '2'; },
    (report) => { report.isolation[0].otherCreated = 1; },
  ]) {
    const report = structuredClone(source.report); change(report);
    assert.throws(() => validateWorker(report, metadata.runtimeManifest, source.expected));
  }
});

test('package manifest hashes are recomputed and cannot be replaced by a refreshed unpinned digest', () => {
  const original = metadata.runtimeManifest.distributions.B;
  const modified = structuredClone(original); modified.files[0].sha256 = '0'.repeat(64);
  assert.throws(() => validateDistribution(modified, original.sha256), /inconsistent package manifest/);
  modified.sha256 = hash(JSON.stringify(modified.files));
  assert.throws(() => validateDistribution(modified, original.sha256), /unpinned package distribution/);
});

test('arithmetic preserves all eight rows and original thresholds without treating copied observations as a study', () => {
  // Copies below exercise only aggregation arithmetic, never archive independent measurement claims.
  const entries = processSchedule().filter((entry) => entry.phase === 'AB').map((entry) => ({ ...entry,
    observation: structuredClone(workers.find(({ report }) => report.engine === entry.engine).report) }));
  for (const entry of entries) {
    for (const batch of entry.observation.batches.filter((batch) => batch.label === 'B')) {
      const source = entry.observation.batches.find((other) => other.label === 'A' && other.name === batch.name && other.rows === batch.rows);
      batch.samplesMs = [...source.samplesMs];
    }
  }
  const identity = summarize(entries, 'AB');
  assert.equal(identity.length, 8);
  assert.ok(identity.every((row) => row.calibrated && row.withinBudget && row.rustdomChangePercent === 0));
  assert.ok(identity.every((row) => row.A.rustdom.processCount === 8 && row.A.rustdom.count === 72));
  for (const entry of entries) for (const batch of entry.observation.batches.filter((batch) => batch.label === 'B')) {
    batch.samplesMs = batch.samplesMs.map((value) => value * (entry.engine === 'rustdom' ? 1.06 : 1));
  }
  assert.ok(summarize(entries, 'AB').every((row) => row.calibrated && !row.withinBudget));
  for (const entry of entries.filter((entry) => entry.engine === 'jsdom')) {
    for (const batch of entry.observation.batches.filter((batch) => batch.label === 'B')) {
      batch.samplesMs = batch.samplesMs.map((value) => value * 1.03);
    }
  }
  assert.ok(summarize(entries, 'AB').every((row) => !row.calibrated && !row.withinBudget));
  assert.throws(() => summarize(entries.slice(1), 'AB'));
});

test('actual source snapshots reproduce the harness identity and reject altered or missing executed bytes', () => withDirectory((root) => {
  const harness = captureHarness(); const repository = path.resolve(__dirname, '../../..');
  for (const file of harness.files) {
    const target = path.join(root, 'harness', file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(repository, file.path), target);
  }
  verifyHarness(root, harness);
  const target = path.join(root, 'harness/benchmarks/worker.cjs');
  fs.appendFileSync(target, '\n// Altered source snapshot.\n');
  assert.throws(() => verifyHarness(root, harness));
  fs.unlinkSync(target); assert.throws(() => verifyHarness(root, harness));
}));

test('incomplete real-worker evidence cannot be presented as a complete Node archive or both Nodes', () => withDirectory((root) => {
  fs.writeFileSync(path.join(root, 'index.json'), JSON.stringify({ complete: false, runs: workers.map(({ report }) => report) }));
  assert.throws(() => verify(root)); assert.throws(() => verifySet([root]));
  const child = spawnSync(process.execPath, [path.join(__dirname, 'paired-main-experiment.cjs'), '--verify', root], { encoding: 'utf8' });
  assert.equal(child.status, 2); assert.equal(child.stdout, '');
}));

test('the real driver preserves an existing output directory before reading missing runtime paths',
  { skip: process.platform !== 'linux' || !settings.nodeVersions.includes(process.version) }, () => withDirectory((root) => {
    const output = path.join(root, 'existing'); fs.mkdirSync(output);
    fs.writeFileSync(path.join(output, 'sentinel.json'), 'existing evidence\n');
    assert.throws(() => run('/missing/manifest.json', output, '/missing/provenance.json'), { code: 'EEXIST' });
    assert.deepEqual(fs.readdirSync(output), ['sentinel.json']);
    assert.equal(fs.readFileSync(path.join(output, 'sentinel.json'), 'utf8'), 'existing evidence\n');
  }));

test('a changed reviewed harness is rejected before loading runtime packages or starting workers',
  { skip: process.platform !== 'linux' || !settings.nodeVersions.includes(process.version) }, () => withDirectory((root) => {
    const manifest = path.join(root, 'manifest.json'), provenance = path.join(root, 'provenance.json');
    fs.writeFileSync(manifest, JSON.stringify({ roots: { A: '/missing/reference', B: '/missing/candidate' } }));
    fs.writeFileSync(provenance, JSON.stringify({ harnessSha256: '0'.repeat(64) }));
    const output = path.join(root, 'output');
    assert.throws(() => run(manifest, output, provenance), /harness differs from reviewed sources/);
    const index = readJson(path.join(output, 'index.json'));
    assert.equal(index.complete, false); assert.deepEqual(index.runs, []);
    assert.match(index.failure.message, /harness differs from reviewed sources/);
    assert.deepEqual(fs.readdirSync(output), ['index.json']);
  }));
