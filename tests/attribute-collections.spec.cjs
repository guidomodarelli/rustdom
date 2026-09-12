/** @file Verifies native ordering, caches, ownership and collection visibility against real jsdom. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const reference = require('jsdom');
const runtime = require('../dist/index.cjs');
const { NativeTree } = require('../dist/native.cjs');

/** @param {Function} operation - Public DOM call. @returns {object} Observable result or DOM error. */
function outcome(operation) {
  try { const result = operation(); return { id: result?.marker ?? null }; }
  catch (error) { return { error: error.name, code: error.code }; }
}
/** @param {object} engine - Real engine. @returns {object} DOM objects used by the mutation sequence. */
function fixture(engine) {
  const dom = new engine.JSDOM('<!doctype html><main><div></div><section></section></main>');
  const document = dom.window.document;
  const elements = [...document.querySelectorAll('div, section')];
  const specs = [[null, 'id'], ['urn:one', 'p:key'], ['urn:one', 'q:key'], ['urn:two', 'p:key'],
    [null, 'DATA'], [null, 'Ä'], [null, 'constructor'], [null, '__proto__'], [null, 'length'], [null, 'data-value']];
  const attributes = Array.from({ length: 30 }, (_, index) => {
    const [namespace, name] = specs[index % specs.length];
    const attribute = document.createAttributeNS(namespace, name);
    attribute.marker = index;
    attribute.value = `value-${index}`;
    return attribute;
  });
  return { dom, document, elements, attributes };
}
/** @param {object} state - Fixture. @returns {object} Names, identities, values and owner links. */
function observe(state) {
  return { elements: state.elements.map((element) => ({
    names: element.getAttributeNames(), html: element.outerHTML,
    keys: Object.keys(element.attributes),
    items: Array.from({ length: element.attributes.length + 1 }, (_, index) => element.attributes.item(index)?.marker ?? null),
    named: ['id', 'p:key', 'q:key', 'DATA', 'data', 'Ä', 'constructor', '__proto__', 'length', 'data-value'].map((name) =>
      [name, element.getAttribute(name), element.getAttributeNode(name)?.marker ?? null, element.hasAttribute(name)]),
  })), owners: state.attributes.map((attribute) => state.elements.indexOf(attribute.ownerElement)) };
}

test('should preserve native collections through seeded replacements, removals and value changes', () => {
  const expected = fixture(reference);
  const actual = fixture(runtime);
  let seed = 70231;
  try {
    for (let iteration = 0; iteration < 360; iteration++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const index = seed % expected.attributes.length;
      const ownerIndex = (seed >>> 8) % 2;
      const operation = (state) => {
        const element = state.elements[ownerIndex];
        const attribute = state.attributes[index];
        switch (iteration % 6) {
          case 0: return element.attributes.setNamedItemNS(attribute);
          case 1: attribute.value = `changed-${iteration}\ud800`; return attribute;
          case 2: return element.removeAttributeNode(attribute);
          case 3: return element.setAttributeNode(attribute);
          case 4: return element.attributes.removeNamedItem(attribute.name);
          default: element.removeAttributeNS(attribute.namespaceURI, attribute.localName); return null;
        }
      };
      assert.deepEqual(outcome(() => operation(actual)), outcome(() => operation(expected)), `operation ${iteration}`);
      assert.deepEqual(observe(actual), observe(expected), `state after ${iteration}`);
    }
  } finally { expected.dom.window.close(); actual.dom.window.close(); }
});

test('should preserve legacy aliases independently of current order and namespace lookups', () => {
  const inspect = (engine) => {
    const state = fixture(engine);
    try {
      const [element, other] = state.elements;
      const first = state.attributes[1];
      const replacement = state.attributes[2];
      element.setAttributeNodeNS(first);
      element.setAttributeNodeNS(replacement);
      element.removeAttributeNode(replacement);
      other.setAttributeNodeNS(first);
      first.value = 'moved';
      return { oldName: element.getAttribute('p:key'), currentNames: element.getAttributeNames(),
        byNamespace: element.getAttributeNodeNS('urn:one', 'key')?.marker ?? null,
        oldIdentity: element.getAttributeNode('p:key') === first,
        owner: first.ownerElement === other, other: other.outerHTML };
    } finally { state.dom.window.close(); }
  };
  assert.deepEqual(inspect(runtime), inspect(reference));
});

test('should preserve Unicode supported-property names and template metadata', () => {
  const inspect = (engine) => {
    const dom = new engine.JSDOM('<!doctype html>');
    try {
      const document = dom.window.document;
      const element = document.createElement('div');
      for (const name of ['a', 'A', 'Ä', 'ä', 'İ', 'Σ', 'σ', '𐐀', '𐐨', '\ua7ce', '\ua7d2', '\ua7d4']) element.setAttributeNode(document.createAttributeNS(null, name));
      const names = Reflect.ownKeys(element.attributes).filter((name) => typeof name === 'string');
      const template = document.createElement('template');
      template.innerHTML = '<p title="inert">inside</p>';
      const own = ['Ä', 'ä', 'İ', 'Σ', '\ua7ce', '\ua7d2', '\ua7d4'].map((name) => [name, Object.hasOwn(element.attributes, name)]);
      return { names, own, html: element.outerHTML, template: template.outerHTML };
    } finally { dom.window.close(); }
  };
  assert.deepEqual(inspect(runtime), inspect(reference));
});

test('should reject invalid native operations atomically and clean every collection reference', () => {
  const tree = new NativeTree();
  const first = tree.allocate(); const second = tree.allocate(); const attribute = tree.allocate();
  for (const element of [first, second]) {
    tree.initializeAttributeCollection(element); tree.setHtmlElementMetadata(element, 'div');
  }
  tree.initializePlainAttribute(attribute, 'id', 'value');
  tree.setAttribute(first, attribute);
  assert.throws(() => tree.setAttribute(second, attribute), { code: 'InvalidArg' });
  assert.throws(() => tree.initializePlainAttribute(attribute, 'changed', 'invalid'), { code: 'InvalidArg' });
  tree.setHtmlElementMetadata(first, 'section');
  assert.deepEqual(tree.attributeIds(first), [attribute]);
  assert.equal(tree.attributeOwner(attribute), first);
  assert.equal(tree.serializeHtml(first, true, false), '<section id="value"></section>');
  tree.release(attribute);
  assert.equal(tree.attributeCount(first), 0);
  tree.release(first); tree.release(second);
  assert.equal(tree.statistics().attributeCollections, 0);
  assert.equal(tree.statistics().attributeOwners, 0);
  assert.equal(tree.statistics().attributeHolders, 0);
});

test('should clear constructor-only owners when an element is released', () => {
  const tree = new NativeTree(); const element = tree.allocate(); const attribute = tree.allocate();
  tree.initializeAttributeCollection(element); tree.setHtmlElementMetadata(element, 'div');
  tree.initializePlainAttribute(attribute, 'name', 'value');
  tree.initializeAttributeOwner(attribute, element);
  tree.release(element);
  assert.equal(tree.attributeOwner(attribute), 0);
  tree.release(attribute);
  assert.equal(tree.statistics().attributeOwners, 0);
});
