/** @file Verifies namespace lookup against independent jsdom across contexts and live changes. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

/** @param {Node[]} nodes - Actual DOM nodes. @returns {object[]} Public namespace observations. */
function observe(nodes) {
  return nodes.map((node) => ({ type: node.nodeType,
    uris: [null, '', 'p', 'q', 'xml', 'xmlns', 'missing'].map((prefix) => [prefix, node.lookupNamespaceURI(prefix)]),
    prefixes: [null, '', 'urn:one', 'urn:two', 'urn:element', 'urn:\ud800'].map((namespace) => [namespace, node.lookupPrefix(namespace)]),
    defaults: [null, '', 'urn:one', 'urn:two', 'http://www.w3.org/1999/xhtml'].map((namespace) => [namespace, node.isDefaultNamespace(namespace)]),
  }));
}

/** @param {object} engine - Real implementation. @returns {object[]} Observable state through namespace mutations. */
function inspectMutations(engine) {
  const dom = new engine.JSDOM('<!doctype html><main></main><aside></aside>');
  try {
    const document = dom.window.document;
    const parent = document.querySelector('main');
    const other = document.querySelector('aside');
    parent.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:p', 'urn:one');
    parent.setAttributeNS(XMLNS_NAMESPACE, 'xmlns', 'urn:two');
    other.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:p', 'urn:two');
    const child = document.createElementNS(null, 'child');
    const leaf = document.createElementNS('urn:element', 'q:leaf');
    child.append(leaf, document.createTextNode('text'), document.createComment('comment'));
    parent.append(child);
    const attribute = document.createAttribute('value');
    child.setAttributeNode(attribute);
    const fragment = document.createDocumentFragment();
    const nodes = [document, document.doctype, parent, child, leaf, child.childNodes[1], child.lastChild, attribute, fragment];
    const states = [observe(nodes)];
    const declaration = parent.getAttributeNodeNS(XMLNS_NAMESPACE, 'p');
    declaration.value = 'urn:\ud800'; states.push(observe(nodes));
    child.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:p', ''); states.push(observe(nodes));
    child.removeAttributeNS(XMLNS_NAMESPACE, 'p'); other.append(child); states.push(observe(nodes));
    child.removeAttributeNode(attribute); other.setAttributeNode(attribute); states.push(observe(nodes));
    fragment.append(child); states.push(observe(nodes));
    const shadow = parent.attachShadow({ mode: 'open' });
    const shadowChild = document.createElementNS(null, 'shadow-child');
    shadow.append(shadowChild);
    states.push(observe([shadow, shadowChild]));
    return states;
  } finally { dom.window.close(); }
}

test('should resolve current namespaces after declarations, moves, attribute ownership and fragment changes', () => {
  assert.deepEqual(inspectMutations(engines.rustdom), inspectMutations(engines.jsdom));
});

test('should preserve XML namespace precedence and prefix selection', () => {
  const inspect = (engine) => {
    const dom = new engine.JSDOM('<q:root xmlns:q="urn:element" xmlns:p="urn:one" xmlns="urn:two"><child xmlns:p="urn:two"><leaf/></child></q:root>', { contentType: 'application/xml' });
    try {
      const document = dom.window.document;
      const root = document.documentElement;
      const child = root.firstChild;
      return observe([document, root, child, child.firstChild, root.getAttributeNodeNS(XMLNS_NAMESPACE, 'p')]);
    } finally { dom.window.close(); }
  };
  assert.deepEqual(inspect(engines.rustdom), inspect(engines.jsdom));
});

test('should retain WebIDL conversion and invalid receiver errors', () => {
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM();
    try {
      const node = dom.window.document;
      for (const method of ['lookupPrefix', 'lookupNamespaceURI', 'isDefaultNamespace']) {
        assert.throws(() => node[method](), { name: 'TypeError' });
        assert.throws(() => node[method](Symbol('invalid')), { name: 'TypeError' });
        assert.throws(() => node[method].call({}, null), { name: 'TypeError' });
      }
      assert.equal(node.lookupNamespaceURI(undefined), node.lookupNamespaceURI(null));
    } finally { dom.window.close(); }
  }
});
