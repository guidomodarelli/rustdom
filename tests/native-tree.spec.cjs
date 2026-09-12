/** @file Compares the actual native-backed topology contract with the original SymbolTree. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const SymbolTree = require('symbol-tree');
const NativeSymbolTree = require('../dist/native-tree.cjs');
const runtime = require('../dist/index.cjs');
const { NativeTree } = require('../dist/native.cjs');

test('should release incomplete Attr snapshots in a retained native tree without accumulating nodes', () => {
  const tree = new NativeTree(); const root = tree.allocate();
  for (let iteration = 0; iteration < 1024; iteration++) {
    const attribute = tree.allocate(); tree.setData(attribute, JSON.stringify({ kind: 2, value: [0, 0xd800] }));
    tree.append(root, attribute);
    assert.equal(tree.release(attribute), true); assert.equal(tree.release(attribute), false);
    assert.equal(tree.getLinks(root).childCount, 0);
  }
  tree.release(root);
  assert.equal(tree.statistics().liveNodes, 0); assert.equal(tree.statistics().dataNodes, 0);
  assert.equal(tree.statistics().attributeOwners, 0); assert.equal(tree.statistics().attributeHolders, 0);
});

test('should expose controlled native errors without corrupting topology', () => {
  const tree = new NativeTree();
  const root = tree.allocate();
  const child = tree.allocate();
  tree.append(root, child);
  for (const handle of [0, 1.5, NaN, Infinity, 1e10]) {
    assert.throws(() => tree.getLinks(handle), (error) => error.code === 'InvalidArg');
  }
  assert.throws(() => tree.append(child, root), (error) => error.code === 'InvalidArg');
  assert.deepEqual(tree.descendants(root), [root, child]);
  tree.release(root);
  tree.release(child);
  assert.equal(tree.statistics().liveNodes, 0);
});

/** @param {object} tree - Tree implementation. @param {object[]} nodes - Test objects. @returns {object[]} Public relationship observations. */
function observe(tree, nodes) {
  return nodes.map((node) => ({
    parent: tree.parent(node)?.id ?? null,
    previous: tree.previousSibling(node)?.id ?? null,
    next: tree.nextSibling(node)?.id ?? null,
    children: tree.childrenToArray(node).map((child) => child.id),
    count: tree.childrenCount(node),
    index: tree.index(node),
    descendants: tree.treeToArray(node).map((child) => child.id),
  }));
}

test('should preserve topology and indices through deterministic mutation sequences', () => {
  const reference = new SymbolTree();
  const native = new NativeSymbolTree();
  const expected = Array.from({ length: 24 }, (_, id) => reference.initialize({ id }));
  const actual = Array.from({ length: 24 }, (_, id) => native.initialize({ id }));
  const insertions = 500;
  let seed = 9173;
  for (let iteration = 0; iteration < insertions; iteration++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const childIndex = 2 + seed % 22;
    const parentIndex = iteration % 2;
    for (const [tree, nodes] of [[reference, expected], [native, actual]]) {
      const child = nodes[childIndex];
      const parent = nodes[parentIndex];
      tree.remove(child);
      if (iteration % 3 === 0) tree.prependChild(parent, child);
      else if (iteration % 3 === 1 && tree.firstChild(parent)) tree.insertAfter(tree.firstChild(parent), child);
      else tree.appendChild(parent, child);
    }
    assert.deepEqual(observe(native, actual), observe(reference, expected));
    assert.equal(native.compareTreePosition(actual[0], actual[childIndex]),
      reference.compareTreePosition(expected[0], expected[childIndex]));
  }
  // Every insertion is native; removing a never-indexed detached node is a no-op.
  assert.ok(native.statistics().mutations >= insertions);
});

test('should preserve live traversal callbacks when a filter changes the tree', () => {
  for (const Implementation of [SymbolTree, NativeSymbolTree]) {
    const tree = new Implementation();
    const parent = { id: 'parent' };
    const first = { id: 'first' };
    const last = { id: 'last' };
    tree.appendChild(parent, first);
    const result = tree.treeToArray(parent, { filter(node) {
      if (node === first) tree.appendChild(parent, last);
      return true;
    } });
    assert.deepEqual(result.map((node) => node.id), ['parent', 'first', 'last']);
  }
});

test('should preserve nested forests through subtree moves and cache invalidation', () => {
  const reference = new SymbolTree();
  const native = new NativeSymbolTree();
  const expected = Array.from({ length: 40 }, (_, id) => reference.initialize({ id }));
  const actual = Array.from({ length: 40 }, (_, id) => native.initialize({ id }));
  let seed = 48271;
  for (let iteration = 0; iteration < 800; iteration++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const childIndex = seed % expected.length;
    const descendants = new Set(reference.treeToArray(expected[childIndex]));
    const candidates = expected.filter((node) => !descendants.has(node));
    if (!candidates.length) continue;
    const parentIndex = candidates[(seed >>> 8) % candidates.length].id;
    for (const [tree, nodes] of [[reference, expected], [native, actual]]) {
      tree.remove(nodes[childIndex]);
      if (iteration % 2) tree.appendChild(nodes[parentIndex], nodes[childIndex]);
      else tree.prependChild(nodes[parentIndex], nodes[childIndex]);
    }
    assert.deepEqual(observe(native, actual), observe(reference, expected));
  }
});

test('should use native topology for actual DOM moves, fragments and live collections', () => {
  const before = runtime.getNativeTreeStatistics();
  const dom = new runtime.JSDOM('<!doctype html><main><p id=a>A</p><p id=b>B</p></main>');
  try {
    const document = dom.window.document;
    const main = document.querySelector('main');
    const children = main.children;
    const first = document.querySelector('#a');
    const second = document.querySelector('#b');
    main.insertBefore(second, first);
    assert.equal(children[0], second);
    const fragment = document.createDocumentFragment();
    fragment.append(first, document.createTextNode('tail'));
    main.append(fragment);
    assert.equal(fragment.childNodes.length, 0);
    assert.equal(main.textContent, 'BAtail');
    assert.equal(first.parentNode, main);
    assert.equal(first.previousSibling, second);
    assert.equal(main.lastChild.previousSibling, first);
    assert.throws(() => first.append(main), { name: 'HierarchyRequestError' });
    assert.equal(main.textContent, 'BAtail');
    const after = runtime.getNativeTreeStatistics();
    assert.ok(after.allocations > before.allocations);
    assert.ok(after.mutations > before.mutations);
    assert.equal(after.liveNodes, after.indexedNodes);
  } finally { dom.window.close(); }
});

test('should preserve adoption, clone, ranges and normalization with native links', () => {
  const first = new runtime.JSDOM('<!doctype html><p>hello</p>');
  const second = new runtime.JSDOM('<!doctype html>');
  try {
    const paragraph = first.window.document.querySelector('p');
    const cloned = paragraph.cloneNode(true);
    paragraph.append(first.window.document.createTextNode(' world'));
    paragraph.normalize();
    assert.equal(paragraph.childNodes.length, 1);
    const range = first.window.document.createRange();
    range.selectNodeContents(paragraph);
    assert.equal(range.toString(), 'hello world');
    second.window.document.body.append(second.window.document.adoptNode(paragraph));
    assert.equal(paragraph.ownerDocument, second.window.document);
    assert.equal(paragraph.firstChild.ownerDocument, second.window.document);
    assert.equal(cloned.textContent, 'hello');
    assert.equal(first.window.document.querySelector('p'), null);
  } finally { first.window.close(); second.window.close(); }
});
