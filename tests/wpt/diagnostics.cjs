/** @file Preserves complete isolated-fixture observations without changing the original parity verdict. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { assertWptParity } = require('./comparison.cjs');
const settings = require('./constants/diagnostics.cjs');

/**
 * Require unchanged parity and retain both raw reports when it fails.
 * @param {string} file - Upstream fixture identifier.
 * @param {object} candidate - Actual candidate result and process observations.
 * @param {object} reference - Independent reference result and process observations.
 * @param {object} [options] - Caller-owned diagnostic output directory.
 * @param {string} [options.directory] - Root for unique preserved failure folders.
 * @returns {void} Successful comparisons produce no files.
 * @throws {Error} Original parity assertion, or an AggregateError retaining it if preservation fails.
 */
function assertFixtureParity(file, candidate, reference, { directory = settings.OUTPUT_DIRECTORY } = {}) {
  try {
    assertWptParity(file, candidate.result, reference.result);
  } catch (error) {
    try {
      fs.mkdirSync(directory, { recursive: true });
      const output = fs.mkdtempSync(path.join(directory, settings.FAILURE_DIRECTORY_PREFIX));
      const filename = path.join(output, settings.REPORT_FILENAME);
      fs.writeFileSync(filename, `${JSON.stringify({ capturedAt: new Date().toISOString(),
        node: process.version, file, reference, candidate }, null, 2)}\n`, { flag: 'wx' });
      error.diagnosticsPath = filename;
    } catch (diagnosticsError) {
      throw new AggregateError([error, diagnosticsError],
        `WPT ${file}: comparison failed and diagnostics could not be saved under ${directory}`, { cause: error });
    }
    throw error;
  }
}

module.exports = { assertFixtureParity };
