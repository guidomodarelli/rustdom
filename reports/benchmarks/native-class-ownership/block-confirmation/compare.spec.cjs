/** @module ownership-confirmation-contracts Synthetic scalar contracts, not scientific samples or runtime qualification. */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const { criteria, schedule, population } = require('./calendar.cjs');
const { compareCriterion, compare } = require('./compare.cjs');
const design = require('./constants/design.json');
const original = require('../combined-process-study/model.cjs');
const protocol = require('../combined-process-study/constants/protocol.json');

/** @param {object} criterion - One declared criterion. @param {number} ratio - Deliberate synthetic effect. @returns {object[]} Synthetic scalar observations only. */
function fixture(criterion, ratio = 1) {
  return schedule(criterion.criterionId).processes.map((input) => {
    const baseline = 100 + input.factor / 10 + input.block / 100;
    const contrast = input.block % 2 === 0 ? 0.1 : -0.1;
    return { revision: design.revision, mode: 'capture', complete: true,
      processId: input.processId, hostId: 'synthetic-host-' + criterion.ordinal,
      meanMs: input.label === 'A' ? baseline : baseline * ratio + contrast,
      measuredTaskCount: 144, warmupTaskCount: 48,
      outputHash: createHash('sha256').update(criterion.row).digest('hex'),
      startMonotonicMs: input.ordinal * 2, endMonotonicMs: input.ordinal * 2 + 1 };
  });
}

test('full 64-criterion calendar preserves every original factor, copy lead, seed and complete cyclic squares', () => {
  const old = original.plan();
  const matrix = criteria();
  assert.equal(matrix.length, 64);
  assert.equal(new Set(matrix.map((entry) => entry.criterionId)).size, 64);
  for (const criterion of matrix) {
    const planned = schedule(criterion.criterionId);
    assert.equal(planned.processes.length, criterion.engine === 'jsdom' ? 1024 : 512);
    assert.equal(new Set(planned.processes.map((input) => input.processId)).size, planned.processes.length);
    for (let block = 0; block < criterion.blocks; block += 1) {
      const inputs = planned.processes.filter((input) => input.block === block);
      assert.equal(inputs.length, 32);
      assert.equal(new Set(inputs.map((input) => input.factor)).size, 16);
      for (let slot = 0; slot < 16; slot += 1) {
        const factor = (slot + block) % 16;
        const expected = old.filter((input) => input.phase === criterion.phase && input.engine === criterion.engine &&
          input.rowIndex === criterion.rowIndex && input.position === factor);
        assert.deepEqual(inputs.filter((input) => input.slot === slot).map((input) => ({
          phase: input.phase, engine: input.engine, position: input.position, label: input.label, rowIndex: input.rowIndex })), expected);
        assert.ok(inputs.filter((input) => input.slot === slot).every((input) => input.seed === protocol.v8Seeds[factor]));
      }
    }
  }
  assert.deepEqual(population(), { criteria: 64, processes: 49152, measuredDurations: 7077888,
    warmupDurations: 2359296, windows: 589824, documents: 589824, cleanupRounds: 147456,
    requiredFinalClearStates: 98304, parentSnapshots: 192 });
});

test('reduces factors equally to 32 or 16 block pairs, not 1024 or 512 independent observations', () => {
  for (const engine of ['jsdom', 'rustdom']) {
    const criterion = criteria().find((entry) => entry.engine === engine);
    const result = compareCriterion(criterion.criterionId, fixture(criterion));
    const blocks = engine === 'jsdom' ? 32 : 16;
    assert.equal(result.blockCount, blocks); assert.equal(result.interval.pairCount, blocks);
    assert.equal(result.degreesOfFreedom, blocks - 1);
    assert.ok(Math.abs(result.blockMeans[0].baselineMeanMs - 100.75) < 1e-12);
    assert.ok(Math.abs(result.blockMeans[0].candidateMeanMs - 100.85) < 1e-12);
    assert.equal(result.passesBudget, true);
    assert.equal(result.captureAuthenticated, false); assert.equal(result.performanceAccepted, null);
    assert.equal(result.gateReevaluated, false); assert.equal(result.independenceEstablished, false);
  }
});

test('preserves jsdom ±2%, Rust AA ±5% and Rust AB upper +5%, including improvements', () => {
  const cases = [
    ['jsdom', 'AA', 1.03, false], ['jsdom', 'AB', 0.97, false],
    ['rustdom', 'AA', 1.06, false], ['rustdom', 'AA', 0.94, false],
    ['rustdom', 'AB', 1.06, false], ['rustdom', 'AB', 0.80, true],
    ['rustdom', 'AA', 1.04, true], ['jsdom', 'AB', 1.01, true]
  ];
  for (const [engine, phase, ratio, passes] of cases) {
    const criterion = criteria().find((entry) => entry.engine === engine && entry.phase === phase);
    assert.equal(compareCriterion(criterion.criterionId, fixture(criterion, ratio)).passesBudget, passes);
  }
});

test('rejects partials, foreign method data, functional data, broken chronology, host changes and incorrect public output', () => {
  const criterion = criteria()[0];
  const originalData = fixture(criterion);
  const mutations = [
    (data) => data.pop(), (data) => { data[1] = data[0]; },
    (data) => { data[1].revision = 'ownership-jsdom-block-pilot-design-v2'; },
    (data) => { data[1].mode = 'functional'; }, (data) => { data[1].complete = false; },
    (data) => { data[1].hostId = 'different-host'; }, (data) => { data[1].hostId = ''; },
    (data) => { data[1].meanMs = NaN; }, (data) => { data[1].meanMs = 0; },
    (data) => { data[1].measuredTaskCount = 143; }, (data) => { data[1].warmupTaskCount = 0; },
    (data) => { data[1].startMonotonicMs = data[0].startMonotonicMs; },
    (data) => { data[1].endMonotonicMs = data[1].startMonotonicMs; },
    (data) => { data[1].outputHash = '0'.repeat(64); }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(originalData); mutate(changed);
    assert.throws(() => compareCriterion(criterion.criterionId, changed));
  }
  assert.throws(() => schedule('v24.14.1/AB/rustdom/undeclared/100'));
});

test('full numerical conjunction retains all 64 controls and candidates, never authenticates or promotes a synthetic pass', () => {
  const matrix = criteria().map((entry) => ({ criterionId: entry.criterionId, observations: fixture(entry) }));
  const result = compare(matrix);
  assert.equal(result.results.length, 64); assert.equal(result.allBudgetsMet, true);
  assert.equal(result.captureAuthenticated, false); assert.equal(result.performanceAccepted, null);
  assert.equal(result.gateReevaluated, false); assert.equal(result.simultaneousCoverageClaimed, false);
  assert.throws(() => compare(matrix.slice(1)), /complete ordered/);
  const adverse = structuredClone(matrix);
  const criterion = criteria().find((entry) => entry.node === 'v24.14.1' && entry.phase === 'AB' && entry.engine === 'rustdom');
  adverse[criterion.ordinal].observations = fixture(criterion, 1.06);
  const rejected = compare(adverse);
  assert.equal(rejected.allBudgetsMet, false);
  assert.equal(rejected.results.filter((entry) => !entry.passesBudget).length, 1);
  assert.equal(rejected.performanceAccepted, null);
  const wrongOutput = structuredClone(matrix);
  for (const observation of wrongOutput[1].observations) observation.outputHash = '0'.repeat(64);
  assert.throws(() => compare(wrongOutput), /across engines, phases or SDKs/);
});

module.exports = { fixture };
