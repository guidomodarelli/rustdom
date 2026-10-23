/** @file Builds immutable XML baseline/candidate packages with the existing real producer and a separate reference. */
'use strict';
const producer = require('./prepare-hosted-build.cjs');
const recipe = require('./constants/xml-hosted-build.cjs');
const { captureXmlBuildInputs } = require('./xml-build-inputs.cjs');
const options = { recipe, captureInputs: captureXmlBuildInputs };

/** @param {string} baseline - Actual checkpoint066 sources. @param {string} candidate - Current sources. @param {string} output - New external output. @returns {object} Build identity only. */
function prepare(baseline, candidate, output) { return producer.prepare(baseline, candidate, output, options); }
/** @param {string} output - Real immutable preparation. @returns {object} Full checked identity, without timing acceptance. */
function verify(output) { return producer.verify(output, options); }
if (require.main === module) {
  try {
    const result = process.argv[2] === '--verify' ? verify(process.argv[3]) : prepare(...process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { prepare, verify, verifyFunctionalReport: producer.verifyFunctionalReport };
