/** @file Rejects any second non-skipped workflow execution before a measurement can start. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

/**
 * Check the complete paginated list of non-skipped workflow run IDs, including the current run.
 * @param {string} filename - Whitespace-separated IDs returned by the workflow history query.
 * @param {string} currentRun - GitHub's current run ID.
 * @returns {void} Throws when another execution already exists or the query omitted this run.
 */
function assertSingleRun(filename, currentRun) {
  const ids = fs.readFileSync(filename, 'utf8').trim().split(/\s+/);
  assert.deepEqual(ids, [currentRun], 'Current ownership: candidate already consumed or run history incomplete; no repetition');
}
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 4, 'Current ownership: provide run-history file and current run ID');
    assertSingleRun(process.argv[2], process.argv[3]);
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { assertSingleRun };
