/** Exercise the real worker's owned observer edge; no dependency or runtime library is mocked. */
'use strict';
const { main } = require('../worker.cjs');
const { progressFailureMessage, failureExitCode } = require('../constants/worker.json');
main(process.argv.slice(2), (progress) => {
  if (progress.complete) throw new Error(progressFailureMessage);
}).catch((error) => {
  process.stderr.write(JSON.stringify({ name: error.name, message: error.message }) + '\n');
  process.exitCode = failureExitCode;
});
