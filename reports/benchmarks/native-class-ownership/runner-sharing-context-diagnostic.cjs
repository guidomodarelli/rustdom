/** @file Bind the complete-context recipe without changing the original focused diagnostic defaults. */
'use strict';
const { createPairedStudy } = require('./paired-main-experiment.cjs');
const diagnostic = require('./runner-sharing-diagnostic.cjs');
const settings = require('./constants/runner-sharing-context.cjs');
if (require.main === module) {
  const [manifest, output, provenance] = process.argv.slice(2);
  try { diagnostic.run(manifest, output, provenance, settings); }
  catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { captureHarness: createPairedStudy({ method: settings }).captureHarness };
