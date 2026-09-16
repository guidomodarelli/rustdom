/** @file Checks serializer roots across success, primitive throws, iterator closing and dynamic results. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const native = require('../../dist/native.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @returns {object} Dynamic result whose methods cannot capture a fixture's DOM closure. */
function independentReplacement() { return { replace() { global.gc(); return this; } }; }

/** @param {number} mode - Select normal, throw or dynamic result. @returns {object} Retained output and weak owners. */
function fixture(mode) {
  const { window } = new runtime.JSDOM('<r/>', { contentType: 'text/xml' });
  const root = window.document.documentElement;
  const text = window.document.createTextNode('<&>'); root.append(text);
  const observed = { windows: [new WeakRef(window)], documents: [new WeakRef(window.document)], nodes: [new WeakRef(root), new WeakRef(text)], callbacks: [], iterators: [], errors: [] };
  let retained;
  if (mode === 0) {
    let parent = root;
    for (let depth = 0; depth < 1000; depth++) { const child = window.document.createElementNS(`urn:n${depth % 4}`, 'p:n'); parent.append(child); parent = child; }
    retained = new window.XMLSerializer().serializeToString(root); assert.ok(retained.includes('&lt;&amp;&gt;'));
  } else if (mode === 1) {
    const failure = new Error('serialization memory failure'); observed.errors.push(new WeakRef(failure));
    const read = () => { global.gc(); throw failure; }; observed.callbacks.push(new WeakRef(read));
    Object.defineProperty(text, 'data', { get: read });
    const iterator = { next() { return { done: false, value: text }; }, return() { return {}; } };
    observed.iterators.push(new WeakRef(iterator));
    Object.defineProperty(root, 'childNodes', { get: () => ({ length: 1, [Symbol.iterator]: () => iterator }) });
    assert.throws(() => new window.XMLSerializer().serializeToString(root), /serialization memory failure/);
  } else if (mode === 2) {
    const replacement = independentReplacement();
    const read = () => replacement; observed.callbacks.push(new WeakRef(read));
    Object.defineProperty(text, 'data', { get: read });
    retained = new window.XMLSerializer().serializeToString(text); assert.equal(retained, replacement);
  } else {
    const invalidResult = mode === 3 ? Symbol('invalid iterator result') : undefined;
    const next = () => { global.gc(); return invalidResult; };
    const iterator = { next, return() { assert.fail('next failure must not close its iterator'); } };
    const iterable = { [Symbol.iterator]() { return mode === 4 ? invalidResult : iterator; } };
    observed.callbacks.push(new WeakRef(next)); observed.iterators.push(new WeakRef(iterator));
    Object.defineProperty(root, 'childNodes', { get: () => iterable });
    let caught = false;
    try { native.serializeXml(root, false); }
    catch (error) { caught = true; assert.ok(error instanceof TypeError); observed.errors.push(new WeakRef(error)); }
    assert.equal(caught, true);
  }
  const statistics = native.xmlSerializationStatistics();
  assert.equal(statistics.live, 0); assert.equal(statistics.references, 0); assert.equal(statistics.cleanupErrors, 0);
  window.close(); return { observed, retained };
}

/** @returns {Promise<void>} Save finite GC cycles without retaining observed DOM owners. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 15; cycle++) {
      const sample = fixture(cycle % 5);
      const released = await waitForMemoryQuiescence({ label: `xml-serialization-${cycle}`, sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
      report.cycles.push(released); assert.equal(released.reached, true);
      if (cycle % 5 === 2) assert.equal(sample.retained.replace(), sample.retained);
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-xml-serialization.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
