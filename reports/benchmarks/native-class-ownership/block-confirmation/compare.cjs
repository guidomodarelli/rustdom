/** @module ownership-confirmation-comparison Scalar block inference only; cannot authenticate files or accept performance. */
'use strict';
const assert = require('node:assert/strict');
const { criteria, schedule } = require('./calendar.cjs');
const design = require('./constants/design.json');
const sampling = require('../owner-batch-study/constants/sampler.json');
const { pairedInterval } = require('../range-combined-study/paired-interval.cjs');
const { criterion: originalBudget } = require('../combined-process-study/compare.cjs');

/** @param {number[]} values - Nonempty finite positive process means. @returns {number} Equally weighted arithmetic mean, with scaled summation. */
function mean(values) {
  assert.ok(values.length > 0 && values.every((value) => Number.isFinite(value) && value > 0));
  const scale = Math.max(...values);
  const result = scale * (values.reduce((total, value) => total + value / scale, 0) / values.length);
  assert.ok(Number.isFinite(result) && result > 0, 'Ownership confirmation comparison: unrepresentable mean');
  return result;
}

/**
 * Reduce every complete factor block to one equally weighted A/B pair. All input scalars must come from an
 * independent integral behavior/resource reader. A functional run, old pilot or partial cannot satisfy this contract.
 * @param {string} criterionId - One exact prospective criterion.
 * @param {object[]} observations - Full chronological scalar observations after upstream authentication.
 * @returns {object} Conditional pointwise interval and original budget result; acceptance remains null.
 */
function compareCriterion(criterionId, observations) {
  const planned = schedule(criterionId);
  assert.ok(Array.isArray(observations));
  assert.equal(observations.length, planned.processes.length, 'Ownership confirmation comparison: incomplete criterion');
  let hostId; let previousEnd = -Infinity;
  const hashes = new Set();
  for (const [ordinal, observation] of observations.entries()) {
    assert.equal(observation.processId, planned.processes[ordinal].processId,
      'Ownership confirmation comparison: missing, duplicated or reordered process');
    assert.equal(observation.revision, design.revision, 'Ownership confirmation comparison: foreign method');
    assert.equal(observation.mode, 'capture', 'Ownership confirmation comparison: functional data is not evidence');
    assert.equal(observation.complete, true);
    assert.equal(typeof observation.hostId, 'string'); assert.ok(observation.hostId.length > 0);
    hostId ??= observation.hostId;
    assert.equal(observation.hostId, hostId, 'Ownership confirmation comparison: criterion spans hosts');
    assert.ok(Number.isFinite(observation.meanMs) && observation.meanMs > 0);
    assert.equal(observation.measuredTaskCount, sampling.logicalTasksPerBlock * sampling.measuredBlocksPerProcess);
    assert.equal(observation.warmupTaskCount, sampling.logicalTasksPerBlock * sampling.warmupBlocksPerProcess);
    assert.ok(Number.isFinite(observation.startMonotonicMs) && observation.startMonotonicMs >= 0);
    assert.ok(Number.isFinite(observation.endMonotonicMs) && observation.endMonotonicMs > observation.startMonotonicMs);
    assert.ok(observation.startMonotonicMs >= previousEnd, 'Ownership confirmation comparison: overlapping or reversed processes');
    previousEnd = observation.endMonotonicMs;
    assert.equal(typeof observation.outputHash, 'string'); assert.match(observation.outputHash, /^[a-f0-9]{64}$/);
    hashes.add(observation.outputHash);
  }
  assert.equal(hashes.size, 1, 'Ownership confirmation comparison: public output differs across factors or labels');
  const processesPerBlock = design.factorsPerBlock * design.labelsPerPair;
  const blockMeans = Array.from({ length: planned.blocks }, (unused, block) => {
    const inputs = planned.processes.slice(block * processesPerBlock, (block + 1) * processesPerBlock);
    const byLabel = (label) => mean(inputs.filter((input) => input.label === label).map((input) => observations[input.ordinal].meanMs));
    return { block, baselineMeanMs: byLabel('A'), candidateMeanMs: byLabel('B') };
  });
  const interval = pairedInterval(blockMeans, design.criticalValues[planned.engine]);
  return { criterionId, node: planned.node, phase: planned.phase, engine: planned.engine, row: planned.row,
    hostId, processCount: observations.length, blockCount: blockMeans.length, degreesOfFreedom: blockMeans.length - 1,
    criticalValue: design.criticalValues[planned.engine], outputHash: [...hashes][0], blockMeans, interval,
    ...originalBudget(interval, planned.phase, planned.engine),
    independentUnitCandidate: 'complete-factor-block-under-working-iid-normal-assumption',
    independenceEstablished: false, confidenceScope: design.confidenceScope,
    captureAuthenticated: false, performanceAccepted: null, gateReevaluated: false };
}

/**
 * Require the full 64-criterion scalar matrix before any numerical conclusion. This boundary never authenticates
 * captures: a future integral reader must separately verify transport, source, packages, tasks, cleanup and clocks.
 * @param {{criterionId:string,observations:object[]}[]} entries - Exact full matrix in published order.
 * @returns {object} Every adverse control/candidate result and a numerical conjunction, never gate acceptance.
 */
function compare(entries) {
  assert.ok(Array.isArray(entries));
  const expected = criteria();
  assert.deepEqual(entries.map((entry) => entry.criterionId), expected.map((entry) => entry.criterionId),
    'Ownership confirmation comparison: require the complete ordered 64-criterion matrix');
  const results = entries.map((entry) => compareCriterion(entry.criterionId, entry.observations));
  const outputHashes = new Map();
  for (const result of results) {
    const previous = outputHashes.get(result.row);
    if (previous !== undefined) assert.equal(result.outputHash, previous,
      'Ownership confirmation comparison: public output differs across engines, phases or SDKs');
    outputHashes.set(result.row, result.outputHash);
  }
  return { revision: design.revision, results, allBudgetsMet: results.every((result) => result.passesBudget),
    confidenceLevel: design.confidenceLevel, confidenceScope: design.confidenceScope,
    independenceEstablished: false, simultaneousCoverageClaimed: false, powerEstimated: false,
    captureAuthenticated: false, performanceAccepted: null, gateReevaluated: false };
}

module.exports = { compareCriterion, compare };
