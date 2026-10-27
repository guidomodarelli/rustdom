/** @file Exercises numerical behavior and explicit model failure, without runtime mocks or DOM execution. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalGenerator, monteCarloInterval, evaluate, sensitivity } = require('./model.cjs');
const policy = require('./constants/model.json');

test('block means retain the ratio of arithmetic means rather than the mean of ratios', () => {
  const pairs = Array.from({ length: 8 }, (unused, index) => index < 4 ?
    { baselineMeanMs: 10, candidateMeanMs: 20 } : { baselineMeanMs: 100, candidateMeanMs: 100 });
  const result = evaluate(pairs, 'AB', 'rustdom');
  assert.ok(Math.abs(result.interval.pointRatio - 480 / 440) < 1e-12);
  assert.notEqual(result.interval.pointRatio, 1.5);
  assert.equal(result.performanceAccepted, null);
});

test('known constant effects preserve the original control and candidate budgets', () => {
  for (const [engine, phase, ratio, expected] of [
    ['jsdom', 'AA', 1.01, true], ['jsdom', 'AB', 1.03, false],
    ['rustdom', 'AA', 1.04, true], ['rustdom', 'AA', 0.94, false],
    ['rustdom', 'AB', 1.04, true], ['rustdom', 'AB', 1.06, false],
  ]) {
    const pairs = Array.from({ length: policy.replicatesByEngine[engine] }, () =>
      ({ baselineMeanMs: 100, candidateMeanMs: 100 * ratio }));
    const result = evaluate(pairs, phase, engine);
    assert.equal(result.withinBudgetUnderWorkingModel, expected);
    assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
  }
});

test('critical input errors stop instead of resampling or accepting', () => {
  assert.throws(() => evaluate([], 'AA', 'jsdom'));
  const scenario = policy.scenarios[0];
  assert.throws(() => sensitivity({ ...scenario, lagCorrelation: 1 }, 10));
  assert.throws(() => sensitivity({ ...scenario, trueRatio: NaN }, 10));
  assert.throws(() => sensitivity({ ...scenario, contrastStandardDeviationPoints: -1 }, 10));
  assert.throws(() => sensitivity(scenario, 0));
  assert.throws(() => monteCarloInterval(2, 1));
});

test('public seeds reproduce every synthetic pair and interval', () => {
  const first = sensitivity(policy.scenarios[0], 20, 'public-reproduction');
  assert.deepEqual(sensitivity(policy.scenarios[0], 20, 'public-reproduction'), first);
  assert.notDeepEqual(sensitivity(policy.scenarios[0], 20, 'other-public-domain').syntheticResults, first.syntheticResults);
  assert.equal(first.syntheticResults.length, 20);
  assert.equal(first.blockReplicates, 16); assert.equal(first.degreesOfFreedom, 15);
  assert.equal(first.DOMExecuted, false); assert.equal(first.performanceAccepted, null);
});

test('Monte Carlo frequency uncertainty retains nonzero bounds at zero or all events', () => {
  const zero = monteCarloInterval(0, 1000); const all = monteCarloInterval(1000, 1000);
  assert.ok(zero[0] < 1e-12 && zero[1] > 0);
  assert.ok(all[0] < 1 && all[1] > 1 - 1e-12);
  const middle = monteCarloInterval(50, 100);
  assert.ok(Math.abs(middle[0] - 0.40383) < 0.0001);
  assert.ok(Math.abs(middle[1] - 0.59617) < 0.0001);
});

test('the deterministic normal model has stable finite centered moments', () => {
  const normal = normalGenerator('normal-model-contract');
  const values = Array.from({ length: 4000 }, normal);
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1);
  assert.ok(Math.abs(mean) < 0.1); assert.ok(variance > 0.85 && variance < 1.15);
});

test('correlated blocks expose lost coverage instead of being called independent evidence', () => {
  const independent = sensitivity(policy.scenarios[0], 1000, 'dependence-contract');
  const dependent = sensitivity(policy.scenarios.find((scenario) => scenario.id === 'jsdom-dependent-blocks'), 1000, 'dependence-contract');
  assert.equal(independent.workingModelAssumptionsSatisfied, true);
  assert.equal(dependent.workingModelAssumptionsSatisfied, false);
  assert.ok(independent.boundedCoverageFraction > 0.9);
  assert.ok(dependent.boundedCoverageFraction < 0.65);
  for (const result of [independent, dependent]) {
    assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
  }
});
