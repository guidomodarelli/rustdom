/** @file Executes the original row-isolated public workload and release sampler on the declared current packages. */
'use strict';
const { createSinglePackageWorker } = require('./single-package-worker.cjs');
const worker = createSinglePackageWorker(require('./constants/current-ownership.cjs'));
if (require.main === module) worker.main(...process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
module.exports = worker;
