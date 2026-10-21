/** @file Real-addon value projection, raw boundary errors, diagnostics and lifetime contracts. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../dist/index.cjs');
const { NativeTree } = require('../dist/native.cjs');

test('should execute each public Element attribute read once in Rust without resolving Attr wrappers', () => {
  const { window } = new runtime.JSDOM('<!doctype html><body>');
  try {
    const element = window.document.createElement('section'); element.setAttribute('data-key', 'value');
    const before = runtime.getNativeTreeStatistics().nativeAttributeReads;
    assert.equal(element.getAttribute('DATA-KEY'), 'value');
    assert.equal(element.getAttributeNS('', 'data-key'), 'value');
    assert.equal(element.hasAttribute('DATA-KEY'), true);
    assert.equal(element.hasAttributeNS(null, 'data-key'), true);
    assert.equal(runtime.getNativeTreeStatistics().nativeAttributeReads - before, 4);
    const absentBefore = runtime.getNativeTreeStatistics().nativeAttributeReads;
    assert.equal(element.getAttribute('absent'), null); assert.equal(element.getAttributeNS(null, 'absent'), null);
    assert.equal(element.hasAttribute('absent'), false); assert.equal(element.hasAttributeNS('', 'absent'), false);
    assert.equal(runtime.getNativeTreeStatistics().nativeAttributeReads - absentBefore, 4);
  } finally { window.close(); }
});

test('should return independent lossless strings and release canonical attributes after repeated reads', () => {
  const tree = new NativeTree(); const owner = tree.allocate(); const attribute = tree.allocate();
  tree.setHtmlElement(owner, 'section', []); tree.initializeAttributeCollection(owner);
  tree.initializeAttribute(attribute, JSON.stringify({ kind: 2, name: 'key', namespace: [117, 114, 110, 58, 118, 97, 108, 117, 101, 115, 0, 55296], prefix: 'p', value: [0, 55296, 56320] }));
  tree.appendAttribute(owner, attribute);
  const retained = [];
  for (const value of ['', '\0', '\ud800', '𠮷', '\udfff\0'.repeat(4096)]) {
    tree.setAttributeValue(attribute, value);
    const projected = tree.attributeValueByName(owner, 'p:key', true);
    assert.equal(projected, value); retained.push(projected);
    assert.equal(tree.attributeValueByNamespace(owner, 'urn:values\0\ud800', 'key'), value);
    assert.equal(tree.attributeReflectionValue(owner, 'urn:values\0\ud800', 'key'), value);
    assert.equal(tree.hasAttributeByName(owner, 'p:key', false), true);
    assert.equal(tree.hasAttributeByNamespace(owner, 'urn:values\0\ud800', 'key'), true);
  }
  assert.equal(tree.attributeReflectionValue(owner, null, 'missing'), '');
  assert.equal(tree.attributeValueByName(owner, 'missing', true), null);
  tree.release(attribute); tree.release(owner);
  assert.deepEqual(retained, ['', '\0', '\ud800', '𠮷', '\udfff\0'.repeat(4096)]);
  for (const key of ['liveNodes', 'attributeCollections', 'attributeOwners', 'attributeHolders']) assert.equal(tree.statistics()[key], 0);
});

test('should reject raw string coercion and invalid handles without changing canonical ownership', () => {
  const tree = new NativeTree(); const owner = tree.allocate(); const attribute = tree.allocate();
  tree.setHtmlElement(owner, 'section', []); tree.initializeAttributeCollection(owner);
  tree.initializeAttribute(attribute, '{"kind":2,"name":"key","value":"retained"}'); tree.appendAttribute(owner, attribute);
  const before = tree.statistics(); let coercions = 0;
  const rejected = { toString() { coercions++; throw new Error('raw reads must not coerce'); } };
  for (const name of [rejected, Symbol('key'), 7, true, Object('key'), null, undefined]) {
    for (const operation of [() => tree.attributeValueByName(owner, name, true),
      () => tree.attributeValueByNamespace(owner, null, name), () => tree.attributeReflectionValue(owner, null, name),
      () => tree.hasAttributeByName(owner, name, false), () => tree.hasAttributeByNamespace(owner, null, name)]) {
      assert.throws(operation, (error) => error.name === 'Error' && /utf16 string/.test(error.message));
    }
  }
  assert.equal(coercions, 0);
  for (const handle of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => tree.attributeValueByName(handle, 'key', false));
    assert.throws(() => tree.hasAttributeByNamespace(handle, null, 'key'));
  }
  assert.equal(tree.attributeValueByName(owner, 'key', true), 'retained');
  assert.equal(tree.attributeOwner(attribute), owner);
  for (const key of ['liveNodes', 'attributeCollections', 'attributeOwners', 'attributeHolders', 'mutations', 'dataUpdates']) {
    assert.equal(tree.statistics()[key], before[key]);
  }
  tree.release(owner); tree.release(attribute);
  assert.equal(tree.statistics().liveNodes, 0);
});
