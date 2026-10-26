/** @file Qualifies real row-isolated processes, public output, release and historical archive preservation. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const study = require('./row-isolation-experiment.cjs');
const legacy = require('./seeded-pre-gc-experiment.cjs');
const worker = require('./row-isolation-worker.cjs');
const { createSinglePackageWorker } = require('./single-package-worker.cjs');
const settings = require('./constants/row-isolation.cjs');
const original = require('./constants/seeded-pre-gc.cjs');
const method = require('./constants/row-isolation-study.cjs');
const preparation = require('./hosted-main-experiment.cjs');
const archive = process.env.RUSTDOM_HOSTED_BUILD_ARCHIVE;
const prior = process.env.RUSTDOM_PRIOR_SEEDED_ARCHIVE;
const output = process.env.RUSTDOM_ROW_ISOLATION_TEST_OUTPUT;
assert.ok(archive && prior && output, 'Set official preparation, complete historical seeded archive and fresh test output');
const manifest = preparation.createManifest(archive);
const manifestPath = path.join(output, 'manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });

test('process partition retains every original factor and row in the global schedule', () => {
  const sequence = study.processSchedule();
  assert.equal(sequence.length, 1024);
  const unpartitioned = legacy.processSchedule();
  const groups = [];
  for (let offset = 0; offset < sequence.length; offset += settings.rows.length) {
    const group = sequence.slice(offset, offset + settings.rows.length);
    const { rowIndex: unusedIndex, ...input } = group[0];
    groups.push(input);
    assert.deepEqual(group.map(({ rowIndex: unusedRowIndex, ...entry }) => entry), group.map(() => input));
    const canonical = settings.rows.map((unusedRow, rowIndex) => rowIndex);
    assert.deepEqual(group.map((entry) => entry.rowIndex), input.position & 4 ? canonical.reverse() : canonical);
    const legacyPlan = require('./seeded-pre-gc-worker.cjs').schedule(manifest,
      input.phase, input.engine, input.position, input.label);
    assert.deepEqual(group.flatMap((entry) => worker.schedule(manifest, entry.phase,
      entry.engine, entry.position, entry.label, entry.rowIndex).rows), legacyPlan.rows);
  }
  assert.deepEqual(groups, unpartitioned);
  const { revision: unusedRevision, rowPartition: unusedPartition, ...unchanged } = settings;
  const { revision: unusedOriginalRevision, ...originalSettings } = original;
  assert.deepEqual(unchanged, originalSettings);
});

test('both historical seeded rejections remain verifiable with the updated factories', () => {
  const result = legacy.verifySet(['node-22', 'node-24'].map((label) => path.join(prior, label)));
  assert.equal(result.verified, true); assert.equal(result.accepted, false);
  assert.deepEqual(result.results.map((entry) => entry.processes), [128, 128]);
  assert.deepEqual(result.results.map((entry) => entry.measuredDurations), [9216, 9216]);
  const command = [path.join(__dirname, 'row-isolation-experiment.cjs'), '--verify-set',
    path.join(prior, 'node-22'), path.join(prior, 'node-24')];
  const child = spawnSync(process.execPath, command, { encoding: 'utf8' });
  fs.writeFileSync(path.join(output, 'historical-relabel.stderr.log'), child.stderr, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'historical-relabel.process.json'), `${JSON.stringify({
    command: [process.execPath, ...command], pid: child.pid, exitCode: child.status,
    signal: child.signal, error: child.error?.message ?? null })}\n`, { flag: 'wx' });
  assert.equal(child.status, 2); assert.equal(child.stdout, ''); assert.match(child.stderr, /AssertionError/);
});

const inputs = [
  { phase: 'AA', engine: 'rustdom', position: 0, label: 'A' },
  { phase: 'AA', engine: 'rustdom', position: 0, label: 'B' },
  { phase: 'AA', engine: 'jsdom', position: 0, label: 'A' },
  { phase: 'AA', engine: 'jsdom', position: 0, label: 'B' },
  { phase: 'AB', engine: 'rustdom', position: 15, label: 'B' },
];
const reports = [];

/**
 * Run the actual worker CLI and preserve its process and public resource observations.
 * @param {object} input - Declared phase, engine, position, label and optional canonical row index.
 * @param {string} prefix - Unique filename prefix in the qualification directory.
 * @param {boolean} [isolated=true] - Use process partition or the unchanged seeded default.
 * @returns {object} Validated real child report after termination.
 * @throws {Error} When the child, public output or resource contract fails.
 */
function execute(input, prefix, isolated = true) {
  const filename = path.join(output, `${prefix}.json`);
  const script = isolated ? method.workerFilename : 'seeded-pre-gc-worker.cjs';
  const argumentsList = [...worker.workerArguments(input.position), path.join(__dirname, script), manifestPath,
    input.phase, input.engine, String(input.position), input.label, filename,
    ...(isolated ? [String(input.rowIndex)] : [])];
  const environment = { ...process.env }; delete environment.NODE_OPTIONS;
  const child = spawnSync(process.execPath, argumentsList,
    { env: environment, encoding: 'utf8', timeout: method.workerTimeoutMs });
  fs.writeFileSync(path.join(output, `${prefix}.stdout.log`), child.stdout ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(output, `${prefix}.stderr.log`), child.stderr ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(output, `${prefix}.process.json`), `${JSON.stringify({
    command: [process.execPath, ...argumentsList], pid: child.pid, exitCode: child.status,
    signal: child.signal, error: child.error?.message ?? null })}\n`, { flag: 'wx' });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  const report = JSON.parse(fs.readFileSync(filename, 'utf8'));
  (isolated ? study : legacy).validateWorker(report, manifest, { ...input, node: process.version, pid: child.pid });
  return report;
}

for (const input of inputs) {
  test(`all eight isolated workloads preserve ${input.phase}/${input.engine}/${input.position}/${input.label}`, () => {
    const ordered = study.processSchedule().filter((entry) => Object.entries(input).every(([key, value]) => entry[key] === value));
    assert.equal(ordered.length, settings.rows.length);
    for (const entry of ordered) reports.push(execute(entry,
      `isolated-${entry.phase}-${entry.engine}-${entry.position}-${entry.label}-row-${entry.rowIndex}`));
  });
}

test('all five physical copies preserve the eight public hashes and pre-exit release', () => {
  assert.equal(reports.length, 40);
  assert.equal(new Set(reports.map((report) => report.schedule.physical)).size, 5);
  const oracle = JSON.parse(fs.readFileSync(path.join(prior, 'node-22/AA-0-jsdom-A.json')));
  for (const report of reports) {
    assert.equal(report.batches.length, 1);
    const batch = report.batches[0];
    assert.equal(`${batch.name}/${batch.size}`, settings.rows[report.rowIndex]);
    assert.equal(batch.outputHash, oracle.batches.find((row) => row.name === batch.name && row.size === batch.size).outputHash);
    const owners = settings.warmupSamples + settings.measuredSamples;
    assert.deepEqual(batch.trackedOwners, { window: owners, document: owners });
    assert.ok(batch.cleanupTrace.slice(-settings.requiredClearRounds).every((endpoint) => endpoint.clear));
  }
  const matched = reports.filter((report) => report.phase === 'AA').map((report) => ({ ...report, observation: report }));
  study.validateSeedProbes(matched);
  const duplicate = structuredClone(matched); duplicate[0] = duplicate[1];
  assert.throws(() => study.validateSeedProbes(duplicate));
  assert.throws(() => study.validateSeedProbes(matched.slice(1)), /incomplete seeded process group/);
  const changedProbe = structuredClone(matched); changedProbe[0].observation.randomProbe[0] /= 2;
  assert.throws(() => study.validateSeedProbes(changedProbe), /startup RNG differs/);
});

for (const input of [inputs[2], inputs.at(-1)]) {
  test(`unpartitioned seeded ${input.engine} retains the actual eight-row worker contract`, () => {
    const report = execute(input, `unpartitioned-${input.engine}`, false);
    assert.equal(report.batches.length, 8); assert.equal(Object.hasOwn(report, 'rowIndex'), false);
  });
}

test('invalid row CLI arguments fail before loading a package or measuring a workload', () => {
  for (const [caseIndex, argument] of [undefined, '', '-1', '8', '0.5', 'not-a-row'].entries()) {
    const filename = path.join(output, `invalid-row-${caseIndex}.json`);
    const command = [...worker.workerArguments(0), path.join(__dirname, method.workerFilename), manifestPath,
      'AA', 'jsdom', '0', 'A', filename, ...(argument === undefined ? [] : [argument])];
    const child = spawnSync(process.execPath, command, { encoding: 'utf8', timeout: method.workerTimeoutMs });
    fs.writeFileSync(path.join(output, `invalid-row-${caseIndex}.stderr.log`), child.stderr, { flag: 'wx' });
    fs.writeFileSync(path.join(output, `invalid-row-${caseIndex}.process.json`), `${JSON.stringify({
      command: [process.execPath, ...command], pid: child.pid, exitCode: child.status,
      signal: child.signal, error: child.error?.message ?? null })}\n`, { flag: 'wx' });
    assert.ifError(child.error); assert.equal(child.status, 1); assert.match(child.stderr, /rowIndex/);
    assert.equal(fs.existsSync(filename), false);
  }
  assert.throws(() => createSinglePackageWorker({ ...original, rowPartition: 'undeclared' }));
});

test('altered row identity, extra batches and false resource endpoints cannot pass verification', () => {
  const report = reports[0];
  const expected = { ...inputs[0], rowIndex: report.rowIndex, pid: report.pid, node: process.version };
  for (const mutate of [
    (altered) => { altered.rowIndex = 7; },
    (altered) => { altered.schedule.rows[0].size++; },
    (altered) => { altered.batches.push(altered.batches[0]); },
    (altered) => { altered.batches[0].cleanupTrace.at(-1).survivors.window++; },
  ]) {
    const altered = structuredClone(report); mutate(altered);
    assert.throws(() => study.validateWorker(altered, manifest, expected));
  }
  assert.throws(() => study.summarize(reports.filter((report) => report.phase === 'AA')
    .map((report) => ({ ...report, observation: report })), 'AA'), /incomplete or reordered treatment rows/);
});
