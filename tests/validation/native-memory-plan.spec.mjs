/** @file Verifies exhaustive native-memory scheduling and rejects incomplete test results. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { planNativeMemoryRuns, completedNativeMemoryRun } from '../../scripts/native-memory-plan.mjs';

test('should schedule every discovered test exactly once across bounded runs', () => {
  const names = Array.from({ length: 241 }, (_, index) => `dom::module_${index}::tests::should_preserve_contract`);
  const listing = [...names.map((name) => `${name}: test`), 'throughput: benchmark', '241 tests, 1 benchmark'].join('\r\n');
  const batches = planNativeMemoryRuns(listing);
  assert.deepEqual(batches.flat(), names);
  assert.equal(new Set(batches.flat()).size, names.length);
  assert.equal(batches.length, 8);
  assert.ok(batches.every((batch) => batch.length > 0 && batch.length <= 32));
});

test('should reject empty and duplicate test inventories before declaring a memory gate', () => {
  assert.throws(() => planNativeMemoryRuns('0 tests, 0 benchmarks'), /no runnable Rust tests/u);
  assert.throws(() => planNativeMemoryRuns('same: test\nsame: test'), /duplicate test names/u);
});

test('should require a complete successful test result and reject partial, failed or ignored runs', () => {
  assert.equal(completedNativeMemoryRun('test result: ok. 32 passed; 0 failed; 0 ignored; 0 measured; 209 filtered out;', 32), true);
  assert.equal(completedNativeMemoryRun('test result: ok. 0 passed; 0 failed; 0 ignored;', 32), false);
  assert.equal(completedNativeMemoryRun('test result: ok. 31 passed; 0 failed; 1 ignored;', 32), false);
  assert.equal(completedNativeMemoryRun('test result: FAILED. 31 passed; 1 failed; 0 ignored;', 32), false);
  assert.equal(completedNativeMemoryRun('test dom::pending ... ', 32), false);
});
