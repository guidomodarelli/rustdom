/** @file Describes process and chronological variation in an existing verified study, without collecting or accepting measurements. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { median, verify } = require('./main-affinity-experiment.cjs');
const settings = require('./constants/main-affinity.cjs');
const { PRECISION_REVISION, PRECISION_LIMITS } = require('./constants/precision.cjs');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Contrast all recorded durations in the supplied A/B groups, retaining counts and process medians. */
function contrast(processes) {
  const groups = {};
  for (const label of ['A', 'B']) {
    const selected = processes.filter((entry) => entry.label === label);
    const durations = selected.flatMap((entry) => entry.samples);
    const processMediansMs = selected.map((entry) => median(entry.samples));
    groups[label] = { processes: selected.length, measuredDurations: durations.length, medianMs: median(durations),
      processMediansMs, minimumProcessMedianMs: Math.min(...processMediansMs), maximumProcessMedianMs: Math.max(...processMediansMs) };
  }
  return { groups, changePercent: (groups.B.medianMs / groups.A.medianMs - 1) * 100 };
}

/**
 * Recalculate descriptive full/half/adjacent-block contrasts from all verified raw observations.
 * The balanced partitions are diagnostics, not replacement estimators or independent experiments.
 * @param {string} archiveRoot - Complete two-version main-affinity-v2 archive.
 * @returns {object} All 64 version/phase/workload/engine rows, provenance and unchanged acceptance.
 */
function analyze(archiveRoot) {
  const directories = fs.readdirSync(archiveRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const runtimes = directories.map((entry) => {
    const root = path.join(archiveRoot, entry.name);
    const verification = verify(root);
    const bytes = fs.readFileSync(path.join(root, 'index.json'));
    return { root, index: JSON.parse(bytes), indexSha256: digest(bytes), verification };
  }).sort((left, right) => left.index.node.localeCompare(right.index.node));
  assert.deepEqual(runtimes.map((runtime) => runtime.index.node), settings.nodeVersions);
  const result = { revision: PRECISION_REVISION, kind: 'Post-hoc descriptive audit of existing measurements',
    measurementsCollected: 0, gateReevaluated: false, limits: [...PRECISION_LIMITS], sources: [], rows: [] };
  for (const runtime of runtimes) {
    const { index } = runtime;
    result.sources.push({ directory: path.basename(runtime.root), node: index.node, indexSha256: runtime.indexSha256,
      studyAccepted: runtime.verification.accepted, processes: runtime.verification.processes,
      measuredDurations: runtime.verification.measuredDurations });
    const reports = index.runs.map((entry) => {
      const bytes = fs.readFileSync(path.join(runtime.root, entry.stdout));
      assert.equal(digest(bytes), index.files[entry.stdout]);
      return { ...entry, observation: JSON.parse(bytes) };
    });
    for (const phase of settings.phases) {
      for (const row of index.summaries[phase]) {
        for (const engine of new Set(settings.engines)) {
          const processes = reports.filter((entry) => entry.phase === phase && entry.engine === engine).map((entry) => {
            const workload = entry.observation.workloads.find((workload) => `${workload.name}/${workload.rows}` === row.key);
            return { position: entry.position, slot: entry.slot, label: entry.label, samples: workload.samplesMs };
          });
          const full = contrast(processes);
          const originalChangePercent = engine === 'rustdom' ? row.rustdomChangePercent : row.jsdomControlChangePercent;
          assert.equal(full.changePercent, originalChangePercent);
          for (const label of ['A', 'B']) {
            assert.equal(full.groups[label].processes, settings.samplesPerLabelEngine / settings.measuredSamples);
            assert.equal(full.groups[label].measuredDurations, settings.samplesPerLabelEngine);
            assert.deepEqual(full.groups[label].processMediansMs, row[label][engine].processMediansMs);
          }
          const midpoint = settings.order.length / 2;
          const halves = [processes.filter((entry) => entry.position < midpoint), processes.filter((entry) => entry.position >= midpoint)]
            .map((partition, half) => ({ half, ...contrast(partition) }));
          const adjacentPairs = [];
          for (let position = 0; position < settings.order.length; position += 2) {
            const selected = processes.filter((entry) => entry.position === position || entry.position === position + 1);
            const pair = contrast(selected);
            assert.equal(pair.groups.A.processes, pair.groups.B.processes);
            adjacentPairs.push({ positions: [position, position + 1], ...pair });
          }
          for (const half of halves) assert.equal(half.groups.A.processes, half.groups.B.processes);
          result.rows.push({ node: index.node, phase, key: row.key, engine, full, halves, adjacentPairs });
        }
      }
    }
  }
  assert.equal(result.rows.length, settings.nodeVersions.length * settings.phases.length * settings.rows.length * new Set(settings.engines).size);
  return result;
}

if (require.main === module) {
  const root = process.argv[2] || path.join(__dirname, 'main-affinity/2026-10-21');
  process.stdout.write(JSON.stringify(analyze(root), null, 2) + '\n');
}
module.exports = { analyze };
