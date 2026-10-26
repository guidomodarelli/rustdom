/** @file Exercises real current-build packages with the same public operations and finite release contract. */
'use strict';
const { main } = require('./hosted-build-worker.cjs');
const preparation = require('./prepare-current-hosted-build.cjs');
if (require.main === module) main(process.argv[2], preparation).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
