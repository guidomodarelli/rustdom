/** @module block-precision-planner Simulates hypothetical block means; never loads DOM, captures timings or accepts performance. */
'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { pairedInterval } = require('../../range-combined-study/paired-interval.cjs');
const original = require('../../combined-process-study/constants/protocol.json');
const policy = require('./constants/model.json');

/** @param {string} seed - Public deterministic domain, not a secret. @returns {()=>number} Box-Muller normal draws from a SHA-256 counter stream. */
function normalGenerator(seed) {
  assert.equal(typeof seed, 'string'); assert.ok(seed.length > 0);
  let counter = 0; let bytes = Buffer.alloc(0); let offset = 0; let spare;
  const uniform = () => {
    if (offset === bytes.length) {
      assert.ok(Number.isSafeInteger(counter));
      bytes = createHash('sha256').update(seed).update('\0').update(String(counter)).digest();
      counter += 1; offset = 0;
    }
    const value = (bytes.readUInt32LE(offset) + 0.5) / 2 ** 32;
    offset += 4;
    return value;
  };
  return () => {
    if (spare !== undefined) { const result = spare; spare = undefined; return result; }
    const radius = Math.sqrt(-2 * Math.log(uniform()));
    const angle = 2 * Math.PI * uniform();
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}

/** @param {number} count - Observed Monte Carlo events. @param {number} trials - Fixed synthetic trial count. @returns {number[]} Approximate Wilson interval for simulation frequency, not operational study coverage. */
function monteCarloInterval(count, trials) {
  assert.ok(Number.isSafeInteger(trials) && trials > 0);
  assert.ok(Number.isSafeInteger(count) && count >= 0 && count <= trials);
  const fraction = count / trials;
  const squaredCritical = policy.monteCarloNormalCritical ** 2;
  const denominator = 1 + squaredCritical / trials;
  const center = (fraction + squaredCritical / (2 * trials)) / denominator;
  const halfWidth = policy.monteCarloNormalCritical *
    Math.sqrt(fraction * (1 - fraction) / trials + squaredCritical / (4 * trials ** 2)) / denominator;
  return [Math.max(0, center - halfWidth), Math.min(1, center + halfWidth)];
}

/**
 * Preserve the ratio-of-means estimand and the historical budgets on synthetic independent-unit summaries.
 * @param {object[]} pairs - One arithmetic A/B block mean per replicate, never individual tasks or factors.
 * @param {'AA'|'AB'} phase - Fixed role.
 * @param {'jsdom'|'rustdom'} engine - Fixed role.
 * @returns {object} Numerical classification only; acceptance remains null.
 */
function evaluate(pairs, phase, engine) {
  assert.ok(original.phases.includes(phase) && original.engines.includes(engine));
  assert.equal(pairs.length, policy.replicatesByEngine[engine]);
  const interval = pairedInterval(pairs, policy.criticalByReplicates[pairs.length]);
  const bounds = engine === 'jsdom' ? original.aaJsdomBounds : phase === 'AA' ? original.aaRustBounds : [null, original.abRustUpperBound];
  const bounded = interval.status === 'bounded';
  return { interval, ratioBounds: [...bounds],
    withinBudgetUnderWorkingModel: bounded && (bounds[0] === null || interval.intervalRatio[0] >= bounds[0]) && interval.intervalRatio[1] <= bounds[1],
    performanceAccepted: null, gateReevaluated: false };
}

/**
 * Vary hypothetical between-block dispersion and temporal dependence without fitting historical observations.
 * @param {object} scenario - Explicit model parameters from the prospective planning grid.
 * @param {number} [trials] - Fixed simulation size, selected before reading results.
 * @param {string} [seed] - Reproducibility domain.
 * @returns {object} Every generated pair and interval, including adverse and non-estimable cases.
 */
function sensitivity(scenario, trials = policy.trials, seed = policy.seed) {
  assert.ok(Number.isSafeInteger(trials) && trials > 0);
  assert.ok(original.phases.includes(scenario.phase) && original.engines.includes(scenario.engine));
  assert.ok(Number.isFinite(scenario.trueRatio) && scenario.trueRatio > 0);
  assert.ok(Number.isFinite(scenario.contrastStandardDeviationPoints) && scenario.contrastStandardDeviationPoints >= 0);
  assert.ok(Number.isFinite(scenario.lagCorrelation) && Math.abs(scenario.lagCorrelation) < 1);
  assert.equal(typeof scenario.id, 'string'); assert.ok(scenario.id.length > 0);
  const normal = normalGenerator(seed + '/' + scenario.id);
  const count = policy.replicatesByEngine[scenario.engine];
  const innovationScale = Math.sqrt(1 - scenario.lagCorrelation ** 2);
  const results = []; let bounded = 0; let containsTruth = 0; let withinBudget = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    let previousShock;
    const pairs = Array.from({ length: count }, () => {
      const baselineMeanMs = policy.baselineMeanUnits + policy.baselineStandardDeviationUnits * normal();
      const shock = previousShock === undefined ? normal() : scenario.lagCorrelation * previousShock + innovationScale * normal();
      previousShock = shock;
      const candidateMeanMs = scenario.trueRatio * baselineMeanMs +
        policy.baselineMeanUnits * scenario.contrastStandardDeviationPoints / 100 * shock;
      // Never clip or redraw negative Gaussian tails. A failed input remains a failed run.
      assert.ok(baselineMeanMs > 0 && candidateMeanMs > 0, 'Planning model produced non-positive synthetic means');
      return { baselineMeanMs, candidateMeanMs };
    });
    const comparison = evaluate(pairs, scenario.phase, scenario.engine);
    const covers = comparison.interval.status === 'bounded' && comparison.interval.intervalRatio[0] <= scenario.trueRatio &&
      comparison.interval.intervalRatio[1] >= scenario.trueRatio;
    bounded += Number(comparison.interval.status === 'bounded');
    containsTruth += Number(covers); withinBudget += Number(comparison.withinBudgetUnderWorkingModel);
    results.push({ trial, syntheticBlockPairs: pairs, ...comparison, boundedIntervalContainsTrueRatio: covers });
  }
  return { revision: policy.revision, scenario: { ...scenario }, trials, blockReplicates: count, degreesOfFreedom: count - 1,
    workingModelAssumptionsSatisfied: scenario.lagCorrelation === 0,
    boundedIntervals: bounded, boundedIntervalsContainingTruth: containsTruth,
    boundedCoverageFraction: containsTruth / trials,
    coverageNote: 'Counts bounded intervals only; unbounded Fieller sets are not reported as noncoverage claims',
    withinBudgetTrials: withinBudget, withinBudgetFraction: withinBudget / trials,
    withinBudgetMonteCarloWilson95: monteCarloInterval(withinBudget, trials),
    syntheticResults: results, planningOnly: true, DOMExecuted: false, performanceAccepted: null, gateReevaluated: false };
}

module.exports = { normalGenerator, monteCarloInterval, evaluate, sensitivity };
