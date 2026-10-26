'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { calendar, summarize } = require('./blocks.cjs');
const original = require('../../combined-process-study/model.cjs');

/** Scalar synthetic examples exercise calendar/aggregation only, never supply performance evidence. */
function observations(shard, baseline = (block) => 100 + block, candidate = (block) => 200 + 2 * block) {
  return shard.processes.map((input) => ({ processId: input.processId, complete: true, hostId: 'synthetic-host',
    meanMs: (input.label === 'A' ? baseline : candidate)(input.block),
    measuredTaskCount: 144, warmupTaskCount: 48,
    startMonotonicMs: input.ordinal * 2, endMonotonicMs: input.ordinal * 2 + 1 }));
}

test('full calendar preserves every original factor pair and balances each temporal slot', () => {
  const shards = calendar(); const source = original.plan();
  assert.equal(shards.length, 32); assert.equal(shards.flatMap((shard) => shard.processes).length, 16384);
  const ids = new Set();
  for (const shard of shards) {
    assert.equal(shard.engine, 'jsdom'); assert.equal(shard.processes.length, 512);
    for (let block = 0; block < 16; block += 1) {
      const inputs = shard.processes.filter((input) => input.block === block);
      assert.equal(inputs.length, 32);
      assert.equal(new Set(inputs.map((input) => input.factor)).size, 16);
      assert.equal(inputs.filter((input, index) => index % 2 === 0 && input.label === 'A').length, 8);
      for (let slot = 0; slot < 16; slot += 1) {
        const pair = inputs.filter((input) => input.slot === slot);
        const reference = source.filter((input) => input.engine === 'jsdom' && input.phase === shard.phase &&
          input.rowIndex === shard.rowIndex && input.position === pair[0].factor);
        assert.deepEqual(pair.map((input) => input.label), reference.map((input) => input.label));
        assert.ok(pair.every((input) => input.seed === input.factor + 1 && input.position === input.factor));
      }
    }
    for (let slot = 0; slot < 16; slot += 1) {
      assert.equal(new Set(shard.processes.filter((input) => input.slot === slot).map((input) => input.factor)).size, 16);
    }
    for (const input of shard.processes) { assert.equal(ids.has(input.processId), false); ids.add(input.processId); }
  }
});

test('summaries preserve all complete block means, covariance, fixed contrasts and null acceptance', () => {
  const shard = calendar()[0]; const result = summarize(shard.criterionId, observations(shard));
  assert.equal(result.blockMeans.length, 16); assert.equal(result.processCount, 512);
  assert.equal(result.baselineMeanMs, 107.5); assert.equal(result.candidateMeanMs, 215);
  assert.equal(result.ratioOfArithmeticMeans, 2);
  assert.equal(result.sampleCovarianceMsSquared, 2 * 16 * 17 / 12);
  const neutral = result.contrasts.find((contrast) => contrast.fixedRatio === 1);
  assert.equal(neutral.meanMs, 107.5); assert.equal(neutral.sampleVarianceMsSquared, 16 * 17 / 12);
  assert.equal(neutral.valuesMs.length, 16);
  assert.deepEqual(result.contrasts.map((contrast) => contrast.fixedRatio), [0.98, 1, 1.02]);
  assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
  assert.equal(result.inputAuthenticationPerformed, false); assert.equal(result.confidenceIntervalsComputed, false);
  assert.equal(result.independenceEstablished, false);
});

test('ratio of arithmetic block means differs from average of individual ratios', () => {
  const shard = calendar()[0];
  const result = summarize(shard.criterionId, observations(shard, (block) => block + 1, () => 10));
  assert.equal(result.ratioOfArithmeticMeans, 10 / 8.5);
  const averageOfRatios = result.blockMeans.reduce((total, block) => total + block.candidateMeanMs / block.baselineMeanMs, 0) / 16;
  assert.ok(Math.abs(result.ratioOfArithmeticMeans - averageOfRatios) > 0.1);
});

test('partial, duplicated, reordered, incomplete and cross-host inputs cannot form a criterion', () => {
  const shard = calendar()[0]; const valid = observations(shard);
  assert.throws(() => summarize('undeclared', valid), /undeclared/);
  assert.throws(() => summarize(shard.criterionId, valid.slice(1)), /incomplete criterion/);
  const mutations = [
    (data) => { data[1] = { ...data[0] }; },
    (data) => { [data[0], data[1]] = [data[1], data[0]]; },
    (data) => { data[0].complete = false; },
    (data) => { data.at(-1).hostId = 'other-host'; },
    (data) => { data[0].warmupTaskCount = 47; },
    (data) => { data[0].measuredTaskCount = 143; },
    (data) => { data[1].startMonotonicMs = data[0].startMonotonicMs; }
  ];
  for (const mutate of mutations) { const data = structuredClone(valid); mutate(data); assert.throws(() => summarize(shard.criterionId, data)); }
});

test('non-finite, non-positive and overflowing durations are rejected rather than clipped', () => {
  const shard = calendar()[0];
  for (const value of [0, -1, NaN, Infinity, Number.MAX_VALUE]) {
    const data = observations(shard, () => value);
    assert.throws(() => summarize(shard.criterionId, data));
  }
});

test('real planning CLI preserves an existing calendar and never emits measured durations', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jsdom-pilot-calendar-'));
  try {
    const output = path.join(directory, 'calendar.json');
    const command = [path.join(__dirname, 'plan.cjs'), output];
    const first = spawnSync(process.execPath, command, { encoding: 'utf8' });
    assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).processes, 16384);
    const bytes = fs.readFileSync(output); const result = JSON.parse(bytes);
    assert.equal(result.executionReady, false); assert.equal(result.scientificCaptureExecuted, false);
    assert.ok(result.shards.every((shard) => shard.processes.every((input) => !Object.hasOwn(input, 'meanMs'))));
    const second = spawnSync(process.execPath, command, { encoding: 'utf8' });
    assert.notEqual(second.status, 0); assert.match(second.stderr, /EEXIST/);
    assert.deepEqual(fs.readFileSync(output), bytes);
  } finally { fs.rmSync(directory, { recursive: true }); }
});
