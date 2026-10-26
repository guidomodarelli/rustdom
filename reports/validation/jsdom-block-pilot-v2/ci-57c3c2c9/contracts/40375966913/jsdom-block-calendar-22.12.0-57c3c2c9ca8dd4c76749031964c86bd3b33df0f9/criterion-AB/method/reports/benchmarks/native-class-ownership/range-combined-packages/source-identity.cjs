/** @module combined-package-source Reads actual source provenance without loading a runtime. */
'use strict';
const { captureSourceIdentity } = require('../../../../benchmarks/sources.cjs');
console.log(JSON.stringify(captureSourceIdentity(process.argv[2])));
