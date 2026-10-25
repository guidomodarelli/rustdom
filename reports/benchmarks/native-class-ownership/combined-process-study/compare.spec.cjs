/** @file Numerical contract fixtures exercise the full prospective matrix; they are not captured performance evidence. */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const model = require('./model.cjs');
const original = require('../range-collapse-study/model.cjs');
const policy = require('./constants/protocol.json');
const critical = require('./constants/critical-value.json');
const referencePolicy = require('../range-combined-study/constants/reference.json');
const { processMean, criterion, compare } = require('./compare.cjs');
const { bindSettings } = require('./settings.cjs');
const declaredIdentity = require('./constants/identity.json');

/** @param {Function} factor - Declared synthetic duration multiplier. @returns {object[]} Complete numerical fixtures, not sampler reports. */
function fixture(factor = () => 1) {
  return policy.nodes.map((node) => ({ node, entries: model.plan().map((input) => {
    const key = policy.rows[input.rowIndex];
    const separator = key.lastIndexOf('/');
    const baseline = 10 + input.position / 32;
    const duration = baseline * (input.label === 'B' ? factor({ ...input, node }) : 1);
    return { ...input, observation: { revision: policy.revision, purpose: policy.purpose,
      functionalOnly: false, node, batches: [{ label: input.label, name: key.slice(0, separator),
        rows: Number(key.slice(separator + 1)), samplesMs: Array(policy.measuredSpansPerProcess).fill(duration),
        outputHash: createHash('sha256').update(key).digest('hex') }] } };
  }) }));
}

test('keeps every original execution tuple and balances adjacent labels without modifying the historical plan', () => {
  const before = original.plan();
  const plan = model.plan();
  assert.deepEqual(plan, before);
  assert.equal(plan.length * policy.nodes.length, policy.processes);
  for (let index = 0; index < plan.length; index += policy.labels.length) {
    const pair = plan.slice(index, index + policy.labels.length);
    for (const key of ['phase', 'position', 'engine', 'rowIndex']) assert.equal(pair[0][key], pair[1][key]);
    assert.deepEqual(new Set(pair.map((input) => input.label)), new Set(policy.labels));
  }
  assert.deepEqual(original.plan(), before);
  assert.equal(critical.degreesOfFreedom, policy.pairsPerComparison - 1);
  assert.equal(critical.twoSidedCriticalValue, policy.criticalValue);
  assert.equal(policy.performanceAccepted, null); assert.equal(policy.gateReevaluated, false);
});

test('reduces all nine durations to one arithmetic process mean without overflow or input mutation', () => {
  const samples = [1, 2, 3, 4, 5, 6, 7, 8, 99];
  const before = [...samples];
  assert.equal(processMean(samples), 15);
  assert.deepEqual(samples, before);
  assert.equal(processMean(Array(9).fill(Number.MAX_VALUE)), Number.MAX_VALUE);
  assert.equal(processMean(Array(9).fill(Number.MIN_VALUE)), Number.MIN_VALUE);
  for (const invalid of [[], Array(8).fill(1), Array(10).fill(1), Array(9).fill(0),
    Array(9).fill(-1), Array(9).fill(NaN), Array(9).fill(Infinity)]) assert.throws(() => processMean(invalid));
});

test('binds immutable cloned factors without freezing legacy modules and rejects undeclared sampler changes', () => {
  const legacy = require('../constants/current-ownership.cjs');
  const before = structuredClone(legacy); const wasFrozen = Object.isFrozen(legacy);
  const bound = bindSettings(legacy, declaredIdentity);
  assert.deepEqual(legacy, before); assert.equal(Object.isFrozen(legacy), wasFrozen);
  assert.notEqual(bound.rows, legacy.rows);
  assert.equal(bound.distributionHashes.B, declaredIdentity.distributions.B);
  assert.ok(Object.isFrozen(bound) && Object.isFrozen(bound.rows) && Object.isFrozen(bound.distributionHashes));
  assert.throws(() => { bound.rows.push('undeclared/1'); }, TypeError);
  const changed = structuredClone(legacy); changed.workerCount -= 1;
  assert.throws(() => bindSettings(changed, declaredIdentity));
});

test('computes all 64 fixed criteria from 16 process pairs each without accepting the synthetic matrix', () => {
  const entries = fixture(); const before = structuredClone(entries);
  const result = compare(entries);
  assert.equal(result.results.length, policy.comparisons);
  assert.equal(result.allBudgetsMet, true);
  assert.equal(result.captureAuthenticated, false);
  assert.equal(result.performanceAccepted, null);
  assert.equal(result.gateReevaluated, false);
  for (const row of result.results) {
    assert.equal(row.processPairs.length, policy.pairsPerComparison);
    assert.equal(row.interval.pairCount, policy.pairsPerComparison);
    assert.equal(row.interval.pointRatio, 1);
    assert.deepEqual(row.interval.intervalRatio, [1, 1]);
    assert.equal(row.passesBudget, true);
  }
  assert.deepEqual(entries, before);
});

test('rejects the complete matrix when either jsdom phase exceeds the original two-percent budget', () => {
  for (const phase of policy.phases) {
    const result = compare(fixture((input) => input.engine === 'jsdom' && input.phase === phase ? 1.03 : 1));
    assert.equal(result.allBudgetsMet, false);
    assert.equal(result.results.filter((row) => !row.passesBudget).length, policy.rows.length * policy.nodes.length);
    assert.ok(result.results.filter((row) => !row.passesBudget).every((row) => row.role === 'jsdom-control' && row.phase === phase));
    assert.equal(result.performanceAccepted, null);
  }
});

test('applies symmetric five-percent Rust AA control and one-sided Rust AB regression without excluding speedups', () => {
  for (const factor of [0.94, 1.06]) {
    const result = compare(fixture((input) => input.engine === 'rustdom' && input.phase === 'AA' ? factor : 1));
    assert.equal(result.allBudgetsMet, false);
    assert.ok(result.results.filter((row) => !row.passesBudget).every((row) => row.role === 'rustdom-aa-control'));
  }
  const regression = compare(fixture((input) => input.engine === 'rustdom' && input.phase === 'AB' ? 1.06 : 1));
  assert.equal(regression.allBudgetsMet, false);
  const speedup = compare(fixture((input) => input.engine === 'rustdom' && input.phase === 'AB' ? 0.5 : 1));
  assert.equal(speedup.allBudgetsMet, true);
  assert.equal(speedup.performanceAccepted, null);
});

test('requires the whole bounded interval rather than only a favorable point estimate', () => {
  const uncertain = { status: 'bounded', pointRatio: 1, intervalRatio: [0.97, 1.03] };
  assert.equal(criterion(uncertain, 'AA', 'jsdom').passesBudget, false);
  for (const status of ['unbounded', 'not-estimable']) {
    assert.equal(criterion({ status, pointRatio: 1, intervalRatio: null }, 'AB', 'rustdom').passesBudget, false);
  }
  for (const intervalRatio of [null, [], [1], [1, NaN], [Infinity, Infinity], [2, 1], [-2, 0]]) {
    assert.equal(criterion({ status: 'bounded', intervalRatio }, 'AB', 'rustdom').passesBudget, false);
  }
  assert.equal(criterion({ status: 'bounded', intervalRatio: [0.98, 1.02] }, 'AA', 'jsdom').passesBudget, true);
  assert.equal(criterion({ status: 'bounded', intervalRatio: [0.95, 1.05] }, 'AA', 'rustdom').passesBudget, true);
  assert.equal(criterion({ status: 'bounded', intervalRatio: [0.5, 1.05] }, 'AB', 'rustdom').passesBudget, true);
});

test('retains between-process variation rather than turning 144 spans into independent process pairs', () => {
  const entries = fixture();
  for (const { entries: processes } of entries) for (const entry of processes) {
    entry.observation.batches[0].samplesMs.fill(entry.position === policy.pairsPerComparison - 1 ? (entry.label === 'A' ? 100 : 50) : 1);
  }
  const result = compare(entries);
  assert.equal(result.allBudgetsMet, false);
  for (const row of result.results) {
    assert.equal(row.interval.pairCount, 16);
    assert.ok(Math.abs(row.interval.baselineMeanMs - 115 / 16) <= referencePolicy.comparisonRelativeTolerance * (115 / 16));
    assert.ok(Math.abs(row.interval.candidateMeanMs - 65 / 16) <= referencePolicy.comparisonRelativeTolerance * (65 / 16));
    assert.equal(row.interval.status, 'unbounded');
  }
});

test('rejects missing, duplicate, reordered, historical or mismatched-output observations before numerical interpretation', () => {
  for (const corrupt of [
    (data) => data[0].entries.pop(),
    (data) => { data[0].entries[1] = structuredClone(data[0].entries[0]); },
    (data) => data[0].entries.reverse(),
    (data) => { data[0].entries[0].observation.revision = 'ownership-range-collapse-v1'; },
    (data) => { data[0].entries[0].observation.batches[0].outputHash = 'f'.repeat(64); },
    (data) => { data[0].entries[0].observation.batches[0].samplesMs.pop(); },
  ]) {
    const data = fixture(); corrupt(data); assert.throws(() => compare(data));
  }
});
