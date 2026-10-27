/** @module ownership-seeded-pre-gc-worker Executes one real package under its declared V8 startup seed. */
'use strict';
const { createSinglePackageWorker } = require('./single-package-worker.cjs');
const worker = createSinglePackageWorker(require('./constants/seeded-pre-gc.cjs'));
if (require.main === module) worker.main(...process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
module.exports = worker;
