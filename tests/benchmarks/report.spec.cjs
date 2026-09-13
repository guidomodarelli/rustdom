/** @file Exercises benchmark aggregation failures through real JSON and filesystem contracts. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { BenchmarkReport } = require('../../benchmarks/report.cjs');

/**
 * Prepare an isolated artifact destination and explicit worker-contract data.
 * @param {import('node:test').TestContext} context - Owns temporary output cleanup.
 * @returns {object} Report writer, sample runs and destination.
 */
function fixture(context) {
  const directory = mkdtempSync(join(tmpdir(), 'rustdom-benchmark-report-'));
  context.after(() => rmSync(directory, { recursive: true }));
  const report = { capturedAt: '2026-09-13T00:00:00.000Z', complete: false,
    workerTimeoutMs: 600_000, node: process.version, jsdom: '27.4.0',
    machine: { cpu: 'contract-fixture', release: 'contract-fixture' }, runs: [], comparisons: [] };
  const runs = ['jsdom', 'rustdom', 'rustdom', 'jsdom'].map((engine) => ({
    engine, warmupSamples: 3, measuredSamples: 9,
    workloads: [{ name: 'shadow-hosts-create-100', rows: 25, outputHash: 'equivalent-output',
      samplesMs: [9, 1, 5, 3, 7, 2, 8, 4, 6] }],
  }));
  return { directory, report, runs, writer: new BenchmarkReport(report, directory) };
}

/**
 * Consume the same serialized result contract emitted by a completed worker.
 * @param {BenchmarkReport} writer - Current aggregation lifecycle.
 * @param {object[]} runs - Already measured process outcomes in execution order.
 * @returns {void} Records every successful JSON worker output.
 */
function recordRuns(writer, runs) {
  for (const [index, run] of runs.entries()) writer.recordWorker({ status: 0, signal: null,
    stdout: JSON.stringify(run), stderr: `completed process ${index + 1}` }, {
    engine: run.engine, processIndex: index + 1, elapsedMs: 100, timeoutMs: 600_000,
  });
}

/**
 * Observe an actual thrown error and read its persisted incomplete artifact.
 * @param {object} scenario - Fixture containing the report writer and destination.
 * @param {Function} action - Failing report operation.
 * @param {Function} causeType - Expected original error constructor.
 * @returns {object} Parsed durable report with the original cause verified.
 */
function failure(scenario, action, causeType) {
  assert.throws(action, (error) => {
    assert.ok(error.cause instanceof causeType);
    assert.match(error.message, /diagnostic: .+-failed\.json/);
    return true;
  });
  const files = readdirSync(scenario.directory);
  assert.equal(files.length, 1);
  assert.match(files[0], /-failed\.json$/);
  const saved = JSON.parse(readFileSync(join(scenario.directory, files[0]), 'utf8'));
  assert.equal(saved.complete, false);
  assert.equal(scenario.report.complete, false);
  return saved;
}

test('should preserve completed samples and invalid output when worker JSON cannot be parsed', (context) => {
  // Arrange: a measured worker succeeds before an exit-zero result has broken JSON.
  const scenario = fixture(context);
  recordRuns(scenario.writer, scenario.runs.slice(0, 1));
  const invalidOutput = '{"engine":"rustdom","workloads":';
  // Act and assert: the parse exception remains the cause and both outputs survive.
  const saved = failure(scenario, () => scenario.writer.recordWorker({ status: 0, signal: null,
    stdout: invalidOutput, stderr: 'completed workload before truncated JSON' }, {
    engine: 'rustdom', processIndex: 2, elapsedMs: 120, timeoutMs: 600_000,
  }), SyntaxError);
  assert.equal(saved.failure.stage, 'worker-json');
  assert.equal(saved.failure.exitCode, 0);
  assert.equal(saved.failure.processIndex, 2);
  assert.equal(saved.failure.cause.name, 'SyntaxError');
  assert.deepEqual(saved.runs, scenario.runs.slice(0, 1));
  assert.equal(saved.processes.length, 2);
  assert.deepEqual(JSON.parse(saved.processes[0].stdout), scenario.runs[0]);
  assert.equal(saved.processes[1].stdout, invalidOutput);
  assert.equal(saved.processes[1].stderr, 'completed workload before truncated JSON');
});

test('should retain all raw runs and partial comparisons when output hashes diverge', (context) => {
  // Arrange: the first workload compares successfully, the second diverges.
  const scenario = fixture(context);
  for (const run of scenario.runs) run.workloads.push({ ...run.workloads[0], name: 'second-workload' });
  scenario.runs[2].workloads[1].outputHash = 'different-output';
  recordRuns(scenario.writer, scenario.runs);
  // Act and assert: no complete artifact is published and the mismatch still fails.
  const saved = failure(scenario, () => scenario.writer.finish(), assert.AssertionError);
  assert.equal(saved.failure.stage, 'output-comparison');
  assert.equal(saved.failure.workload, 'second-workload');
  assert.equal(saved.failure.rows, 25);
  assert.match(saved.failure.cause.message, /Benchmark output mismatch: second-workload\/25/);
  assert.deepEqual(saved.runs, scenario.runs);
  assert.equal(saved.comparisons.length, 1);
  assert.equal(saved.processes.length, 4);
  assert.deepEqual(saved.processes.map((entry) => JSON.parse(entry.stdout)), scenario.runs);
});

test('should preserve measured output when a later run lacks a comparable workload', (context) => {
  const scenario = fixture(context);
  scenario.runs[2].workloads = [];
  recordRuns(scenario.writer, scenario.runs);
  const saved = failure(scenario, () => scenario.writer.finish(), TypeError);
  assert.equal(saved.failure.stage, 'output-comparison');
  assert.deepEqual(saved.runs, scenario.runs);
  assert.equal(saved.processes.length, 4);
});

test('should preserve samples when a sample cannot participate in the numeric summary', (context) => {
  const scenario = fixture(context);
  scenario.runs[2].workloads[0].samplesMs[0] = { valueOf: null, toString: null };
  recordRuns(scenario.writer, scenario.runs);
  const saved = failure(scenario, () => scenario.writer.finish(), TypeError);
  assert.equal(saved.failure.stage, 'sample-summary');
  assert.deepEqual(saved.runs, scenario.runs);
});

test('should preserve raw results when summary formatting fails after aggregation', (context) => {
  const scenario = fixture(context);
  scenario.runs[0].workloads[0].samplesMs = ['invalid-duration'];
  scenario.runs[3].workloads[0].samplesMs = [];
  recordRuns(scenario.writer, scenario.runs);
  const saved = failure(scenario, () => scenario.writer.finish(), TypeError);
  assert.equal(saved.failure.stage, 'summary-render');
  assert.deepEqual(saved.runs, scenario.runs);
  assert.equal(saved.comparisons.length, 1);
});

test('should publish equivalent summaries and unchanged raw samples when every stage succeeds', (context) => {
  const scenario = fixture(context);
  recordRuns(scenario.writer, scenario.runs);
  const result = scenario.writer.finish();
  const saved = JSON.parse(readFileSync(result.jsonPath, 'utf8'));
  assert.equal(saved.complete, true);
  assert.equal(saved.failure, undefined);
  assert.equal(saved.processes, undefined);
  assert.deepEqual(saved.runs, scenario.runs);
  assert.deepEqual(saved.comparisons[0].jsdom,
    { samples: 18, medianMs: 5, p95Ms: 9, minMs: 1, maxMs: 9 });
  assert.deepEqual(saved.comparisons[0].rustdom, saved.comparisons[0].jsdom);
  assert.equal(saved.comparisons[0].speedup, 1);
  const markdown = readFileSync(result.jsonPath.replace(/\.json$/, '.md'), 'utf8');
  assert.ok(markdown.includes(result.table.join('\n')));
  assert.equal(readdirSync(scenario.directory).length, 2);
});

test('should preserve the original failure when the diagnostic destination is unavailable', (context) => {
  const scenario = fixture(context);
  const occupiedPath = join(scenario.directory, 'occupied');
  writeFileSync(occupiedPath, 'existing file');
  const writer = new BenchmarkReport(scenario.report, occupiedPath);
  assert.throws(() => writer.recordWorker({ status: 0, signal: null, stdout: '{', stderr: '' }, {
    engine: 'jsdom', processIndex: 1, elapsedMs: 10, timeoutMs: 600_000,
  }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.ok(error.cause instanceof SyntaxError);
    assert.equal(error.errors[0], error.cause);
    assert.equal(error.errors[1].code, 'EEXIST');
    assert.match(error.message, /diagnostic could not be saved/);
    return true;
  });
  assert.equal(readFileSync(occupiedPath, 'utf8'), 'existing file');
  assert.equal(scenario.report.complete, false);
});
