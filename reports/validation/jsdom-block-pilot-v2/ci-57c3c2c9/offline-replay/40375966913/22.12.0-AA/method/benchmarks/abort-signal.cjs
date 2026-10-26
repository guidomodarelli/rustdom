/** @file Measures public abort lifecycle, nested composition and synchronous fanout with equivalent outputs. */
'use strict';
const assert = require('node:assert/strict');

/** @param {object} runtime - Actual DOM implementation. @param {Window} window - Fixture realm. @param {number} size - Number of signals. @param {string} name - Operation selector. @returns {object} Timed operation and untimed validation/cleanup. */
function abortFixture(runtime, window, size, name) {
  let first = new window.AbortController(); let second = new window.AbortController();
  let signals = []; let reason = { marker: 'abort-benchmark' }; let calls = 0; let orderCorrect = true; let markedBeforeSource = false;
  if (name === 'abort-propagation') {
    for (let index = 0; index < size; index++) {
      const signal = window.AbortSignal.any([first.signal]);
      signal.addEventListener('abort', () => { orderCorrect = orderCorrect && calls === index; calls++; });
      signals.push(signal);
    }
    first.signal.addEventListener('abort', () => { markedBeforeSource = signals.every((signal) => signal.aborted && signal.reason === reason); });
  }
  return {
    /** @returns {number} Observable checksum or count. */
    run() {
      if (name === 'abort-lifecycle') {
        let checksum = 0;
        for (let index = 0; index < size; index++) {
          const controller = new window.AbortController(); controller.abort(reason); controller.abort('ignored');
          checksum += Number(controller.signal.aborted) + Number(controller.signal.reason === reason);
          try { controller.signal.throwIfAborted(); } catch (error) { checksum += Number(error === reason); }
        }
        return checksum;
      }
      if (name === 'abort-any') {
        let previous = first.signal;
        for (let index = 0; index < size; index++) {
          previous = window.AbortSignal.any([previous, second.signal, first.signal]); signals.push(previous);
        }
        return signals.length;
      }
      first.abort(reason); return calls;
    },
    /** @param {number} result - Result recorded during timing. @returns {void} Verifies reasons, deduplication, order and native use. */
    validate(result) {
      if (name === 'abort-lifecycle') assert.equal(result, size * 3);
      else {
        assert.equal(result, size);
        if (name === 'abort-any') first.abort(reason);
        second.abort('ignored');
        assert.ok(signals.every((signal) => signal.aborted && signal.reason === reason));
        if (name === 'abort-propagation') { assert.equal(calls, size); assert.equal(orderCorrect, true); assert.equal(markedBeforeSource, true); }
      }
      if (runtime.getNativeTreeStatistics) assert.ok(runtime.getNativeTreeStatistics().abortStates.created >= size);
    },
    /** @returns {void} Drops benchmark-owned references before closing the realm. */
    dispose() { signals = null; first = null; second = null; reason = null; },
  };
}
module.exports = { abortFixture };
