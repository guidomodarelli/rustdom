/** @file Canonical native dataset lookups, name validation and owner rejection. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeTree, DatasetNameStatus } = require('../dist/native.cjs');

/** @returns {object} Real native element with a canonical attribute collection. */
function fixture() { const tree = new NativeTree(); const owner = tree.allocate(); tree.setData(owner, JSON.stringify({ kind: 1, name: 'div' })); tree.initializeAttributeCollection(owner); return { tree, owner }; }
/** @param {NativeTree} tree - Forest. @param {number} owner - Element. @param {object} data - Attr fields. @returns {number} Actual canonical Attr handle. */
function attribute(tree, owner, data) { const id = tree.allocate(); tree.initializeAttribute(id, JSON.stringify({ kind: 2, ...data })); tree.appendAttribute(owner, id); return id; }

test('should deduplicate local names in order and read current values across namespaces', () => {
  const { tree, owner } = fixture();
  const first = attribute(tree, owner, { name: 'data-foo-bar', namespace: 'urn:p', prefix: 'p', value: 'first' });
  attribute(tree, owner, { name: 'data-foo-bar', value: 'second' }); attribute(tree, owner, { name: 'data-UPPER', value: 'ignored' });
  attribute(tree, owner, { name: 'data-', value: 'empty' });
  assert.deepEqual(tree.datasetNames(owner), ['fooBar', '']); assert.equal(tree.datasetValue(owner, 'fooBar'), 'first');
  tree.setAttributeValue(first, 'updated\0\ud800'); assert.equal(tree.datasetValue(owner, 'fooBar'), 'updated\0\ud800');
  tree.removeAttribute(owner, first); assert.equal(tree.datasetValue(owner, 'fooBar'), 'second');
  assert.equal(tree.datasetValue(owner, 'foo-bar'), null); assert.equal(tree.datasetValue(owner, 'UPPER'), null);
});

test('should preserve setter validation and allow unvalidated deletion conversion', () => {
  const { tree } = fixture();
  assert.deepEqual(tree.datasetNamePlan('fooBar', true), { status: DatasetNameStatus.Valid, attribute: 'data-foo-bar' });
  assert.equal(tree.datasetNamePlan('bad-name', true).status, DatasetNameStatus.InvalidProperty);
  assert.deepEqual(tree.datasetNamePlan('space key', true), { status: DatasetNameStatus.InvalidName, attribute: 'data-space key' });
  assert.deepEqual(tree.datasetNamePlan('\ud800', false), { status: DatasetNameStatus.Valid, attribute: 'data-\ud800' });
  assert.equal(tree.datasetNamePlan('x:y', true).status, DatasetNameStatus.Valid);
});

test('should reject missing and non-element owners without changing storage', () => {
  const { tree, owner } = fixture(); const text = tree.allocate(); tree.setData(text, JSON.stringify({ kind: 3, value: 'text' }));
  const before = tree.statistics();
  assert.throws(() => tree.datasetNames(text), /Element/); assert.throws(() => tree.datasetValue(text, 'name'), /Element/);
  tree.release(owner); assert.throws(() => tree.datasetNames(owner));
  assert.equal(tree.statistics().dataUpdates, before.dataUpdates);
});

test('should route public dataset operations through native algorithms', () => {
  const runtime = require('../dist/index.cjs'); const { window } = new runtime.JSDOM('<div data-start="one"></div>');
  try {
    const before = runtime.getNativeTreeStatistics().dataset; const dataset = window.document.querySelector('div').dataset;
    assert.equal(dataset.start, 'one'); dataset.newKey = 'two'; assert.deepEqual(Object.keys(dataset), ['start', 'newKey']); delete dataset.start;
    const after = runtime.getNativeTreeStatistics().dataset;
    assert.ok(after.reads > before.reads); assert.ok(after.enumerations > before.enumerations); assert.ok(after.namePlans > before.namePlans);
  } finally { window.close(); }
});
