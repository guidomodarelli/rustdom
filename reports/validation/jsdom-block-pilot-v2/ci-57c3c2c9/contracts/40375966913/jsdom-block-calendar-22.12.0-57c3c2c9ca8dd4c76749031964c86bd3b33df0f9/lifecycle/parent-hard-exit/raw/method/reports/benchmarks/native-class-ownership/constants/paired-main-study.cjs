/** @file Study orchestration and frozen source scope, separate from the validated sampler configuration. */
'use strict';
module.exports = {
  revision: 'paired-main-study-v1',
  workerTimeoutMs: 600_000,
  methodFiles: [
    'reports/benchmarks/native-class-ownership/PAIRED-MAIN-PROTOCOL.md',
    'reports/benchmarks/native-class-ownership/paired-main-experiment.cjs',
    'reports/benchmarks/native-class-ownership/paired-main-experiment.spec.cjs',
    'reports/benchmarks/native-class-ownership/paired-main-worker.cjs',
    'reports/benchmarks/native-class-ownership/paired-main.spec.cjs',
    'reports/benchmarks/native-class-ownership/balanced-worker.cjs',
    'reports/benchmarks/native-class-ownership/paired-worker.cjs',
    'reports/benchmarks/native-class-ownership/paired-experiment.cjs',
    'reports/benchmarks/native-class-ownership/thread-worker.cjs',
    'reports/benchmarks/native-class-ownership/main-affinity-experiment.cjs',
    ...['paired-main-study', 'paired-main', 'main-affinity', 'paired', 'balanced', 'thread', 'hosted']
      .map((name) => `reports/benchmarks/native-class-ownership/constants/${name}.cjs`),
  ],
};
