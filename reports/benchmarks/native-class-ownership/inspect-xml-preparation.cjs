/** @module xml-preparation-inspection Verifies the actual build, distributions, dependencies and tools without starting a study. */
'use strict';
const assert = require('node:assert/strict');
const { inspectPreparation } = require('./xml-current-run.cjs');
const policy = require('./constants/xml-preparation-inspection.cjs');

/**
 * Inspect the current preparation without granting the consumed XML method's fixed source scope.
 * @param {string} baseline - Actual checkpoint066 source, distribution and dependency root.
 * @param {string} candidate - Actual current source, distribution and dependency root.
 * @param {string} archive - Independently verified immutable preparation.
 * @returns {object} Complete observed identities; no measurement or gate acceptance.
 */
function inspectPrepared(baseline, candidate, archive) {
  return { ...inspectPreparation(baseline, candidate, archive), revision: policy.revision,
    scope: 'preparation-only', scientificCaptureEligible: false, gateReevaluated: false };
}

if (require.main === module) {
  try {
    assert.equal(process.argv.length, 6, 'XML preparation inspection: provide --inspect baseline candidate archive');
    assert.equal(process.argv[2], policy.option);
    process.stdout.write(JSON.stringify(inspectPrepared(...process.argv.slice(3))) + '\n');
  } catch (error) {
    process.stderr.write(error.stack + '\n'); process.exitCode = policy.failureExitCode;
  }
}
module.exports = { inspectPrepared };
