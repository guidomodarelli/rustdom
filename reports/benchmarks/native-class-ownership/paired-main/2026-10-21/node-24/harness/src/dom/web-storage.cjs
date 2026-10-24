/** @file Storage WebIDL/realm and event scheduling around canonical native areas. */
'use strict';
const { StorageSetStatus } = require('../../dist/native.cjs');

/** @param {object} cursor - Native live cursor; owns an area but no Window. @yields {string} Current insertion-ordered key. */
function* storageKeys(cursor) { for (;;) { const key = cursor.next(); if (key === null) return; yield key; } }

/** @param {object} DOMException - Realm factory. @param {object} StorageEvent - Event factory. @param {object} idlUtils - WebIDL symbols. @param {Function} fireAnEvent - Real dispatcher. @returns {Function} Private Storage implementation. */
function createStorageImplementation(DOMException, StorageEvent, idlUtils, fireAnEvent) {
  return class StorageImpl {
    /** @param {object} globalObject - Creation realm. @param {unknown[]} args - Constructor arguments. @param {object} data - Shared native area and host context. */
    constructor(globalObject, args, data) {
      this._associatedWindow = data.associatedWindow; this._items = data.storageArea;
      this._url = data.url; this._type = data.type; this._quota = data.storageQuota; this._globalObject = globalObject;
    }
    /** @param {string|null} key - Changed key. @param {string|null} oldValue - Previous event value. @param {string|null} newValue - New event value. @returns {void} Deliver to the live origin group using the existing realm dispatcher. */
    _dispatchStorageEvent(key, oldValue, newValue) {
      this._associatedWindow._currentOriginData.windowsInSameOrigin.filter((target) => target !== this._associatedWindow)
        .forEach((target) => fireAnEvent('storage', target, StorageEvent, { key, oldValue, newValue, url: this._url, storageArea: target['_' + this._type] }));
    }
    /** @returns {number} Canonical entry count. */
    get length() { return this._items.size; }
    /** @param {number} index - WebIDL unsigned index. @returns {string|null} Insertion-ordered key. */
    key(index) { return this._items.key(index); }
    /** @param {string} key - Converted key. @returns {string|null} Exact native UTF16 value. */
    getItem(key) { return this._items.get(key); }
    /** @param {string} key - Converted key. @param {string} value - Converted value. @returns {void} Preserve quota validation, scheduling and commit order. */
    setItem(key, value) {
      const plan = this._items.planSet(key, value, this._quota);
      if (plan.status === StorageSetStatus.Unchanged) return;
      if (plan.status === StorageSetStatus.QuotaExceeded) throw DOMException.create(this._globalObject, [`The ${this._quota}-code unit storage quota has been exceeded.`, 'QuotaExceededError']);
      setTimeout(this._dispatchStorageEvent.bind(this), 0, key, plan.oldValue ?? null, value);
      this._items.set(key, value);
    }
    /** @param {string} key - Converted key. @returns {void} Schedule the exact previous value before native deletion. */
    removeItem(key) {
      const previous = this._items.get(key); if (previous === null) return;
      setTimeout(this._dispatchStorageEvent.bind(this), 0, key, previous, null); this._items.delete(key);
    }
    /** @returns {void} Schedule only for a nonempty area; clear the current state after scheduling. */
    clear() {
      if (this._items.size === 0) return;
      setTimeout(this._dispatchStorageEvent.bind(this), 0, null, null, null); this._items.clear();
    }
    /** @returns {Generator<string>} Live iteration even when named-property checks mutate storage. */
    get [idlUtils.supportedPropertyNames]() { return storageKeys(this._items.keyCursor()); }
  };
}
module.exports = { createStorageImplementation };
