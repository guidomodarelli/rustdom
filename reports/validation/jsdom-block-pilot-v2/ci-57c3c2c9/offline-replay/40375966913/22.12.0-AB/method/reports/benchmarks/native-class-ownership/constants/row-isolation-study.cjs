/** @module ownership-row-isolation-provenance Keeps separate prospective evidence for workload process isolation. */
'use strict';
const original = require('./seeded-pre-gc-study.cjs');
module.exports = { ...original, revision: 'row-isolation-study-v1', workerFilename: 'row-isolation-worker.cjs',
  methodFiles: [...original.methodFiles,
    'reports/benchmarks/native-class-ownership/constants/row-isolation.cjs',
    'reports/benchmarks/native-class-ownership/constants/row-isolation-study.cjs',
    'reports/benchmarks/native-class-ownership/row-isolation-worker.cjs',
    'reports/benchmarks/native-class-ownership/row-isolation-experiment.cjs',
    'reports/benchmarks/native-class-ownership/row-isolation.spec.cjs',
    'reports/benchmarks/native-class-ownership/ROW-ISOLATION-PROTOCOL.md',
  ] };
