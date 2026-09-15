/** @file Verifies native abort plans, safe identity boundaries and ownership release. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { NativeAbortState, NativeTree } = require('../dist/native.cjs');

test('should expose ordered native composition and reject invalid identities before mutation', () => {
  const first = new NativeAbortState(); const second = new NativeAbortState(); const combined = new NativeAbortState();
  assert.deepEqual(combined.initializeAny([first.id, second.id, first.id]), { reasonSource: 0, sources: [first.id, second.id], sourceInputs: [0, 1] });
  const nested = new NativeAbortState();
  assert.deepEqual(nested.initializeAny([combined.id, second.id]), { reasonSource: 0, sources: [first.id, second.id], sourceInputs: [0, 0] });
  const before = first.graphStatistics();
  const invalidStates = [];
  assert.throws(() => first.markDependents(), { code: 'InvalidArg' });
  for (const invalid of [0, -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER]) {
    const fresh = new NativeAbortState(); const snapshot = fresh.graphStatistics();
    invalidStates.push(fresh);
    assert.throws(() => fresh.initializeAny([first.id, invalid]), { code: 'InvalidArg' });
    assert.deepEqual(fresh.graphStatistics(), snapshot); assert.equal(fresh.aborted, false); assert.equal(fresh.dependent, false);
  }
  assert.equal(first.graphStatistics().links, before.links);
  first.aborted = true; assert.deepEqual(first.markDependents(), [combined.id, nested.id]);
  assert.equal(combined.aborted, true); assert.equal(nested.aborted, true);
  second.aborted = true; assert.deepEqual(second.markDependents(), []);
  assert.deepEqual(combined.sourceIds(), [first.id, second.id]);
  combined.detachSources(); combined.detachSources();
  assert.deepEqual(combined.sourceIds(), []);
  assert.deepEqual(nested.sourceIds(), [first.id, second.id]);
  assert.throws(() => combined.initializeAny([]), { code: 'InvalidArg' });
  for (const foreign of [{}, new NativeTree(), Object.create(NativeAbortState.prototype)]) {
    assert.throws(() => Reflect.apply(first.markDependents, foreign, []), { name: 'TypeError' });
  }
});

test('should keep live native algorithm order and independent iteration cursors', () => {
  const state = new NativeAbortState(); const first = state.addAlgorithm(0); const removed = state.addAlgorithm(0);
  assert.equal(state.addAlgorithm(first), first); assert.equal(state.nextAlgorithm(0), first);
  assert.equal(state.removeAlgorithm(removed), true); const last = state.addAlgorithm(0); assert.ok(last > removed);
  assert.equal(state.nextAlgorithm(first), last); assert.equal(state.nextAlgorithm(0), first);
  state.aborted = true; assert.equal(state.addAlgorithm(0), 0);
  state.clearAlgorithms(); assert.equal(state.nextAlgorithm(0), 0);
  assert.throws(() => state.nextAlgorithm(-1), { code: 'InvalidArg' });
});

test('should collect strong signal graphs, reasons and callbacks while native states remain retained', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/abort-memory.cjs'], {
    encoding: 'utf8', timeout: 90_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});

test('should release discarded dependents while preserving active abort work and realm teardown', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/abort-dependent-memory.cjs'], {
    encoding: 'utf8', timeout: 90_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});

test('should release native DOMs created by runner fixtures while their parent remains alive', () => {
  // Start an independent real runner; inherited child-v8 makes Node skip recursively requested test files.
  const childEnvironment = { ...process.env }; delete childEnvironment.NODE_TEST_CONTEXT;
  const child = spawnSync(process.execPath, ['--expose-gc', '--test', '--test-reporter=tap', 'tests/helpers/abort-runner-memory.cjs'], {
    env: childEnvironment, encoding: 'utf8', timeout: 90_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  assert.match(child.stdout, /^# tests 11$/m); assert.match(child.stdout, /^# pass 11$/m);
});
