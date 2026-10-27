/** @file Exercises owner-pair construction through the real addon, DOM nodes and independent native entry points. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const source = process.env.RUSTDOM_STATIC_RANGE_SOURCE;
if (!source) throw new Error('StaticRange owner-pair contracts require RUSTDOM_STATIC_RANGE_SOURCE');
const runtime = require(path.join(source, 'dist/index.cjs'));
const native = require(path.join(source, 'dist/native.cjs'));
const { implForWrapper } = require(path.join(source, 'dist/vendor-jsdom/lib/jsdom/living/generated/utils'));
const { domSymbolTree } = require(path.join(source, 'dist/vendor-jsdom/lib/jsdom/living/helpers/internal-constants'));
const exceptionFactory = require(path.join(source, 'dist/vendor-jsdom/lib/jsdom/living/generated/DOMException'));

/** @returns {object} Private identity/exception adapters with no platform mocks. */
function helpers() {
  return {
    nodeIds(startNode, endNode) { return [domSymbolTree._ensure(startNode), domSymbolTree._ensure(endNode)]; },
    exception(globalObject, message, name) { return exceptionFactory.create(globalObject, [message, name]); },
  };
}

/** @param {object} window - Real Window. @returns {object[]} Separate connected and detached implementation nodes. */
function endpoints(window) {
  return [implForWrapper(window.document.querySelector('main').firstChild),
    implForWrapper(window.document.createTextNode('detached'))];
}

test('paired owners resolve once with the original receiver after all node validation', () => {
  const dom = new runtime.JSDOM('<main>abcdef</main>');
  const observed = [];
  try {
    const [start, end] = endpoints(dom.window);
    domSymbolTree._ensure(start); domSymbolTree._ensure(end);
    for (const [label, node] of [['start', start], ['end', end]]) {
      Object.defineProperty(node, 'nodeType', { configurable: true, get() { observed.push(label); return 3; } });
    }
    const adapter = helpers();
    const identify = adapter.nodeIds;
    adapter.nodeIds = function nodeIds(startNode, endNode) {
      assert.equal(this, adapter); assert.equal(startNode, start); assert.equal(endNode, end);
      observed.push('owners'); return identify.call(this, startNode, endNode);
    };
    const state = native.initializeStaticRangeWithOwners(dom.window, start, 1, end, 4, adapter);
    assert.equal(state.startOffset, 1); assert.equal(state.endOffset, 4); assert.equal(state.collapsed, false);
    assert.deepEqual(observed, ['start', 'start', 'end', 'end', 'owners']);
  } finally { dom.window.close(); }
});

test('rejected nodes do not resolve owners or allocate a native state', () => {
  const dom = new runtime.JSDOM('<!doctype html><main>abcdef</main>');
  try {
    const [start] = endpoints(dom.window);
    const invalid = implForWrapper(dom.window.document.doctype);
    const adapter = helpers();
    let calls = 0;
    adapter.nodeIds = function nodeIds() { calls++; throw new Error('Invalid nodes must not reach owner resolution'); };
    const before = native.NativeRange.statistics();
    assert.throws(() => native.initializeStaticRangeWithOwners(dom.window, invalid, 0, start, 0, adapter),
      (error) => error instanceof dom.window.DOMException && error.name === 'InvalidNodeTypeError');
    assert.equal(calls, 0); assert.equal(native.NativeRange.statistics().created, before.created);
  } finally { dom.window.close(); }
});

test('owner callback and returned array getters preserve original thrown values without native allocation', () => {
  const dom = new runtime.JSDOM('<main>abcdef</main>');
  try {
    const [start, end] = endpoints(dom.window);
    for (const sentinel of [{ original: 'owner resolver' }, Symbol('owner resolver'), undefined, null, NaN, -0]) {
      for (const failure of ['callback', 'array-getter']) {
        const adapter = helpers();
        adapter.nodeIds = function nodeIds() {
          if (failure === 'callback') throw sentinel;
          const pair = [domSymbolTree._ensure(start), domSymbolTree._ensure(end)];
          Object.defineProperty(pair, 1, { get() { throw sentinel; } });
          return pair;
        };
        const before = native.NativeRange.statistics();
        let caught = false;
        try { native.initializeStaticRangeWithOwners(dom.window, start, 0, end, 1, adapter); }
        catch (error) { caught = true; assert.ok(Object.is(error, sentinel)); }
        assert.equal(caught, true); assert.equal(native.NativeRange.statistics().created, before.created);
      }
    }
  } finally { dom.window.close(); }
});

test('malformed owner pairs fail before NativeRange allocation', () => {
  const dom = new runtime.JSDOM('<main>abcdef</main>');
  try {
    const [start, end] = endpoints(dom.window);
    const identifiers = helpers().nodeIds(start, end);
    for (const result of [[], [identifiers[0]], [...identifiers, identifiers[0]],
      [undefined, identifiers[1]], [identifiers[0], NaN], [0, identifiers[1]],
      { 0: identifiers[0], 1: identifiers[1], length: 2 }]) {
      const adapter = helpers(); adapter.nodeIds = function nodeIds() { return result; };
      const before = native.NativeRange.statistics();
      assert.throws(() => native.initializeStaticRangeWithOwners(dom.window, start, 0, end, 1, adapter));
      assert.equal(native.NativeRange.statistics().created, before.created);
    }
  } finally { dom.window.close(); }
});

test('nested public construction during paired identification remains independent', () => {
  const dom = new runtime.JSDOM('<main>abcdef</main>');
  try {
    const [start, end] = endpoints(dom.window);
    const text = dom.window.document.querySelector('main').firstChild;
    for (const phase of ['callback', 'array-getter']) {
      const adapter = helpers(); const identify = adapter.nodeIds;
      let nested;
      const constructNested = () => {
        nested = new dom.window.StaticRange({ startContainer: text, startOffset: 2, endContainer: text, endOffset: 5 });
      };
      adapter.nodeIds = function nodeIds(startNode, endNode) {
        const pair = identify.call(this, startNode, endNode);
        if (phase === 'callback') constructNested();
        else {
          const startId = pair[0];
          Object.defineProperty(pair, 0, { get() { constructNested(); return startId; } });
        }
        return pair;
      };
      const state = native.initializeStaticRangeWithOwners(dom.window, start, 1, end, 3, adapter);
      assert.equal(state.startOffset, 1); assert.equal(state.endOffset, 3);
      assert.equal(nested.startContainer, text); assert.equal(nested.endOffset, 5);
    }
  } finally { dom.window.close(); }
});

test('paired construction is the same branded native operation in CJS and ESM', async () => {
  const esm = await import(pathToFileURL(path.join(source, 'dist/native.mjs')).href);
  assert.equal(esm.initializeStaticRangeWithOwners, native.initializeStaticRangeWithOwners);
  const dom = new runtime.JSDOM('<main>abcdef</main>');
  try {
    const [start] = endpoints(dom.window);
    for (const initialize of [native.initializeStaticRangeWithOwners, esm.initializeStaticRangeWithOwners]) {
      const state = initialize(dom.window, start, 1, start, 1, helpers());
      assert.ok(state instanceof native.NativeRange); assert.equal(state.startOffset, 1);
      assert.equal(state.endOffset, 1); assert.equal(state.collapsed, true);
    }
  } finally { dom.window.close(); }
});
