/** @module range-collapse-fixture-policy Bounds finite owner observations and their subprocess. */
'use strict';
module.exports = { cycles: 6, rangesPerCycle: 32, retainedMaxRounds: 2,
  releaseMaxRounds: 64, releaseTimeoutMs: 10_000, subprocessTimeoutMs: 120_000,
  maximumOutputBytes: 16 * 1024 * 1024 };
