/** @module range-worker-exports Preserves every raw span and finite resource observation without relabeling or estimating. */
'use strict';
const { policy } = require('./analysis-source.cjs');

/** @param {object} report - Original worker report, kept unchanged. @returns {object[]} Exact warmup/measured rows with original identities and values. */
function spanRows(report) {
  const batch = report.batches[0];
  return batch.sampleTimings.map((span) => ({ node: report.node, pid: report.pid, phase: report.phase,
    position: report.position, seed: report.v8Seed, engine: report.engine, physical: report.schedule.physical,
    label: report.label, rowIndex: report.rowIndex, name: batch.name, size: batch.size, span: span.index,
    stage: span.stage, startMs: span.startMs, durationMs: span.durationMs, outputHash: batch.outputHash }));
}

/** @returns {object} Mutable aggregate owned by one offline export, never a global cache. */
function createAggregate() {
  return { totals: { processes: 0, ...Object.fromEntries(policy.totalFields.map((name) => [name, 0])) }, groups: {} };
}

/**
 * Fold an already validated resource summary, separating phase/engine/physical package.
 * @param {object} aggregate - Caller-owned counters.
 * @param {object} report - Original worker identity.
 * @param {object} resource - Output of the unchanged qualified release predicate.
 * @returns {void}
 */
function addWorker(aggregate, report, resource) {
  const identity = { node: report.node, phase: report.phase, engine: report.engine, physical: report.schedule.physical };
  const key = policy.groupIdentityFields.map((name) => identity[name]).join('/');
  const group = aggregate.groups[key] ?? { ...identity, processes: 0, windows: 0, documents: 0,
    firstUnclearStates: 0, requiredFinalClearStates: 0, memoryRangesBytes: {},
    nativeClassBaselines: new Set(), nativeClassFinalValues: new Set(), v8Versions: new Set() };
  aggregate.totals.processes++; group.processes++;
  for (const name of policy.totalFields) aggregate.totals[name] += resource[name];
  for (const name of policy.groupFields) group[name] += resource[name];
  group.v8Versions.add(report.v8);
  if (resource.nativeClassBaseline !== null) group.nativeClassBaselines.add(resource.nativeClassBaseline);
  if (resource.nativeClassFinal !== null) group.nativeClassFinalValues.add(resource.nativeClassFinal);
  for (const [name, range] of Object.entries(resource.memoryRangesBytes)) {
    const previous = group.memoryRangesBytes[name] ?? range;
    group.memoryRangesBytes[name] = { min: Math.min(previous.min, range.min), max: Math.max(previous.max, range.max) };
  }
  aggregate.groups[key] = group;
}

/** @param {object} aggregate - Completed caller-owned counters. @returns {object} Same counters with finite JSON arrays instead of sets. */
function finishAggregate(aggregate) {
  for (const group of Object.values(aggregate.groups)) {
    for (const name of policy.serializedSetFields) group[name] = [...group[name]].sort();
  }
  return aggregate;
}
module.exports = { spanRows, createAggregate, addWorker, finishAggregate };
