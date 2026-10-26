/** @file Fixes the full four-factor experiment and its complete source graph. */
'use strict';
const original = require('./single-package-study.cjs');
module.exports = {
  ...original,
  revision: 'independent-order-study-v1',
  workerFilename: 'independent-order-worker.cjs',
  methodFiles: [...original.methodFiles,
    'reports/benchmarks/native-class-ownership/constants/independent-order.cjs',
    'reports/benchmarks/native-class-ownership/constants/independent-order-study.cjs',
    'reports/benchmarks/native-class-ownership/independent-order-worker.cjs',
    'reports/benchmarks/native-class-ownership/independent-order-experiment.cjs',
    'reports/benchmarks/native-class-ownership/independent-order.spec.cjs',
    'reports/benchmarks/native-class-ownership/INDEPENDENT-ORDER-PROTOCOL.md',
    '.github/workflows/ownership-independent-order.yml',
  ],
};
