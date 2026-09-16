/** @module rustdom/integration-abort Separates native DOM ordering from runner-host signal interoperability. */
'use strict';
const { NativeAbortState } = require('@rustdom/rustdom/native');

/**
 * Register real native and runner-global abort contracts without assuming window selects the native constructor.
 * @param {object} runner - Actual runner functions and its execution global.
 * @param {Function} runner.test - Test registration function.
 * @param {Function} runner.expect - Runner assertions.
 * @param {object} runner.runnerGlobal - Actual execution global, including VM pools.
 * @param {Function} [runner.createNativeDom] - Creates an owned, unbridged DOM when runner globals expose host signals.
 * @returns {void} Registers two observable abort contracts.
 */
module.exports = function registerAbortSuite({ test, expect, runnerGlobal, createNativeDom }) {
  test('should preserve native composed abort ordering when a runner observes onabort and signaled listeners', () => {
    const dom = createNativeDom?.();
    const nativeWindow = dom ? dom.window : runnerGlobal;
    try {
      const before = NativeAbortState.statistics().created;
      const controller = new nativeWindow.AbortController();
      const signal = nativeWindow.AbortSignal.any([controller.signal]);
      const nested = nativeWindow.AbortSignal.any([signal]);
      const target = new nativeWindow.EventTarget();
      const trace = []; const sourceStates = [];
      target.addEventListener('work', () => trace.push('stale'), { signal: nested });
      signal.onabort = () => trace.push('replaced');
      signal.onabort = null;
      signal.onabort = () => trace.push('signal');
      nested.addEventListener('abort', () => { target.dispatchEvent(new nativeWindow.Event('work')); trace.push('nested'); }, { once: true });
      controller.signal.addEventListener('abort', () => {
        sourceStates.push([signal.aborted, nested.aborted, signal.reason, nested.reason]);
        trace.push('source');
      });
      // One controller signal and two composites must actually allocate three native states.
      expect(NativeAbortState.statistics().created - before).toBe(3);
      controller.abort('winner'); controller.abort('ignored');
      expect(sourceStates).toEqual([[true, true, 'winner', 'winner']]);
      expect(trace).toEqual(['source', 'signal', 'nested']);
    } finally { dom?.window.close(); }
  });

  test('should bridge a composed runner signal to DOM listeners before its abort observer', () => {
    const controller = new runnerGlobal.AbortController();
    const signal = runnerGlobal.AbortSignal.any([controller.signal]);
    const nested = runnerGlobal.AbortSignal.any([signal]);
    const target = runnerGlobal.document.createElement('button');
    const trace = []; const sourceStates = [];
    const onWork = () => trace.push('work');
    const onSourceAbort = () => {
      sourceStates.push([signal.aborted, nested.aborted, signal.reason, nested.reason]);
      trace.push('source');
    };
    try {
      target.addEventListener('work', onWork, { signal: nested });
      nested.onabort = () => { target.dispatchEvent(new runnerGlobal.Event('work')); trace.push('abort'); };
      controller.signal.addEventListener('abort', onSourceAbort);
      target.dispatchEvent(new runnerGlobal.Event('work'));
      controller.abort('winner'); controller.abort('ignored');
      target.dispatchEvent(new runnerGlobal.Event('work'));
      expect(sourceStates).toEqual([[true, true, 'winner', 'winner']]);
      expect(trace).toEqual(['work', 'source', 'abort']);
    } finally {
      nested.onabort = null;
      controller.signal.removeEventListener('abort', onSourceAbort);
      target.removeEventListener('work', onWork);
    }
  });
};
