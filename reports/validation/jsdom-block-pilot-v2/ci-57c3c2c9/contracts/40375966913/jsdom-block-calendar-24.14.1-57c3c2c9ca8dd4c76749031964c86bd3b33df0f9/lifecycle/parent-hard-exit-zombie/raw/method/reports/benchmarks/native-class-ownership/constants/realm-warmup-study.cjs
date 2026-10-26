/** @file Prospective same-window warmup experiment; historical decisions remain unchanged. */
'use strict';
const original = require('./independent-order-study.cjs');
module.exports = {
  ...original,
  revision: 'realm-warmup-study-v1',
  workerFilename: 'realm-warmup-worker.cjs',
  methodFiles: [...original.methodFiles,
    'benchmarks/constants/ownership-warmup.cjs',
    'benchmarks/ownership-operations.cjs',
    'benchmarks/ownership-warmup.cjs',
    'tests/benchmarks/worker-warmup.spec.cjs',
    'reports/benchmarks/native-class-ownership/constants/realm-warmup.cjs',
    'reports/benchmarks/native-class-ownership/constants/realm-warmup-study.cjs',
    'reports/benchmarks/native-class-ownership/realm-warmup-worker.cjs',
    'reports/benchmarks/native-class-ownership/realm-warmup-experiment.cjs',
    'reports/benchmarks/native-class-ownership/realm-warmup.spec.cjs',
    'reports/benchmarks/native-class-ownership/REALM-WARMUP-PROTOCOL.md',
  ],
};
