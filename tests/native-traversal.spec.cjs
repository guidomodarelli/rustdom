/** @file Tests the exported native traversal protocol on real mutable native forests. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeTree, NativeTraversal, TraversalMethod, TraversalAction, TraversalMoveResult } = require('../dist/native.cjs');

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

test('should preserve every unfiltered movement without allocating suspended operation objects', () => {
  const { tree, root, sibling, text } = fixture();
  for (const mask of [0, 1, 4, 0xffffffff]) {
    for (const active of [false, true]) {
      const direct = tree.createTraversal(root, mask, false); const stepped = tree.createTraversal(root, mask, false);
      direct.active = active; stepped.active = active;
      for (const start of [root, sibling, text]) {
        direct.current = start; stepped.current = start;
        for (const method of Object.values(TraversalMethod)) {
          const expected = tree.traversalStep(stepped, stepped.start(method));
          const allocatedBefore = NativeTraversal.statistics().createdOperations;
          const actual = tree.traversalMove(direct, method);
          assert.equal(NativeTraversal.statistics().createdOperations, allocatedBefore);
          assert.equal(actual, expected.kind === TraversalAction.Recursive ? TraversalMoveResult.Recursive : expected.node);
          assert.equal(direct.current, stepped.current); assert.equal(direct.before, stepped.before);
        }
      }
    }
  }
});

test('should reject direct filtered or foreign-forest movement before changing cursor state', () => {
  const { tree, root } = fixture(); const other = fixture();
  const filtered = tree.createTraversal(root, 1, true); const unfiltered = tree.createTraversal(root, 1, false);
  assert.throws(() => tree.traversalMove(filtered, TraversalMethod.IteratorNext), /without a filter/);
  assert.throws(() => other.tree.traversalMove(unfiltered, TraversalMethod.IteratorNext), /different forest/);
  assert.equal(filtered.current, root); assert.equal(filtered.before, true);
  assert.equal(unfiltered.current, root); assert.equal(unfiltered.before, true);
});

test('should consume a pending filter response once and observe live topology when resuming in one call', () => {
  const { tree, root, text, sibling } = fixture(); const other = fixture();
  const cursor = tree.createTraversal(root, 1, true); const otherCursor = tree.createTraversal(root, 1, true);
  const operation = cursor.start(TraversalMethod.IteratorNext);
  assert.throws(() => tree.traversalResumeStep(cursor, operation, 1), /no filter result/);
  assert.equal(tree.traversalStep(cursor, operation).node, root);
  cursor.active = false;
  assert.throws(() => other.tree.traversalResumeStep(cursor, operation, 3), /different forest/);
  assert.throws(() => tree.traversalResumeStep(otherCursor, operation, 3), /different cursor/);
  tree.remove(text); tree.remove(sibling); tree.append(root, sibling);
  assert.deepEqual(tree.traversalResumeStep(cursor, operation, 3), { kind: TraversalAction.Filter, node: sibling });
  cursor.active = false;
  assert.deepEqual(tree.traversalResumeStep(cursor, operation, 1), { kind: TraversalAction.Accepted, node: sibling });
  assert.throws(() => tree.traversalResumeStep(cursor, operation, 1), /no filter result/);
  assert.equal(cursor.current, sibling); assert.equal(cursor.before, false);
});

test('should run public unfiltered scans without retaining per-movement native operations', () => {
  const runtime = require('../dist/index.cjs'); const { window } = new runtime.JSDOM('<main><a>A</a><b>B</b></main>');
  try {
    const root = window.document.querySelector('main');
    const iterator = window.document.createNodeIterator(root, 1); const walker = window.document.createTreeWalker(root, 1);
    const before = NativeTraversal.statistics().createdOperations;
    assert.equal(iterator.nextNode(), root); assert.equal(iterator.nextNode(), root.firstChild);
    assert.equal(walker.nextNode(), root.firstChild); assert.equal(walker.nextNode(), root.lastChild);
    assert.equal(NativeTraversal.statistics().createdOperations, before);
  } finally { window.close(); }
});

test('should restart an idle operation without accessing an abandoned released candidate', () => {
  const { tree, root, sibling } = fixture(); const cursor = tree.createTraversal(root, 1, true);
  const other = fixture(); const otherCursor = tree.createTraversal(root, 1, true);
  const operation = cursor.start(TraversalMethod.NextNode);
  assert.deepEqual(tree.traversalStep(cursor, operation), { kind: TraversalAction.Filter, node: sibling });
  cursor.active = false; tree.remove(sibling); tree.release(sibling);
  assert.throws(() => other.tree.traversalRestartStep(cursor, operation, TraversalMethod.IteratorNext), /different forest/);
  assert.throws(() => tree.traversalRestartStep(otherCursor, operation, TraversalMethod.IteratorNext), /different cursor/);
  assert.deepEqual(tree.traversalRestartStep(cursor, operation, TraversalMethod.IteratorNext), { kind: TraversalAction.Filter, node: root });
  cursor.active = false;
  assert.equal(tree.traversalResumeStep(cursor, operation, 1).node, root);
});

test('should allocate one reusable operation per filtered cursor across repeated movements and throws', () => {
  const runtime = require('../dist/index.cjs'); const { window } = new runtime.JSDOM('<main><a>A</a><b>B</b></main>');
  try {
    const root = window.document.querySelector('main'); let throws = true;
    const cursor = window.document.createNodeIterator(root, 1, () => { if (throws) throw new Error('filter retry'); return 1; });
    const before = NativeTraversal.statistics().createdOperations;
    for (let index = 0; index < 10; index++) assert.throws(() => cursor.nextNode(), /filter retry/);
    throws = false;
    for (let index = 0; index < 10; index++) { assert.equal(cursor.nextNode(), root); assert.equal(cursor.previousNode(), root); }
    assert.equal(NativeTraversal.statistics().createdOperations, before + 1);
  } finally { window.close(); }
});
