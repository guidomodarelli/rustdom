/** @file Verify all complete-context medians and raw samples independently with the original JavaScript median. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2]);
const analysis = JSON.parse(fs.readFileSync(path.resolve(process.argv[3])));
const { median } = require(path.join(root, 'harness-source/reports/benchmarks/native-class-ownership/main-affinity-experiment.cjs'));
const workers = new Map();
let durations = 0;
for (const row of analysis.observations) {
  const folder = row.node === 'v22.12.0' ? 'node-22' : 'node';
  const filename = path.join(root, folder, `${row.mode}-${row.position}.json`);
  if (!workers.has(filename)) workers.set(filename, JSON.parse(fs.readFileSync(filename)));
  const batches = workers.get(filename).batches.filter((batch) => `${batch.name}/${batch.rows}` === row.key);
  assert.equal(batches.length, 2);
  assert.deepEqual(batches.map((batch) => batch.label), row.batchOrder);
  for (const batch of batches) {
    assert.deepEqual(batch.samplesMs, row.samplesMs[batch.label]);
    assert.equal(median(batch.samplesMs), row.medianMs[batch.label]);
    assert.equal(batch.outputHash, analysis.outputHashes[row.key]);
    durations += batch.samplesMs.length;
  }
  assert.equal(row.firstOverSecondPercent, (row.medianMs[row.batchOrder[0]] / row.medianMs[row.batchOrder[1]] - 1) * 100);
}
assert.equal(workers.size, 8);
assert.equal(durations, 1152);
assert.equal(analysis.observations.length, 64);
process.stdout.write(`${JSON.stringify({ verified: true, node: process.version, workers: workers.size,
  durations, batchMedians: analysis.observations.length * 2, rowComparisons: analysis.observations.length })}\n`);
