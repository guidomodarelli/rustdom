/** @module confirmation-functional-replay Independently checks the live functional producer/package and reads its complete criterion without executing captured code. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inspectCurrentSource } = require('./source.cjs');
const { authenticatePackage } = require('./authentication.cjs');
const { requireMode } = require('./binding.cjs');
const { verifyCriterion, dataFile } = require('./criterion-reader.cjs');
const { createManifest } = require('../control-precision/pilot-v2/packages.cjs');
const { readJSON, writeNewJSON } = require('../owner-batch-study/io.cjs');
const policy = require('./constants/capture.json');
const historical = require('./constants/authentication.json');
const worker = require('./constants/worker.json');
const repository = path.resolve(__dirname, '../../../..');

/**
 * Replay an unmoved real functional criterion against actual current source and separately authenticated sealed packages.
 * Stored expected context is reusable as data for offline tests; it never grants scientific or transport authority.
 * @param {string} criterionDirectory - Actual physical unmoved functional output.
 * @param {string} prepared - Existing authenticated sealed package root.
 * @param {string} supervisorFile - Actual supervisor journal from this invocation.
 * @param {string} destination - New disjoint replay evidence directory.
 * @returns {object} Complete functional observations with no statistical acceptance.
 */
function replayFunctional(criterionDirectory, prepared, supervisorFile, destination) {
  requireMode(policy.functionalMode);
  criterionDirectory = fs.realpathSync(criterionDirectory); prepared = fs.realpathSync(prepared);
  destination = path.join(fs.realpathSync(path.dirname(path.resolve(destination))), path.basename(destination));
  for (const protectedRoot of [repository, prepared, criterionDirectory]) {
    assert.ok(destination !== protectedRoot && !destination.startsWith(protectedRoot + path.sep) && !protectedRoot.startsWith(destination + path.sep));
  }
  assert.equal(fs.existsSync(destination), false, 'Confirmation functional replay: preserve existing output');
  fs.mkdirSync(destination);
  const profile = inspectCurrentSource(repository, process.env[historical.authenticationSourceEnvironment]);
  const authentication = authenticatePackage(prepared, destination, 'independent-package');
  const manifest = createManifest(prepared, authentication, policy.functionalMode);
  const index = readJSON(dataFile(criterionDirectory, policy.files.index));
  supervisorFile = fs.realpathSync(supervisorFile);
  dataFile(path.dirname(supervisorFile), path.basename(supervisorFile));
  const expected = { mode: policy.functionalMode, criterionId: index.criterionId, originalDirectory: criterionDirectory,
    referenceRoot: repository, manifest, supervisor: readJSON(supervisorFile),
    source: { profile, files: profile.currentFiles, publicationSha256: null, hosted: null, consumptionSha256: null } };
  writeNewJSON(path.join(destination, policy.functionalQualification.expectedContextFile), expected);
  const result = verifyCriterion(criterionDirectory, expected);
  assert.equal(result.clock.supervisorVerified, true);
  writeNewJSON(path.join(destination, policy.functionalQualification.replayResultFile), result);
  return result;
}

if (require.main === module) {
  try {
    assert.equal(process.argv.length, 7, 'Confirmation functional replay: provide --functional criterion sealed-package supervisor new-output');
    assert.equal(process.argv[2], policy.functionalOption);
    process.stdout.write(JSON.stringify(replayFunctional(...process.argv.slice(3))) + '\n');
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = worker.failureExitCode; }
}
module.exports = { replayFunctional };
