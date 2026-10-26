/** @file Fixed full-workload paired sampler with main-thread affinity and independent package instances. */
'use strict';
const publicMethod = require('./main-affinity.cjs');
module.exports = {
  revision: 'paired-main-public-v1',
  nodeVersions: publicMethod.nodeVersions,
  cpu: publicMethod.cpu,
  phases: publicMethod.phases,
  engines: ['jsdom', 'rustdom'],
  workerCount: 8,
  cleanupRounds: 3,
  requiredClearRounds: 2,
  warmupSamples: publicMethod.warmupSamples,
  measuredSamples: publicMethod.measuredSamples,
  rows: publicMethod.rows,
  distributionParts: publicMethod.distributionParts,
  distributionHashes: { A0: publicMethod.distributionHashes.A, A1: publicMethod.distributionHashes.A,
    B: publicMethod.distributionHashes.B,
    J0: 'c458b9e9ca38d2f0af6fdf0d7277f7d6499c723ffab361216bfdc119386d9078',
    J1: 'c458b9e9ca38d2f0af6fdf0d7277f7d6499c723ffab361216bfdc119386d9078' },
  controlBudgetPercent: publicMethod.controlBudgetPercent,
  rustBudgetPercent: publicMethod.rustBudgetPercent,
};
