/** @file Checks that clean-realm key capture does not retain VM contexts across addon reloads. */
'use strict';
const assert = require('node:assert/strict');
const { getHeapStatistics } = require('node:v8');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage } = require('../../scripts/memory-endpoint.cjs');
require('node:vm');
const addonPath = require.resolve('../../dist/rustdom.node');
const iteratorKey = Symbol.iterator;
const arrayPrototype = Array.prototype;
const generatorPrototype = Object.getPrototypeOf(Object.getPrototypeOf((function* () {})()));
const iteratorPrototype = Object.getPrototypeOf(generatorPrototype);
const arrayDescriptor = Object.getOwnPropertyDescriptor(arrayPrototype, iteratorKey);
const iteratorDescriptor = Object.getOwnPropertyDescriptor(iteratorPrototype, iteratorKey);
const symbols = Object.getOwnPropertyDescriptor(globalThis, 'Symbol');
const strings = Object.getOwnPropertyDescriptor(globalThis, 'String');
const arrays = Object.getOwnPropertyDescriptor(globalThis, 'Array');

/** @returns {object} Scalar process memory and public V8 context counters. */
function sample() {
  const heap = getHeapStatistics();
  return { memory: process.memoryUsage(), nativeContexts: heap.number_of_native_contexts,
    detachedContexts: heap.number_of_detached_contexts };
}

/** @param {number} cycle - Alternate missing keys and severed generator chains. @returns {object} Native counters after real successful/error operations. */
function loadWithMissingIntrinsics(cycle) {
  try {
    delete arrayPrototype[iteratorKey];
    if (cycle % 2) Object.setPrototypeOf(generatorPrototype, null);
    else delete iteratorPrototype[iteratorKey];
    globalThis.Symbol = undefined; globalThis.String = undefined; globalThis.Array = undefined;
    delete require.cache[addonPath];
    const native = require(addonPath);
    let done = false;
    const root = { nodeType: 11, childNodes: { [iteratorKey]() { return {
      next() { if (done) return { done: true }; done = true; return { done: false, value: { nodeType: 3, data: 'ready' } }; },
    }; } } };
    const value = native.serializeXml(root, false);
    const invalid = { nodeType: 11, childNodes: { [iteratorKey]() { return { next() { return iteratorKey; } }; } } };
    let failure;
    try { native.serializeXml(invalid, false); } catch (error) {
      failure = { hostTypeError: error instanceof TypeError, message: error.message };
    }
    return { value, failure, statistics: native.xmlSerializationStatistics() };
  } finally {
    Object.setPrototypeOf(generatorPrototype, iteratorPrototype);
    Object.defineProperty(arrayPrototype, iteratorKey, arrayDescriptor);
    Object.defineProperty(iteratorPrototype, iteratorKey, iteratorDescriptor);
    Object.defineProperty(globalThis, 'Symbol', symbols);
    Object.defineProperty(globalThis, 'String', strings);
    Object.defineProperty(globalThis, 'Array', arrays);
  }
}

/** @returns {Promise<void>} Persist every post-GC sample while retaining only scalar results. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false,
    methodology: 'Warm core VM module before baseline; each cycle reloads the actual addon with both host routes unavailable, then verifies XML and its intrinsic error. Public V8 native/detached context counters are sampled after GC. No private V8 ABI, mocks or exposed context handles.', samples: [] };
  try {
    await collectGarbage(); report.baseline = sample();
    for (let cycle = 0; cycle < 24; cycle++) {
      const { value, failure, statistics } = loadWithMissingIntrinsics(cycle);
      assert.equal(value, 'ready');
      assert.equal(failure?.hostTypeError, true);
      assert.equal(failure?.message, 'Iterator result Symbol(Symbol.iterator) is not an object');
      assert.equal(statistics.live, 0); assert.equal(statistics.references, 0); assert.equal(statistics.cleanupErrors, 0);
      const beforeGc = sample();
      await collectGarbage();
      const current = sample();
      report.samples.push({ cycle, statistics, beforeGc, ...current });
      assert.equal(current.nativeContexts, report.baseline.nativeContexts);
      assert.equal(current.detachedContexts, report.baseline.detachedContexts);
    }
    assert.ok(report.samples.some((entry) => entry.beforeGc.nativeContexts > report.baseline.nativeContexts));
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-intrinsic-realm-contexts.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ path, pass: report.pass, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });