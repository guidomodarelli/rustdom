/** @file Public numerical contracts with explicitly synthetic scalar inputs; no fabricated capture or runtime measurements. */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { processMean, compare } = require('./compare.cjs');
const model = require('../combined-process-study/model.cjs');
const protocol = require('../combined-process-study/constants/protocol.json');
const sampler = require('./constants/sampler.json');
const count = sampler.logicalTasksPerBlock * sampler.measuredBlocksPerProcess;

/** Construct mathematical inputs only, with process-level variation shared by each declared matched pair. */
function inputs(ratio = () => 1) {
  return protocol.nodes.map((node) => ({ node, entries: model.plan().map((input) => ({ ...input,
    observation: { outputHash: 'a'.repeat(64), samplesMs: Array.from({ length: count }, (unused, index) =>
      (1 + input.position / 100 + index / 10000) * (input.label === 'B' ? ratio(input) : 1)) } })) }));
}
test('all 144 times contribute to exactly one process mean, including each first task', () => {
  const samples = Array(count).fill(1);
  for (let block = 0; block < sampler.measuredBlocksPerProcess; block++) samples[block * sampler.logicalTasksPerBlock] = 17;
  assert.ok(Math.abs(processMean(samples) - 2) < 1e-12);
});
test('missing, invalid and additional times cannot be silently discarded', () => {
  for (const samples of [Array(count - 1).fill(1), Array(count + 1).fill(1),
    [NaN, ...Array(count - 1).fill(1)], [0, ...Array(count - 1).fill(1)], [Infinity, ...Array(count - 1).fill(1)]]) {
    assert.throws(() => processMean(samples));
  }
});
test('finite large and tiny durations retain representable process means', () => {
  for (const value of [Number.MAX_VALUE / 4, Number.MIN_VALUE * count]) {
    const actual = processMean(Array(count).fill(value));
    assert.ok(actual > 0 && Number.isFinite(actual)); assert.ok(Math.abs(actual / value - 1) < 1e-12);
  }
});
test('the complete numerical matrix has 64 original criteria with 16 process pairs, and never grants acceptance', () => {
  const result = compare(inputs()); assert.equal(result.results.length, 64); assert.equal(result.allBudgetsMet, true);
  assert.equal(result.captureAuthenticated, false); assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
  for (const entry of result.results) {
    assert.equal(entry.processPairs.length, 16); assert.equal(entry.interval.pairCount, 16);
    assert.equal(entry.interval.criticalValue, protocol.criticalValue);
  }
});
test('jsdom regressions preserve the two-percent control rejection', () => {
  const result = compare(inputs((input) => input.engine === 'jsdom' ? 1.03 : 1));
  assert.equal(result.results.filter((entry) => !entry.passesBudget).length, 32);
  assert.ok(result.results.filter((entry) => entry.engine === 'jsdom').every((entry) => !entry.passesBudget));
});
test('Rust AA keeps two-sided five-percent bounds and AB retains its original upper bound', () => {
  const result = compare(inputs((input) => input.engine === 'rustdom' ? (input.phase === 'AA' ? 0.94 : 1.06) : 1));
  assert.equal(result.results.filter((entry) => !entry.passesBudget).length, 32);
  assert.ok(result.results.filter((entry) => entry.engine === 'rustdom').every((entry) => !entry.passesBudget));
});
test('a missing or duplicated process is rejected rather than counted as an independent observation', () => {
  const missing = inputs(); missing[0].entries.pop(); assert.throws(() => compare(missing));
  const duplicate = inputs(); duplicate[0].entries[1] = duplicate[0].entries[0]; assert.throws(() => compare(duplicate));
});
test('changed public output and a missing Node are rejected', () => {
  const changed = inputs(); changed[0].entries[0].observation.outputHash = 'b'.repeat(64); assert.throws(() => compare(changed));
  assert.throws(() => compare(inputs().slice(0, 1)));
});
