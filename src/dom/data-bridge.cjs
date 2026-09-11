/** @module rustdom/data-bridge Encodes private DOM data without losing UTF-16 or invoking prototype toJSON hooks. */
'use strict';
const stringify = JSON.stringify;
const setPrototypeOf = Object.setPrototypeOf;
const isWellFormed = Function.call.bind(String.prototype.isWellFormed);
const charCodeAt = Function.call.bind(String.prototype.charCodeAt);
/** Namespace invariant from the HTML specification. */
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
/** Plain character data and containers have no qualified names or attribute metadata. */
const SIMPLE_NODE_TYPES = new Set([3, 4, 8, 9, 11]);

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

/**
 * Transfer common HTML data directly; preserve the lossless decoder for exceptional strings and namespaces.
 * @param {object} arena - Native storage instance.
 * @param {number} handle - Stable node identifier.
 * @param {object} node - DOM implementation.
 * @param {Function} ensure - Template content handle resolver.
 * @returns {void} Data is committed before returning to the caller.
 */
function writeNodeData(arena, handle, node, ensure) {
  const value = node._data ?? '';
  if (SIMPLE_NODE_TYPES.has(node.nodeType) && isWellFormed(value)) {
    arena.setSimpleData(handle, node.nodeType, value);
    return;
  }
  if (node._namespaceURI === HTML_NAMESPACE && !node._prefix && !node._templateContents &&
      node._isValue == null && isWellFormed(node._localName)) {
    const attributes = [];
    let direct = true;
    for (const attribute of node._attributeList) {
      if (attribute._namespace != null || attribute._namespacePrefix != null ||
          !isWellFormed(attribute._localName) || !isWellFormed(attribute._value)) {
        direct = false;
        break;
      }
      attributes.push(attribute._localName, attribute._value);
    }
    if (direct) {
      arena.setHtmlElement(handle, node._localName, attributes);
      return;
    }
  }
  arena.setData(handle, encodeNodeData(node, ensure));
}

module.exports = { writeNodeData };
