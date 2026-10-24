/** @file Freeze two matched historical cases with all eight public workloads; never grant acceptance. */
'use strict';
const original = require('./runner-sharing.cjs');
module.exports = {
  ...original,
  revision: 'runner-sharing-complete-context-v1',
  workload: null,
  // Positions differ only in batch order; both include a previously negative and positive order observation.
  selectedPositions: [0, 4],
  files: { ...original.files, worker: 'runner-sharing-context-worker.cjs' },
  methodFiles: [...original.methodFiles,
    'reports/benchmarks/native-class-ownership/RUNNER-SHARING-CONTEXT-PROTOCOL.md',
    'reports/benchmarks/native-class-ownership/constants/runner-sharing-context.cjs',
    'reports/benchmarks/native-class-ownership/runner-sharing-context-worker.cjs',
    'reports/benchmarks/native-class-ownership/runner-sharing-context-diagnostic.cjs',
    'reports/benchmarks/native-class-ownership/runner-sharing-context.spec.cjs'],
};
