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
 * @param {boolean} [includeAttributes] - Whether to copy legacy attribute values.
 * @returns {string} Prototype-safe JSON consumed by the native metadata decoder.
 */
function encodeNodeData(node, ensure, includeAttributes = true) {
  const attributes = [];
  if (includeAttributes && node._attributeList) for (const attribute of node._attributeList) {
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
  if (node._attributeList) {
    const attributes = node._attributeList.map(ensure);
    if (node._namespaceURI === HTML_NAMESPACE && !node._prefix && !node._templateContents &&
        node._isValue == null && isWellFormed(node._localName)) {
      arena.setHtmlElementFromAttributes(handle, node._localName, attributes);
    } else {
      arena.setElementFromAttributes(handle, encodeNodeData(node, ensure, false), attributes);
    }
    return;
  }
  arena.setData(handle, encodeNodeData(node, ensure));
}

/** @param {number} kind - Attr node type. @param {object} data - Constructor metadata. @returns {string} Lossless initialization without reading native-backed getters. */
function encodeAttribute(kind, data) {
  return stringify({ __proto__: null, kind,
    name: wireString(data.localName), namespace: wireString(data.namespace),
    prefix: wireString(data.namespacePrefix), value: wireString(data.value === undefined ? '' : data.value) });
}

/** @param {object} arena - Native storage. @param {number} handle - Attr ID. @param {number} kind - Attr kind. @param {object} data - Constructor metadata. @returns {void} */
function writeAttribute(arena, handle, kind, data) {
  const value = data.value === undefined ? '' : data.value;
  if (data.namespace == null && data.namespacePrefix == null && isWellFormed(data.localName) && isWellFormed(value)) {
    arena.initializePlainAttribute(handle, data.localName, value);
  } else {
    arena.initializeAttribute(handle, encodeAttribute(kind, data));
  }
}

module.exports = { writeNodeData, writeAttribute };
