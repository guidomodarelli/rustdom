/** @file Runs one prepared physical package with explicit same-window operation warmup. */
'use strict';
const { createSinglePackageWorker } = require('./single-package-worker.cjs');
const worker = createSinglePackageWorker(require('./constants/realm-warmup.cjs'));
if (require.main === module) worker.main(...process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
module.exports = worker;
