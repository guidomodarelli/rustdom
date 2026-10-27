/** @file Exercises the complete published samples and controlled corruption through the real offline reader. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { gunzipSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { analyze, analyzeSamples } = require('./current-ownership-diagnostics.cjs');
const policy = require('./constants/current-ownership-diagnostics.cjs');
const directory = path.join(__dirname, policy.packetDirectory);
const samples = () => JSON.parse(gunzipSync(fs.readFileSync(path.join(directory, 'process-samples.json.gz'))).toString('utf8'));
const summary = require(path.join(directory, 'summary.json'));
const receipt = require(path.join(directory, 'receipt.json'));

test('all 2048 processes and 18432 durations reproduce every original pooled median and rejection', () => {
  const result = analyze(directory);
  assert.equal(result.originalPerformanceAccepted, false); assert.equal(result.gateReevaluated, false);
  assert.equal(result.measurementsCollected, 0);
  assert.equal(result.processes, 2048); assert.equal(result.measuredDurations, 18432);
  assert.equal(result.engineRows, 64); assert.equal(result.treatmentCells, 128);
  assert.equal(result.rows.filter((row) => row.engine === 'jsdom' && !row.originalControlCalibrated).length, 13);
  for (const row of result.rows) for (const treatment of Object.values(row.treatments)) {
    assert.equal(treatment.processes, 16); assert.equal(treatment.measuredDurations, 144);
    assert.equal(treatment.sampleIndices.length, 9);
    assert.ok(treatment.sampleIndices.every((index) => index.processes === 16));
    assert.equal(treatment.physicalCopies.reduce((total, copy) => total + copy.measuredDurations, 0), 144);
  }
});

test('the diagnostic preserves the recorded fresh-realm index trajectory and all process medians', () => {
  const result = analyze(directory);
  const row = result.rows.find((entry) => entry.node === 'v22.12.0' && entry.phase === 'AA'
    && entry.engine === 'jsdom' && entry.key === 'mutation-records-collect/100');
  assert.equal(row.treatments.A.sampleIndices[0].medianMs, 2.3721104999999625);
  assert.equal(row.treatments.A.sampleIndices[8].medianMs, 1.9406530000001112);
  assert.equal(row.treatments.B.sampleIndices[0].medianMs, 2.6143334999999297);
  assert.equal(row.treatments.B.sampleIndices[8].medianMs, 1.9756689999999253);
  assert.deepEqual(row.treatments.A.physicalCopies.map((copy) => copy.processes), [8, 8]);
  assert.equal(row.treatments.A.minimumProcessMedianMs, 1.7824239999999918);
  assert.equal(row.treatments.A.maximumProcessMedianMs, 2.1924910000002455);
  assert.equal(row.originalChangePercent, 3.6199347477175126);
});

for (const corruption of ['missing process', 'duplicate report', 'duplicate position', 'wrong seed', 'missing sample', 'changed duration']) {
  test(`incomplete or corrupted observations cannot become a diagnostic: ${corruption}`, () => {
    const changed = samples();
    if (corruption === 'missing process') changed.pop();
    else if (corruption === 'duplicate report') changed[0].report = changed[1].report;
    else if (corruption === 'duplicate position') changed[0].position = 1;
    else if (corruption === 'wrong seed') changed[0].v8Seed = 99;
    else if (corruption === 'missing sample') changed[0].samplesMs.pop();
    else for (const entry of changed.filter((entry) => entry.node === changed[0].node && entry.phase === changed[0].phase
      && entry.engine === changed[0].engine && entry.key === changed[0].key && entry.label === changed[0].label)) {
      entry.samplesMs = entry.samplesMs.map((sample) => sample * 2);
    }
    assert.throws(() => analyzeSamples(changed, summary, receipt));
  });
}

test('the command analyzes the published artifact and emits the same full report', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'current-ownership-diagnostics.cjs'), directory],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), analyze(directory));
});

test('the real reader rejects altered published bytes before describing them', (context) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-ownership-diagnostics-'));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(os.tmpdir()));
    fs.rmSync(temporary, { recursive: true });
  });
  fs.copyFileSync(path.join(directory, 'files.json'), path.join(temporary, 'files.json'));
  for (const filename of policy.inputFiles) fs.copyFileSync(path.join(directory, filename), path.join(temporary, filename));
  fs.appendFileSync(path.join(temporary, 'summary.json'), ' ');
  assert.throws(() => analyze(temporary), /changed input summary.json/);
});
