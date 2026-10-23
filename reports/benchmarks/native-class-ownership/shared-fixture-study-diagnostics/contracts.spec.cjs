/** @file Real-data trajectory reader regressions; no DOM, benchmark or profiling execution. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { analyze } = require('./analyze.cjs');
const repository = process.env.SHARED_TRAJECTORY_REPOSITORY;
const original = JSON.parse(fs.readFileSync(process.env.SHARED_TRAJECTORY_INPUT, 'utf8'));

test('all original trajectories retain the complete negative decision and every process', () => {
  const result = analyze(repository, original);
  assert.equal(result.processes, 2048); assert.equal(result.measuredDurations, 18432);
  assert.equal(result.warmupDurationsPreserved, 6144); assert.equal(result.treatmentCells, 128);
  assert.equal(result.measurementsCollected, 0); assert.equal(result.gateReevaluated, false);
  assert.equal(result.originalPerformanceAccepted, false);
  assert.equal(result.rows.length, 64);
  for (const row of result.rows) for (const treatment of Object.values(row.treatments)) {
    assert.equal(treatment.sampleIndices.length, 9); assert.equal(treatment.processMedians.length, 16);
  }
});
test('a duplicated process position cannot be summarized as the original sixteen seeds', () => {
  const input = structuredClone(original); input.samples[0].position = 1;
  assert.throws(() => analyze(repository, input), { code: 'ERR_ASSERTION' });
});
test('the descriptive reader cannot relabel the original rejection as acceptance', () => {
  const input = structuredClone(original); input.summary.accepted = true;
  assert.throws(() => analyze(repository, input), { code: 'ERR_ASSERTION' });
});
