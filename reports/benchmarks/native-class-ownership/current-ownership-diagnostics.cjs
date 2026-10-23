/** @file Describes all terminal ownership trajectories without importing or executing a DOM runner. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const { median } = require('./main-affinity-experiment.cjs');
const settings = require('./constants/current-ownership.cjs');
const policy = require('./constants/current-ownership-diagnostics.cjs');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * Describe one complete treatment with all original sample indices and physical copies.
 * @param {object[]} processes - All processes of this node/phase/engine/row/label cell.
 * @returns {object} Pooled median, trajectories, copy partitions and every process median.
 */
function describeTreatment(processes) {
  assert.deepEqual(processes.map((entry) => entry.position), Array.from({ length: settings.workerCount },
    (unusedEntry, position) => position), 'Ownership diagnostics: missing, duplicate or reordered position');
  for (const entry of processes) {
    assert.equal(entry.v8Seed, settings.v8Seeds[entry.position]);
    assert.equal(entry.samplesMs.length, settings.measuredSamples);
    assert.ok(entry.samplesMs.every((sample) => Number.isFinite(sample) && sample > 0));
  }
  const samples = processes.flatMap((entry) => entry.samplesMs);
  const sampleIndices = Array.from({ length: settings.measuredSamples }, (unusedEntry, index) => {
    const values = processes.map((entry) => entry.samplesMs[index]);
    return { index, processes: values.length, medianMs: median(values), minMs: Math.min(...values), maxMs: Math.max(...values) };
  });
  const processMedians = processes.map((entry) => ({ position: entry.position, seed: entry.v8Seed,
    pid: entry.pid, physical: entry.physical, report: entry.report, medianMs: median(entry.samplesMs),
    firstMs: entry.samplesMs[0], lastMs: entry.samplesMs.at(-1),
    firstToLastChangePercent: (entry.samplesMs.at(-1) / entry.samplesMs[0] - 1) * 100 }));
  const minimumProcessMedianMs = Math.min(...processMedians.map((entry) => entry.medianMs));
  const maximumProcessMedianMs = Math.max(...processMedians.map((entry) => entry.medianMs));
  const physicalCopies = [...new Set(processes.map((entry) => entry.physical))].sort().map((physical) => {
    const selected = processes.filter((entry) => entry.physical === physical);
    const durations = selected.flatMap((entry) => entry.samplesMs);
    return { physical, positions: selected.map((entry) => entry.position), processes: selected.length,
      measuredDurations: durations.length, medianMs: median(durations) };
  });
  return { processes: processes.length, measuredDurations: samples.length, pooledMedianMs: median(samples),
    sampleIndices, processMedians, minimumProcessMedianMs, maximumProcessMedianMs,
    processMedianSpreadPercent: (maximumProcessMedianMs / minimumProcessMedianMs - 1) * 100,
    firstToLastIndexMedianChangePercent: (sampleIndices.at(-1).medianMs / sampleIndices[0].medianMs - 1) * 100,
    physicalCopies };
}

/**
 * Preserve the terminal decision and describe all engines, labels, rows and positions.
 * @param {object[]} samples - Exact compact samples in original process order.
 * @param {object} summary - Published full pooled-median result, including rejected controls.
 * @param {object} receipt - Authenticated terminal metadata; never interpreted as a new gate.
 * @returns {object} Complete descriptive report, with the original rejection unchanged.
 */
function analyzeSamples(samples, summary, receipt) {
  assert.equal(summary.accepted, false); assert.equal(receipt.accepted, false);
  assert.equal(summary.verified, true); assert.equal(receipt.executionComplete, true);
  assert.equal(summary.runId, receipt.runId);
  const expectedProcesses = settings.nodeVersions.length * settings.phases.length * settings.engines.length
    * settings.labels.length * settings.rows.length * settings.workerCount;
  assert.equal(samples.length, expectedProcesses);
  assert.equal(new Set(samples.map((entry) => entry.report)).size, expectedProcesses,
    'Ownership diagnostics: duplicate process report');
  assert.equal(summary.rows.length, settings.nodeVersions.length * settings.phases.length * settings.rows.length);
  const rows = [];
  for (const node of settings.nodeVersions) for (const phase of settings.phases) for (const key of settings.rows) {
    const originalRows = summary.rows.filter((row) => row.node === node && row.phase === phase && row.key === key);
    assert.equal(originalRows.length, 1);
    const original = originalRows[0];
    for (const engine of settings.engines) {
      const treatments = Object.fromEntries(settings.labels.map((label) => [label, describeTreatment(samples.filter((entry) =>
        entry.node === node && entry.phase === phase && entry.key === key && entry.engine === engine && entry.label === label))]));
      const originalChangePercent = engine === 'jsdom' ? original.jsdomControlChangePercent : original.rustdomChangePercent;
      for (const label of settings.labels) {
        const originalMedianMs = original[`${engine === 'rustdom' ? 'rustdom' : 'jsdom'}${label}ms`];
        assert.equal(treatments[label].pooledMedianMs, originalMedianMs,
          `Ownership diagnostics: pooled median differs for ${node}/${phase}/${engine}/${key}/${label}`);
      }
      assert.equal((treatments.B.pooledMedianMs / treatments.A.pooledMedianMs - 1) * 100, originalChangePercent);
      rows.push({ node, phase, key, engine, originalChangePercent,
        originalControlCalibrated: original.calibrated, originalRowWithinBudget: original.withinBudget, treatments });
    }
  }
  const processes = rows.reduce((total, row) => total + row.treatments.A.processes + row.treatments.B.processes, 0);
  const measuredDurations = rows.reduce((total, row) => total + row.treatments.A.measuredDurations + row.treatments.B.measuredDurations, 0);
  assert.equal(processes, receipt.processes); assert.equal(measuredDurations, receipt.measuredDurations);
  return { revision: policy.revision, runId: receipt.runId, originalPerformanceAccepted: false,
    measurementsCollected: 0, gateReevaluated: false, limits: policy.limits,
    processes, measuredDurations, engineRows: rows.length, treatmentCells: rows.length * settings.labels.length, rows };
}

/**
 * Authenticate the three consumed published inputs and analyze their original bytes.
 * @param {string} directory - Published terminal result directory, not a live capture.
 * @returns {object} Reproducible report and input hashes; no runtime or sampler is invoked.
 */
function analyze(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'files.json'), 'utf8'));
  const inputs = {};
  const hashes = {};
  for (const filename of policy.inputFiles) {
    const manifestEntries = Object.entries(manifest).filter(([relative]) => relative.endsWith(`/${filename}`));
    assert.equal(manifestEntries.length, 1);
    const bytes = fs.readFileSync(path.join(directory, filename));
    hashes[filename] = digest(bytes);
    assert.equal(hashes[filename], manifestEntries[0][1].sha256, `Ownership diagnostics: changed input ${filename}`);
    inputs[filename] = JSON.parse(filename.endsWith('.gz') ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8'));
  }
  return { ...analyzeSamples(inputs['process-samples.json.gz'], inputs['summary.json'], inputs['receipt.json']), inputSha256: hashes };
}

if (require.main === module) process.stdout.write(`${JSON.stringify(analyze(process.argv[2]
  ?? path.join(__dirname, policy.packetDirectory)), null, 2)}\n`);
module.exports = { analyze, analyzeSamples, describeTreatment };
