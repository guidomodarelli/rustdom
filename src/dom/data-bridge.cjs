/** @module rustdom/data-bridge Encodes private DOM data without losing UTF-16 or invoking prototype toJSON hooks. */
'use strict';
const stringify = JSON.stringify;
const setPrototypeOf = Object.setPrototypeOf;
const isWellFormed = Function.call.bind(String.prototype.isWellFormed);
const charCodeAt = Function.call.bind(String.prototype.charCodeAt);

/** @param {string|null|undefined} value - DOM string. @returns {string|number[]|null} Lossless transport value. */
function wireString(value) {
  if (value == null) return null;
  if (isWellFormed(value)) return value;
  const units = [];
  for (let index = 0; index < value.length; index++) units[index] = charCodeAt(value, index);
  return setPrototypeOf(units, null);
}

/**
 * Snapshot only DOM data; structure remains in the authoritative native forest.
 * @param {object} node - Private jsdom Node implementation.
 * @param {Function} ensure - Resolves a template content fragment to its native handle.
 * @returns {string} Prototype-safe JSON consumed by the native metadata decoder.
 */
function encodeNodeData(node, ensure) {
  const attributes = [];
  if (node._attributeList) for (const attribute of node._attributeList) {
    attributes[attributes.length] = { __proto__: null,
      name: wireString(attribute._localName), namespace: wireString(attribute._namespace),
      prefix: wireString(attribute._namespacePrefix), value: wireString(attribute._value) };
  }
  setPrototypeOf(attributes, null);
  return stringify({ __proto__: null,
    kind: node.nodeType || 0,
    name: wireString(node._localName ?? node.name),
    namespace: wireString(node._namespaceURI), prefix: wireString(node._prefix),
    value: wireString(node._data ?? ''), attributes,
    templateContent: node._templateContents ? ensure(node._templateContents) : 0,
    isValue: wireString(node._isValue),
  });
}

module.exports = { encodeNodeData };
