/** @module ownership-row-isolation-worker Executes exactly one public workload with the existing seeded sampler. */
'use strict';
const { createSinglePackageWorker } = require('./single-package-worker.cjs');
const worker = createSinglePackageWorker(require('./constants/row-isolation.cjs'));
if (require.main === module) worker.main(...process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
module.exports = worker;
