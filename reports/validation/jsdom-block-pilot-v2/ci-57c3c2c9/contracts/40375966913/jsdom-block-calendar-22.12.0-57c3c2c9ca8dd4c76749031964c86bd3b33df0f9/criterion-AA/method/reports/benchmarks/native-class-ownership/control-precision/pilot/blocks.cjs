/** @module jsdom-block-pilot Declares prospective balanced blocks and summarizes scalar inputs; never launches a process or accepts performance. */
'use strict';
const assert = require('node:assert/strict');
const original = require('../../combined-process-study/model.cjs');
const protocol = require('../../combined-process-study/constants/protocol.json');
const sampling = require('../../owner-batch-study/constants/sampler.json');
const design = require('./constants/design.json');

/**
 * Repeat all original factors with a cyclic Latin-square temporal order within each criterion.
 * Physical package assignment and A/B lead remain properties of the original factor, not the slot.
 * @returns {object[]} One prospective host/shard per Node, phase and row; no executable activation.
 */
function calendar() {
  assert.equal(design.blocksPerCriterion, design.factorsPerBlock);
  const source = original.plan().filter((input) => input.engine === design.engine);
  const shards = [];
  for (const node of protocol.nodes) for (const phase of protocol.phases) {
    for (const [rowIndex, row] of protocol.rows.entries()) {
      const criterionId = [node, phase, design.engine, row].join('/');
      const factors = Array.from({ length: design.factorsPerBlock }, (unused, factor) => {
        const pair = source.filter((input) => input.phase === phase && input.rowIndex === rowIndex && input.position === factor);
        assert.equal(pair.length, design.labelsPerPair);
        assert.deepEqual(new Set(pair.map((input) => input.label)), new Set(protocol.labels));
        return pair;
      });
      const processes = [];
      for (let block = 0; block < design.blocksPerCriterion; block += 1) {
        for (let slot = 0; slot < design.factorsPerBlock; slot += 1) {
          const factor = (slot + block) % design.factorsPerBlock;
          for (const input of factors[factor]) {
            processes.push({ ...input, node, row, block, slot, factor,
              ordinal: processes.length, processId: [criterionId, block, factor, input.label].join('/'),
              seed: protocol.v8Seeds[factor] });
          }
        }
      }
      shards.push({ criterionId, node, phase, engine: design.engine, rowIndex, row, processes });
    }
  }
  return shards;
}

/** @param {number[]} values - Finite scalar observations. @returns {number} Arithmetic mean in the original duration units. */
function mean(values) {
  assert.ok(values.length > 0 && values.every(Number.isFinite));
  const result = values.reduce((total, value) => total + value, 0) / values.length;
  assert.ok(Number.isFinite(result), 'Pilot blocks: non-finite mean');
  return result;
}

/** @param {number[]} values - Complete block contrasts. @returns {object} Empirical dispersion only, without confidence or independence claims. */
function dispersion(values) {
  const average = mean(values);
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
  assert.ok(Number.isFinite(variance) && variance >= 0, 'Pilot blocks: non-finite variance');
  return { meanMs: average, sampleVarianceMsSquared: variance, sampleStandardDeviationMs: Math.sqrt(variance) };
}

/**
 * Validate completeness/order of already-authenticated scalar means and aggregate each full factor block.
 * This boundary does not authenticate files, tasks, correctness or cleanup; the future integral reader must do so first.
 * @param {string} criterionId - Exactly one declared Node/phase/row on one host.
 * @param {object[]} observations - Chronological complete process summaries, including both treatment labels.
 * @returns {object} All block means and fixed-q empirical contrasts; never a performance decision or confidence interval.
 */
function summarize(criterionId, observations) {
  const shard = calendar().find((entry) => entry.criterionId === criterionId);
  assert.ok(shard, 'Pilot blocks: undeclared criterion');
  assert.ok(Array.isArray(observations));
  assert.equal(observations.length, shard.processes.length, 'Pilot blocks: incomplete criterion');
  let hostId; let previousEnd = -Infinity;
  for (const [index, observation] of observations.entries()) {
    const expected = shard.processes[index];
    assert.equal(observation.processId, expected.processId, 'Pilot blocks: duplicate, missing or reordered process');
    assert.equal(observation.complete, true, 'Pilot blocks: incomplete process');
    assert.equal(typeof observation.hostId, 'string'); assert.ok(observation.hostId.length > 0);
    hostId ??= observation.hostId;
    assert.equal(observation.hostId, hostId, 'Pilot blocks: criterion spans multiple hosts');
    assert.ok(Number.isFinite(observation.meanMs) && observation.meanMs > 0, 'Pilot blocks: invalid process mean');
    assert.equal(observation.measuredTaskCount, sampling.logicalTasksPerBlock * sampling.measuredBlocksPerProcess);
    assert.equal(observation.warmupTaskCount, sampling.logicalTasksPerBlock * sampling.warmupBlocksPerProcess);
    assert.ok(Number.isFinite(observation.startMonotonicMs) && observation.startMonotonicMs >= 0);
    assert.ok(Number.isFinite(observation.endMonotonicMs) && observation.endMonotonicMs > observation.startMonotonicMs);
    assert.ok(observation.startMonotonicMs >= previousEnd, 'Pilot blocks: overlapping or reversed process timeline');
    previousEnd = observation.endMonotonicMs;
  }
  const blockMeans = Array.from({ length: design.blocksPerCriterion }, (unused, block) => {
    const first = block * design.factorsPerBlock * design.labelsPerPair;
    const indexes = shard.processes.slice(first, first + design.factorsPerBlock * design.labelsPerPair);
    const byLabel = (label) => indexes.filter((input) => input.label === label).map((input) => observations[input.ordinal].meanMs);
    return { block, baselineMeanMs: mean(byLabel('A')), candidateMeanMs: mean(byLabel('B')) };
  });
  const baseline = blockMeans.map((block) => block.baselineMeanMs);
  const candidate = blockMeans.map((block) => block.candidateMeanMs);
  const baselineMeanMs = mean(baseline); const candidateMeanMs = mean(candidate);
  const covariance = baseline.reduce((total, value, index) => total +
    (value - baselineMeanMs) * (candidate[index] - candidateMeanMs), 0) / (blockMeans.length - 1);
  const ratio = candidateMeanMs / baselineMeanMs;
  assert.ok(Number.isFinite(covariance) && Number.isFinite(ratio), 'Pilot blocks: non-finite covariance or ratio');
  return { revision: design.revision, criterionId, hostId, inputAuthenticationPerformed: false,
    processCount: observations.length, independentUnitCandidate: 'complete-factor-block-under-working-iid-assumption',
    blockMeans, baselineMeanMs, candidateMeanMs, ratioOfArithmeticMeans: ratio,
    sampleCovarianceMsSquared: covariance,
    contrasts: design.contrastRatios.map((ratio) => {
      const valuesMs = blockMeans.map((block) => block.candidateMeanMs - ratio * block.baselineMeanMs);
      return { fixedRatio: ratio, diagnosticOnly: ratio === 1, valuesMs, ...dispersion(valuesMs) };
    }),
    confidenceIntervalsComputed: false, independenceEstablished: false,
    performanceAccepted: null, gateReevaluated: false };
}

module.exports = { calendar, summarize };
