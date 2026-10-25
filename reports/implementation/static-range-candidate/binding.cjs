/** @file Keeps realm factories and GC-visible endpoints while Rust constructs StaticRange state. */
'use strict';
const { initializeStaticRange } = require('../../dist/native.cjs');

/**
 * Bind native StaticRange construction to the existing realm and tree adapters.
 * @param {Function} AbstractRange - Existing base implementation with traced node references.
 * @param {object} tree - Private NativeSymbolTree instance.
 * @param {object} exceptionFactory - Original DOMException namespace.
 * @returns {Function} StaticRange implementation consumed by the real WebIDL wrapper.
 */
function createStaticRange(AbstractRange, tree, exceptionFactory) {
  const helpers = {
    nodeId(node) { return tree._ensure(node); },
    exception(globalObject, message, name) { return exceptionFactory.create(globalObject, [message, name]); },
  };
  return class StaticRangeImpl extends AbstractRange {
    /** @param {object} globalObject - Owning realm. @param {object[]} args - Converted WebIDL arguments. */
    constructor(globalObject, args) {
      const { startContainer, startOffset, endContainer, endOffset } = args[0];
      const nativeCopy = initializeStaticRange(globalObject, startContainer, startOffset, endContainer, endOffset, helpers);
      super(globalObject, [], { nativeCopy, startNode: startContainer, endNode: endContainer });
    }
  };
}

module.exports = { createStaticRange };
