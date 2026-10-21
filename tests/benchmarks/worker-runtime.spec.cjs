/** @file Exercises the reusable public workloads and the real worker CLI with independent runtime packages. */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { createBenchmarkRunner } = require('../../benchmarks/worker.cjs');
const { getBenchmarkPlan } = require('../../benchmarks/workload-plan.cjs');
const settings = require('../../reports/benchmarks/native-class-ownership/constants/main-affinity.cjs');
const root = process.env.RUSTDOM_BENCHMARK_PACKAGE || path.resolve(__dirname, '../..');
const fromPackage = createRequire(path.join(root, 'package.json'));
const runtimes = [
  { label: 'jsdom', engine: 'jsdom', api: fromPackage('jsdom') },
  { label: 'rustdom', engine: 'rustdom', api: require(path.join(root, 'dist/index.cjs')), root },
];
if (process.env.RUSTDOM_WORKER_BASELINE) {
  const baseline = path.resolve(process.env.RUSTDOM_WORKER_BASELINE);
  runtimes.push({ label: 'baseline', engine: 'rustdom', api: require(path.join(baseline, 'dist/index.cjs')), root: baseline });
}
const oraclePath = process.env.RUSTDOM_WORKER_REFERENCE_REPORT || path.resolve(__dirname,
  '../../reports/benchmarks/native-class-ownership/main-affinity/2026-10-21/node-22/index.json');
const oracle = JSON.parse(fs.readFileSync(oraclePath, 'utf8'));
const plan = getBenchmarkPlan().filter((workload) => settings.workloads.includes(workload.name));
const reports = {};
const runnerFor = (runtime) => createBenchmarkRunner({ engine: runtime.engine, runtime: runtime.api,
  environmentEntry: runtime.root ? pathToFileURL(path.join(runtime.root, 'src/environments/vitest.mjs')).href : undefined });

/** Use the entire original warmup/sample schedule for all eight rows; these timings are validation only. */
before(async () => {
  for (const runtime of runtimes) {
    const runner = runnerFor(runtime);
    reports[runtime.label] = [];
    for (const workload of plan) reports[runtime.label].push(await runner.measureWorkload(workload.name, workload.size));
  }
});

test('all real packages preserve the eight public workload outputs from the independent historical study', () => {
  assert.equal(plan.length, settings.rows.length);
  for (const runtime of runtimes) for (const report of reports[runtime.label]) {
    const expected = oracle.summaries.AA.find((row) => row.key === `${report.name}/${report.rows}`);
    assert.ok(expected); assert.equal(report.outputHash, expected.outputHash);
    assert.equal(report.samplesMs.length, settings.measuredSamples);
    assert.equal(report.memoryAfterCleanup.length, settings.measuredSamples);
    assert.ok(report.samplesMs.every((value) => Number.isFinite(value) && value > 0));
  }
});

test('binding separate real runtimes does not redirect native parsing through another runner', async () => {
  for (const runtime of runtimes) {
    const others = runtimes.filter((other) => other !== runtime && other.api.getParserStatistics);
    const before = others.map((other) => other.api.getParserStatistics().nativeDocument);
    const ownBefore = runtime.api.getParserStatistics?.().nativeDocument;
    await runnerFor(runtime).measureWorkload('range-control-1000', 250);
    for (const [index, other] of others.entries()) assert.equal(other.api.getParserStatistics().nativeDocument, before[index]);
    if (ownBefore !== undefined) assert.equal(runtime.api.getParserStatistics().nativeDocument - ownBefore,
      settings.warmupSamples + settings.measuredSamples);
  }
});

test('unknown workloads and fixture sizes are rejected before any native document is created', () => {
  const runtime = runtimes.find((runtime) => runtime.label === 'rustdom');
  const runner = runnerFor(runtime);
  const before = runtime.api.getParserStatistics().nativeDocument;
  assert.throws(() => runner.measureWorkload('unknown-workload', 250), /unknown workload or fixture size/);
  assert.throws(() => runner.measureWorkload('range-control-1000', -1), /unknown workload or fixture size/);
  assert.equal(runtime.api.getParserStatistics().nativeDocument, before);
});

test('the original CLI preserves both engines, all rows, sample counts and public output hashes', () => {
  for (const engine of ['jsdom', 'rustdom']) {
    const child = spawnSync(process.execPath, ['--expose-gc', 'benchmarks/worker.cjs', engine, ...settings.workloads], {
      cwd: path.resolve(__dirname, '../..'), env: { ...process.env, RUSTDOM_BENCHMARK_PACKAGE: root,
        RUSTDOM_BENCHMARK_SHARD_COUNT: '1', RUSTDOM_BENCHMARK_SHARD_INDEX: '0' },
      encoding: 'utf8', timeout: settings.workerTimeoutMs, maxBuffer: 4 * 1024 * 1024,
    });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
    const report = JSON.parse(child.stdout);
    assert.equal(report.engine, engine); assert.equal(report.warmupSamples, settings.warmupSamples);
    assert.equal(report.measuredSamples, settings.measuredSamples);
    assert.deepEqual(report.workloads.map((row) => `${row.name}/${row.rows}`).sort(), settings.rows);
    for (const workload of report.workloads) {
      const expected = reports[engine].find((row) => row.name === workload.name && row.rows === workload.rows);
      assert.equal(workload.outputHash, expected.outputHash); assert.equal(workload.samplesMs.length, settings.measuredSamples);
    }
  }
});

test('invalid CLI engines still fail before loading a nonexistent selected package', () => {
  const child = spawnSync(process.execPath, ['benchmarks/worker.cjs', 'invalid-engine'], {
    cwd: path.resolve(__dirname, '../..'), env: { ...process.env, RUSTDOM_BENCHMARK_PACKAGE: path.join(root, 'missing-runtime') },
    encoding: 'utf8', timeout: settings.workerTimeoutMs,
  });
  assert.equal(child.status, 1); assert.match(child.stderr, /engine must be jsdom or rustdom/);
  assert.equal(child.stdout, '');
});

test('runtime environment URLs preserve real Vitest setup and VM teardown in the reusable runner', async () => {
  for (const runtime of runtimes.filter((runtime) => runtime.label !== 'baseline')) {
    for (const name of ['environment-setup', 'environment-vm-setup']) {
      const report = await runnerFor(runtime).measureWorkload(name, 25);
      assert.equal(report.name, name); assert.equal(report.rows, 25);
      assert.equal(report.samplesMs.length, settings.measuredSamples);
      assert.equal(report.memoryAfterCleanup.length, settings.measuredSamples);
    }
  }
});
