/** @file Binds the original one-package sampler to the independently balanced schedule. */
'use strict';
const { createSinglePackageWorker } = require('./single-package-worker.cjs');
const worker = createSinglePackageWorker(require('./constants/independent-order.cjs'));
if (require.main === module) worker.main(...process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
module.exports = worker;
