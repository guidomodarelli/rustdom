/** @module ownership-confirmation-planning Bounded read-only calculations from the authenticated complete jsdom pilot; never executes DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const design = require('./constants/design.json');
const { criteria, population } = require('./calendar.cjs');

/** @param {string} filename - Current data, not executable code. @param {string} expectedHash - Published immutable digest. @returns {object} Bounded, exact authenticated bytes decoded as JSON. */
function readInput(filename, expectedHash) {
  const stat = fs.lstatSync(filename);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= design.maximumPlanningInputBytes,
    'Ownership confirmation planning: regular bounded input file required: ' + filename);
  const raw = fs.readFileSync(filename);
  assert.equal(createHash('sha256').update(raw).digest('hex'), expectedHash,
    'Ownership confirmation planning: published input digest changed: ' + filename);
  return JSON.parse(raw.toString('utf8'));
}

/**
 * Forecast only, using the larger of the historical estimate and observed jsdom supervisor time per block.
 * Rust's variance and future elapsed time are not estimated from jsdom. Timeout forecasts are not guarantees.
 * @param {number} jsdomObservedMinutes - Worst actual complete criterion, including its supervisor overhead.
 * @param {{jsdom:number,rustdom:number}} [blocks] - Explicit alternative evaluated without mutating the method.
 * @returns {object} Resource feasibility; no statistical or performance acceptance.
 */
function runtimeForecast(jsdomObservedMinutes, blocks = design.blocksPerCriterion) {
  assert.ok(Number.isFinite(jsdomObservedMinutes) && jsdomObservedMinutes > 0);
  const forecasts = {};
  for (const engine of Object.keys(design.blocksPerCriterion)) {
    assert.ok(Number.isSafeInteger(blocks[engine]) && blocks[engine] > 0);
    const prior = design.priorWorstCaseForecastMinutes[engine];
    const observedPerBlock = engine === 'jsdom' ? jsdomObservedMinutes / design.pilotBlocksPerCriterion : null;
    const minutesPerBlock = Math.max(prior.minutes / prior.blocks, observedPerBlock ?? 0);
    const projectedMinutes = minutesPerBlock * blocks[engine] * design.forecastSafetyMultiplier;
    forecasts[engine] = { blocks: blocks[engine], priorEstimateMinutesPerBlock: prior.minutes / prior.blocks,
      observedPilotMinutesPerBlock: observedPerBlock, projectedMinutes,
      withinCaptureBudget: projectedMinutes <= design.captureTimeoutMinutes,
      futureElapsedTimeGuaranteed: false, varianceTransferredFromJsdom: false };
  }
  const reservedMinutes = design.setupBudgetMinutes + design.archiveBudgetMinutes +
    design.uploadBudgetMinutes + design.jobMarginMinutes;
  return { forecasts, captureTimeoutMinutes: design.captureTimeoutMinutes, jobTimeoutMinutes: design.jobTimeoutMinutes,
    reservedMinutes, platformLimitMinutes: design.hostedJobLimitMinutes,
    feasible: Object.values(forecasts).every((entry) => entry.withinCaptureBudget) &&
      design.captureTimeoutMinutes + reservedMinutes <= design.jobTimeoutMinutes &&
      design.jobTimeoutMinutes <= design.hostedJobLimitMinutes };
}

/**
 * Compare fixed-boundary uncertainty scenarios using the old pilot only for planning.
 * The observed mean and upper SD are held fixed hypothetically; this is neither future power nor a pass prediction.
 * @param {string} inputDirectory - Two unmodified published pilot data files.
 * @returns {object} All 32 scenarios, actual provenance, exact prospective denominators and uncompleted integration requirements.
 */
function plan(inputDirectory) {
  const evidence = design.planningEvidence;
  const analysis = readInput(path.join(inputDirectory, 'analysis.json'), evidence.analysisSha256);
  const resources = readInput(path.join(inputDirectory, 'resource-endpoints.json'), evidence.resourceSha256);
  assert.equal(analysis.runId, evidence.runId); assert.equal(resources.runId, evidence.runId);
  assert.equal(analysis.sourceCommit, evidence.sourceCommit);
  assert.equal(analysis.newSamplesCollected, false); assert.equal(analysis.allCriteriaAreJsdomOnly, true);
  assert.equal(analysis.performanceAccepted, null); assert.equal(analysis.gateReevaluated, false);
  const expected = criteria().filter((entry) => entry.engine === 'jsdom');
  const sourceAnalyses = analysis.sourceAnalysesPreservedUnmodified.map((entry) => entry.sourceAnalysisUnmodified);
  assert.deepEqual(sourceAnalyses.map((entry) => entry.criterionId), expected.map((entry) => entry.criterionId));
  assert.deepEqual(resources.criteria.map((entry) => entry.criterionId), expected.map((entry) => entry.criterionId));
  const scenarios = sourceAnalyses.map((entry) => {
    assert.equal(entry.blockMeans.length, design.pilotBlocksPerCriterion);
    assert.equal(entry.performanceAccepted, null); assert.equal(entry.independenceEstablished, false);
    const boundaries = entry.contrasts.filter((contrast) => !contrast.diagnosticOnly).map((contrast) => {
      assert.ok(Number.isFinite(contrast.meanMs) && Number.isFinite(contrast.standardDeviationUpper95Ms) &&
        contrast.standardDeviationUpper95Ms > 0);
      const hypotheticalHalfWidthMs = design.criticalValues.jsdom * contrast.standardDeviationUpper95Ms /
        Math.sqrt(design.blocksPerCriterion.jsdom);
      return { fixedRatio: contrast.fixedRatio, observedContrastMeanMs: contrast.meanMs,
        pilotUpper95StandardDeviationMs: contrast.standardDeviationUpper95Ms, hypotheticalHalfWidthMs,
        hypotheticalSignedMarginMs: (contrast.fixedRatio < 1 ? contrast.meanMs : -contrast.meanMs) - hypotheticalHalfWidthMs };
    });
    assert.deepEqual(boundaries.map((entry) => entry.fixedRatio), design.jsdomBoundaryRatios);
    return { criterionId: entry.criterionId, observedRatioOfArithmeticMeans: entry.ratioOfArithmeticMeans, boundaries,
      usesNewSamples: false, powerEstimated: false, futurePassPredicted: false, performanceAccepted: null };
  });
  const worstObservedMinutes = Math.max(...resources.criteria.map((entry) => {
    assert.equal(entry.supervisor.complete, true); assert.equal(entry.supervisor.mode, 'capture');
    assert.equal(entry.supervisor.exitCode, 0);
    assert.ok(Number.isFinite(entry.supervisor.elapsedSeconds) && entry.supervisor.elapsedSeconds > 0);
    return entry.supervisor.elapsedSeconds / 60;
  }));
  const timing = runtimeForecast(worstObservedMinutes);
  assert.equal(timing.feasible, true, 'Ownership confirmation planning: proposed method exceeds runtime limits');
  return { revision: design.revision, executionReady: design.executionReady, planningOnly: true,
    scientificCaptureExecuted: false, newSamplesCollected: false, historicalPilotUsedForAcceptance: false,
    selectedPackageArtifact: design.selectedPackageArtifact, selectedPackageArchiveSha256: design.selectedPackageArchiveSha256,
    selectedNativeBinarySha256: design.selectedNativeBinarySha256, planningEvidence: evidence,
    population: population(), timing, rejectedAlternative: runtimeForecast(worstObservedMinutes, { jsdom: 32, rustdom: 32 }),
    scenarios, rustVarianceEstimated: false, independenceEstablished: false, powerEstimated: false,
    remainingRequirements: ['new native worker and integral source/package/resource reader',
      'both pinned SDKs real functional and teardown qualification', 'isolated method review and publication',
      'one new consumed fixed scientific sequence', 'complete authenticated result integration into ownership gate'],
    performanceAccepted: null, gateReevaluated: false };
}

if (require.main === module) {
  try {
    assert.equal(process.argv.length, 3, 'Ownership confirmation planning: provide the planning-input directory');
    process.stdout.write(JSON.stringify(plan(process.argv[2]), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ operation: 'Ownership confirmation planning', name: error.name, message: error.message }) + '\n');
    process.exitCode = 1;
  }
}
module.exports = { runtimeForecast, plan };
