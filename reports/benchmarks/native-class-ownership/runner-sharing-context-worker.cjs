/** @file Run the existing real module-sharing worker with the complete original workload context. */
'use strict';
const { main } = require('./runner-sharing-worker.cjs');
const settings = require('./constants/runner-sharing-context.cjs');
if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  main(input, output, settings).catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
}
