/** @file Compares real StaticRange construction, conversions, realms and rejected native lifetimes. */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { rejectedConstructorsPerTest } = require('./constants/probe.cjs');
const source = process.env.RUSTDOM_STATIC_RANGE_SOURCE;
if (!source) throw new Error('StaticRange candidate tests require RUSTDOM_STATIC_RANGE_SOURCE');
const runtime = require(path.join(source, 'dist/index.cjs'));
const reference = require(path.join(source, 'node_modules/jsdom'));
const native = require(path.join(source, 'dist/native.cjs'));

/** @param {object} window - Actual DOM realm. @returns {Node[]} Supported real node kinds. */
function nodes(window) {
  const { document } = window;
  const root = document.querySelector('main');
  return [document, document.doctype, document.createAttribute('data-value'), root, root.firstChild,
    document.createComment('comment'), document.createProcessingInstruction('target', 'value'),
    document.createDocumentFragment(), root.attachShadow({ mode: 'open' })];
}

/** @param {object} engine - Independent real DOM engine. @returns {object[]} Public construction observations. */
function matrix(engine) {
  const owner = new engine.JSDOM('<!doctype html><main>abcdef</main>', { runScripts: 'outside-only' });
  const foreign = new engine.JSDOM('<main>foreign</main>', { runScripts: 'outside-only' });
  try {
    const candidates = nodes(owner.window);
    candidates.push(foreign.window.document.querySelector('main').firstChild);
    const offsets = [[0, 0], [999, 1], [-1, 2 ** 32 + 3], [NaN, Infinity], [-0, 2.9]];
    return candidates.flatMap((start, startIndex) => candidates.flatMap((end, endIndex) =>
      offsets.map(([startOffset, endOffset]) => {
        try {
          const range = new owner.window.StaticRange({ startContainer: start, startOffset, endContainer: end, endOffset });
          assert.equal(range.startContainer, start); assert.equal(range.endContainer, end);
          assert.ok(range instanceof owner.window.AbstractRange);
          return { startIndex, endIndex, startOffset: range.startOffset, endOffset: range.endOffset,
            negativeZero: Object.is(range.startOffset, -0), collapsed: range.collapsed };
        } catch (error) {
          assert.ok(error instanceof owner.window.DOMException);
          return { startIndex, endIndex, name: error.name, message: error.message };
        }
      })));
  } finally { owner.window.close(); foreign.window.close(); }
}

test('should preserve supported kinds, disconnected roots, offset conversion and exception realms', () => {
  assert.deepEqual(matrix(runtime), matrix(reference));
});

/** @param {object} engine - Actual DOM engine. @returns {object} Observed dictionary conversion and original thrown identity. */
function conversion(engine) {
  const dom = new engine.JSDOM('<main>text</main>', { runScripts: 'outside-only' });
  try {
    const { window } = dom;
    const text = window.document.querySelector('main').firstChild;
    const observed = [];
    const init = {};
    for (const [key, value] of [['startContainer', text], ['startOffset', 2], ['endContainer', text], ['endOffset', 3]]) {
      Object.defineProperty(init, key, { get() {
        observed.push(key);
        return key.endsWith('Offset') ? { valueOf() { observed.push(key + ':number'); return value; } } : value;
      } });
    }
    const range = new window.StaticRange(init);
    const sentinel = { thrown: 'dictionary' };
    const rejected = { get endContainer() { throw sentinel; } };
    assert.throws(() => new window.StaticRange(rejected), (error) => error === sentinel);
    assert.throws(() => new window.StaticRange(), window.TypeError);
    assert.throws(() => new window.StaticRange(null), window.TypeError);
    let invocation;
    try { window.StaticRange(init); } catch (error) {
      assert.equal(error.name, 'TypeError');
      invocation = { name: error.name, message: error.message, receiverRealm: error instanceof window.TypeError };
    }
    class DerivedRange extends window.StaticRange {}
    assert.ok(new DerivedRange(init) instanceof DerivedRange);
    return { observed, offsets: [range.startOffset, range.endOffset], invocation };
  } finally { dom.window.close(); }
}

test('should preserve dictionary getter order, numeric effects, arbitrary throws and subclassing', () => {
  assert.deepEqual(conversion(runtime), conversion(reference));
});

/** @param {object} engine - Real engine under test. @param {string} vendor - Its real implementation utilities. @returns {object[]} Internal node property observations. */
function typeReads(engine, vendor) {
  const dom = new engine.JSDOM('<main>text</main>', { runScripts: 'outside-only' });
  const { implForWrapper } = require(path.join(source, vendor, 'lib/jsdom/living/generated/utils'));
  try {
    const { window } = dom;
    const start = window.document.querySelector('main').firstChild;
    const end = window.document.createTextNode('end');
    const implementation = implForWrapper(start);
    const descriptor = Object.getOwnPropertyDescriptor(implementation, 'nodeType');
    const outcomes = [];
    for (const sequence of [[10], [3, 2], ['10', '2', 3], [3, 3]]) {
      const observed = [];
      Object.defineProperty(implementation, 'nodeType', { configurable: true, get() {
        observed.push(sequence[Math.min(observed.length, sequence.length - 1)]);
        return observed.at(-1);
      } });
      try {
        const range = new window.StaticRange({ startContainer: start, startOffset: 0, endContainer: end, endOffset: 1 });
        outcomes.push({ observed, collapsed: range.collapsed });
      } catch (error) { outcomes.push({ observed, name: error.name, message: error.message }); }
    }
    for (const sentinel of [{ thrown: 'nodeType' }, Symbol('nodeType'), undefined, null, NaN, -0]) {
      Object.defineProperty(implementation, 'nodeType', { configurable: true, get() { throw sentinel; } });
      let caught = false;
      try { new window.StaticRange({ startContainer: start, startOffset: 0, endContainer: end, endOffset: 0 }); }
      catch (error) { caught = true; assert.ok(Object.is(error, sentinel)); }
      assert.equal(caught, true);
    }
    if (descriptor) Object.defineProperty(implementation, 'nodeType', descriptor);
    else delete implementation.nodeType;
    return outcomes;
  } finally { dom.window.close(); }
}

test('should preserve short-circuit reads and strict type equality on real node implementations', () => {
  assert.deepEqual(typeReads(runtime, 'dist/vendor-jsdom'), typeReads(reference, 'node_modules/jsdom'));
});

test('should not allocate NativeRange state for rejected real public constructors', () => {
  const dom = new runtime.JSDOM('<!doctype html><main>text</main>');
  try {
    const { window } = dom;
    const before = native.NativeRange.statistics();
    for (let index = 0; index < rejectedConstructorsPerTest; index++) {
      assert.throws(() => new window.StaticRange({ startContainer: window.document.doctype, startOffset: 0,
        endContainer: window.document.body, endOffset: 0 }), { name: 'InvalidNodeTypeError' });
    }
    const after = native.NativeRange.statistics();
    assert.equal(after.created, before.created);
    assert.ok(after.live <= before.live);
  } finally { dom.window.close(); }
});

/** @param {object} engine - Real DOM engine. @param {string} vendor - Its implementation utilities. @returns {object} Nested construction outcome. */
function reentry(engine, vendor) {
  const dom = new engine.JSDOM('<main>outer</main>', { runScripts: 'outside-only' });
  const { implForWrapper } = require(path.join(source, vendor, 'lib/jsdom/living/generated/utils'));
  const text = dom.window.document.querySelector('main').firstChild;
  const other = dom.window.document.createTextNode('inner');
  const implementation = implForWrapper(text);
  const descriptor = Object.getOwnPropertyDescriptor(implementation, 'nodeType');
  let entered = false;
  let nested;
  try {
    Object.defineProperty(implementation, 'nodeType', { configurable: true, get() {
      if (!entered) {
        entered = true;
        nested = new dom.window.StaticRange({ startContainer: other, startOffset: 1, endContainer: other, endOffset: 3 });
      }
      return 3;
    } });
    const outer = new dom.window.StaticRange({ startContainer: text, startOffset: 0, endContainer: text, endOffset: 2 });
    assert.equal(outer.startContainer, text); assert.equal(nested.startContainer, other);
    return { entered, outer: [outer.startOffset, outer.endOffset], nested: [nested.startOffset, nested.endOffset] };
  } finally {
    if (descriptor) Object.defineProperty(implementation, 'nodeType', descriptor);
    else delete implementation.nodeType;
    dom.window.close();
  }
}

test('should allow real nested StaticRange construction during a node property read', () => {
  assert.deepEqual(reentry(runtime, 'dist/vendor-jsdom'), reentry(reference, 'node_modules/jsdom'));
});

test('should construct branded states and realm exceptions through real CJS and ESM native entry points', async () => {
  const { pathToFileURL } = require('node:url');
  const esm = await import(pathToFileURL(path.join(source, 'dist/native.mjs')).href);
  const { implForWrapper } = require(path.join(source, 'dist/vendor-jsdom/lib/jsdom/living/generated/utils'));
  const { domSymbolTree } = require(path.join(source, 'dist/vendor-jsdom/lib/jsdom/living/helpers/internal-constants'));
  const exceptionFactory = require(path.join(source, 'dist/vendor-jsdom/lib/jsdom/living/generated/DOMException'));
  const dom = new runtime.JSDOM('<main>start</main>', { runScripts: 'outside-only' });
  try {
    const text = implForWrapper(dom.window.document.querySelector('main').firstChild);
    const attribute = implForWrapper(dom.window.document.createAttribute('example'));
    const helpers = {
      nodeId(node) { return domSymbolTree._ensure(node); },
      exception(globalObject, message, name) { return exceptionFactory.create(globalObject, [message, name]); },
    };
    for (const initialize of [native.initializeStaticRange, esm.initializeStaticRange]) {
      const state = initialize(dom.window, text, 1, text, 4, helpers);
      assert.ok(state instanceof native.NativeRange);
      assert.equal(state.startOffset, 1); assert.equal(state.endOffset, 4); assert.equal(state.collapsed, false);
      assert.throws(() => initialize(dom.window, attribute, 0, text, 0, helpers),
        (error) => error instanceof dom.window.DOMException && error.name === 'InvalidNodeTypeError');
    }
  } finally { dom.window.close(); }
});
