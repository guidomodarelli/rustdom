/** @module confirmation-finalization Prevents cancellation or a late postflight from being published as a complete qualification. */
'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { setImmediate: immediate } = require('node:timers/promises');

/**
 * Keep completion unpublished through the final real GC and package/source checks.
 * @param {object} options - Parent-owned lifecycle, monotonic deadline and real finalization operations.
 * @param {AbortSignal} options.signal - Actual controller signal; never synthesized from report data.
 * @param {number} options.startedMonotonicMs - Original qualification start, before any workers.
 * @param {number} options.timeoutMs - Prospectively declared functional deadline.
 * @param {function():Promise<void>} options.snapshot - Real final resource observation.
 * @param {function():void|Promise<void>} options.recheck - Real immutable package/source postflight.
 * @returns {Promise<{elapsedMs:number}>} Eligibility for the caller's synchronous complete/save operation.
 */
async function finalizeQualification({ signal, startedMonotonicMs, timeoutMs, snapshot, recheck }) {
  assert.ok(signal instanceof AbortSignal);
  assert.ok(Number.isFinite(startedMonotonicMs) && startedMonotonicMs >= 0);
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0);
  assert.equal(typeof snapshot, 'function'); assert.equal(typeof recheck, 'function');
  const check = () => {
    assert.equal(signal.aborted, false, 'Confirmation finalization: cancelled qualification cannot become complete');
    const elapsedMs = performance.now() - startedMonotonicMs;
    assert.ok(elapsedMs >= 0 && elapsedMs <= timeoutMs, 'Confirmation finalization: qualification deadline exceeded');
    return elapsedMs;
  };
  check();
  await snapshot();
  check();
  await recheck();
  // Synchronous provenance readers may have held the event loop while an OS signal arrived.
  await immediate();
  return { elapsedMs: check() };
}

module.exports = { finalizeQualification };
