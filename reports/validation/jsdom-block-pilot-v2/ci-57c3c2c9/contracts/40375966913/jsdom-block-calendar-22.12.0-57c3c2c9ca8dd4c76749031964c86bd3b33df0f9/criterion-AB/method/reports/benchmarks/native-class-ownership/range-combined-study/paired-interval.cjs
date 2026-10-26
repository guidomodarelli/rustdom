/** @module paired-process-interval Computes a bounded Fieller interval from complete paired process summaries. */
'use strict';
const policy = require('./constants/interval.json');

/**
 * Estimate a ratio of arithmetic means without treating repeated spans as independent processes.
 * The caller supplies one summary per process in each matched pair and the declared t critical value.
 * This numerical function does not choose a confidence level, sampler, budget, or acceptance decision.
 * @param {{baselineMeanMs: number, candidateMeanMs: number}[]} pairs - Matched independent execution summaries.
 * @param {number} criticalValue - Positive critical value chosen before interpreting results.
 * @returns {object} Bounded interval or an explicit non-estimable/unbounded result, never acceptance.
 * @throws {RangeError} When the public numerical inputs cannot describe positive execution durations.
 */
function pairedInterval(pairs, criticalValue) {
  if (!Array.isArray(pairs) || pairs.length < policy.minimumPairCount) {
    throw new RangeError('Paired interval: provide at least ' + policy.minimumPairCount + ' process pairs');
  }
  if (!Number.isFinite(criticalValue) || criticalValue <= 0) {
    throw new RangeError('Paired interval: criticalValue must be finite and positive');
  }
  let baselineScale = 0;
  let candidateScale = 0;
  for (const [pairIndex, pair] of pairs.entries()) {
    for (const field of ['baselineMeanMs', 'candidateMeanMs']) {
      if (!pair || !Number.isFinite(pair[field]) || pair[field] <= 0) {
        throw new RangeError('Paired interval: ' + field + ' must be finite and positive at pairIndex=' + pairIndex);
      }
    }
    baselineScale = Math.max(baselineScale, pair.baselineMeanMs);
    candidateScale = Math.max(candidateScale, pair.candidateMeanMs);
  }
  let baselineMean = 0;
  let candidateMean = 0;
  let baselineSquaredDeviations = 0;
  let candidateSquaredDeviations = 0;
  let pairedDeviations = 0;
  for (const [pairIndex, pair] of pairs.entries()) {
    const count = pairIndex + 1;
    const baseline = pair.baselineMeanMs / baselineScale;
    const candidate = pair.candidateMeanMs / candidateScale;
    const baselineDelta = baseline - baselineMean;
    const candidateDelta = candidate - candidateMean;
    baselineMean += baselineDelta / count;
    candidateMean += candidateDelta / count;
    baselineSquaredDeviations += baselineDelta * (baseline - baselineMean);
    candidateSquaredDeviations += candidateDelta * (candidate - candidateMean);
    pairedDeviations += baselineDelta * (candidate - candidateMean);
  }
  const normalizedPointRatio = candidateMean / baselineMean;
  const baselineMeanMs = baselineMean * baselineScale;
  const candidateMeanMs = candidateMean * candidateScale;
  const pointRatio = candidateMeanMs / baselineMeanMs;
  const representablePoint = Number.isFinite(pointRatio) && pointRatio > 0 ? pointRatio : null;
  const changePercent = representablePoint === null ? null : 100 * (pointRatio - 1);
  const result = { revision: policy.revision, pairCount: pairs.length, criticalValue,
    baselineMeanMs, candidateMeanMs, pointRatio: representablePoint,
    changePercent: Number.isFinite(changePercent) ? changePercent : null, intervalRatio: null,
    intervalChangePercent: null, performanceAccepted: null, gateReevaluated: false };
  if (representablePoint === null || !Number.isFinite(changePercent)) {
    return { ...result, status: 'not-estimable', reason: 'unrepresentable-point-ratio-or-percent' };
  }
  const degreesOfFreedom = pairs.length - 1;
  const varianceBaseline = baselineSquaredDeviations / degreesOfFreedom;
  const varianceCandidate = candidateSquaredDeviations / degreesOfFreedom;
  const covariance = pairedDeviations / degreesOfFreedom;
  const squaredCriticalOverCount = criticalValue ** 2 / pairs.length;
  const denominator = baselineMean ** 2 - squaredCriticalOverCount * varianceBaseline;
  const center = baselineMean * candidateMean - squaredCriticalOverCount * covariance;
  const constant = candidateMean ** 2 - squaredCriticalOverCount * varianceCandidate;
  if (![pointRatio, denominator, center, constant].every(Number.isFinite) || baselineMean <= 0) {
    return { ...result, status: 'not-estimable', reason: 'non-finite-arithmetic' };
  }
  const denominatorTolerance = policy.minimumDenominatorRelativeMagnitude *
    Math.max(baselineMean ** 2, squaredCriticalOverCount * varianceBaseline, Number.MIN_VALUE);
  if (Math.abs(denominator) <= denominatorTolerance) {
    return { ...result, status: 'not-estimable', reason: 'ill-conditioned-baseline-uncertainty-boundary' };
  }
  if (denominator <= 0) {
    return { ...result, status: 'unbounded', reason: 'baseline-uncertainty-includes-zero' };
  }
  const squaredCenter = center ** 2;
  const product = denominator * constant;
  const discriminant = squaredCenter - product;
  const tolerance = policy.discriminantRelativeToleranceMultiplier * Number.EPSILON *
    Math.max(Math.abs(squaredCenter), Math.abs(product), Number.MIN_VALUE);
  if (!Number.isFinite(discriminant) || discriminant < -tolerance) {
    return { ...result, status: 'not-estimable', reason: 'negative-or-non-finite-discriminant' };
  }
  const roundedDiscriminant = Math.max(0, discriminant);
  const halfWidth = Math.sqrt(roundedDiscriminant);
  const stableNumerator = center + (center >= 0 ? halfWidth : -halfWidth);
  const firstRoot = stableNumerator / denominator;
  const secondRoot = stableNumerator !== 0 ? constant / stableNumerator : center / denominator;
  const normalizedLower = Math.min(firstRoot, secondRoot);
  const normalizedUpper = Math.max(firstRoot, secondRoot);
  const lower = normalizedLower / normalizedPointRatio * pointRatio;
  const upper = normalizedUpper / normalizedPointRatio * pointRatio;
  const intervalChangePercent = [100 * (lower - 1), 100 * (upper - 1)];
  if (![lower, upper, ...intervalChangePercent].every(Number.isFinite) ||
      lower > upper || lower > pointRatio || upper < pointRatio) {
    return { ...result, status: 'not-estimable', reason: 'non-finite-or-inconsistent-bounds' };
  }
  return { ...result, status: 'bounded', intervalRatio: [lower, upper],
    intervalChangePercent,
    discriminantRoundedToZero: discriminant < 0 };
}

module.exports = { pairedInterval };
