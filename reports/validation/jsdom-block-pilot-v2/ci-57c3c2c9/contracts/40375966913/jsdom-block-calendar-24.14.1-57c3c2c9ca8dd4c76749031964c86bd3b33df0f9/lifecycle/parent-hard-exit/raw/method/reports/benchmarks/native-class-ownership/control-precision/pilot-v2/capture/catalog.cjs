/** @module pilot-publication Publishes a source/criterion catalog from current bytes, without creating review or performance claims. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { currentFiles, filesDigest, repository } = require('./source.cjs');
const { calendar } = require('../blocks.cjs');
const { writeNewJSON, hashFile } = require('./io.cjs');
const policy = require('../constants/capture.json');

/** @returns {object} Exact current source/criteria dictionary. This does not infer review, capture readiness or an actual commit from a working tree. */
function catalog() {
  const files = currentFiles(repository, true);
  return { revision: policy.revision, executionReady: policy.executionReady, files, filesDigest: filesDigest(files),
    criteria: calendar().map((criterion, ordinal) => ({ ordinal, criterionId: criterion.criterionId,
      node: criterion.node, phase: criterion.phase, row: criterion.row })),
    performanceAccepted: null, gateReevaluated: false };
}
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 3, 'Pilot catalog: provide one fresh catalog path');
    assert.equal(path.resolve(process.argv[2]), path.join(repository, policy.catalog));
    assert.equal(fs.existsSync(process.argv[2]), false, 'Pilot catalog: preserve an existing publication');
    writeNewJSON(process.argv[2], catalog());
    process.stdout.write(JSON.stringify({ sha256: hashFile(process.argv[2]), reviewPerformed: false, performanceAccepted: null }) + '\n');
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = 2; }
}
module.exports = { catalog };
