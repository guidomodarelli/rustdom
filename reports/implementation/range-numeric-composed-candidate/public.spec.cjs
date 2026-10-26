/** @file Exercises numeric initialization and native collapse together through real addon and public DOM APIs. */
'use strict';
require('./range-initialization-candidate.spec.cjs');
require('./range-collapse-candidate.spec.cjs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { NativeRange, NativeTree } = require('../dist/native.cjs');

test('factory states collapse independently and keep old snapshots unchanged', () => {
  const tree = new NativeTree();
  const text = tree.allocate();
  try {
    tree.setCharacterData(text, 3, 'abcdef');
    const original = NativeRange.fromEndpoints(text, 1, text, 4);
    const snapshot = original.end;
    for (const toStart of [true, false]) {
      const copy = original.copy();
      assert.equal(copy.collapse(toStart), !toStart);
      assert.equal(copy.startOffset, toStart ? 1 : 4);
      assert.equal(copy.endOffset, copy.startOffset);
      assert.equal(tree.rangeTextFromState(copy), '');
      assert.equal(tree.rangeTextFromState(original), 'bcd');
      assert.deepEqual(snapshot, { node: text, offset: 4 });
    }
  } finally { tree.release(text); }
});
