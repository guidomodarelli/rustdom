'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { calendar } = require('./blocks.cjs');
const { analyze } = require('./variance.cjs');
const reference = require('./constants/variance-reference.json');
const shard = calendar()[0];

/** Construct scalar synthetic process inputs from complete fixed block means, without executing DOM. */
function observations(blocks) {
  return shard.processes.map((input) => ({ processId: input.processId, complete: true, hostId: 'synthetic-host',
    meanMs: blocks[input.block][input.label === 'A' ? 'baselineMeanMs' : 'candidateMeanMs'],
    measuredTaskCount: 144, warmupTaskCount: 48,
    startMonotonicMs: input.ordinal * 2, endMonotonicMs: input.ordinal * 2 + 1 }));
}

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= 2e-12 * Math.max(1, Math.abs(expected)), `${actual} differs from independent reference ${expected}`);
}

test('three fixed-q SD intervals match independently generated 80-digit gamma-inversion reference', () => {
  const result = analyze(shard.criterionId, observations(reference.blockMeans));
  for (const [index, actual] of result.contrasts.entries()) {
    const expected = reference.expectedContrasts[index]; assert.equal(actual.fixedRatio, expected.fixedRatio);
    for (const key of ['meanMs', 'sampleVarianceMsSquared', 'sampleStandardDeviationMs', 'standardDeviationUpper95Ms']) close(actual[key], expected[key]);
    actual.standardDeviationIntervalMs.forEach((bound, boundIndex) => close(bound, expected.standardDeviationIntervalMs[boundIndex]));
    assert.ok(actual.standardDeviationIntervalMs[0] < actual.sampleStandardDeviationMs);
    assert.ok(actual.standardDeviationIntervalMs[1] > actual.sampleStandardDeviationMs);
    assert.equal(actual.valuesMs.length, 16);
  }
  assert.equal(result.degreesOfFreedom, 15); assert.equal(result.performanceAccepted, null);
  assert.equal(result.gateReevaluated, false); assert.equal(result.inputAuthenticationPerformed, false);
  assert.equal(result.simultaneousCoverageClaimed, false); assert.equal(result.independenceEstablished, false);
  assert.equal(result.powerEstimated, false);
});

test('positive rescaling preserves duration units and scales variance quadratically', () => {
  const original = analyze(shard.criterionId, observations(reference.blockMeans));
  const scaled = analyze(shard.criterionId, observations(reference.blockMeans.map((block) => ({
    baselineMeanMs: block.baselineMeanMs * 1000, candidateMeanMs: block.candidateMeanMs * 1000 }))));
  for (const [index, contrast] of scaled.contrasts.entries()) {
    close(contrast.standardDeviationUpper95Ms, original.contrasts[index].standardDeviationUpper95Ms * 1000);
    close(contrast.sampleVarianceMsSquared, original.contrasts[index].sampleVarianceMsSquared * 1000000);
  }
});

test('zero empirical dispersion is inconclusive and cannot prove zero population variance', () => {
  const result = analyze(shard.criterionId, observations(Array.from({ length: 16 }, () => ({ baselineMeanMs: 100, candidateMeanMs: 100 }))));
  for (const contrast of result.contrasts) {
    assert.equal(contrast.status, 'inconclusive-zero-observed-dispersion');
    assert.equal(contrast.standardDeviationIntervalMs, null); assert.equal(contrast.standardDeviationUpper95Ms, null);
    assert.equal(contrast.temporalDiagnostics.lagOneCorrelation, null);
  }
  assert.equal(result.populationVarianceZeroEstablished, false);
});

test('visible temporal drift is preserved descriptively without filtering or independence claims', () => {
  const result = analyze(shard.criterionId, observations(Array.from({ length: 16 }, (unused, block) => ({ baselineMeanMs: 100, candidateMeanMs: 100 + block }))));
  const neutral = result.contrasts.find((contrast) => contrast.fixedRatio === 1);
  close(neutral.temporalDiagnostics.linearSlopeMsPerBlock, 1);
  close(neutral.temporalDiagnostics.lagOneCorrelation, 13 / 16);
  assert.deepEqual(neutral.valuesMs, Array.from({ length: 16 }, (unused, block) => block));
  assert.equal(neutral.temporalDiagnostics.independenceEstablished, false);
});

test('partial and non-finite observations never reach an interval result', () => {
  const data = observations(reference.blockMeans);
  assert.throws(() => analyze(shard.criterionId, data.slice(1)), /incomplete criterion/);
  data[0].meanMs = Infinity;
  assert.throws(() => analyze(shard.criterionId, data), /invalid process mean/);
});
