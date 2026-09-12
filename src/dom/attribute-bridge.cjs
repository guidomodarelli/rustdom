/** @module rustdom/attributes Connects native attribute operations to existing DOM reaction and observer hooks. */
'use strict';
const DOMException = require('./generated/DOMException');
const { domSymbolTree } = require('./helpers/internal-constants');
const { queueAttributeMutationRecord } = require('./helpers/mutation-observers');
const { enqueueCECallbackReaction } = require('./helpers/custom-elements');

/** @param {object} element - Owner. @param {object} attribute - Changed Attr metadata. @param {string|null} oldValue - Prior value. @param {string|null} newValue - Current value. @returns {void} */
function notify(element, attribute, oldValue, newValue) {
  const localName = attribute._localName;
  const namespace = attribute._namespace;
  queueAttributeMutationRecord(element, localName, namespace, oldValue);
  if (element._ceState === 'custom') enqueueCECallbackReaction(element, 'attributeChangedCallback', [localName, oldValue, newValue, namespace]);
}

/** @param {object} element - Element. @param {object} attribute - Attr. @returns {boolean} */
exports.hasAttribute = (element, attribute) => domSymbolTree.containsAttribute(element, attribute);
/** @param {object} element - Element. @param {string} name - Already-normalized name. @returns {boolean} */
exports.hasAttributeByName = (element, name) => domSymbolTree.attributeByName(element, name, false) !== null;
/** @param {object} element - Element. @param {string|null} namespace - Namespace. @param {string} name - Local name. @returns {boolean} */
exports.hasAttributeByNameNS = (element, namespace, name) => domSymbolTree.attributeByNamespace(element, namespace, name) !== null;

/** @param {object} element - Element. @param {object} attribute - Attr. @param {string} value - New value. @returns {void} */
exports.changeAttribute = (element, attribute, value) => {
  const previous = attribute._value;
  domSymbolTree.setAttributeValue(attribute, value);
  notify(element, attribute, previous, value);
  element._attrModified(attribute._qualifiedName, value, previous);
};

/** @param {object} element - Element. @param {object} attribute - New Attr. @returns {void} */
exports.appendAttribute = (element, attribute) => {
  domSymbolTree.appendAttribute(element, attribute);
  const value = attribute._value;
  notify(element, attribute, null, value);
  element._attrModified(attribute._qualifiedName, value, null);
};

/** @param {object} element - Element. @param {object} attribute - Attr. @returns {void} */
exports.removeAttribute = (element, attribute) => {
  const value = attribute._value;
  const { changed } = domSymbolTree.removeAttribute(element, attribute);
  // Pinned jsdom queues a record even when a legacy alias is absent from the ordered list.
  notify(element, attribute, value, null);
  if (changed) element._attrModified(attribute._qualifiedName, null, value);
};

/** @param {object} element - Element. @param {object} oldAttribute - Prior Attr. @param {object} newAttribute - Replacement. @returns {void} */
exports.replaceAttribute = (element, oldAttribute, newAttribute) => {
  const previous = oldAttribute._value;
  const value = newAttribute._value;
  const { changed } = domSymbolTree.replaceAttribute(element, oldAttribute, newAttribute);
  notify(element, oldAttribute, previous, value);
  if (changed) element._attrModified(newAttribute._qualifiedName, value, previous);
};

/** @param {object} element - Element. @param {string} name - Qualified name. @returns {object|null} */
exports.getAttributeByName = (element, name) => domSymbolTree.attributeByName(element, name);
/** @param {object} element - Element. @param {string|null} namespace - Namespace. @param {string} name - Local name. @returns {object|null} */
exports.getAttributeByNameNS = (element, namespace, name) => domSymbolTree.attributeByNamespace(element, namespace === '' ? null : namespace, name);
/** @param {object} element - Element. @param {string} name - Local name. @returns {string} */
exports.getAttributeValue = (element, name) => exports.getAttributeByNameNS(element, null, name)?._value ?? '';
/** @param {object} element - Element. @param {string|null} namespace - Namespace. @param {string} name - Local name. @returns {string} */
exports.getAttributeValueNS = (element, namespace, name) => exports.getAttributeByNameNS(element, namespace, name)?._value ?? '';

/** @param {object} element - Target. @param {object} attribute - Attr. @returns {object|null} Previous Attr. */
exports.setAttribute = (element, attribute) => {
  const owner = domSymbolTree.attributeOwner(attribute);
  if (owner !== null && owner !== element) throw DOMException.create(element._globalObject, ['The attribute is in use.', 'InUseAttributeError']);
  const { changed, previous } = domSymbolTree.setAttribute(element, attribute);
  if (!changed) return previous;
  const oldValue = previous?._value ?? null;
  const value = attribute._value;
  notify(element, previous || attribute, oldValue, value);
  element._attrModified(attribute._qualifiedName, value, oldValue);
  return previous;
};

/** @param {object} element - Element. @param {string} name - Local name. @param {string} value - Value. @param {string|null} [prefix] - Prefix. @param {string|null} [namespace] - Namespace. @returns {void} */
exports.setAttributeValue = (element, name, value, prefix = null, namespace = null) => {
  const attribute = exports.getAttributeByNameNS(element, namespace, name);
  if (attribute === null) {
    exports.appendAttribute(element, element._ownerDocument._createAttribute({ namespace, namespacePrefix: prefix, localName: name, value }));
  } else exports.changeAttribute(element, attribute, value);
};

/** @param {object} attribute - Attr. @param {string} value - New value. @returns {void} */
exports.setAnExistingAttributeValue = (attribute, value) => {
  const element = domSymbolTree.attributeOwner(attribute);
  if (element === null) domSymbolTree.setAttributeValue(attribute, value);
  else exports.changeAttribute(element, attribute, value);
};
/** @param {object} element - Element. @param {string} name - Qualified name. @returns {object|null} */
exports.removeAttributeByName = (element, name) => {
  const attribute = exports.getAttributeByName(element, name);
  if (attribute !== null) exports.removeAttribute(element, attribute);
  return attribute;
};
/** @param {object} element - Element. @param {string|null} namespace - Namespace. @param {string} name - Local name. @returns {object|null} */
exports.removeAttributeByNameNS = (element, namespace, name) => {
  const attribute = exports.getAttributeByNameNS(element, namespace, name);
  if (attribute !== null) exports.removeAttribute(element, attribute);
  return attribute;
};
/** @param {object} element - Element. @returns {string[]} */
exports.attributeNames = (element) => domSymbolTree.attributeNames(element);
/** @param {object} element - Element. @returns {boolean} */
exports.hasAttributes = (element) => domSymbolTree.attributeCount(element) > 0;
