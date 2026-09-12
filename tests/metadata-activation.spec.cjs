/** @file Verifies atomic activation of metadata handles against the real native addon. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeTree } = require('../dist/native.cjs');

/** @param {number} templateContent - Content handle. @returns {string} Element metadata payload. */
function metadata(templateContent) {
  return JSON.stringify({ kind: 1, name: 'template', namespace: 'http://www.w3.org/1999/xhtml', templateContent });
}

/** Public entry points that share the native metadata commit path. */
const writers = [
  ['setElementMetadata', (tree, handle, template) => tree.setElementMetadata(handle, metadata(template))],
  ['setData', (tree, handle, template) => tree.setData(handle, metadata(template))],
  ['setElementFromAttributes', (tree, handle, template) => tree.setElementFromAttributes(handle, metadata(template), [])],
  ['initializeAttribute', (tree, handle, template) => tree.initializeAttribute(handle,
    JSON.stringify({ kind: 2, name: 'title', value: 'value', templateContent: template }))],
];

for (const [name, write] of writers) {
  test(`should reject ${name} without activating a reserved target when its template handle is invalid`, () => {
    const tree = new NativeTree();
    const reserved = tree.reserveHandles();
    const invalidTemplates = [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, reserved + tree.handleBatchSize];
    for (const invalidTemplate of invalidTemplates) {
      const before = tree.statistics();
      assert.throws(() => write(tree, reserved, invalidTemplate), { code: 'InvalidArg' });
      assert.deepEqual(tree.statistics(), before);
    }
    for (let offset = 0; offset < tree.handleBatchSize; offset += 1) tree.release(reserved + offset);
    assert.equal(tree.statistics().liveNodes, 0);
    assert.equal(tree.statistics().reservedHandles, 0);
  });

  test(`should preserve ${name} metadata when a later template handle is stale`, () => {
    const tree = new NativeTree();
    const element = tree.allocate();
    const fragment = tree.allocate();
    write(tree, element, fragment);
    const stale = tree.allocate(); tree.release(stale);
    const before = tree.statistics();
    assert.throws(() => write(tree, element, stale), { code: 'InvalidArg' });
    assert.deepEqual(tree.statistics(), before);
    tree.release(element); tree.release(fragment);
    assert.equal(tree.statistics().liveNodes, 0);
  });

  test(`should not activate the template when ${name} receives an invalid target handle`, () => {
    const tree = new NativeTree();
    const template = tree.reserveHandles();
    for (const target of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, template + tree.handleBatchSize]) {
      const before = tree.statistics();
      assert.throws(() => write(tree, target, template), { code: 'InvalidArg' });
      assert.deepEqual(tree.statistics(), before);
    }
  });
}

test('should activate shared or existing template handles only once', () => {
  const tree = new NativeTree();
  const first = tree.reserveHandles();
  const second = first + 1; const fragment = first + 2;
  tree.setElementMetadata(first, metadata(fragment));
  assert.equal(tree.statistics().allocations, 2);
  tree.setElementMetadata(second, metadata(fragment));
  assert.equal(tree.statistics().allocations, 3);
  tree.setSimpleData(fragment, 11, '');
  const text = tree.allocate(); tree.setSimpleData(text, 3, 'shared'); tree.append(fragment, text);
  assert.equal(tree.serializeHtml(first, true, false), '<template>shared</template>');
  assert.equal(tree.serializeHtml(second, true, false), '<template>shared</template>');
  const before = tree.statistics().allocations;
  tree.setElementMetadata(first, metadata(fragment));
  assert.equal(tree.statistics().allocations, before);
  for (let offset = 0; offset < tree.handleBatchSize; offset += 1) tree.release(first + offset);
  tree.release(text);
  assert.equal(tree.statistics().liveNodes, 0);
});

test('should keep rejected metadata writes bounded across all reserved targets', () => {
  const tree = new NativeTree();
  const first = tree.reserveHandles();
  const unknown = first + tree.handleBatchSize;
  const before = tree.statistics();
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    const handle = first + (iteration % tree.handleBatchSize);
    assert.throws(() => tree.setElementMetadata(handle, metadata(unknown)), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.statistics(), before);
  for (let offset = 0; offset < tree.handleBatchSize; offset += 1) tree.release(first + offset);
  assert.equal(tree.statistics().liveNodes, 0);
  assert.equal(tree.statistics().reservedHandles, 0);
});

test('should preserve self template handles without double activation', () => {
  const tree = new NativeTree();
  const template = tree.reserveHandles();
  tree.setElementMetadata(template, metadata(template));
  assert.equal(tree.statistics().allocations, 1);
  assert.equal(tree.statistics().liveNodes, 1);
  assert.equal(tree.serializeHtml(template, true, false), '<template></template>');
  const before = tree.statistics().allocations;
  tree.setElementMetadata(template, metadata(template));
  assert.equal(tree.statistics().allocations, before);
  for (let offset = 0; offset < tree.handleBatchSize; offset += 1) tree.release(template + offset);
  assert.equal(tree.statistics().liveNodes, 0);
});
