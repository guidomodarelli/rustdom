/** @file Exercises aggregation of real archived workers and the CLI's protection of historical measurements. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { summarize, archiveFailureReports } = require('./hosted-experiment.cjs');
const { BenchmarkReport } = require('../../../benchmarks/report.cjs');
const protocol = require('./constants/hosted.cjs');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(__dirname, relativePath), 'utf8'));
const original = readJson('local/index.json');
const originalEntries = original.blocks.filter((block) => block.node === protocol.nodeVersion).map((block) => ({
  label: block.label, report: readJson(`local/${block.report}`),
}));

test('recomputes the original public Range regression without changing its samples or threshold', () => {
  const expected = readJson('local/v22.12.0-summary.json');
  const rows = summarize(originalEntries, 'AB');
  for (const row of rows) {
    const historical = expected.rows.find((entry) => entry.key === row.key);
    assert.equal(row.rustdomChangePercent, historical.rustdomChangePercent);
    assert.equal(row.jsdomControlChangePercent, historical.jsdomControlChangePercent);
  }
  assert.equal(rows.find((row) => row.key.endsWith('/1000')).withinBudget, false);
});

test('rejects divergent public outputs rather than accepting favorable durations', () => {
  const entries = structuredClone(originalEntries);
  const workload = entries[0].report.runs[0].workloads.find((entry) => `${entry.name}/${entry.rows}` === protocol.rows[0]);
  workload.outputHash = '0'.repeat(64);
  assert.throws(() => summarize(entries, 'AB'), /Public output differs/);
});

test('recomputes the uncalibrated original A/A and preserves its rejection', () => {
  const index = readJson('negative-control/index.json');
  const entries = index.blocks.map((block) => ({ label: block.label, report: readJson(`negative-control/${block.report}`) }));
  const rows = summarize(entries, 'AA');
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => !row.calibrated));
});

test('refuses an existing output directory before loading an engine, preserving its bytes', () => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'rustdom-ownership-history-'));
  const marker = path.join(directory, 'sentinel.json');
  const historical = Buffer.from('{"preserve":true}\n');
  fs.writeFileSync(marker, historical);
  try {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'hosted-experiment.cjs'), 'missing-baseline', directory, '0'], { encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /output directory already exists/);
    assert.deepEqual(fs.readdirSync(directory), ['sentinel.json']);
    assert.deepEqual(fs.readFileSync(marker), historical);
  } finally { fs.unlinkSync(marker); fs.rmdirSync(directory); }
});

test('archives a real failed CLI report and its completed observations before propagating failure', () => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'rustdom-ownership-partial-'));
  const output = path.join(directory, 'archive');
  fs.mkdirSync(output);
  const historical = path.join(directory, 'historical-failed.json');
  fs.writeFileSync(historical, '{"historical":true}\n');
  const before = new Set(fs.readdirSync(directory));
  const completedWorker = originalEntries[0].report.runs[0];
  const metadata = { complete: false, runs: [completedWorker], comparisons: [] };
  const report = new BenchmarkReport(metadata, directory);
  try {
    assert.throws(() => report.fail(new Error('Deliberate controlled report failure'), { stage: 'worker-execution' }), /diagnostic:/);
    const partials = archiveFailureReports(directory, before, output, 'AA-01-A');
    assert.equal(partials.length, 1);
    const bytes = fs.readFileSync(path.join(output, partials[0].archived));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), partials[0].sha256);
    assert.deepEqual(bytes, fs.readFileSync(path.join(directory, partials[0].original)));
    const archived = JSON.parse(bytes);
    assert.equal(archived.complete, false);
    assert.deepEqual(archived.runs[0], completedWorker);
    assert.equal(archived.failure.cause.message, 'Deliberate controlled report failure');
    assert.equal(fs.readFileSync(historical, 'utf8'), '{"historical":true}\n');
  } finally {
    for (const name of fs.readdirSync(output)) fs.unlinkSync(path.join(output, name));
    fs.rmdirSync(output);
    for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
  }
});
