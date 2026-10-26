/** @module pilot-block-variance Reports pointwise normal-model uncertainty of fixed block contrasts without accepting performance. */
'use strict';
const assert = require('node:assert/strict');
const { summarize } = require('./blocks.cjs');
const design = require('./constants/design.json');
const policy = require('./constants/variance.json');

/**
 * Retain descriptive temporal dependence; no significance test or threshold can establish independence.
 * @param {number[]} values - Ordered complete-block contrasts in milliseconds.
 * @param {number} average - Their arithmetic mean.
 * @returns {object} Lag-one correlation and linear slope per block, without filtering observations.
 */
function temporalDiagnostics(values, average) {
  const centered = values.map((value) => value - average);
  const sumSquares = centered.reduce((total, value) => total + value ** 2, 0);
  const centerIndex = (values.length - 1) / 2;
  const indexSquares = values.reduce((total, unused, index) => total + (index - centerIndex) ** 2, 0);
  const lagProduct = centered.slice(1).reduce((total, value, index) => total + centered[index] * value, 0);
  const slope = centered.reduce((total, value, index) => total + (index - centerIndex) * value, 0) / indexSquares;
  const lagOneCorrelation = sumSquares === 0 ? null : lagProduct / sumSquares;
  assert.ok(Number.isFinite(slope) && (lagOneCorrelation === null || Number.isFinite(lagOneCorrelation)), 'Pilot variance: non-finite temporal diagnostic');
  return { lagOneCorrelation, linearSlopeMsPerBlock: slope, descriptiveOnly: true, independenceEstablished: false };
}

/**
 * Compute SD intervals for each predeclared q under the explicit iid-normal complete-block working model.
 * @param {string} criterionId - Declared jsdom criterion; exactly one host.
 * @param {object[]} observations - Complete ordered scalar means; upstream authentication remains mandatory.
 * @returns {object} Every block, contrast and adverse diagnostic; never power, simultaneous coverage or acceptance.
 */
function analyze(criterionId, observations) {
  assert.equal(design.blocksPerCriterion, policy.blocks);
  assert.equal(policy.degreesOfFreedom, policy.blocks - 1);
  const summary = summarize(criterionId, observations);
  const contrasts = summary.contrasts.map((contrast) => {
    const deviation = contrast.sampleStandardDeviationMs;
    const diagnostics = temporalDiagnostics(contrast.valuesMs, contrast.meanMs);
    // Zero empirical dispersion may reflect quantization/degeneracy; it does not establish zero population variance.
    const estimable = deviation > 0;
    const interval = estimable ? [deviation * Math.sqrt(policy.degreesOfFreedom / policy.upperTailQuantile975),
      deviation * Math.sqrt(policy.degreesOfFreedom / policy.lowerTailQuantile025)] : null;
    const upper = estimable ? deviation * Math.sqrt(policy.degreesOfFreedom / policy.lowerTailQuantile05) : null;
    assert.ok(interval === null || interval.every((bound) => Number.isFinite(bound) && bound > 0), 'Pilot variance: non-finite SD interval');
    assert.ok(upper === null || Number.isFinite(upper), 'Pilot variance: non-finite upper SD bound');
    return { ...contrast, status: estimable ? 'conditional-pointwise-interval' : 'inconclusive-zero-observed-dispersion',
      standardDeviationIntervalMs: interval, standardDeviationUpper95Ms: upper, temporalDiagnostics: diagnostics };
  });
  return { ...summary, contrasts, confidenceIntervalsComputed: true, confidenceLevel: policy.confidenceLevel,
    degreesOfFreedom: policy.degreesOfFreedom, coverageModel: policy.model,
    confidenceScope: 'pointwise-per-fixed-contrast', simultaneousCoverageClaimed: false,
    powerEstimated: false, populationVarianceZeroEstablished: false, independenceEstablished: false,
    performanceAccepted: null, gateReevaluated: false };
}

module.exports = { analyze };
