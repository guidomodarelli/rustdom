/** @file Cross-checks the Python analysis against the original JavaScript duration median and raw reports. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2]);
const { median } = require(path.join(root, 'harness-source/reports/benchmarks/native-class-ownership/main-affinity-experiment.cjs'));
const analysis = JSON.parse(fs.readFileSync(path.resolve(process.argv[3])));
let samples = 0;
for (const row of analysis.observations) {
  const folder = row.node === 'v22.12.0' ? 'node-22' : 'node';
  const actual = JSON.parse(fs.readFileSync(path.join(root, folder, `${row.mode}-${row.position}.json`)));
  for (const batch of actual.batches) {
    assert.deepEqual(row.rawDurations[batch.label], batch.samplesMs);
    assert.equal(row.medianMs[batch.label], median(batch.samplesMs));
    samples += batch.samplesMs.length;
  }
  assert.equal(row.firstOverSecondPercent, (row.medianMs[row.batchOrder[0]] / row.medianMs[row.batchOrder[1]] - 1) * 100);
}
assert.equal(samples, 576);
for (const summary of analysis.summaries) {
  const rows = analysis.observations.filter((row) => row.node === summary.node && row.mode === summary.mode);
  const ordered = rows.map((row) => row.firstOverSecondPercent).sort((left, right) => left - right);
  assert.equal(ordered.length, 8);
  assert.equal(summary.medianFirstOverSecondPercent, (ordered[3] + ordered[4]) / 2);
  assert.equal(summary.firstSlowerCount, rows.filter((row) => row.firstOverSecondPercent > 0).length);
}
process.stdout.write(`${JSON.stringify({ verified: true, node: process.version, workers: analysis.observations.length,
  samples, processMedians: analysis.observations.length * 2, summaries: analysis.summaries.length })}\n`);
