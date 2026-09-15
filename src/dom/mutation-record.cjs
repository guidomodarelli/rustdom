/** @module rustdom/mutation-record Binds immutable native payloads to real WebIDL lists and V8 ownership. */
'use strict';

/**
 * Create the private runtime implementation using its real factories and forest.
 * @param {object} nodeList - Generated NodeList factory from this private runtime.
 * @param {object} tree - NativeSymbolTree for the same runtime.
 * @returns {Function} MutationRecord implementation constructor.
 */
function createMutationRecordImplementation(nodeList, tree) {
  return class MutationRecordImpl {
    /** @param {object} globalObject - Creation realm. @param {unknown[]} args - WebIDL arguments. @param {object} data - Complete producer payload. */
    constructor(globalObject, args, data) {
      this._globalObject = globalObject;
      this._owners = data.owners;
      this._nativeRecord = data.nativeRecord;
      this._selfReference = new WeakRef(this);
    }
    /** @returns {string} Native mutation kind. */
    get type() { return this._nativeRecord.kind; }
    /** @returns {string|null} Attribute local name, preserving null and UTF-16. */
    get attributeName() { return this._nativeRecord.attributeName ?? null; }
    /** @returns {string|null} Attribute namespace snapshot. */
    get attributeNamespace() { return this._nativeRecord.attributeNamespace ?? null; }
    /** @returns {string|null} Old value selected for this observer. */
    get oldValue() { return this._nativeRecord.oldValue ?? null; }
    /** @returns {object} Original target implementation. */
    get target() { this._selfReference.deref(); return tree._object(this._nativeRecord.target); }
    /** @returns {object|null} Previous sibling captured at creation. */
    get previousSibling() { this._selfReference.deref(); return tree._object(this._nativeRecord.previousSibling); }
    /** @returns {object|null} Next sibling captured at creation. */
    get nextSibling() { this._selfReference.deref(); return tree._object(this._nativeRecord.nextSibling); }
    /** @returns {object} Static list; the generated WebIDL getter supplies public SameObject identity. */
    get addedNodes() {
      this._selfReference.deref();
      return nodeList.createImpl(this._globalObject, [], { nodes: this._nativeRecord.addedNodes.map((id) => tree._object(id)) });
    }
    /** @returns {object} Independent static removed-node list in the creation realm. */
    get removedNodes() {
      this._selfReference.deref();
      return nodeList.createImpl(this._globalObject, [], { nodes: this._nativeRecord.removedNodes.map((id) => tree._object(id)) });
    }
  };
}

module.exports = { createMutationRecordImplementation };
