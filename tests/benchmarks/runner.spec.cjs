/** @file Exercises the real benchmark CLI, worker deadlines and preserved failure artifacts. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

/**
 * Run the production CLI and real engines with an isolated deadline setting.
 * @param {string} workload - Public workload selector.
 * @param {string | undefined} timeout - Optional worker budget in milliseconds.
 * @param {string | undefined} packageRoot - Optional actual package to load.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} Captured process result.
 */
function runBenchmark(workload, timeout, packageRoot) {
  const env = { ...process.env };
  delete env.RUSTDOM_BENCHMARK_TIMEOUT_MS;
  delete env.RUSTDOM_BENCHMARK_PACKAGE;
  if (packageRoot !== undefined) env.RUSTDOM_BENCHMARK_PACKAGE = packageRoot;
  if (timeout !== undefined) env.RUSTDOM_BENCHMARK_TIMEOUT_MS = timeout;
  return spawnSync(process.execPath, ['--expose-gc', 'benchmarks/compare.cjs', workload], {
    env, encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
  });
}

/**
 * Read the durable diagnostic named by a failed CLI invocation.
 * @param {import('node:child_process').SpawnSyncReturns<string>} child - Completed benchmark CLI.
 * @returns {object} Parsed failure report.
 */
function failureReport(child) {
  assert.ifError(child.error);
  assert.equal(child.status, 1);
  const match = child.stderr.match(/diagnostic: (reports\/benchmarks\/[^\s]+-failed\.json)/);
  assert.ok(match, child.stderr);
  const report = JSON.parse(readFileSync(match[1], 'utf8'));
  assert.equal(report.complete, false);
  assert.deepEqual(report.comparisons, []);
  return report;
}

test('benchmark CLI rejects invalid worker budgets before starting measurements', () => {
  for (const timeout of ['0', '-1', '1.5', 'invalid', 'Infinity', '9007199254740992', '']) {
    const child = runBenchmark('shadow-hosts-create-100', timeout);
    assert.ifError(child.error);
    assert.equal(child.status, 1);
    assert.match(child.stderr, /RUSTDOM_BENCHMARK_TIMEOUT_MS must be a positive safe integer/);
    assert.equal(child.stdout, '');
  }
});

test('benchmark CLI fails on a real worker deadline and preserves its diagnostic', () => {
  const report = failureReport(runBenchmark('shadow-hosts-create-100', '1'));
  assert.equal(report.workerTimeoutMs, 1);
  assert.deepEqual(report.runs, []);
  assert.equal(report.failure.engine, 'jsdom');
  assert.equal(report.failure.processIndex, 1);
  assert.equal(report.failure.error.code, 'ETIMEDOUT');
  assert.equal(report.failure.timeoutMs, 1);
  assert.ok(report.failure.elapsedMs >= 1);
  assert.equal(report.failure.exitCode, null);
  assert.ok(report.failure.signal);
});

test('benchmark CLI preserves a real worker rejection without classifying it as a timeout', () => {
  const report = failureReport(runBenchmark('unknown-workload'));
  assert.equal(report.workerTimeoutMs, 600_000);
  assert.equal(report.failure.error, null);
  assert.equal(report.failure.exitCode, 1);
  assert.equal(report.failure.signal, null);
  assert.match(report.failure.stderr, /Unknown benchmark workload: unknown-workload/);
});

test('benchmark CLI preserves complete real-engine samples and comparable outputs', () => {
  const packageRoot = resolve(__dirname, '../..');
  const child = runBenchmark('shadow-hosts-create-100', undefined, packageRoot);
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  const match = child.stdout.match(/Guardado: (reports\/benchmarks\/[^\s]+\.json)/);
  assert.ok(match, child.stdout);
  const report = JSON.parse(readFileSync(match[1], 'utf8'));
  assert.equal(report.complete, true);
  assert.equal(report.runtimeSource.kind, 'package-override');
  assert.equal(report.runtimeSource.root, packageRoot);
  assert.equal(report.runtimeSource.entry, resolve(packageRoot, 'dist/index.cjs'));
  assert.equal(report.nativeBinarySha256, report.runtimeSource.nativeBuild.binarySha256);
  assert.equal(report.workerTimeoutMs, 600_000);
  assert.equal(report.failure, undefined);
  assert.deepEqual(report.runs.map((run) => run.engine), ['jsdom', 'rustdom', 'rustdom', 'jsdom']);
  assert.equal(report.comparisons.length, 1);
  const hashes = [];
  for (const run of report.runs) {
    assert.equal(run.warmupSamples, 3);
    assert.equal(run.measuredSamples, 9);
    assert.equal(run.workloads.length, 1);
    assert.equal(run.workloads[0].samplesMs.length, 9);
    assert.equal(run.workloads[0].name, 'shadow-hosts-create-100');
    hashes.push(run.workloads[0].outputHash);
  }
  assert.ok(hashes.every((hash) => hash === hashes[0]));
  for (const engine of ['jsdom', 'rustdom']) assert.equal(report.comparisons[0][engine].samples, 18);
});
