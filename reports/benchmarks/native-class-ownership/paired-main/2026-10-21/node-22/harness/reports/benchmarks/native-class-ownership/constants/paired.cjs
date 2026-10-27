/** @file Predeclared pairing and unchanged public-operation counts for the fresh-realm experiment. */
'use strict';
module.exports = {
  nodeVersion: 'v22.12.0',
  workerCount: 8,
  sizes: [250, 1000],
  operations: 1000,
  warmupRounds: 3,
  measuredRounds: 9,
  cleanupRounds: 3,
  warmupOrder: ['AB', 'BA', 'AB'],
  measuredOrder: ['AB', 'BA', 'BA', 'AB', 'BA', 'AB', 'AB', 'BA', 'AB'],
  controlBudgetPercent: 2,
  rustBudgetPercent: 5,
  workerTimeoutMs: 600_000,
};
