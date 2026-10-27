/** @file Exercises the actual MutationRecord allocation and failed-wrap cleanup for an isolated addon candidate. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const native = require(process.env.RUSTDOM_CLASS_CONSTRUCTION_NATIVE_MODULE || '../dist/native.cjs');
const { NATIVE_CLASS_FAILED_CONSTRUCTION_ATTEMPTS, NATIVE_CLASS_INITIALIZATION_ERROR_MESSAGE } = require('../scripts/constants/native-class-memory.cjs');

test('MutationRecord failed wraps release the new payload and preserve the original receiver', () => {
  const tree = new native.NativeTree();
  const target = tree.allocate();
  tree.setHtmlElement(target, 'article', []);
  const input = { kind: 'attributes', target, previousSibling: 0, nextSibling: 0,
    attributeName: 'data-state', attributeNamespace: null, oldValue: '\ud800original', addedNodes: [], removedNodes: [] };
  const original = new native.NativeMutationRecord(tree, input);
  for (let attempt = 0; attempt < NATIVE_CLASS_FAILED_CONSTRUCTION_ATTEMPTS; attempt++) {
    const before = native.NativeMutationRecord.statistics();
    assert.throws(() => Reflect.apply(native.NativeMutationRecord, original, [tree, input]), {
      name: 'Error', message: NATIVE_CLASS_INITIALIZATION_ERROR_MESSAGE });
    const after = native.NativeMutationRecord.statistics();
    assert.equal(after.live, before.live);
    assert.equal(after.created - before.created, 1);
    assert.equal(after.released - before.released, 1);
    assert.equal(original.kind, 'attributes');
    assert.equal(original.target, target);
    assert.equal(original.attributeName, 'data-state');
    assert.equal(original.oldValue, input.oldValue);
  }
  tree.release(target);
});
