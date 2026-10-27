/** @file Partitions the actual Rust test inventory into bounded Memcheck processes without dropping tests. */
import assert from 'node:assert/strict';

/** Limit cumulative debug/instrumentation cost per process; individual tests retain the full watchdog. */
export const NATIVE_MEMORY_TESTS_PER_RUN = 32;

/**
 * Build exact-name batches from libtest's public inventory.
 * @param {string} listing - Successful `--list --format=terse` output from the real executable.
 * @returns {string[][]} Disjoint, exhaustive batches in original test order.
 */
export function planNativeMemoryRuns(listing) {
  const tests = listing.split(/\r?\n/u).filter((line) => line.endsWith(': test')).map((line) => line.slice(0, -6));
  assert.ok(tests.length > 0, 'Native memory analysis found no runnable Rust tests');
  assert.equal(new Set(tests).size, tests.length, 'Native memory inventory contains duplicate test names');
  return Array.from({ length: Math.ceil(tests.length / NATIVE_MEMORY_TESTS_PER_RUN) }, (_, index) =>
    tests.slice(index * NATIVE_MEMORY_TESTS_PER_RUN, (index + 1) * NATIVE_MEMORY_TESTS_PER_RUN));
}

/**
 * Confirm libtest actually completed every selected test; an empty or partial run cannot pass the memory gate.
 * @param {string} output - Actual libtest stdout.
 * @param {number} expectedCount - Number of exact names passed to this run.
 * @returns {boolean} Whether all selected tests passed and none were ignored.
 */
export function completedNativeMemoryRun(output, expectedCount) {
  const summary = /test result: ok\. (\d+) passed; 0 failed; 0 ignored;/u.exec(output);
  return summary !== null && Number(summary[1]) === expectedCount;
}
