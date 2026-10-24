/** @file Keeps real failed MutationRecord wrapping balanced while preserving an unpaired UTF-16 payload. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const native = require(process.env.RUSTDOM_CLASS_CONSTRUCTION_NATIVE_MODULE || '../dist/native.cjs');
const { NATIVE_CLASS_FAILED_CONSTRUCTION_ATTEMPTS } = require('../scripts/constants/native-class-memory.cjs');

test('should release failed MutationRecord wraps and preserve the receiver with real unpaired UTF-16', () => {
  const tree = new native.NativeTree();
  const target = tree.allocate();
  try {
    tree.setHtmlElement(target, 'article', []);
    const input = { kind: 'attributes', target, previousSibling: 0, nextSibling: 0,
      attributeName: 'data-state', attributeNamespace: null,
      oldValue: String.fromCharCode(0xd800) + 'original', addedNodes: [], removedNodes: [] };
    assert.equal(input.oldValue.isWellFormed(), false);
    const original = new native.NativeMutationRecord(tree, input);
    for (let attempt = 0; attempt < NATIVE_CLASS_FAILED_CONSTRUCTION_ATTEMPTS; attempt++) {
      const before = native.NativeMutationRecord.statistics();
      assert.throws(() => Reflect.apply(native.NativeMutationRecord, original, [tree, input]), {
        name: 'Error', message: 'Failed to initialize class `constructor`' });
      const after = native.NativeMutationRecord.statistics();
      assert.equal(after.live, before.live);
      assert.equal(after.created - before.created, 1);
      assert.equal(after.released - before.released, 1);
      assert.equal(original.kind, 'attributes');
      assert.equal(original.target, target);
      assert.equal(original.attributeName, 'data-state');
      assert.equal(original.oldValue, input.oldValue);
      assert.equal(original.oldValue.charCodeAt(0), 0xd800);
    }
  } finally { tree.release(target); }
});
