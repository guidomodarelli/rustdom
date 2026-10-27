/** @file Exercises the five actual XML preparation copies and requires separate Window/Document release. */
'use strict';
const { main } = require('./hosted-build-worker.cjs');
const preparation = require('./prepare-xml-hosted-build.cjs');
if (require.main === module) main(process.argv[2], preparation).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
});
