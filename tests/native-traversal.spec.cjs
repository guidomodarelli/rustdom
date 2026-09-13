/** @file Tests the exported native traversal protocol on real mutable native forests. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeTree, NativeTraversal, TraversalMethod, TraversalAction } = require('../dist/native.cjs');

/** @returns {object} Native element forest with a text child and element sibling. */
function fixture() {
  const tree = new NativeTree();
  const root = tree.allocate(); const text = tree.allocate(); const sibling = tree.allocate();
  tree.setData(root, JSON.stringify({ kind: 1, name: 'root' })); tree.setData(text, JSON.stringify({ kind: 3, value: 'text' }));
  tree.setData(sibling, JSON.stringify({ kind: 1, name: 'child' }));
  tree.append(root, text); tree.append(root, sibling);
  return { tree, root, text, sibling };
}

test('should filter native candidates by type and commit accepted iterator positions', () => {
  const { tree, root, sibling } = fixture(); const cursor = tree.createTraversal(root, 1, false);
  assert.deepEqual(tree.traversalStep(cursor, cursor.start(TraversalMethod.IteratorNext)), { kind: TraversalAction.Accepted, node: root });
  assert.equal(cursor.before, false);
  assert.deepEqual(tree.traversalStep(cursor, cursor.start(TraversalMethod.IteratorNext)), { kind: TraversalAction.Accepted, node: sibling });
  assert.equal(cursor.current, sibling);
  assert.deepEqual(tree.traversalStep(cursor, cursor.start(TraversalMethod.IteratorNext)), { kind: TraversalAction.Complete, node: 0 });
  assert.equal(cursor.current, sibling);
});

test('should reject recursion before masking but allow navigation with no candidates', () => {
  const { tree, root, text } = fixture(); const cursor = tree.createTraversal(root, 1, true);
  const outer = cursor.start(TraversalMethod.IteratorNext);
  assert.equal(tree.traversalStep(cursor, outer).kind, TraversalAction.Filter);
  assert.equal(tree.traversalStep(cursor, cursor.start(TraversalMethod.Parent)).kind, TraversalAction.Complete);
  cursor.current = text;
  assert.equal(tree.traversalStep(cursor, cursor.start(TraversalMethod.IteratorNext)).kind, TraversalAction.Recursive);
  cursor.active = false; outer.resume(1);
  assert.equal(tree.traversalStep(cursor, outer).node, root);
});

test('should reject missing results and foreign forest or cursor operations', () => {
  const { tree, root } = fixture(); const other = fixture();
  const cursor = tree.createTraversal(root, 0xffffffff, true); const operation = cursor.start(TraversalMethod.IteratorNext);
  assert.throws(() => other.tree.traversalStep(cursor, operation), /different forest/);
  const otherCursor = tree.createTraversal(root, 0xffffffff, true);
  assert.throws(() => tree.traversalStep(otherCursor, operation), /different cursor/);
  assert.throws(() => operation.resume(1), /no filter result/);
  assert.equal(tree.traversalStep(cursor, operation).kind, TraversalAction.Filter);
  assert.throws(() => tree.traversalStep(cursor, operation), /filter result is required/);
  cursor.active = false; operation.resume(1);
  assert.throws(() => operation.resume(1), /no filter result/);
  assert.equal(tree.traversalStep(cursor, operation).node, root);
  assert.equal(tree.traversalStep(cursor, operation).kind, TraversalAction.Complete);
});

test('should execute public DOM traversals through native cursor state', () => {
  const runtime = require('../dist/index.cjs'); const before = NativeTraversal.statistics();
  const { window } = new runtime.JSDOM('<main><a>A</a><b>B</b></main>');
  try {
    const root = window.document.querySelector('main');
    const iterator = window.document.createNodeIterator(root, 1); const walker = window.document.createTreeWalker(root, 1);
    assert.equal(iterator.nextNode(), root); assert.equal(walker.nextNode(), root.firstChild);
    assert.ok(NativeTraversal.statistics().created >= before.created + 2);
  } finally { window.close(); }
});
