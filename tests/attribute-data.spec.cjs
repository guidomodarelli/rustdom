/** @file Verifies canonical native Attr metadata through public DOM contracts. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const reference = require('jsdom');
const runtime = require('../dist/index.cjs');
const { NativeTree, AttributeField } = require('../dist/native.cjs');

/** @param {Attr} attribute - Real Attr object. @returns {object} Observable metadata. */
function describe(attribute) {
  return { name: attribute.name, nodeName: attribute.nodeName, localName: attribute.localName,
    prefix: attribute.prefix, namespaceURI: attribute.namespaceURI, value: attribute.value,
    nodeValue: attribute.nodeValue, textContent: attribute.textContent, specified: attribute.specified,
    owner: attribute.ownerElement?.localName ?? null };
}

for (const [namespace, name] of [[null, 'DATA-X'], ['urn:example', 'p:name'], ['urn:\ud800', 'p:name'],
  ['http://www.w3.org/2000/xmlns/', 'xmlns:p'], ['http://www.w3.org/XML/1998/namespace', 'xml:lang']]) {
  test(`should preserve Attr fields and UTF16 updates for ${name} in ${JSON.stringify(namespace)}`, () => {
    const expected = new reference.JSDOM('<!doctype html><p></p>');
    const actual = new runtime.JSDOM('<!doctype html><p></p>');
    try {
      const attributes = [expected, actual].map((dom) => dom.window.document.createAttributeNS(namespace, name));
      const before = runtime.getNativeTreeStatistics();
      for (const value of ['first', '🦀 &<"', '\ud800\0\udfff', '']) {
        attributes.forEach((attribute) => { attribute.value = value; });
        assert.deepEqual(describe(attributes[1]), describe(attributes[0]));
      }
      attributes.forEach((attribute) => { attribute.nodeValue = 'node-value'; attribute.textContent = 'content'; });
      assert.deepEqual(describe(attributes[1]), describe(attributes[0]));
      assert.ok(runtime.getNativeTreeStatistics().dataUpdates > before.dataUpdates);
      [expected, actual].forEach((dom, index) => dom.window.document.querySelector('p').setAttributeNodeNS(attributes[index]));
      assert.deepEqual(describe(attributes[1]), describe(attributes[0]));
      assert.equal(actual.serialize(), expected.serialize());
    } finally { expected.window.close(); actual.window.close(); }
  });
}

/** @param {object} engine - Real DOM engine. @returns {object} Mutations, ownership and reflected behavior. */
function observe(engine) {
  const dom = new engine.JSDOM('<!doctype html><div id="a"></div><div id="b"></div>');
  try {
    const document = dom.window.document;
    const first = document.getElementById('a');
    const second = document.getElementById('b');
    const observer = new dom.window.MutationObserver(() => {});
    observer.observe(first, { attributes: true, attributeOldValue: true });
    const attribute = document.createAttributeNS('urn:example', 'p:key');
    attribute.value = 'before';
    first.attributes.setNamedItemNS(attribute);
    assert.equal(first.getAttributeNodeNS('urn:example', 'key'), attribute);
    let inUse;
    try { second.setAttributeNodeNS(attribute); } catch (error) { inUse = [error.name, error.code]; }
    attribute.value = 'after\ud800';
    const clone = first.cloneNode(true);
    const removed = first.removeAttributeNode(attribute);
    assert.equal(removed, attribute);
    assert.equal(attribute.ownerElement, null);
    second.setAttributeNodeNS(attribute);
    const replacement = document.createAttributeNS('urn:example', 'q:key');
    replacement.value = 'replacement';
    assert.equal(second.setAttributeNodeNS(replacement), attribute);
    first.classList.add('selected');
    first.dataset.value = 'value';
    first.style.color = 'red';
    const imported = document.implementation.createHTMLDocument('').importNode(second, true);
    const records = observer.takeRecords().map((record) => [record.attributeName, record.attributeNamespace, record.oldValue]);
    observer.disconnect();
    return { inUse, old: describe(attribute), current: describe(replacement), records,
      clone: clone.outerHTML, imported: imported.outerHTML, names: second.getAttributeNames(),
      first: first.outerHTML, second: second.outerHTML, selected: document.querySelector('.selected') === first };
  } finally { dom.window.close(); }
}

test('should preserve NamedNodeMap identity, ownership, replacement, observers, clones and reflection', () => {
  assert.deepEqual(observe(runtime), observe(reference));
});

test('should preserve custom-element attribute callbacks before and after attachment', () => {
  const observeCallbacks = (engine) => {
    const dom = new engine.JSDOM('<!doctype html>');
    try {
      const calls = [];
      class Example extends dom.window.HTMLElement {
        static observedAttributes = ['value'];
        attributeChangedCallback(name, previous, next) { calls.push([name, previous, next, this.getAttribute(name)]); }
      }
      dom.window.customElements.define('attribute-example', Example);
      const element = dom.window.document.createElement('attribute-example');
      element.setAttribute('value', 'one');
      dom.window.document.body.append(element);
      element.getAttributeNode('value').value = 'two';
      element.removeAttribute('value');
      return calls;
    } finally { dom.window.close(); }
  };
  assert.deepEqual(observeCallbacks(runtime), observeCallbacks(reference));
});

test('should reject invalid native Attr handles without replacing existing element metadata', () => {
  const tree = new NativeTree();
  const attribute = tree.allocate();
  const element = tree.allocate();
  tree.initializeAttribute(attribute, JSON.stringify({ kind: 2, name: 'title', value: 'before' }));
  assert.equal(tree.attributeField(attribute, AttributeField.Prefix), null);
  tree.setHtmlElementFromAttributes(element, 'p', [attribute]);
  assert.throws(() => tree.setHtmlElementFromAttributes(element, 'div', [element]), { code: 'InvalidArg' });
  assert.equal(tree.serializeHtml(element, true, false), '<p title="before"></p>');
  tree.setAttributeValue(attribute, '\udfff');
  assert.equal(tree.attributeField(attribute, AttributeField.Value), '\udfff');
  tree.release(attribute); tree.release(element);
  assert.equal(tree.statistics().dataNodes, 0);
});
