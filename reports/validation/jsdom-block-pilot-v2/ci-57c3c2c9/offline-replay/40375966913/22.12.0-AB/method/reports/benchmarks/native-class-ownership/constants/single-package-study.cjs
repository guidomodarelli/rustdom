/** @file Declares the source graph of the separate-process hypothesis before measuring. */
'use strict';
const original = require('./hosted-main-study.cjs');
module.exports = {
  ...original,
  revision: 'single-package-study-v1',
  workerFilename: 'single-package-worker.cjs',
  methodFiles: [...original.methodFiles,
    'reports/benchmarks/native-class-ownership/constants/single-package.cjs',
    'reports/benchmarks/native-class-ownership/constants/single-package-study.cjs',
    'reports/benchmarks/native-class-ownership/single-package-worker.cjs',
    'reports/benchmarks/native-class-ownership/single-package-experiment.cjs',
    'reports/benchmarks/native-class-ownership/single-package.spec.cjs',
    'reports/benchmarks/native-class-ownership/SINGLE-PACKAGE-PROTOCOL.md',
    '.github/workflows/ownership-single-package.yml',
  ],
};
