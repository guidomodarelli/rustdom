/** @file Connects the pinned Element read methods to canonical native value and presence operations. */
import { replaceRegion } from './build-event-dispatch.mjs';

/**
 * Preserve the original methods as observable entry points while moving their lookup/projection decisions to Rust.
 * @param {string} source - Pinned Element implementation.
 * @param {Function} substituteOnce - Checked upstream substitution.
 * @returns {string} Element source using one native operation for each read.
 */
export function patchAttributeReads(source, substituteOnce) {
  source = replaceRegion(source, '  getAttribute(name) {', '  setAttribute(name, value) {',
    '  getAttribute(name) {\n    return domSymbolTree.attributeValueByName(this, name);\n  }\n\n' +
    '  getAttributeNS(namespace, localName) {\n    return domSymbolTree.attributeValueByNamespace(this, namespace, localName);\n  }\n\n', substituteOnce);
  return replaceRegion(source, '  hasAttribute(name) {', '  getAttributeNode(name) {',
    '  hasAttribute(name) {\n    return domSymbolTree.hasAttributeByName(this, name);\n  }\n\n' +
    '  hasAttributeNS(namespace, localName) {\n    return domSymbolTree.hasAttributeByNamespace(this, namespace, localName);\n  }\n\n', substituteOnce);
}
