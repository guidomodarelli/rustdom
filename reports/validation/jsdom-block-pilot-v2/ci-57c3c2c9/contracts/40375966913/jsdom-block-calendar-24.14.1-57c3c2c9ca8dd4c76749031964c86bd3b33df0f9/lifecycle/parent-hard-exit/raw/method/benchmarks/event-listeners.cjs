/** @file Builds equivalent public listener registration, removal and dense-dispatch workloads. */
'use strict';
const assert = require('node:assert/strict');
/** Keep dense dispatch bounded while exercising repeated snapshot membership. */
const DISPATCH_COUNT = 20;
const EVENT_TYPE = 'benchmark-listeners';

/** @param {object} runtime - Real DOM implementation. @param {Window} window - Owned fixture realm. @param {number} size - Listener count. @param {string} name - Selected public operation. @returns {object} Untimed setup/checks and a timed operation. */
function listenerFixture(runtime, window, size, name) {
  let target = new window.EventTarget(); let calls = 0; let ordered = true; let phasesCorrect = true; let nativeBefore;
  let callbacks = Array.from({ length: size }, (_, index) => (event) => {
    ordered = ordered && index === calls % size; calls++;
    phasesCorrect = phasesCorrect && event.eventPhase === 2 && event.currentTarget === target;
  });
  if (name !== 'listener-register') for (const callback of callbacks) target.addEventListener(EVENT_TYPE, callback);
  return {
    /** @returns {void} Capture native counts after setup GC and outside timing. */
    prepare() { nativeBefore = runtime.getNativeTreeStatistics?.().listenerRegistries.listeners; },
    /** @returns {number} Number of public operations completed. */
    run() {
      if (name === 'listener-register') for (const callback of callbacks) target.addEventListener(EVENT_TYPE, callback);
      else if (name === 'listener-remove') for (const callback of callbacks) target.removeEventListener(EVENT_TYPE, callback);
      else {
        let accepted = 0;
        for (let index = 0; index < DISPATCH_COUNT; index++) accepted += Number(target.dispatchEvent(new window.Event(EVENT_TYPE)));
        return accepted;
      }
      return size;
    },
    /** @param {number} result - Timed result. @returns {void} Check all callbacks, order, phase and native registration changes. */
    validate(result) {
      if (nativeBefore !== undefined) {
        const delta = name === 'listener-register' ? size : name === 'listener-remove' ? -size : 0;
        assert.equal(runtime.getNativeTreeStatistics().listenerRegistries.listeners, nativeBefore + delta);
      }
      if (name !== 'listener-dispatch') { assert.equal(result, size); assert.equal(target.dispatchEvent(new window.Event(EVENT_TYPE)), true); }
      else assert.equal(result, DISPATCH_COUNT);
      assert.equal(calls, name === 'listener-remove' ? 0 : name === 'listener-dispatch' ? size * DISPATCH_COUNT : size);
      assert.equal(ordered, true); assert.equal(phasesCorrect, true);
    },
    /** @returns {void} Remove all references before the parent fixture closes its realm. */
    dispose() { for (const callback of callbacks) target.removeEventListener(EVENT_TYPE, callback); callbacks = null; target = null; },
  };
}
module.exports = { listenerFixture };
