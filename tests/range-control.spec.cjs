/** @file Exercises native Range comparison dispatch, independent copies and collapse plans. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

for (const [name, engine] of Object.entries(engines)) {
  test(`should preserve comparison modes, error order and collapse/copy independence in ${name}`, () => {
    const owner = new engine.JSDOM('', { runScripts: 'outside-only' });
    const target = new engine.JSDOM('<main>abcdefghij</main>', { runScripts: 'outside-only' });
    try {
      const text = target.window.document.querySelector('main').firstChild;
      const range = owner.window.document.createRange(); range.setStart(text, 1); range.setEnd(text, 5);
      const source = target.window.document.createRange(); source.setStart(text, 3); source.setEnd(text, 7);
      for (const [how, expected] of [[0, -1], [1, 1], [2, -1], [3, -1]]) {
        assert.equal(range.compareBoundaryPoints(how, source), expected);
      }
      const foreign = owner.window.document.createRange();
      for (const [how, errorName] of [[99, 'NotSupportedError'], [0, 'WrongDocumentError']]) {
        assert.throws(() => range.compareBoundaryPoints(how, foreign), (error) => {
          assert.equal(error.name, errorName); assert.ok(error instanceof owner.window.DOMException); return true;
        });
      }
      const clone = range.cloneRange();
      assert.notEqual(clone, range); assert.ok(clone instanceof owner.window.Range);
      clone.collapse(true); assert.equal(clone.startOffset, 1); assert.equal(clone.endOffset, 1);
      assert.equal(range.endOffset, 5);
      range.collapse(); assert.equal(range.startOffset, 5); assert.equal(range.endOffset, 5);
      text.insertData(0, '!');
      assert.equal(clone.startOffset, 2); assert.equal(range.startOffset, 6);
    } finally { owner.window.close(); target.window.close(); }
  });
}

test('should copy native values independently and reject stale endpoints for every comparison mode', () => {
  const { NativeTree, NativeRange, RangeComparison } = require('../dist/native.cjs');
  const tree = new NativeTree();
  const first = tree.allocate(); const second = tree.allocate();
  const source = new NativeRange(); source.setStart(first, -0); source.setEnd(second, 7);
  const before = NativeRange.statistics();
  const copy = source.copy();
  assert.equal(NativeRange.statistics().created, before.created + 1);
  assert.ok(Object.is(copy.startOffset, -0));
  assert.deepEqual(copy.collapsePlan(true), { node: first, offset: -0, updateStart: false });
  assert.deepEqual(copy.collapsePlan(false), { node: second, offset: 7, updateStart: true });
  copy.setStart(first, 2); assert.ok(Object.is(source.startOffset, -0));
  assert.equal(tree.compareRangeStates(source, 0, copy), RangeComparison.Before);
  const reserved = tree.reserveHandles();
  for (const how of [0, 1, 2, 3, 99]) {
    for (const endpoint of ['setStart', 'setEnd']) {
      const invalid = source.copy(); invalid[endpoint](reserved, 0);
      assert.throws(() => tree.compareRangeStates(invalid, how, source), { code: 'InvalidArg' });
      assert.throws(() => tree.compareRangeStates(source, how, invalid), { code: 'InvalidArg' });
    }
  }
  tree.release(first); tree.release(second);
  assert.equal(tree.statistics().liveNodes, 0); assert.equal(copy.endOffset, 7);
});
