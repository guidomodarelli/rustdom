/** @file Fixed factorial design for diagnosing module-context bias using identical packages only. */
'use strict';
module.exports = {
  revision: 'balanced-aa-v1',
  factors: ['load-order', 'physical-assignment', 'sample-order'],
  methodFiles: [
    'reports/benchmarks/native-class-ownership/balanced-experiment.cjs',
    'reports/benchmarks/native-class-ownership/balanced-worker.cjs',
    'reports/benchmarks/native-class-ownership/constants/balanced.cjs',
    'reports/benchmarks/native-class-ownership/BALANCED-PROTOCOL.md',
    'reports/benchmarks/native-class-ownership/paired-worker.cjs',
    'reports/benchmarks/native-class-ownership/paired-experiment.cjs',
    'reports/benchmarks/native-class-ownership/constants/paired.cjs',
    'reports/benchmarks/native-class-ownership/constants/hosted.cjs',
    'scripts/memory-endpoint.cjs',
  ],
};
