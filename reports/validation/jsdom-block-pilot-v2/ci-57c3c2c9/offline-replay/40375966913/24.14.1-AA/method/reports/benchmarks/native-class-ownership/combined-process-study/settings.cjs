/** @module combined-process-settings Preserves every frozen sampling factor, rebinding only the candidate and method revision. */
'use strict';
const assert = require('node:assert/strict');
const policy = require('./constants/protocol.json');

/** @param {object} original - Exact frozen sampler factors. @param {object} identity - Independently authenticated package distribution pins. @returns {object} Immutable settings, usable from both current and derived namespaces. */
function bindSettings(original, identity) {
  for (const [key, expected] of Object.entries({ rows: policy.rows, nodeVersions: policy.nodes,
    phases: policy.phases, engines: policy.engines, labels: policy.labels, workerCount: policy.pairsPerComparison,
    warmupSamples: policy.warmupSpansPerProcess, measuredSamples: policy.measuredSpansPerProcess,
    withinRealmWarmupRounds: policy.withinRealmWarmupRounds, warmupGcOrder: policy.warmupGcOrder,
    cleanupRounds: policy.cleanupRounds, requiredClearRounds: policy.requiredFinalClearStates,
    cpu: policy.cpu, v8Seeds: policy.v8Seeds, v8SeedProbeSamples: policy.v8SeedProbeSamples,
    engineLeadMask: policy.engineLeadMask, rowPartition: policy.rowPartition,
    controlBudgetPercent: policy.controlBudgetPercent, rustBudgetPercent: policy.rustBudgetPercent })) {
    assert.deepEqual(original[key], expected, 'Combined process method: changed frozen sampling factor ' + key);
  }
  return freeze({ ...structuredClone(original), revision: policy.samplerRevision,
    distributionHashes: structuredClone(identity.distributions) });
}

/** @param {object} value - Newly cloned declaration, never a legacy module object. @returns {object} Recursively immutable factors. */
function freeze(value) {
  for (const nested of Object.values(value)) if (nested && typeof nested === 'object') freeze(nested);
  return Object.freeze(value);
}
module.exports = { bindSettings };
