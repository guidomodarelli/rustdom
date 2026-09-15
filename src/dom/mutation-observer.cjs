/** @module rustdom/mutation-observer Connects native registrations to WebIDL callbacks and V8 owners. */
'use strict';

/** @param {object} tree - This runtime's native forest. @param {Function} wrapperForImpl - Its generated wrapper conversion. @returns {Function} MutationObserver implementation constructor. */
function createMutationObserverImplementation(tree, wrapperForImpl) {
  return class MutationObserverImpl {
    /** @param {object} globalObject - Creation realm. @param {Function[]} args - Converted callback. */
    constructor(globalObject, args) {
      this._callback = args[0];
      this._recordOwners = new Map();
      this._id = tree.allocateMutationObserver(this);
      this._selfReference = new WeakRef(this);
    }
    /** @param {object} target - Real Node implementation. @param {object} options - Completed WebIDL dictionary conversion. @returns {void} */
    observe(target, options) {
      this._selfReference.deref();
      tree.observeMutations(this, target, options);
    }
    /** @returns {void} Removes native registrations and surviving nodes' ownership edges before clearing records. */
    disconnect() {
      this._selfReference.deref();
      tree.disconnectMutationObserver(this);
      this._recordOwners.clear();
    }
    /** @returns {MutationRecord[]} Existing wrappers in queue order; delivery remains with the host scheduler. */
    takeRecords() {
      this._selfReference.deref();
      return tree.takeMutationRecords(this).map(wrapperForImpl);
    }
  };
}

module.exports = { createMutationObserverImplementation };
