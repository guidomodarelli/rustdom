/** @module pilot-expectation Selects the current real Git/source profile independently from supplied capture data. */
'use strict';
const assert = require('node:assert/strict');
const { producer, ownedPath, repository } = require('./source.cjs');
const { readConsumption } = require('./once.cjs');
const { calendar } = require('../blocks.cjs');
const { hashFile, writeNewJSON } = require('./io.cjs');
const policy = require('../constants/capture.json');

/** @param {'functional'|'capture'} mode - Independently chosen role. @param {string} criterionId - Declared complete criterion. @returns {object} Expectation from the actual checkout/controller, never from raw index or sidecar claims. */
function expectation(mode, criterionId, supervised = false) {
  assert.ok(policy.modes.includes(mode));
  assert.ok(calendar().some((criterion) => criterion.criterionId === criterionId));
  const origin = producer(mode);
  assert.equal(origin.sourceChangesRaw, '', 'Pilot expectation: clean real Git source required');
  const result = { mode, criterionId, sourceCommit: origin.sourceCommit, files: origin.files, requireComplete: true,
    requireSupervisor: supervised || mode === policy.captureMode };
  if (mode === policy.captureMode) {
    const consumption = readConsumption(origin.sourceCommit);
    result.runId = Number(process.env.GITHUB_RUN_ID);
    result.publicationSha256 = hashFile(ownedPath(repository, policy.publication));
    result.consumptionSha256 = consumption.sha256;
  }
  return result;
}
if (require.main === module) {
  try {
    assert.ok(process.argv.length === 5 || (process.argv.length === 6 && process.argv[5] === '--supervised'),
      'Pilot expectation: provide mode, criterion, new external expectation file and optional --supervised');
    writeNewJSON(process.argv[4], expectation(process.argv[2], process.argv[3], process.argv[5] === '--supervised'));
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = 2; }
}
module.exports = { expectation };
