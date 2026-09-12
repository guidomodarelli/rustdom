/** @file Observes memory after both weak targets and native finalizers have reached a bounded endpoint. */
'use strict';
const { performance } = require('node:perf_hooks');

/** Bound collector retries independently of the retained-memory budgets. */
const MAX_QUIESCENCE_ROUNDS = 12;
/** Do not turn a persistent retained reference into an unbounded wait. */
const QUIESCENCE_TIMEOUT_MS = 10_000;
/** Observe two clear samples across separate event-loop turns before accepting the endpoint. */
const REQUIRED_CLEAR_SAMPLES = 2;
/** Native resources that must return exactly to the caller's baseline. */
const NATIVE_LIFETIME_FIELDS = ['liveNodes', 'dataNodes', 'attributeCollections', 'attributeOwners', 'attributeHolders'];

/** @returns {Promise<void>} Drains callbacks across two asynchronous major collections. */
async function collectGarbage() {
  for (let turn = 0; turn < 2; turn++) {
    await new Promise((resolve) => setImmediate(resolve));
    await global.gc({ type: 'major', execution: 'async' });
  }
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Capture scalar evidence in one synchronous turn; never return dereferenced targets.
 * @param {Record<string, WeakRef<object>[]>} groups - Weak observations grouped by resource kind.
 * @param {object|null} runtime - Real rustdom runtime, or a reference without native statistics.
 * @returns {object} Memory, survivor counts and the corresponding native state.
 */
function captureMemoryState(groups, runtime) {
  const memory = process.memoryUsage();
  const survivors = Object.fromEntries(Object.entries(groups).map(([name, references]) => [name,
    references.reduce((count, reference) => count + Number(reference.deref() !== undefined), 0)]));
  return { memory, survivors, nativeTree: runtime?.getNativeTreeStatistics?.() };
}

/** @param {object} state - Scalar sample. @param {object|undefined} expected - Native baseline. @returns {boolean} Exact liveness agreement. */
function isReleased(state, expected) {
  if (Object.values(state.survivors).some((count) => count !== 0)) return false;
  const native = state.nativeTree;
  if (expected === undefined) return native === undefined;
  return native !== undefined && NATIVE_LIFETIME_FIELDS.every((field) => native[field] === expected[field]) &&
    native.rangeStates?.live === expected.rangeStates?.live &&
    native.indexedNodes === native.liveNodes && native.reservedHandles <= native.handleBatchSize;
}

/**
 * Wait for actual collection/finalization, retaining every attempt as scalar diagnostic data.
 * @param {object} options - Observation and retry policy.
 * @param {string} options.label - Resource boundary being checked.
 * @param {Function} options.sample - Synchronous scalar capture after each collection round.
 * @param {object} [options.expectedNative] - Native resource counts required at the endpoint.
 * @param {number} [options.maxRounds] - Finite collector-round limit.
 * @param {number} [options.timeoutMs] - Deadline checked between collection rounds.
 * @returns {Promise<object>} Final sample and complete trace, including a failed bounded wait.
 */
async function waitForMemoryQuiescence({ label, sample, expectedNative,
  maxRounds = MAX_QUIESCENCE_ROUNDS, timeoutMs = QUIESCENCE_TIMEOUT_MS }) {
  if (!Number.isSafeInteger(maxRounds) || maxRounds < 1 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Memory quiescence requires positive finite limits');
  }
  const started = performance.now();
  const trace = [];
  let clearSamples = 0;
  let state;
  let reached = false;
  for (let round = 1; round <= maxRounds; round++) {
    // Yield before every GC: WeakRef.deref keeps live targets alive until the current job ends.
    await collectGarbage();
    state = sample();
    const clear = isReleased(state, expectedNative);
    clearSamples = clear ? clearSamples + 1 : 0;
    const elapsedMs = performance.now() - started;
    trace.push({ round, elapsedMs, clear, ...state });
    if (clearSamples >= REQUIRED_CLEAR_SAMPLES) { reached = true; break; }
    if (elapsedMs >= timeoutMs) break;
  }
  return { label, reached, maxRounds, timeoutMs, requiredClearSamples: REQUIRED_CLEAR_SAMPLES,
    state, trace };
}

module.exports = { collectGarbage, captureMemoryState, waitForMemoryQuiescence };
