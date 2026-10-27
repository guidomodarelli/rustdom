/** @file Declares one hosted sequence using an authenticated preparation and the existing full sampler. */
'use strict';
const original = require('./paired-inline-study.cjs');
const preparation = require('./hosted-build.cjs');
const receipt = require('../../../validation/native-class-ownership/hosted-build-ci/39720077911/receipt.json');
module.exports = {
  revision: 'hosted-main-inline-study-v1',
  workerTimeoutMs: original.workerTimeoutMs,
  workerFilename: 'hosted-main-worker.cjs',
  sourceHashes: original.sourceHashes,
  preparation: {
    runId: receipt.runId,
    artifactId: receipt.artifactId,
    headSha: receipt.headSha,
    artifactSha256: receipt.artifactSha256,
    tarSha256: receipt.tarSha256,
    identity: receipt.identity,
  },
  methodFiles: [...new Set([...original.methodFiles, ...preparation.preparationFiles,
    'reports/validation/native-class-ownership/hosted-build-ci/39720077911/receipt.json',
    'reports/benchmarks/native-class-ownership/HOSTED-MAIN-PROTOCOL.md',
    'reports/benchmarks/native-class-ownership/constants/hosted-main.cjs',
    'reports/benchmarks/native-class-ownership/constants/hosted-main-study.cjs',
    'reports/benchmarks/native-class-ownership/hosted-main-experiment.cjs',
    'reports/benchmarks/native-class-ownership/hosted-main-worker.cjs',
    'reports/benchmarks/native-class-ownership/hosted-main.spec.cjs',
    '.github/workflows/ownership-hosted-main.yml',
  ])],
};
