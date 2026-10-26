/** @file Exercises the five newly built packages and separate weak Window/Document endpoints. */
'use strict';
const { main } = require('../hosted-build-worker.cjs');
const preparation = require('./prepare.cjs');
if (require.main === module) main(process.argv[2], preparation).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
