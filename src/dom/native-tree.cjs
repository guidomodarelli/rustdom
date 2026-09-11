/** @module rustdom/native-tree Keeps Rust topology authoritative and JS ownership edges visible to V8 GC. */
'use strict';
const SymbolTree = require('symbol-tree');
const { NativeTree } = require('../../dist/native.cjs');

/**
 * Execute topology changes in Rust, then replay them into V8-visible ownership edges.
 * @extends SymbolTree
 */
class NativeSymbolTree extends SymbolTree {
  /** @param {string} [description] - Debug description for the per-node ownership symbol. */
  constructor(description) {
    super(description);
    this._arena = new NativeTree();
    this._handleBatchSize = this._arena.handleBatchSize;
    this._objects = new Map();
    this._nextHandle = 0;
    this._handleLimit = 0;
    const arena = this._arena;
    const objects = this._objects;
    this._collected = new FinalizationRegistry((id) => {
      objects.delete(id);
      arena.release(id);
    });
  }

  /**
   * Read GC-visible edges without a native call on the hot traversal path.
   * @param {object|null} object - DOM node or a related null pointer.
   * @returns {object|null} Its cached ownership edges, never a separate public DOM wrapper.
   */
  _node(object) {
    if (!object) return null;
    return object[this.symbol] || super._node(object);
  }

  /**
   * Index only nodes that participate in topology or a native traversal.
   * @param {object} object - Real node entering native storage.
   * @returns {number} Its stable native handle.
   */
  _ensure(object) {
    const record = this._node(object);
    if (record.nativeId === undefined) {
      if (this._nextHandle === this._handleLimit) {
        this._nextHandle = this._arena.reserveHandles();
        this._handleLimit = this._nextHandle + this._handleBatchSize;
      }
      record.nativeId = this._nextHandle++;
      record.nativeChildCount = 0;
      this._objects.set(record.nativeId, new WeakRef(object));
      this._collected.register(object, record.nativeId);
    }
    return record.nativeId;
  }

  /** @param {number} id - Native handle or zero. @returns {object|null} The original JS node. */
  _object(id) {
    if (!id) return null;
    const object = this._objects.get(id)?.deref();
    if (!object) throw new Error(`NativeSymbolTree: reachable node ${id} was collected`);
    return object;
  }

  /** @param {object} object - Node to detach. @returns {object} The same node instance. */
  remove(object) {
    const record = this._node(object);
    if (record.nativeId === undefined) return super.remove(object);
    const parent = this._node(record.parent);
    const count = this._arena.remove(record.nativeId);
    super.remove(object);
    if (parent) parent.nativeChildCount = count;
    return object;
  }

  /** @param {object} parent - Parent node. @param {object} child - Detached child. @returns {object} The inserted child. */
  appendChild(parent, child) {
    const record = this._node(parent);
    const count = this._arena.append(this._ensure(parent), this._ensure(child));
    // Call non-dispatching base operations to avoid applying the native write twice.
    if (record.lastChild) super.insertAfter(record.lastChild, child);
    else super.appendChild(parent, child);
    record.nativeChildCount = count;
    return child;
  }

  /** @param {object} parent - Parent node. @param {object} child - Detached child. @returns {object} The inserted child. */
  prependChild(parent, child) {
    const record = this._node(parent);
    const count = this._arena.prepend(this._ensure(parent), this._ensure(child));
    if (record.firstChild) super.insertBefore(record.firstChild, child);
    else super.prependChild(parent, child);
    record.nativeChildCount = count;
    return child;
  }

  /** @param {object} reference - Following sibling. @param {object} child - Detached node. @returns {object} The inserted node. */
  insertBefore(reference, child) {
    const referenceNode = this._node(reference);
    const parent = this._node(referenceNode.parent);
    const count = this._arena.insertBefore(this._ensure(reference), this._ensure(child));
    super.insertBefore(reference, child);
    if (parent) parent.nativeChildCount = count;
    return child;
  }

  /** @param {object} reference - Preceding sibling. @param {object} child - Detached node. @returns {object} The inserted node. */
  insertAfter(reference, child) {
    const referenceNode = this._node(reference);
    const parent = this._node(referenceNode.parent);
    const count = this._arena.insertAfter(this._ensure(reference), this._ensure(child));
    super.insertAfter(reference, child);
    if (parent) parent.nativeChildCount = count;
    return child;
  }

  /** @param {object} object - Parent node. @returns {number} The native-maintained child count. */
  childrenCount(object) { return this._node(object).nativeChildCount || 0; }

  /**
   * Batch pure traversals in Rust; preserve live callback semantics when a filter is supplied.
   * @param {object} object - Inclusive subtree root.
   * @param {object} [options] - Existing SymbolTree array/filter/thisArg options.
   * @returns {object[]} Original nodes in document order.
   */
  treeToArray(object, options) {
    if (options?.filter) return super.treeToArray(object, options);
    const array = options?.array || [];
    if (object) for (const id of this._arena.descendants(this._ensure(object))) array.push(this._object(id));
    return array;
  }

  /** @returns {object} Allocation and operation counters without strong references to nodes. */
  statistics() {
    return { ...this._arena.statistics(), indexedNodes: this._objects.size, handleBatchSize: this._handleBatchSize };
  }
}

module.exports = NativeSymbolTree;
