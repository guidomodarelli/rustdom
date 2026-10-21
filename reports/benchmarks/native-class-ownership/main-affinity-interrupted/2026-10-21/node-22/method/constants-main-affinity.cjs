/** @file Fixed full-scope ownership comparison with affinity limited to the main thread. */
'use strict';
module.exports = {
  revision: 'main-affinity-public-v1',
  nodeVersions: ['v22.12.0', 'v24.14.1'],
  cpu: 2,
  phases: ['AA', 'AB'],
  order: ['A', 'B', 'B', 'A', 'B', 'A', 'A', 'B'],
  engines: ['jsdom', 'rustdom', 'rustdom', 'jsdom'],
  workloads: ['range-control-1000', 'range-state-lifecycle-1000', 'mutation-records-collect', 'observer-delivery-records'],
  rows: ['mutation-records-collect/100', 'mutation-records-collect/1000', 'observer-delivery-records/100',
    'observer-delivery-records/1000', 'range-control-1000/1000', 'range-control-1000/250',
    'range-state-lifecycle-1000/1000', 'range-state-lifecycle-1000/250'],
  warmupSamples: 3,
  measuredSamples: 9,
  samplesPerLabelEngine: 72,
  controlBudgetPercent: 2,
  rustBudgetPercent: 5,
  binaryHashes: {
    A: 'e178142421fa9fc4b3b30525b1fae3d7a6eac8ffb9123711d09fbc915cda1a01',
    B: '04863365060a1be4fe135880a89bdc1a289a0ae8247a0d3da922a90a9803069f',
  },
  workerTimeoutMs: 600_000,
  methodFiles: ['MAIN-AFFINITY-PROTOCOL.md', 'constants/main-affinity.cjs', 'main-affinity-worker.cjs',
    'main-affinity-experiment.cjs', 'main-affinity.spec.cjs', 'thread-worker.cjs', 'constants/thread.cjs',
    'paired-worker.cjs', 'constants/paired.cjs', '../../../scripts/memory-endpoint.cjs',
    'paired-experiment.cjs', 'constants/hosted.cjs'],
};
