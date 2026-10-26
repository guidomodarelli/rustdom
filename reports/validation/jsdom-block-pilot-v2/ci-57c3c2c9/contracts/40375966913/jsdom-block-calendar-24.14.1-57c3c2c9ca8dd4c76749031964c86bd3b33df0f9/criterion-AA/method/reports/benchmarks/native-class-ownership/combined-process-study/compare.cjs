/** @module combined-process-comparison Computes prospective criteria from one arithmetic summary per process; never authenticates or accepts a capture. */
'use strict';
const assert = require('node:assert/strict');
const { pairedInterval } = require('../range-combined-study/paired-interval.cjs');
const model = require('./model.cjs');
const policy = require('./constants/protocol.json');

/**
 * Reduce the declared repeated spans to one process observation without overflow or reweighting.
 * @param {number[]} samples - All nine positive measured durations; warmup is retained separately by the capturer.
 * @returns {number} Arithmetic process mean in the original units.
 */
function processMean(samples) {
  assert.ok(Array.isArray(samples));
  assert.equal(samples.length, policy.measuredSpansPerProcess, 'Combined comparison: incomplete process measurements');
  assert.ok(samples.every((sample) => Number.isFinite(sample) && sample > 0), 'Combined comparison: positive finite durations required');
  const scale = Math.max(...samples);
  const result = scale * (samples.reduce((sum, sample) => sum + sample / scale, 0) / samples.length);
  assert.ok(Number.isFinite(result) && result > 0, 'Combined comparison: unrepresentable process mean');
  return result;
}

/** @param {object} interval - Current numerical result. @param {string} phase - Fixed AA/AB phase. @param {string} engine - Real engine label. @returns {object} Conservative fixed-budget criterion, never an acceptance decision. */
function criterion(interval, phase, engine) {
  assert.ok(policy.phases.includes(phase) && policy.engines.includes(engine));
  assert.deepEqual(policy.aaJsdomBounds, [1 - policy.controlBudgetPercent / 100, 1 + policy.controlBudgetPercent / 100]);
  assert.deepEqual(policy.abJsdomBounds, policy.aaJsdomBounds);
  assert.deepEqual(policy.aaRustBounds, [1 - policy.rustBudgetPercent / 100, 1 + policy.rustBudgetPercent / 100]);
  assert.equal(policy.abRustUpperBound, policy.aaRustBounds[1]);
  const bounds = engine === 'jsdom' ? policy.aaJsdomBounds : phase === 'AA' ? policy.aaRustBounds : [null, policy.abRustUpperBound];
  const comparable = interval.status === 'bounded' && Array.isArray(interval.intervalRatio) &&
    interval.intervalRatio.length === 2 && interval.intervalRatio.every(Number.isFinite) &&
    interval.intervalRatio[0] <= interval.intervalRatio[1] && interval.intervalRatio[1] > 0;
  const fits = comparable && (bounds[0] === null || interval.intervalRatio[0] >= bounds[0]) && interval.intervalRatio[1] <= bounds[1];
  return { role: engine === 'jsdom' ? 'jsdom-control' : phase === 'AA' ? 'rustdom-aa-control' : 'rustdom-ab-candidate',
    ratioBounds: [...bounds], passesBudget: fits,
    reason: !comparable ? (interval.status === 'bounded' ? 'invalid-bounded-interval' : interval.status) :
      fits ? 'whole-interval-within-budget' : 'whole-interval-not-within-budget' };
}

/**
 * Compare a complete declared matrix of previously behavior-validated observations.
 * Raw provenance, processes, outputs and resources still require a separate authenticated replay.
 * Synthetic contract fixtures can exercise these numerical criteria; this function always leaves acceptance null.
 * @param {{node:string,entries:object[]}[]} entriesByNode - Exactly one scalar view per scheduled process and Node.
 * @returns {object} All 64 results, per-process means and intervals, with no historical or new-study acceptance.
 */
function compare(entriesByNode) {
  assert.deepEqual(entriesByNode.map((entry) => entry.node), policy.nodes);
  const expected = model.plan();
  const results = [];
  for (const { node, entries } of entriesByNode) {
    assert.deepEqual(entries.map(({ observation, ...input }) => input), expected, 'Combined comparison: incomplete, duplicate or reordered process tuples');
    for (const { observation } of entries) {
      assert.equal(observation.revision, policy.revision);
      assert.equal(observation.purpose, policy.purpose);
      assert.equal(observation.functionalOnly, false);
      assert.equal(observation.node, node);
      assert.equal(observation.batches.length, 1);
    }
    for (const [rowIndex, key] of policy.rows.entries()) {
      const outputHashes = new Set();
      for (const phase of policy.phases) for (const engine of policy.engines) {
        const matching = entries.filter((entry) => entry.phase === phase && entry.engine === engine && entry.rowIndex === rowIndex);
        assert.equal(matching.length, policy.pairsPerComparison * policy.labels.length);
        const pairs = Array.from({ length: policy.pairsPerComparison }, (unused, position) => {
          const group = matching.filter((entry) => entry.position === position);
          assert.equal(group.length, policy.labels.length);
          const means = {};
          for (const label of policy.labels) {
            const entry = group.find((item) => item.label === label); assert.ok(entry);
            const batch = entry.observation.batches[0];
            assert.equal(batch.label, label);
            assert.equal(key, batch.name + '/' + batch.rows);
            assert.match(batch.outputHash, /^[a-f0-9]{64}$/);
            outputHashes.add(batch.outputHash);
            means[label] = processMean(batch.samplesMs);
          }
          return { baselineMeanMs: means.A, candidateMeanMs: means.B };
        });
        const interval = pairedInterval(pairs, policy.criticalValue);
        results.push({ node, phase, engine, key, processPairs: pairs, interval, ...criterion(interval, phase, engine) });
      }
      assert.equal(outputHashes.size, 1, 'Combined comparison: public output differs across phase, engine or label');
    }
  }
  assert.equal(results.length, policy.comparisons);
  return { revision: policy.revision, confidenceLevel: policy.confidenceLevel,
    confidenceScope: 'pointwise-per-comparison-not-simultaneous-coverage', processUnit: 'one-arithmetic-mean-per-process',
    results, allBudgetsMet: results.every((result) => result.passesBudget),
    captureAuthenticated: false, performanceAccepted: null, gateReevaluated: false };
}
module.exports = { processMean, criterion, compare };
