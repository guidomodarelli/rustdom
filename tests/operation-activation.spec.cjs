/** @file Verifies that failed native operations do not consume node reservations. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeTree, QueryMode } = require('../dist/native.cjs');

/** Native topology mutations with two handles. */
const insertions = ['append', 'prepend', 'insertBefore', 'insertAfter'];

for (const operation of insertions) {
  test(`should preserve reservations when ${operation} rejects an unknown second handle`, () => {
    const tree = new NativeTree();
    const reserved = tree.reserveHandles();
    const before = tree.statistics();
    assert.throws(() => tree[operation](reserved, Number.MAX_SAFE_INTEGER), { code: 'InvalidArg', message: /unknown node handle/ });
    assert.deepEqual(tree.statistics(), before);
    assert.throws(() => tree[operation](Number.MAX_SAFE_INTEGER, reserved), { code: 'InvalidArg', message: /unknown node handle/ });
    assert.deepEqual(tree.statistics(), before);
  });

  test(`should preserve reservations when ${operation} rejects an attached child`, () => {
    const tree = new NativeTree();
    const reserved = tree.reserveHandles();
    const root = tree.allocate(); const child = tree.allocate();
    tree.append(root, child);
    const before = tree.statistics();
    assert.throws(() => tree[operation](reserved, child), { code: 'InvalidArg', message: /remove attached node/ });
    assert.deepEqual(tree.statistics(), before);
    assert.deepEqual(tree.descendants(root), [root, child]);
  });

  test(`should preserve reservations when ${operation} rejects a self insertion`, () => {
    const tree = new NativeTree();
    const reserved = tree.reserveHandles();
    const before = tree.statistics();
    const message = operation === 'append' || operation === 'prepend' ? /would create a cycle/ : /own sibling/;
    assert.throws(() => tree[operation](reserved, reserved), { code: 'InvalidArg', message });
    assert.deepEqual(tree.statistics(), before);
  });

  test(`should materialize both handles when ${operation} succeeds`, () => {
    const tree = new NativeTree();
    const first = tree.reserveHandles();
    const child = first + 1;
    const count = tree[operation](first, child);
    assert.equal(tree.statistics().allocations, 2);
    assert.equal(tree.statistics().liveNodes, 2);
    assert.equal(tree.statistics().mutations, 1);
    if (operation === 'append' || operation === 'prepend') {
      assert.equal(count, 1);
      assert.equal(tree.getLinks(child).parent, first);
      assert.deepEqual(tree.descendants(first), [first, child]);
    } else {
      assert.equal(count, 0);
      assert.equal(tree.getLinks(child).parent, 0);
      const sibling = operation === 'insertBefore' ? 'previous' : 'next';
      assert.equal(tree.getLinks(first)[sibling], child);
    }
    for (let offset = 0; offset < tree.handleBatchSize; offset += 1) tree.release(first + offset);
    assert.equal(tree.statistics().liveNodes, 0);
    assert.equal(tree.statistics().reservedHandles, 0);
  });
}

test('should preserve a detached subtree when an insertion would create an ancestor cycle', () => {
  const tree = new NativeTree();
  const root = tree.allocate(); const middle = tree.allocate(); const leaf = tree.allocate();
  tree.append(root, middle); tree.append(middle, leaf);
  const before = tree.statistics();
  for (const operation of insertions) {
    assert.throws(() => tree[operation](leaf, root), { code: 'InvalidArg', message: /would create a cycle/ });
    assert.deepEqual(tree.statistics(), before);
    assert.deepEqual(tree.descendants(root), [root, middle, leaf]);
  }
});

test('should count failed query attempts without materializing either invalid argument', () => {
  const tree = new NativeTree();
  const reserved = tree.reserveHandles();
  const unknown = Number.MAX_SAFE_INTEGER;
  let attempts = 0;
  for (const [root, document] of [[reserved, unknown], [unknown, reserved], [reserved, NaN], [NaN, reserved]]) {
    const before = tree.statistics();
    attempts += 1;
    assert.throws(() => tree.query('*', root, document, QueryMode.All, false), { code: 'InvalidArg' });
    assert.deepEqual(tree.statistics(), { ...before, nativeQueries: attempts });
  }
});

test('should preserve materialization and attempt counters for a successful query fallback', () => {
  const tree = new NativeTree();
  const root = tree.reserveHandles();
  const document = root + 1;
  assert.equal(tree.query('*', root, document, QueryMode.All, false), null);
  assert.equal(tree.statistics().allocations, 2);
  assert.equal(tree.statistics().liveNodes, 2);
  assert.equal(tree.statistics().nativeQueries, 0);
  assert.equal(tree.statistics().queryFallbacks, 1);
  assert.equal(tree.query('*', root, root, QueryMode.All, false), null);
  assert.equal(tree.statistics().allocations, 2);
  assert.equal(tree.statistics().nativeQueries, 0);
  assert.equal(tree.statistics().queryFallbacks, 2);
});

test('should preserve reservations when serialization fails for missing metadata', () => {
  const tree = new NativeTree();
  const reserved = tree.reserveHandles();
  const before = tree.statistics();
  for (const outer of [false, true]) {
    assert.throws(() => tree.serializeHtml(reserved, outer, false), { code: 'InvalidArg', message: /metadata.*not initialized/ });
    assert.deepEqual(tree.statistics(), before);
    assert.throws(() => tree.serializeHtml(Number.MAX_SAFE_INTEGER, outer, false), { code: 'InvalidArg', message: /unknown node handle/ });
    assert.deepEqual(tree.statistics(), before);
  }
});

test('should retain no node records across repeated operation errors on reserved handles', () => {
  const tree = new NativeTree();
  const first = tree.reserveHandles();
  const before = tree.statistics();
  let attempts = 0;
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    const handle = first + (iteration % tree.handleBatchSize);
    for (const operation of insertions) assert.throws(() => tree[operation](handle, handle), { code: 'InvalidArg' });
    assert.throws(() => tree.serializeHtml(handle, true, false), { code: 'InvalidArg' });
    assert.throws(() => tree.query('*', handle, Number.MAX_SAFE_INTEGER, QueryMode.All, false), { code: 'InvalidArg' });
    attempts += 1;
  }
  assert.deepEqual(tree.statistics(), { ...before, nativeQueries: attempts });
  for (let offset = 0; offset < tree.handleBatchSize; offset += 1) tree.release(first + offset);
  assert.equal(tree.statistics().liveNodes, 0);
  assert.equal(tree.statistics().reservedHandles, 0);
});
