/** @file Builds real native snapshot fixtures for implicit attribute transition contracts. */
'use strict';
const { NativeTree, AttributeField, QueryMode } = require('../../dist/native.cjs');

/** @param {string} name - Local element name. @returns {object} HTML metadata. */
function metadata(name = 'div') { return { kind: 1, name, namespace: 'http://www.w3.org/1999/xhtml' }; }

/** Explicit snapshot setters intentionally replace the supplied attribute data. */
const snapshots = {
  setData(tree, element, attributes) {
    tree.setData(element, JSON.stringify({ ...metadata(), attributes: attributes.length
      ? [{ name: 'id', value: 'preserved' }, { name: 'class', value: 'needle' }] : [] }));
  },
  setHtmlElement(tree, element, attributes) {
    tree.setHtmlElement(element, 'div', attributes.length ? ['id', 'preserved', 'class', 'needle'] : []);
  },
  setElementFromAttributes(tree, element, attributes) { tree.setElementFromAttributes(element, JSON.stringify(metadata()), attributes); },
  setHtmlElementFromAttributes(tree, element, attributes) { tree.setHtmlElementFromAttributes(element, 'div', attributes); },
};

/** Implicit transitions all share the canonical collection boundary. */
const operations = {
  appendAttribute: ({ tree, element, incoming }) => tree.appendAttribute(element, incoming),
  setAttribute: ({ tree, element, incoming }) => tree.setAttribute(element, incoming),
  removeAttribute: ({ tree, element, attributes }) => tree.removeAttribute(element, attributes[0]),
  replaceAttribute: ({ tree, element, attributes, incoming }) => tree.replaceAttribute(element, attributes[0], incoming),
  initializeAttributeOwner: ({ tree, element, incoming }) => tree.initializeAttributeOwner(incoming, element),
  setElementMetadata: ({ tree, element }) => tree.setElementMetadata(element, JSON.stringify(metadata('section'))),
  setHtmlElementMetadata: ({ tree, element }) => tree.setHtmlElementMetadata(element, 'section'),
};

/** @param {string} writer - Explicit setter name. @param {boolean} populated - Whether to copy attributes. @returns {object} Native owner and independent Attr handles. */
function fixture(writer, populated = true) {
  const tree = new NativeTree();
  const document = tree.allocate(); const element = tree.allocate();
  const id = tree.allocate(); const className = tree.allocate(); const incoming = tree.allocate();
  tree.setSimpleData(document, 9, '');
  tree.initializePlainAttribute(id, 'id', 'preserved'); tree.initializePlainAttribute(className, 'class', 'needle');
  tree.initializePlainAttribute(incoming, 'data-new', 'incoming');
  const attributes = [id, className];
  snapshots[writer](tree, element, populated ? attributes : []);
  tree.append(document, element);
  return { tree, document, element, attributes, incoming, writer };
}

/** @param {object} state - Real fixture. @returns {object} Observable data, lookup and ownership state. */
function observe({ tree, document, element, attributes, incoming }) {
  return { html: tree.serializeHtml(element, true, false),
    matches: Array.from(tree.query('.needle', document, document, QueryMode.All, false)),
    canonical: tree.attributeIds(element),
    owners: [...attributes, incoming].map((attribute) => tree.attributeOwner(attribute)),
    values: [...attributes, incoming].map((attribute) => tree.attributeField(attribute, AttributeField.Value)) };
}

/** @param {object} state - Owned handles. @returns {void} Releases every fixture record. */
function release({ tree, document, element, attributes, incoming }) {
  for (const handle of [document, element, ...attributes, incoming]) tree.release(handle);
}

module.exports = { snapshots, operations, metadata, fixture, observe, release, NativeTree, AttributeField };
