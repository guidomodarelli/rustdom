/** @module owner-batch-comparison Reduces every timed task to one process mean; numerical results alone never authenticate a capture. */
'use strict';
const assert = require('node:assert/strict');
const model = require('../combined-process-study/model.cjs');
const original = require('../combined-process-study/constants/protocol.json');
const { criterion } = require('../combined-process-study/compare.cjs');
const { pairedInterval } = require('../range-combined-study/paired-interval.cjs');
const sampler = require('./constants/sampler.json');
const worker = require('./constants/worker.json');

/** @param {number[]} samples - All 144 measured times, including each first logical task. @returns {number} One equally weighted process mean; no task becomes an independent process. */
function processMean(samples) {
  assert.ok(Array.isArray(samples));
  assert.equal(samples.length, sampler.logicalTasksPerBlock * sampler.measuredBlocksPerProcess,
    'Owner batch comparison: incomplete measured task population');
  assert.ok(samples.every((sample) => Number.isFinite(sample) && sample > 0),
    'Owner batch comparison: every measured task must be positive and finite');
  const scale = Math.max(...samples);
  const result = scale * (samples.reduce((total, sample) => total + sample / scale, 0) / samples.length);
  assert.ok(Number.isFinite(result) && result > 0, 'Owner batch comparison: unrepresentable process mean');
  return result;
}

/**
 * Apply the original 64 pointwise Fieller criteria to the new process means, without changing independent units or budgets.
 * @param {{node:string,entries:object[]}[]} entriesByNode - Validated scalar views; transport/behavior/resource authentication is separate.
 * @returns {object} Complete numerical decision with acceptance deliberately null until an authenticated integral replay.
 */
function compare(entriesByNode) {
  assert.deepEqual(entriesByNode.map((entry) => entry.node), original.nodes);
  assert.deepEqual(sampler.rows, original.rows);
  const expected = model.plan(); const results = [];
  for (const { node, entries } of entriesByNode) {
    assert.deepEqual(entries.map(({ observation, ...input }) => input), expected,
      'Owner batch comparison: incomplete, duplicated or reordered process schedule');
    for (const [rowIndex, key] of sampler.rows.entries()) {
      const outputHashes = new Set();
      for (const phase of original.phases) for (const engine of original.engines) {
        const matching = entries.filter((entry) => entry.rowIndex === rowIndex && entry.phase === phase && entry.engine === engine);
        assert.equal(matching.length, original.pairsPerComparison * original.labels.length);
        const pairs = Array.from({ length: original.pairsPerComparison }, (unused, position) => {
          const means = {};
          for (const label of original.labels) {
            const candidates = matching.filter((entry) => entry.position === position && entry.label === label);
            assert.equal(candidates.length, 1);
            const record = candidates[0].observation;
            assert.match(record.outputHash, /^[a-f0-9]{64}$/);
            outputHashes.add(record.outputHash); means[label] = processMean(record.samplesMs);
          }
          return { baselineMeanMs: means.A, candidateMeanMs: means.B };
        });
        const interval = pairedInterval(pairs, original.criticalValue);
        results.push({ node, phase, engine, key, processPairs: pairs, interval, ...criterion(interval, phase, engine) });
      }
      assert.equal(outputHashes.size, 1, 'Owner batch comparison: public output changed between treatments');
    }
  }
  assert.equal(results.length, original.comparisons);
  return { revision: worker.revision, processUnit: 'one-arithmetic-mean-per-process',
    measuredTasksPerProcess: sampler.logicalTasksPerBlock * sampler.measuredBlocksPerProcess,
    confidenceLevel: original.confidenceLevel, confidenceScope: 'pointwise-per-comparison-not-simultaneous-coverage',
    results, allBudgetsMet: results.every((entry) => entry.passesBudget), captureAuthenticated: false,
    performanceAccepted: null, gateReevaluated: false };
}
module.exports = { processMean, compare };
