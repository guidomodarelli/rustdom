/** @file Exercises a real native endpoint factory and unchanged public Range semantics against independent jsdom. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const source = path.resolve(__dirname, '..');
const native = require(path.join(source, 'dist/native.cjs'));
const runtime = require(path.join(source, 'dist/index.cjs'));
const reference = require(path.join(source, 'node_modules/jsdom'));

test('the native factory creates an independent class instance with the same numeric state as setters', () => {
  for (const [startNode, startOffset, endNode, endOffset] of [
    [1, 0, 2, 5], [1, -0, 1, 0], [2, NaN, 1, Infinity], [1, -Infinity, 1, -1],
  ]) {
    const manual = new native.NativeRange();
    manual.setStart(startNode, startOffset); manual.setEnd(endNode, endOffset);
    const initialized = native.NativeRange.fromEndpoints(startNode, startOffset, endNode, endOffset);
    assert.ok(initialized instanceof native.NativeRange);
    assert.notEqual(initialized, manual);
    for (const field of ['startOffset', 'endOffset', 'collapsed']) {
      assert.ok(Object.is(initialized[field], manual[field]), field);
    }
    assert.deepEqual(initialized.start, manual.start); assert.deepEqual(initialized.end, manual.end);
    initialized.setStart(3, 7);
    assert.ok(Object.is(manual.startOffset, startOffset));
    assert.equal(initialized.startOffset, 7);
  }
});

test('invalid start or end identities reject before allocating a tracked native range', () => {
  for (const invalidNode of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    for (const endpoints of [[invalidNode, 0, 1, 1], [1, 0, invalidNode, 1]]) {
      const before = native.NativeRange.statistics();
      assert.throws(() => native.NativeRange.fromEndpoints(...endpoints));
      const after = native.NativeRange.statistics();
      assert.equal(after.created, before.created);
      // GC may release unrelated instances from an earlier case while constructing the error.
      assert.ok(after.live <= before.live);
      assert.ok(after.released >= before.released);
    }
  }
});

/** @param {object} dom - Actual engine window and document. @returns {object} Public offsets, identities and subsequent live mutation results. */
function observePublicRanges(dom) {
  const { document } = dom.window;
  const text = document.querySelector('main').firstChild;
  const range = document.createRange();
  const initial = [range.startContainer === document, range.endContainer === document,
    range.startOffset, range.endOffset, range.collapsed];
  range.selectNodeContents(text);
  const clone = range.cloneRange();
  const frozen = new dom.window.StaticRange({ startContainer: text, startOffset: 1,
    endContainer: text, endOffset: 4 });
  clone.setStart(text, 2);
  text.insertData(0, 'x');
  const mutated = [range.startContainer === text, range.endContainer === text, range.startOffset, range.endOffset,
    clone.startContainer === text, clone.endContainer === text, clone.startOffset, clone.endOffset,
    frozen.startContainer === text, frozen.endContainer === text, frozen.startOffset, frozen.endOffset];
  clone.collapse(false);
  return { initial, mutated, collapsed: [clone.startOffset, clone.endOffset, clone.collapsed],
    rangeText: range.toString(), cloneText: clone.toString() };
}

test('public creation, cloning, static endpoints, mutation and collapse preserve independent jsdom behavior', () => {
  const actual = new runtime.JSDOM('<main>abcdef</main>');
  const expected = new reference.JSDOM('<main>abcdef</main>');
  try { assert.deepEqual(observePublicRanges(actual), observePublicRanges(expected)); }
  finally { actual.window.close(); expected.window.close(); }
});
