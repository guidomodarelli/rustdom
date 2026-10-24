/** @module ownership-background-affinity-provenance Keeps the consumed row-isolation method immutable. */
'use strict';
const original = require('./row-isolation-study.cjs');
module.exports = { ...original, revision: 'background-affinity-study-v1', workerFilename: 'background-affinity-worker.cjs',
  qualificationSynchronizationTimeoutMs: 10000, qualificationPollIntervalMs: 10,
  methodFiles: [...original.methodFiles,
    'reports/benchmarks/native-class-ownership/constants/background-affinity.cjs',
    'reports/benchmarks/native-class-ownership/constants/background-affinity-study.cjs',
    'reports/benchmarks/native-class-ownership/background-affinity.cjs',
    'reports/benchmarks/native-class-ownership/background-affinity-worker.cjs',
    'reports/benchmarks/native-class-ownership/background-affinity-experiment.cjs',
    'reports/benchmarks/native-class-ownership/background-affinity.spec.cjs',
    'reports/benchmarks/native-class-ownership/BACKGROUND-AFFINITY-PROTOCOL.md',
  ] };
