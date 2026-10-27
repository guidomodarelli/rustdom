/** @file Tests actual numerical behavior against independent SciPy root solving; no DOM or sampler is loaded. */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pairedInterval } = require('./paired-interval.cjs');
const reference = require('./validation/numerical-reference.json');
const policy = require('./constants/reference.json');

/** @param {number} actual - Observed ratio. @param {number} expected - Independent ratio. @returns {void} */
function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= policy.comparisonRelativeTolerance * Math.max(1, Math.abs(expected)), `${actual} versus ${expected}`);
}

for (const fixture of reference.cases) {
  test('matches independent paired-t roots for ' + fixture.name, () => {
    const result = pairedInterval(fixture.pairs, fixture.expected.criticalValue);
    assert.equal(result.status, fixture.expected.status);
    assert.equal(result.pairCount, fixture.pairs.length);
    close(result.pointRatio, fixture.expected.pointRatio);
    if (fixture.expected.intervalRatio) {
      result.intervalRatio.forEach((value, index) => close(value, fixture.expected.intervalRatio[index]));
    } else {
      assert.equal(result.intervalRatio, null);
      assert.equal(result.intervalChangePercent, null);
    }
    assert.equal(result.performanceAccepted, null);
    assert.equal(result.gateReevaluated, false);
  });
}

const fixture = reference.cases.find((entry) => entry.name === 'correlated');
test('preserves units, process-pair order and original inputs', () => {
  const original = structuredClone(fixture.pairs);
  const result = pairedInterval(fixture.pairs, fixture.expected.criticalValue);
  const scaled = pairedInterval(fixture.pairs.map((pair) => ({
    baselineMeanMs: pair.baselineMeanMs * 1000, candidateMeanMs: pair.candidateMeanMs * 1000,
  })).reverse(), fixture.expected.criticalValue);
  result.intervalRatio.forEach((value, index) => close(value, scaled.intervalRatio[index]));
  close(result.pointRatio, scaled.pointRatio);
  assert.deepEqual(fixture.pairs, original);
});

test('swapping both labels gives reciprocal interval bounds', () => {
  const result = pairedInterval(fixture.pairs, fixture.expected.criticalValue);
  const swapped = pairedInterval(fixture.pairs.map((pair) => ({
    baselineMeanMs: pair.candidateMeanMs, candidateMeanMs: pair.baselineMeanMs,
  })), fixture.expected.criticalValue);
  close(swapped.pointRatio, 1 / result.pointRatio);
  close(swapped.intervalRatio[0], 1 / result.intervalRatio[1]);
  close(swapped.intervalRatio[1], 1 / result.intervalRatio[0]);
});

test('uses the declared pair covariance rather than marginal means alone', () => {
  const aligned = pairedInterval(fixture.pairs, fixture.expected.criticalValue);
  const unpaired = pairedInterval(fixture.pairs.map((pair, index) => ({
    baselineMeanMs: pair.baselineMeanMs,
    candidateMeanMs: fixture.pairs[(index + 1) % fixture.pairs.length].candidateMeanMs,
  })), fixture.expected.criticalValue);
  close(aligned.pointRatio, unpaired.pointRatio);
  assert.ok(unpaired.intervalRatio[1] - unpaired.intervalRatio[0] > aligned.intervalRatio[1] - aligned.intervalRatio[0]);
});

test('rejects nonpositive or unusable public numerical inputs', () => {
  for (const pairs of [null, [], [fixture.pairs[0]], [null, fixture.pairs[0]],
    [{ baselineMeanMs: 0, candidateMeanMs: 1 }, fixture.pairs[0]],
    [{ baselineMeanMs: 1, candidateMeanMs: NaN }, fixture.pairs[0]],
    [{ baselineMeanMs: Infinity, candidateMeanMs: 1 }, fixture.pairs[0]]]) {
    assert.throws(() => pairedInterval(pairs, fixture.expected.criticalValue), RangeError);
  }
  for (const critical of [NaN, Infinity, 0, -1]) assert.throws(() => pairedInterval(fixture.pairs, critical), RangeError);
});

test('never turns an underflowing denominator into a finite accepted interval', () => {
  const result = pairedInterval([{ baselineMeanMs: Number.MIN_VALUE, candidateMeanMs: Number.MAX_VALUE },
    { baselineMeanMs: Number.MIN_VALUE, candidateMeanMs: Number.MAX_VALUE }], fixture.expected.criticalValue);
  assert.notEqual(result.status, 'bounded');
  assert.equal(result.intervalRatio, null);
  assert.equal(result.performanceAccepted, null);
});

test('preserves both directions of representable extreme constant ratios without inverted bounds', () => {
  for (const [baseline, candidate] of [[2e-162, 1], [1, 2e-162]]) {
    const pairs = Array.from({ length: 4 }, () => ({ baselineMeanMs: baseline, candidateMeanMs: candidate }));
    const result = pairedInterval(pairs, 2);
    const ratio = candidate / baseline;
    assert.equal(result.status, 'bounded');
    assert.ok(result.intervalRatio[0] <= result.pointRatio && result.pointRatio <= result.intervalRatio[1]);
    for (const bound of result.intervalRatio) {
      assert.ok(bound > 0 && Math.abs(bound / ratio - 1) <= policy.comparisonRelativeTolerance);
    }
  }
});

test('does not turn an underflowing positive candidate into an exact zero interval', () => {
  const result = pairedInterval(Array.from({ length: 2 }, () => ({
    baselineMeanMs: Number.MAX_VALUE, candidateMeanMs: Number.MIN_VALUE,
  })), 2);
  assert.equal(result.status, 'not-estimable');
  assert.equal(result.candidateMeanMs, Number.MIN_VALUE);
  assert.equal(result.pointRatio, null);
  assert.equal(result.intervalRatio, null);
  assert.equal(result.performanceAccepted, null);
});

test('does not report a narrow interval at an ill-conditioned Fieller boundary', () => {
  // Reviewer reference: exact Decimal100 inversion gives upper=312.9913491294245, not 312.7864158370677.
  const result = pairedInterval([{ baselineMeanMs: 1, candidateMeanMs: 1 },
    { baselineMeanMs: 1.170849566108771, candidateMeanMs: 100 }], 12.706204736432095);
  assert.equal(result.status, 'not-estimable');
  assert.equal(result.reason, 'ill-conditioned-baseline-uncertainty-boundary');
  assert.equal(result.intervalRatio, null);
  assert.equal(result.performanceAccepted, null);
});

test('keeps the exact zero-denominator boundary inconclusive', () => {
  const result = pairedInterval([{ baselineMeanMs: 1, candidateMeanMs: 1 },
    { baselineMeanMs: 1.1, candidateMeanMs: 100 }], 21);
  assert.equal(result.status, 'not-estimable');
  assert.equal(result.intervalRatio, null);
  assert.equal(result.performanceAccepted, null);
});
