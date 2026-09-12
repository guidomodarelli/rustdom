/** @file Verifies name enumeration order and namespace duplicates against independent jsdom. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const reference = require('jsdom');
const runtime = require('../dist/index.cjs');
const { NativeTree } = require('../dist/native.cjs');

/** @param {object} element - DOM element. @returns {object} Public ordered names and own-property names. */
function snapshot(element) {
  return { names: element.getAttributeNames(),
    keys: Reflect.ownKeys(element.attributes).filter((name) => typeof name === 'string'),
    attributes: [...element.attributes].map((attribute) => [attribute.name, attribute.namespaceURI]) };
}

/** @param {object} engine - Real DOM implementation. @param {boolean} xml - XML document mode.
 * @returns {object[]} Snapshots before and after removing and reinserting a duplicate qualified name. */
function inspectDuplicates(engine, xml) {
  const dom = new engine.JSDOM(xml ? '<root/>' : '<!doctype html><div></div>',
    xml ? { contentType: 'application/xml' } : {});
  try {
    const element = xml ? dom.window.document.documentElement : dom.window.document.querySelector('div');
    for (const [namespace, name] of [['urn:first', 'p:shared'], ['urn:other', 'q:first'],
      ['urn:second', 'p:shared'], ['urn:upper', 'p:UPPER'], ['urn:third', 'p:shared'],
      ['urn:last', 'q:last']]) element.setAttributeNS(namespace, name, namespace);
    const snapshots = [snapshot(element)];
    element.removeAttributeNS('urn:first', 'shared');
    snapshots.push(snapshot(element));
    element.setAttributeNS('urn:first', 'p:shared', 'reinserted');
    snapshots.push(snapshot(element));
    return snapshots;
  } finally { dom.window.close(); }
}

test('should preserve first-seen supported names and duplicate getAttributeNames across namespaces', () => {
  for (const xml of [false, true]) {
    const actual = inspectDuplicates(runtime, xml);
    assert.deepEqual(actual, inspectDuplicates(reference, xml));
    assert.equal(actual[0].names.filter((name) => name === 'p:shared').length, 3);
    assert.equal(actual[0].keys.filter((name) => name === 'p:shared').length, 1);
    assert.equal(actual[0].keys.includes('p:UPPER'), xml);
    assert.ok(actual[1].keys.indexOf('q:first') < actual[1].keys.indexOf('p:shared'));
  }
});

test('should enumerate large collections repeatedly without changing names or native ownership', () => {
  const dom = new runtime.JSDOM('<!doctype html><div></div>');
  const expected = new reference.JSDOM('<!doctype html><div></div>');
  try {
    const element = dom.window.document.querySelector('div');
    const referenceElement = expected.window.document.querySelector('div');
    for (let index = 0; index < 2048; index++) {
      for (const target of [element, referenceElement]) target.setAttribute(`data-${index}`, `${index}`);
    }
    for (const target of [element, referenceElement]) {
      target.setAttributeNS('urn:first', 'p:shared', 'first');
      target.setAttributeNS('urn:second', 'p:shared', 'second');
    }
    const before = runtime.getNativeTreeStatistics();
    const referenceSnapshot = snapshot(referenceElement);
    for (let repetition = 0; repetition < 12; repetition++) assert.deepEqual(snapshot(element), referenceSnapshot);
    const after = runtime.getNativeTreeStatistics();
    for (const field of ['liveNodes', 'dataNodes', 'attributeCollections', 'attributeOwners', 'attributeHolders']) {
      assert.equal(after[field], before[field], field);
    }
  } finally { dom.window.close(); expected.window.close(); }
});

test('should deduplicate native UTF-16 names without normalizing distinct code units', () => {
  const tree = new NativeTree();
  const element = tree.allocate();
  const attributes = [];
  tree.initializeAttributeCollection(element);
  tree.setHtmlElementMetadata(element, 'div');
  try {
    for (const [index, name] of ['p:\ud800', 'p:\ud801', 'p:\ud800', 'p:lower'].entries()) {
      const attribute = tree.allocate();
      attributes.push(attribute);
      tree.initializeAttribute(attribute, JSON.stringify({ kind: 2, name: name.slice(2).split('').map((unit) => unit.charCodeAt(0)),
        prefix: 'p', namespace: `urn:${index}`, value: '' }));
      tree.appendAttribute(element, attribute);
    }
    assert.deepEqual(tree.attributeNames(element, true, true), ['p:\ud800', 'p:\ud801', 'p:lower']);
    assert.deepEqual(tree.attributeNames(element, false, true), ['p:\ud800', 'p:\ud801', 'p:\ud800', 'p:lower']);
  } finally {
    tree.release(element);
    for (const attribute of attributes) tree.release(attribute);
  }
  assert.equal(tree.statistics().liveNodes, 0);
  assert.equal(tree.statistics().attributeHolders, 0);
});
