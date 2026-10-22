/** @file Independent single-package schedule with a prospectively declared pre-warmup GC boundary. */
'use strict';
const original = require('./realm-warmup-study.cjs');
module.exports = { ...original, revision: 'pre-gc-warmup-study-v1', workerFilename: 'pre-gc-warmup-worker.cjs',
  methodFiles: [...original.methodFiles,
    'reports/benchmarks/native-class-ownership/constants/pre-gc-warmup.cjs',
    'reports/benchmarks/native-class-ownership/constants/pre-gc-warmup-study.cjs',
    'reports/benchmarks/native-class-ownership/pre-gc-warmup-worker.cjs',
    'reports/benchmarks/native-class-ownership/pre-gc-warmup-experiment.cjs',
    'reports/benchmarks/native-class-ownership/pre-gc-warmup.spec.cjs',
    'reports/benchmarks/native-class-ownership/PRE-GC-WARMUP-PROTOCOL.md',
  ] };
