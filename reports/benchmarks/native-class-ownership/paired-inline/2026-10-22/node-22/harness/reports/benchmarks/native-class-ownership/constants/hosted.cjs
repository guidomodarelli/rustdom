/** @file Fixed, predeclared configuration for the independent Linux ownership experiment. */
'use strict';
module.exports = Object.freeze({
  nodeVersion: 'v22.12.0',
  baselineCommit: '3d37f89976a48203e80cc5c435e099267f4ce346',
  sourceHashes: {
    A: '67523bf38c8bfd32286618de24cee952b684f32fd91a322c407f7111cd73be3f',
    B: '8332276799c5ccc18c7a45a5136a856b039736597d5e104e22f074f8e23f1ddd',
  },
  order: ['A', 'B', 'B', 'A', 'B', 'A', 'A', 'B'],
  rows: ['range-control-1000/1000', 'range-control-1000/250'],
  engines: ['jsdom', 'rustdom', 'rustdom', 'jsdom'],
  workload: 'range-control-1000',
  warmupSamples: 3,
  measuredSamples: 9,
  samplesPerLabelEngine: 72,
  controlBudgetPercent: 2,
  rustBudgetPercent: 5,
});
