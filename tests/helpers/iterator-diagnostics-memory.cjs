/** @file Observes formatter closure release and repeated XML/FormData failures through the real addon. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const reference = require('jsdom');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @returns {object} Loaded runtime and weak owners of a formatter replaced before addon initialization. */
function loadWithFormatter() {
  const { window } = new reference.JSDOM('<p>formatter owner</p>');
  const formatter = () => window.document.documentElement.localName;
  const observed = { windows: [new WeakRef(window)], documents: [new WeakRef(window.document)], callbacks: [new WeakRef(formatter)] };
  const descriptor = Object.getOwnPropertyDescriptor(Symbol.prototype, 'toString');
  let runtime;
  try {
    Symbol.prototype.toString = formatter;
    runtime = require('../../dist/index.cjs');
  } finally {
    Object.defineProperty(Symbol.prototype, 'toString', descriptor);
    window.close();
  }
  return { runtime, observed };
}

/** @param {object} wrapper - Actual DOM wrapper. @returns {object} Its real implementation for an observable iteration fixture. */
function implementation(wrapper) {
  return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
}

/** @param {object} runtime - Real rustdom runtime. @param {object} native - Real addon. @param {number} cycle - Realm selection. @returns {object} Weak references after all owners are dropped. */
function failRepeatedly(runtime, native, cycle) {
  const { window } = new runtime.JSDOM('<form><input name="field" value="value"></form>', cycle % 2 ? { runScripts: 'outside-only' } : {});
  const document = window.document;
  const form = document.querySelector('form');
  const formImpl = implementation(form);
  const field = implementation(form.elements[0]);
  const observed = { windows: [new WeakRef(window)], documents: [new WeakRef(document)], callbacks: [], iterators: [], errors: [], causes: [] };
  const invalid = Symbol('memory');
  const next = () => invalid;
  const iterator = { next, return() { assert.fail('primitive next result must not close the iterator'); } };
  const iterable = { [Symbol.iterator]() { return iterator; } };
  const root = { nodeType: 11, childNodes: iterable };
  formImpl._getSubmittableElementNodes = () => iterable;
  observed.callbacks.push(new WeakRef(next)); observed.iterators.push(new WeakRef(iterator));
  const stringDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'String');
  try {
    Object.defineProperty(globalThis, 'String', { configurable: true, get() { assert.fail('diagnostic must not read String'); } });
    for (let iteration = 0; iteration < 100; iteration++) {
      for (const operation of [() => native.serializeXml(root, false), () => new window.FormData(form)]) {
        let failed = false;
        try { operation(); } catch (error) {
          failed = true;
          assert.ok(error instanceof TypeError);
          assert.equal(error.message, 'Iterator result Symbol(memory) is not an object');
          if (iteration < 2) observed.errors.push(new WeakRef(error));
        }
        assert.equal(failed, true);
      }
    }
  } finally { Object.defineProperty(globalThis, 'String', stringDescriptor); }
  for (const stage of ['next', 'body']) {
    const cause = { document };
    const original = new Error(`original ${stage}`, { cause });
    const closing = new Error('closing error', { cause: window });
    observed.errors.push(new WeakRef(original), new WeakRef(closing)); observed.causes.push(new WeakRef(cause));
    let closes = 0;
    const body = { get nodeType() { throw original; } };
    const source = (value) => ({ [Symbol.iterator]() { return {
      next() { if (stage === 'next') throw original; return { done: false, value }; },
      return() { closes++; throw closing; },
    }; } });
    assert.throws(() => native.serializeXml({ nodeType: 11, childNodes: source(body) }, false), (error) => error === original && error.cause === cause);
    field._getValue = () => { throw original; };
    formImpl._getSubmittableElementNodes = () => source(field);
    assert.throws(() => new window.FormData(form), (error) => error === original && error.cause === cause);
    assert.equal(closes, stage === 'body' ? 2 : 0);
  }
  assert.equal(native.xmlSerializationStatistics().references, 0);
  assert.equal(native.xmlSerializationStatistics().cleanupErrors, 0);
  assert.equal(native.formDataConstructionStatistics().active, 0);
  window.close();
  return observed;
}

/** @returns {Promise<void>} Persist finite GC observations without retaining fixture owners. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    const { runtime, observed } = loadWithFormatter();
    const native = require('../../dist/native.cjs');
    await collectGarbage();
    const baseline = runtime.getNativeTreeStatistics();
    const formatter = await waitForMemoryQuiescence({ label: 'preload-formatter', sample: () => captureMemoryState(observed, runtime), expectedNative: baseline });
    report.formatter = formatter; assert.equal(formatter.reached, true);
    for (let cycle = 0; cycle < 12; cycle++) {
      const owners = failRepeatedly(runtime, native, cycle);
      const released = await waitForMemoryQuiescence({ label: `iterator-diagnostics-${cycle}`, sample: () => captureMemoryState(owners, runtime), expectedNative: baseline });
      report.cycles.push(released); assert.equal(released.reached, true);
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-iterator-diagnostics.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ path, pass: report.pass, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });