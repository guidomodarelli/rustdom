/** @file Creates the AbstractRange binding with native numeric state and GC-visible node references. */
'use strict';

/**
 * Bind the private runtime's Range base class to its authoritative native forest.
 * @param {object} tree - Private NativeSymbolTree instance.
 * @returns {Function} Base constructor consumed by real Range and StaticRange wrappers.
 */
function createAbstractRange(tree) {
  /** Native endpoints own values; these node references keep their DOM graph visible to V8. */
  class AbstractRangeImpl {
    /** @param {object} globalObject - Owning realm. @param {unknown[]} args - WebIDL constructor arguments. @param {object} privateData - Optional initial endpoints. */
    constructor(globalObject, args, privateData) {
      this._globalObject = globalObject;
      tree.initializeRangeState(this, privateData.start, privateData.end);
    }
    /** @returns {object|undefined} Snapshot preserving the old value across later live updates. */
    get _start() {
      return this._rangeStartNode === undefined ? undefined : { node: this._rangeStartNode, offset: this._nativeRange.startOffset };
    }
    /** @returns {object|undefined} Snapshot preserving the old value across later live updates. */
    get _end() {
      return this._rangeEndNode === undefined ? undefined : { node: this._rangeEndNode, offset: this._nativeRange.endOffset };
    }
    /** @returns {object} Original start node identity. */
    get startContainer() { return this._rangeStartNode; }
    /** @returns {number} Canonical native start offset. */
    get startOffset() { return this._nativeRange.startOffset; }
    /** @returns {object} Original end node identity. */
    get endContainer() { return this._rangeEndNode; }
    /** @returns {number} Canonical native end offset. */
    get endOffset() { return this._nativeRange.endOffset; }
    /** @returns {boolean} Native endpoint equality. */
    get collapsed() { return this._nativeRange.collapsed; }
  }
  return AbstractRangeImpl;
}

module.exports = { createAbstractRange };
