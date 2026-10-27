/** @file A fresh build records current inputs; historical timing acceptance stays pinned separately. */
'use strict';
const original = require('./hosted-build.cjs');
module.exports = { ...original, revision: 'ownership-current-build-v2',
  preparationFiles: [...original.preparationFiles,
    'reports/benchmarks/native-class-ownership/constants/current-hosted-build.cjs',
    'reports/benchmarks/native-class-ownership/constants/current-build-contracts.cjs',
    'reports/benchmarks/native-class-ownership/current-build-inputs.cjs',
    'reports/benchmarks/native-class-ownership/prepare-current-hosted-build.cjs',
    'reports/benchmarks/native-class-ownership/current-hosted-build-worker.cjs',
    'reports/benchmarks/native-class-ownership/current-build-inputs.spec.cjs',
    'reports/benchmarks/native-class-ownership/prepare-current-hosted-build.spec.cjs',
    'reports/benchmarks/native-class-ownership/CURRENT-BUILD-PROTOCOL.md',
  ] };
