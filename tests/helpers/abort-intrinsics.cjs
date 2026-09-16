/** @file Exercises real AbortSignal ownership under mutable host collection intrinsics in isolated processes. */
'use strict';
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const { setImmediate: nextTurn } = require('node:timers/promises');
const [engine, scenario] = process.argv.slice(2);
const { JSDOM } = require(engine === 'jsdom' ? 'jsdom' : '@rustdom/rustdom');
const utils = engine === 'jsdom' ? require('jsdom/lib/jsdom/living/generated/utils.js') : require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils.js');
const NativeAbortState = engine === 'jsdom' ? null : require('@rustdom/rustdom/native').NativeAbortState;
const OriginalMap = Map;
const OriginalWeakMap = WeakMap;
const OriginalWeakRef = WeakRef;
const OriginalRegistry = FinalizationRegistry;
const mapGet = Function.call.bind(Map.prototype.get);
const report = { engine, scenario, node: process.version, calls: 0, uncaught: [] };

/** @returns {void} Save scalars without retaining any collected DOM object. */
function saveReport() {
  if (process.env.ABORT_INTRINSIC_REPORT) writeFileSync(process.env.ABORT_INTRINSIC_REPORT, JSON.stringify(report, null, 2) + '\n');
}
process.on('uncaughtExceptionMonitor', (error) => {
  report.uncaught.push({ name: error.name, message: error.message, stack: error.stack });
  saveReport();
});

/** @param {object} owner - Actual host object. @param {string} key - Mutable intrinsic property. @param {object} replacement - Temporary descriptor. @returns {Function} Restores the exact original descriptor. */
function replaceProperty(owner, key, replacement) {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  Object.defineProperty(owner, key, { ...descriptor, ...replacement });
  return () => Object.defineProperty(owner, key, descriptor);
}

/** @returns {never} A real user-installed hook must never run for private ownership. */
function changedIntrinsic() {
  report.calls++;
  throw new Error(`Observed mutable intrinsic: ${scenario}`);
}

/** @returns {Promise<void>} Reach separate jobs and actual major collections. */
async function collect() {
  await nextTurn();
  await global.gc({ type: 'major', execution: 'async' });
  await nextTurn();
}

/** @returns {Promise<void>} The finalizer's exception remains uncaught and makes the child fail. */
async function checkFinalizer() {
  let dom = new JSDOM('<!doctype html>');
  const nativeBefore = NativeAbortState?.statistics();
  const closedRealm = { document: new OriginalWeakRef(dom.window.document), window: new OriginalWeakRef(dom.window) };
  let witnessed = 0;
  const witness = new OriginalRegistry(() => { witnessed++; });
  report.collections = [];
  /** @returns {WeakRef[]} Leave strong signals on a completed synchronous stack before forcing GC. */
  function discardedSignals() {
    const observed = [];
    for (let index = 0; index < 200; index++) {
      const controller = new dom.window.AbortController();
      observed.push(new OriginalWeakRef(controller.signal));
      witness.register(controller.signal, index);
    }
    return observed;
  }
  const restore = replaceProperty(OriginalMap.prototype, 'delete', {
    value(key) {
      if (typeof key === 'number' && mapGet(this, key) instanceof OriginalWeakRef) return changedIntrinsic();
      return Reflect.apply(originalDelete, this, [key]);
    },
  });
  try {
    for (let cycle = 0; cycle < 5; cycle++) {
      const observed = discardedSignals();
      for (let round = 0; round < 30; round++) await collect();
      report.survivingSignals = observed.filter((reference) => reference.deref() !== undefined).length;
      report.witnessed = witnessed;
      report.collections.push({ cycle, witnessed, survivingSignals: report.survivingSignals, memory: process.memoryUsage() });
      assert.equal(report.survivingSignals, 0);
      assert.equal(witnessed, observed.length * (cycle + 1));
      assert.equal(report.calls, 0);
      if (NativeAbortState) assert.equal(NativeAbortState.statistics().live, nativeBefore.live);
    }
  } finally {
    restore();
    dom.window.close();
    dom = null;
  }
  for (let round = 0; round < 30; round++) await collect();
  report.survivingDocument = Number(closedRealm.document.deref() !== undefined);
  report.survivingWindow = Number(closedRealm.window.deref() !== undefined);
  assert.equal(report.survivingDocument, 0);
  assert.equal(report.survivingWindow, 0);
  report.nativeBefore = nativeBefore;
  report.nativeAfter = NativeAbortState?.statistics();
  if (NativeAbortState) assert.equal(report.nativeAfter.live, nativeBefore.live);
}

const originalDelete = OriginalMap.prototype.delete;

/** @returns {void} Compare actual creation, native algorithms, and composition without substituting the runtime. */
function checkOperation() {
  const dom = new JSDOM('<!doctype html>');
  const source = new dom.window.AbortController();
  const signal = dom.window.AbortSignal.any([source.signal]);
  const nested = dom.window.AbortSignal.any([signal]);
  const implementation = utils.implForWrapper(signal);
  const trace = [];
  function activeAlgorithm() { trace.push('algorithm'); }
  function removedAlgorithm() { trace.push('removed'); }
  const primitiveAlgorithm = 'inactive primitive algorithm';
  const [name, method] = scenario.split('.');
  let restore;
  try {
    if (method === 'constructor') {
      restore = replaceProperty(globalThis, name, { value: changedIntrinsic });
      const controller = new dom.window.AbortController();
      assert.equal(controller.signal.aborted, false);
      implementation._addAlgorithm(activeAlgorithm);
      implementation._removeAlgorithm(activeAlgorithm);
    } else {
      const constructor = { Map: OriginalMap, WeakMap: OriginalWeakMap, WeakRef: OriginalWeakRef, FinalizationRegistry: OriginalRegistry }[name];
      const original = Object.getOwnPropertyDescriptor(constructor.prototype, method);
      if (method === 'size') restore = replaceProperty(constructor.prototype, method, { get: changedIntrinsic });
      else restore = replaceProperty(constructor.prototype, method, {
        value(...args) {
          const ownKey = name === 'Map' ? typeof args[0] === 'number' || args[0] === primitiveAlgorithm : name === 'WeakMap' ? args[0] === activeAlgorithm || args[0] === removedAlgorithm : true;
          if (ownKey) return changedIntrinsic();
          return Reflect.apply(original.value, this, args);
        },
      });
      if (name === 'FinalizationRegistry') {
        const controller = new dom.window.AbortController();
        assert.equal(controller.signal.aborted, false);
      } else {
        implementation._addAlgorithm(primitiveAlgorithm);
        implementation._removeAlgorithm(primitiveAlgorithm);
        implementation._addAlgorithm(activeAlgorithm);
        implementation._addAlgorithm(removedAlgorithm);
        implementation._removeAlgorithm(removedAlgorithm);
        source.abort('reason');
        assert.deepEqual(trace, ['algorithm']);
        assert.equal(signal.aborted, true);
        assert.equal(nested.aborted, true);
        assert.equal(nested.reason, 'reason');
      }
    }
    assert.equal(report.calls, 0);
    report.trace = trace;
  } finally {
    restore?.();
    dom.window.close();
  }
}

(async () => {
  assert.equal(typeof global.gc, 'function');
  if (scenario === 'finalizer-delete') await checkFinalizer();
  else checkOperation();
  report.pass = true;
  saveReport();
  process.stdout.write(JSON.stringify(report) + '\n');
})().catch((error) => {
  report.pass = false;
  report.error = { name: error.name, message: error.message, stack: error.stack };
  saveReport();
  throw error;
});
