/** @file Exercises the real paired coordinator, public DOM operations, IPC and bounded owner release. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readdirSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { runPairedComparison } = require('../../benchmarks/paired.cjs');

test('should pair real independent engines and release every owner while preserving loading state and full outputs', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'rustdom-paired-contract-'));
  const report = await runPairedComparison({ first: { kind: 'jsdom' },
    second: { kind: 'rustdom', root: resolve(__dirname, '../..') }, outputDirectory: directory,
    warmupSamples: 2, measuredSamples: 4, workerPairs: 1,
    rows: ['clone-shallow-template', 'import-template-content', 'attribute-get', 'form-data-construct'].map((name) => ({ name, size: 4 })) });
  assert.equal(report.complete, true); assert.equal(report.rows.length, 4);
  assert.deepEqual(report.pairs[0].exits, [{ code: 0, signal: null }, { code: 0, signal: null }]);
  for (const row of report.rows) {
    assert.equal(row.samplesPerStage, 4);
    const samples = report.pairs[0].observations.filter((sample) => sample.name === row.name);
    assert.equal(samples.filter((sample) => sample.phase === 'warmup').length, 4);
    assert.equal(samples.filter((sample) => sample.phase === 'measured').length, 8);
    assert.equal(new Set(samples.map((sample) => sample.outputHash)).size, 1);
    for (const sample of samples) {
      assert.equal(sample.documentReadyState, 'loading'); assert.ok(sample.elapsedMs > 0);
      assert.ok(sample.cpu.user >= 0 && sample.cpu.system >= 0);
      assert.equal(sample.release.reached, true);
      assert.deepEqual(sample.release.survivors, { windows: 0, documents: 0 });
    }
  }
});

test('should preserve a failed real worker startup report and stop its already initialized peer', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'rustdom-paired-failure-'));
  const missingPackage = mkdtempSync(join(tmpdir(), 'rustdom-paired-empty-package-'));
  await assert.rejects(runPairedComparison({ first: { kind: 'jsdom' }, second: { kind: 'rustdom', root: missingPackage },
    outputDirectory: directory, warmupSamples: 2, measuredSamples: 2, workerPairs: 1,
    rows: [{ name: 'clone-shallow-template', size: 1 }] }), /Paired worker exited/);
  const report = JSON.parse(readFileSync(join(directory, readdirSync(directory)[0])));
  assert.equal(report.complete, false); assert.match(report.failure.message, /Paired worker exited/);
  assert.equal(report.pairs[0].exits.length, 2);
  assert.equal(report.pairs[0].exits[0].code, 0);
  assert.notEqual(report.pairs[0].exits[1].code, 0);
});

test('should reject a mislabeled A/A comparison before starting native workers', async () => {
  await assert.rejects(runPairedComparison({ first: { kind: 'jsdom' },
    second: { kind: 'rustdom', root: resolve(__dirname, '../..') }, aa: true }), /A\/A requires/);
});

test('should record a real OS spawn failure and finish cleanup without waiting for an exit event', { timeout: 15_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'rustdom-paired-spawn-failure-'));
  await assert.rejects(runPairedComparison({ first: { kind: 'jsdom' }, second: { kind: 'jsdom' }, aa: true,
    workerExecutable: join(directory, 'missing-node-executable'), outputDirectory: directory,
    warmupSamples: 2, measuredSamples: 2, workerPairs: 1, rows: [{ name: 'clone-shallow-template', size: 1 }] }),
  (error) => error.code === 'ENOENT');
  const report = JSON.parse(readFileSync(join(directory, readdirSync(directory)[0])));
  assert.equal(report.complete, false); assert.equal(report.pairs[0].exits.length, 1);
  assert.equal(report.pairs[0].exits[0].spawnError.code, 'ENOENT');
  assert.equal(report.pairs[0].exits[0].signal, null);
});
