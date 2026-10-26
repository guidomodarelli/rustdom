/** @file Exercises declared V8 seeds with real official packages, public workloads and retained-resource checks. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const study = require('./seeded-pre-gc-experiment.cjs');
const legacy = require('./pre-gc-warmup-experiment.cjs');
const worker = require('./seeded-pre-gc-worker.cjs');
const { createSinglePackageWorker } = require('./single-package-worker.cjs');
const settings = require('./constants/seeded-pre-gc.cjs');
const original = require('./constants/pre-gc-warmup.cjs');
const method = require('./constants/seeded-pre-gc-study.cjs');
const preparation = require('./hosted-main-experiment.cjs');
const archive = process.env.RUSTDOM_HOSTED_BUILD_ARCHIVE;
const prior = process.env.RUSTDOM_PRIOR_PRE_GC_ARCHIVE;
const output = process.env.RUSTDOM_SEEDED_PRE_GC_TEST_OUTPUT;
assert.ok(archive && prior && output, 'Set official preparation, complete historical pre-GC archive and fresh test output');
const manifest = preparation.createManifest(archive);
const manifestPath = path.join(output, 'manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });

test('fixed seeds retain every original treatment, row, factor, sample count and budget', () => {
  assert.deepEqual(study.processSchedule(), legacy.processSchedule());
  assert.equal(study.processSchedule().length, 128);
  assert.equal(new Set(settings.v8Seeds).size, settings.workerCount);
  assert.deepEqual(settings.v8Seeds, Array.from({ length: settings.workerCount }, (unusedValue, position) => position + 1));
  for (const key of ['rows', 'distributionHashes', 'warmupSamples', 'measuredSamples', 'cleanupRounds',
    'requiredClearRounds', 'controlBudgetPercent', 'rustBudgetPercent', 'warmupCurrentRealm', 'warmupGcOrder']) {
    assert.deepEqual(settings[key], original[key]);
  }
  for (const position of settings.v8Seeds.keys()) assert.deepEqual(worker.workerArguments(position),
    ['--expose-gc', `--random-seed=${position + 1}`, `--hash-seed=${position + 1}`]);
});

test('the previous full rejection remains verifiable and cannot be relabeled as seeded evidence', () => {
  const result = legacy.verifySet(['node-22', 'node-24'].map((label) => path.join(prior, label)));
  assert.equal(result.verified, true); assert.equal(result.accepted, false);
  const child = spawnSync(process.execPath, [path.join(__dirname, 'seeded-pre-gc-experiment.cjs'),
    '--verify-set', path.join(prior, 'node-22'), path.join(prior, 'node-24')], { encoding: 'utf8' });
  fs.writeFileSync(path.join(output, 'historical-relabel.stderr.log'), child.stderr, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'historical-relabel.process.json'), `${JSON.stringify({
    command: [process.execPath, path.join(__dirname, 'seeded-pre-gc-experiment.cjs'), '--verify-set',
      path.join(prior, 'node-22'), path.join(prior, 'node-24')], pid: child.pid, exitCode: child.status,
    signal: child.signal, error: child.error?.message ?? null })}\n`, { flag: 'wx' });
  assert.equal(child.status, 2); assert.equal(child.stdout, ''); assert.match(child.stderr, /AssertionError/);
});

const reports = [];
const inputs = [
  { phase: 'AA', engine: 'rustdom', position: 0, label: 'A' },
  { phase: 'AA', engine: 'rustdom', position: 0, label: 'B' },
  { phase: 'AA', engine: 'jsdom', position: 0, label: 'A' },
  { phase: 'AA', engine: 'jsdom', position: 0, label: 'B' },
  { phase: 'AB', engine: 'rustdom', position: 15, label: 'B' },
];

/**
 * Preserve each real worker and use its public process report as the verifier input.
 * @param {object} input - Phase, engine, position and treatment of a real official copy.
 * @param {string} prefix - Unique filename prefix under the preserved qualification directory.
 * @param {object} [options] - Explicit seeded or unchanged historical startup policy.
 * @param {boolean} [options.seeded=true] - Select the declared seeded worker instead of the legacy worker.
 * @returns {object} Complete result after successful process termination and resource validation.
 * @throws {Error} When the real worker fails or its output violates the declared package, treatment or cleanup contract.
 */
function execute(input, prefix, { seeded = true } = {}) {
  const filename = path.join(output, `${prefix}.json`);
  const argumentsList = seeded ? worker.workerArguments(input.position) : ['--expose-gc'];
  const script = seeded ? method.workerFilename : 'pre-gc-warmup-worker.cjs';
  const environment = { ...process.env }; delete environment.NODE_OPTIONS;
  const child = spawnSync(process.execPath, [...argumentsList, path.join(__dirname, script), manifestPath,
    input.phase, input.engine, String(input.position), input.label, filename],
  { env: environment, encoding: 'utf8', timeout: method.workerTimeoutMs });
  fs.writeFileSync(path.join(output, `${prefix}.stdout.log`), child.stdout ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(output, `${prefix}.stderr.log`), child.stderr ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(output, `${prefix}.process.json`), `${JSON.stringify({ command: [process.execPath,
    ...argumentsList, path.join(__dirname, script), manifestPath, input.phase, input.engine, String(input.position),
    input.label, filename], pid: child.pid, exitCode: child.status, signal: child.signal,
    error: child.error?.message ?? null })}\n`, { flag: 'wx' });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  const report = JSON.parse(fs.readFileSync(filename, 'utf8'));
  (seeded ? study : legacy).validateWorker(report, manifest, { ...input, node: process.version, pid: child.pid });
  return report;
}

for (const input of inputs) {
  test(`real seeded ${input.phase}/${input.engine}/${input.position}/${input.label} preserves output and release`, () => {
    reports.push(execute(input, `seeded-${input.phase}-${input.engine}-${input.position}-${input.label}`));
  });
}

test('all five packages keep the public hashes and share the startup RNG prefix at a matched position', () => {
  assert.equal(reports.length, inputs.length);
  assert.equal(new Set(reports.map((report) => report.schedule.physical)).size, 5);
  const oracle = JSON.parse(fs.readFileSync(path.join(prior, 'node-22/AA-0-jsdom-A.json')));
  for (const report of reports) for (const batch of report.batches) {
    assert.equal(batch.outputHash, oracle.batches.find((row) => row.name === batch.name && row.size === batch.size).outputHash);
  }
  const matched = reports.filter((report) => report.phase === 'AA').map((report) => ({ ...report, observation: report }));
  study.validateSeedProbes(matched);
  assert.notDeepEqual(reports[0].randomProbe, reports.at(-1).randomProbe);
  const changedProbe = structuredClone(matched);
  changedProbe[0].observation.randomProbe[0] /= 2;
  assert.throws(() => study.validateSeedProbes(changedProbe), /startup RNG differs/);
});

for (const input of [inputs[2], inputs.at(-1)]) {
  test(`legacy ${input.engine} startup and resource contracts remain unchanged`, () => {
    const report = execute(input, `legacy-${input.engine}`, { seeded: false });
    assert.deepEqual(report.execArgv, ['--expose-gc']);
    assert.equal(Object.hasOwn(report, 'v8Seed'), false); assert.equal(Object.hasOwn(report, 'randomProbe'), false);
  });
}

test('missing flags and invalid declarations are rejected before any real workload is measured', () => {
  const filename = path.join(output, 'missing-flags.json');
  const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, method.workerFilename),
    manifestPath, 'AA', 'jsdom', '0', 'A', filename], { encoding: 'utf8', timeout: method.workerTimeoutMs });
  fs.writeFileSync(path.join(output, 'missing-flags.stderr.log'), child.stderr, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'missing-flags.process.json'), `${JSON.stringify({
    command: [process.execPath, '--expose-gc', path.join(__dirname, method.workerFilename), manifestPath,
      'AA', 'jsdom', '0', 'A', filename], pid: child.pid, exitCode: child.status,
    signal: child.signal, error: child.error?.message ?? null })}\n`, { flag: 'wx' });
  assert.equal(child.status, 1); assert.match(child.stderr, /process flags differ/);
  assert.equal(fs.existsSync(filename), false);
  for (const seeds of [[], [0, ...settings.v8Seeds.slice(1)], [NaN, ...settings.v8Seeds.slice(1)]]) {
    assert.throws(() => createSinglePackageWorker({ ...settings, v8Seeds: seeds }).workerArguments(0));
  }
  const report = reports[0]; const expected = { ...inputs[0], node: process.version, pid: report.pid };
  const wrongFlags = structuredClone(report); wrongFlags.execArgv.pop();
  assert.throws(() => study.validateWorker(wrongFlags, manifest, expected));
  const wrongSeed = structuredClone(report); wrongSeed.v8Seed++;
  assert.throws(() => study.validateWorker(wrongSeed, manifest, expected));
  const noProbe = structuredClone(report); noProbe.randomProbe = [];
  assert.throws(() => study.validateWorker(noProbe, manifest, expected));
});
