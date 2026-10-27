/** @module range-comparison-exports Lists every verified comparison and unfavorable control without deciding acceptance. */
'use strict';

/** @param {object} verification - Original verifier result. @param {object} settings - Frozen phase order. @returns {object[]} Every original row in declared order. */
function comparisonRows(verification, settings) {
  return verification.results.flatMap((profile) => settings.phases.flatMap((phase) =>
    profile.summaries[phase].map((row) => ({ node: profile.node, phase, ...row }))));
}

/** @param {object[]} comparisons - Original rows, never edited or filtered out of the main export. @param {object} settings - Original budgets. @returns {object} Diagnostic lists; no new acceptance decision. */
function classifyFailures(comparisons, settings) {
  const calibrationPhase = settings.phases[0];
  return {
    jsdomControls: comparisons.filter((row) => Math.abs(row.jsdomControlChangePercent) > settings.controlBudgetPercent),
    rustNumeric: comparisons.filter((row) => (row.phase === calibrationPhase ? Math.abs(row.rustdomChangePercent) : row.rustdomChangePercent) > settings.rustBudgetPercent),
    aaCalibration: comparisons.filter((row) => row.phase === calibrationPhase && !row.calibrated),
    abBudget: comparisons.filter((row) => row.phase !== calibrationPhase && !row.withinBudget)
  };
}
module.exports = { comparisonRows, classifyFailures };
