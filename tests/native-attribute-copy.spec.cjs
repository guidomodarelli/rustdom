/** @file Owned Rust Attr copies preserve data, reject partial destinations and need no source forest. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeTree, NativeAttributeCopy, NativeRange, AttributeField } = require('../dist/native.cjs');
const { JSDOM } = require('jsdom');

/** @param {string|null} value - Actual DOM string. @returns {number[]|null} Lossless native wire input. */
function units(value) { return value === null ? null : Array.from({ length: value.length }, (_, index) => value.charCodeAt(index)); }
/** @param {object} attribute - Real reference Attr. @returns {string} Existing metadata boundary. */
function encode(attribute) {
  return JSON.stringify({ kind: 2, name: units(attribute.localName), namespace: units(attribute.namespaceURI),
    prefix: units(attribute.prefix), value: units(attribute.value) });
}
/** @param {NativeTree} tree - Actual addon. @param {number} id - Copy ID. @returns {object} Observable native fields. */
function fields(tree, id) {
  return { localName: tree.attributeField(id, AttributeField.Name), namespace: tree.attributeField(id, AttributeField.Namespace),
    prefix: tree.attributeField(id, AttributeField.Prefix), value: tree.attributeField(id, AttributeField.Value),
    name: tree.attributeField(id, AttributeField.QualifiedName), owner: tree.attributeOwner(id) };
}
for (const realm of ['default', 'vm']) {
  test(`should copy canonical Attr data independently across forests against real jsdom in ${realm}`, () => {
    const { window } = new JSDOM('<!doctype html><body>', realm === 'vm' ? { runScripts: 'outside-only' } : {});
    try {
      for (const [namespace, name] of [[null, 'id'], ['urn:copy', 'p:key'], ['urn:copy', 'key']]) {
        const source = window.document.createAttributeNS(namespace, name);
        source.value = 'value\0\ud800\udfff🦀';
        window.document.body.setAttributeNodeNS(source);
        const reference = source.cloneNode(true);
        const nativeSource = new NativeTree(), nativeDestination = new NativeTree();
        const sourceId = nativeSource.allocate(); nativeSource.initializeAttribute(sourceId, encode(source));
        const sourceOwner = nativeSource.allocate();
        nativeSource.setHtmlElementMetadata(sourceOwner, 'section');
        nativeSource.initializeAttributeCollection(sourceOwner);
        nativeSource.appendAttribute(sourceOwner, sourceId);
        const copy = NativeAttributeCopy.prepare(nativeSource, sourceId);
        assert.ok(copy instanceof NativeAttributeCopy);
        assert.deepEqual([copy.localName, copy.namespace, copy.prefix, copy.value],
          [reference.localName, reference.namespaceURI, reference.prefix, reference.value]);
        nativeSource.setAttributeValue(sourceId, 'changed after snapshot');
        nativeSource.removeAttribute(sourceOwner, sourceId);
        nativeSource.release(sourceId); nativeSource.release(sourceOwner);
        const copies = [nativeDestination.allocate(), nativeDestination.reserveHandles()];
        for (const id of copies) {
          copy.initialize(nativeDestination, id);
          assert.deepEqual(fields(nativeDestination, id), { localName: reference.localName, namespace: reference.namespaceURI,
            prefix: reference.prefix, value: reference.value, name: reference.name, owner: 0 });
        }
        nativeDestination.setAttributeValue(copies[0], 'independent');
        assert.equal(nativeDestination.attributeField(copies[1], AttributeField.Value), reference.value);
        assert.equal(copy.value, reference.value);
        for (const id of copies) nativeDestination.release(id);
        assert.equal(nativeDestination.statistics().liveNodes, 0);
        assert.equal(nativeDestination.statistics().dataNodes, 0);
      }
    } finally { window.close(); }
  });
}
test('should preserve raw UTF16 null and empty metadata without copying auxiliary handles', () => {
  const source = new NativeTree(), destination = new NativeTree();
  for (const namespace of [null, '', 'urn:\0\ud800']) for (const prefix of [null, '']) {
    const sourceId = source.allocate(), destinationId = destination.allocate();
    source.initializeAttribute(sourceId, JSON.stringify({ kind: 2, name: [107, 55296], namespace: units(namespace),
      prefix: units(prefix), value: [0, 56320, 65] }));
    const copy = NativeAttributeCopy.prepare(source, sourceId);
    copy.initialize(destination, destinationId);
    assert.deepEqual(fields(destination, destinationId), { localName: 'k\ud800', namespace, prefix,
      value: '\0\udc00A', name: prefix === null ? 'k\ud800' : ':k\ud800', owner: 0 });
    source.release(sourceId); destination.release(destinationId);
  }
});
test('should reject invalid sources and nonfresh destinations atomically then accept a valid copy', () => {
  const tree = new NativeTree(), source = tree.allocate();
  tree.initializeAttribute(source, '{"kind":2,"name":"id","value":"kept"}');
  const copy = NativeAttributeCopy.prepare(tree, source), parent = tree.allocate(), child = tree.allocate();
  tree.append(parent, child);
  const element = tree.allocate(); tree.initializeAttributeCollection(element);
  const uninitialized = tree.reserveHandles();
  for (const id of [0, NaN, 0.5, 999999, uninitialized, parent]) {
    const before = tree.statistics();
    assert.throws(() => NativeAttributeCopy.prepare(tree, id));
    assert.deepEqual(tree.statistics(), before);
  }
  for (const id of [0, NaN, 0.5, 999999, source, parent, child, element]) {
    const before = tree.statistics();
    assert.throws(() => copy.initialize(tree, id));
    assert.deepEqual(tree.statistics(), before);
    assert.equal(tree.attributeField(source, AttributeField.Value), 'kept');
  }
  copy.initialize(tree, uninitialized);
  assert.equal(tree.attributeField(uninitialized, AttributeField.Value), 'kept');
});
test('should validate the real native class without reading shadow getters or changing target state', () => {
  const tree = new NativeTree(), source = tree.allocate();
  tree.initializeAttribute(source, '{"kind":2,"name":"id","value":"snapshot"}');
  const copy = NativeAttributeCopy.prepare(tree, source), target = tree.reserveHandles();
  for (const value of [{}, tree, new NativeRange(), Object.create(NativeAttributeCopy.prototype), Object.create(copy), new Proxy(copy, {})]) {
    const before = tree.statistics();
    assert.throws(() => NativeAttributeCopy.prototype.initialize.call(value, tree, target));
    assert.deepEqual(tree.statistics(), before);
  }
  for (const value of [{}, copy, new NativeRange(), Object.create(NativeTree.prototype), new Proxy(tree, {})]) {
    const before = tree.statistics();
    assert.throws(() => NativeAttributeCopy.prepare(value, source));
    assert.throws(() => copy.initialize(value, target));
    assert.deepEqual(tree.statistics(), before);
  }
  let reads = 0;
  for (const property of ['localName', 'namespace', 'prefix', 'value']) {
    Object.defineProperty(copy, property, { get() { reads += 1; throw new Error('Snapshot JS properties must not be read by native initialization'); } });
  }
  copy.initialize(tree, target);
  assert.equal(reads, 0);
  assert.equal(tree.attributeField(target, AttributeField.Value), 'snapshot');
});
