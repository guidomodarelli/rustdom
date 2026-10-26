/** @file Produces current-input build evidence without changing the legacy timing gate or its archives. */
'use strict';
const producer = require('./prepare-hosted-build.cjs');
const recipe = require('./constants/current-hosted-build.cjs');
const { captureCurrentInputs } = require('./current-build-inputs.cjs');
const options = { recipe, captureInputs: captureCurrentInputs };

/** @param {string} baseline - Actual baseline. @param {string} candidate - Current sources. @param {string} output - New owned archive. @returns {object} Verified build, without timing acceptance. */
function prepare(baseline, candidate, output) { return producer.prepare(baseline, candidate, output, options); }
/** @param {string} output - Actual immutable build archive. @returns {object} Verified current-input identity. */
function verify(output) { return producer.verify(output, options); }

if (require.main === module) {
  try {
    const result = process.argv[2] === '--verify' ? verify(process.argv[3]) : prepare(...process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { prepare, verify, verifyFunctionalReport: producer.verifyFunctionalReport };
