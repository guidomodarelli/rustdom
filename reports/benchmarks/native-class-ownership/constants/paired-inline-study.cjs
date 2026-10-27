/** @file Frozen identities and scope for the one planned inline-candidate comparison. */
'use strict';
const original = require('./paired-main-study.cjs');
const { sourceHashes } = require('./hosted.cjs');
module.exports = {
  revision: 'paired-main-inline-study-v1',
  workerTimeoutMs: original.workerTimeoutMs,
  workerFilename: 'paired-inline-worker.cjs',
  sourceHashes: { A: sourceHashes.A, B: '0d67e1d821c70371ca1b82817870b7ad6a053f534161ae9096591d7199d0b947' },
  methodFiles: [...original.methodFiles,
    'reports/benchmarks/native-class-ownership/PAIRED-INLINE-PROTOCOL.md',
    'reports/benchmarks/native-class-ownership/paired-inline-worker.cjs',
    'reports/benchmarks/native-class-ownership/paired-inline-experiment.cjs',
    'reports/benchmarks/native-class-ownership/paired-inline.spec.cjs',
    'reports/benchmarks/native-class-ownership/paired-study-configuration.spec.cjs',
    'reports/benchmarks/native-class-ownership/constants/paired-inline.cjs',
    'reports/benchmarks/native-class-ownership/constants/paired-inline-study.cjs',
  ],
};
