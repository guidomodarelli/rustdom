/** @module xml-serializer-controller Binds native XMLSerializer control to real IDL wrappers and exception realms. */
'use strict';
const { xmlSerializerOperation } = require('../../dist/native.cjs');

/**
 * Retain realm ownership as an ordinary collector-visible JS edge; all operation decisions run in Rust.
 * @param {object} context - Actual generated DOMException factory and IDL utilities.
 * @param {object} context.DOMException - Original private generated module, including observable factory lookup.
 * @param {object} context.utils - Original private IDL utilities.
 * @returns {Function} Binding class compatible with the pinned implementation constructor.
 */
function createXmlSerializerImplementation({ DOMException, utils }) {
  const helpers = {
    exceptionNamespace: DOMException,
    /** @param {object} root - Converted implementation. @returns {unknown} Corresponding public wrapper. */
    wrapper(root) { return utils.wrapperForImpl(root); },
    /** @param {unknown} value - Original receiver. @param {PropertyKey} name - Property selected by Rust. @returns {unknown} Preserve language property-read effects and intrinsic errors. */
    property(value, name) { return value[name]; },
    /** @param {unknown} factory - Already-read non-callable factory. @param {unknown} globalObject - Already-read realm. @param {unknown[]} args - Already-evaluated constructor arguments. @returns {never} Preserve the original engine diagnostic without re-reading the real namespace. */
    invalidFactory(factory, globalObject, args) {
      const DOMException = { create: factory };
      return DOMException.create(globalObject, args);
    },
  };
  return class XMLSerializerImpl {
    /** @param {object} globalObject - Actual wrapper realm, retained only by this binding. */
    constructor(globalObject) { this._globalObject = globalObject; }
    /** @param {object} root - WebIDL-converted Node implementation. @returns {unknown} Serialized text or the original dynamic root result. */
    serializeToString(root) { return xmlSerializerOperation(this, root, helpers); }
  };
}

module.exports = { createXmlSerializerImplementation };
