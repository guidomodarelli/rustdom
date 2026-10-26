/** @module ownership-seeded-pre-gc-provenance Declares separate sources without changing historical study identities. */
'use strict';
const original = require('./pre-gc-warmup-study.cjs');
module.exports = { ...original, revision: 'seeded-pre-gc-study-v1', workerFilename: 'seeded-pre-gc-worker.cjs',
  methodFiles: [...original.methodFiles,
    'reports/benchmarks/native-class-ownership/constants/seeded-pre-gc.cjs',
    'reports/benchmarks/native-class-ownership/constants/seeded-pre-gc-study.cjs',
    'reports/benchmarks/native-class-ownership/seeded-pre-gc-worker.cjs',
    'reports/benchmarks/native-class-ownership/seeded-pre-gc-experiment.cjs',
    'reports/benchmarks/native-class-ownership/seeded-pre-gc.spec.cjs',
    'reports/benchmarks/native-class-ownership/SEEDED-PRE-GC-PROTOCOL.md',
  ] };
