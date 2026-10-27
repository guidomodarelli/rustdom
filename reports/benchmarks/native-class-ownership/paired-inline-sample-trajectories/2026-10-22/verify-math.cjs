/** @file Cross-check all original durations, batch medians and descriptive thirds using JavaScript. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { median } = require('../../main-affinity-experiment.cjs');
const analysis = JSON.parse(fs.readFileSync(path.join(__dirname, 'analysis.json')));
const archive = path.resolve(__dirname, '../../paired-inline/2026-10-22');
const workers = new Map();

/**
 * Compute a descriptive median for signed percentages, outside the positive-duration contract.
 * @param {number[]} values - Finite signed observations; no sample is omitted.
 * @returns {number} Middle value or mean of the two middle values.
 * @throws {AssertionError} When observations are absent or non-finite.
 */
function descriptiveMedian(values) {
  assert.ok(values.length > 0 && values.every(Number.isFinite));
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

let durations = 0;
for (const record of analysis.batches) {
  if (!workers.has(record.report)) workers.set(record.report, JSON.parse(fs.readFileSync(path.join(archive, record.report))));
  const batch = workers.get(record.report).batches[record.batchPosition];
  assert.equal(record.label, batch.label);
  assert.deepEqual(record.samplesMs, batch.samplesMs);
  assert.equal(record.medianMs, median(batch.samplesMs));
  const thirds = [0, 3, 6].map((start) => median(batch.samplesMs.slice(start, start + 3)));
  assert.deepEqual(record.tertileMediansMs, thirds);
  assert.equal(record.earlyOverLatePercent, (thirds[0] / thirds[2] - 1) * 100);
  assert.equal(record.maxOverMinPercent, (Math.max(...batch.samplesMs) / Math.min(...batch.samplesMs) - 1) * 100);
  durations += batch.samplesMs.length;
}
assert.equal(durations, 9216);
assert.equal(analysis.rows.length, 64);
for (const row of analysis.rows) for (const [order, first] of [['first', true], ['second', false]]) {
  const records = analysis.batches.filter((record) => record.node === row.node && record.phase === row.phase &&
    record.engine === row.engine && record.key === row.key && record.firstBatch === first);
  assert.equal(records.length, 8);
  assert.equal(row.withinBatch[order].earlySlowerCount, records.filter((record) => record.earlyOverLatePercent > 0).length);
  assert.equal(row.withinBatch[order].medianEarlyOverLatePercent, descriptiveMedian(records.map((record) => record.earlyOverLatePercent)));
  assert.equal(row.withinBatch[order].medianMaxOverMinPercent, descriptiveMedian(records.map((record) => record.maxOverMinPercent)));
}
process.stdout.write(`${JSON.stringify({ verified: true, node: process.version, durations, workers: workers.size,
  batchMedians: analysis.batches.length, tertileMedians: analysis.batches.length * 3, summaries: analysis.rows.length * 2 })}\n`);
