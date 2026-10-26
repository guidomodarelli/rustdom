/** @module rustdom/event-listeners Keeps callback/signal ownership visible to V8 while Rust owns membership and options. */
'use strict';
const { NativeListenerRegistry, ListenerInvocation } = require('../../dist/native.cjs');

/** A storage identity survives an active dispatch even when Window.close replaces the target's storage. */
class ListenerStorage {
  /** @type {Function|null} Own lifetime hook defined without invoking inherited setters. */
  onChange = null;

  /** Allocate native state only after the first accepted listener. */
  constructor() {
    this.native = null; this.records = null; this.identities = null; this.primitiveIdentities = null; this.nextIdentity = 0;
  }

  /** @returns {boolean} Preserves the empty-bucket history used by XHR and frames. */
  get hasEventTypes() { return this.native?.hasEventTypes ?? false; }

  /** @param {string} type - Converted event type. @returns {number} Native active membership without allocating a callback snapshot. */
  listenerCount(type) { return this.native?.listenerCount(type) ?? 0; }

  /** @param {unknown} reference - WebIDL object or the undefined identity of a raw internal callback. @returns {WeakMap|Map} Identity owner. */
  identityMap(reference) {
    return reference !== null && (typeof reference === 'object' || typeof reference === 'function')
      ? this.identities : this.primitiveIdentities;
  }

  /** @param {string} type - Converted event type. @param {Function} callback - Real callback adapter. @param {boolean} capture - Capture flag. @param {boolean} once - One-shot flag. @param {boolean} passive - Passive flag. @param {object|null} signal - Real AbortSignal implementation. @returns {boolean} Whether a new registration was accepted. */
  add(type, callback, capture, once, passive, signal) {
    if (!this.native) {
      this.native = new NativeListenerRegistry(); this.records = new Map();
      this.identities = new WeakMap(); this.primitiveIdentities = new Map();
    }
    const reference = callback.objectReference; const identities = this.identityMap(reference);
    let identity = identities.get(reference);
    if (identity === undefined) {
      if (this.nextIdentity === Number.MAX_SAFE_INTEGER) throw new RangeError('ListenerStorage.add: callback identities exhausted');
      identity = ++this.nextIdentity; identities.set(reference, identity);
    }
    const id = this.native.add(type, identity, Boolean(capture), Boolean(once), Boolean(passive));
    if (!id) return false;
    this.records.set(id, { id, callback, signal, reference, identity });
    this.onChange?.();
    return true;
  }

  /** @param {object} record - Captured V8 owner record. @param {boolean} forgetCallback - Whether no registration uses the callback identity. @returns {void} Releases current ownership without invalidating snapshots. */
  releaseRecord(record, forgetCallback) {
    this.records.delete(record.id);
    if (forgetCallback) this.identityMap(record.reference).delete(record.reference);
    if (this.records.size === 0) {
      this.records = new Map(); this.identities = new WeakMap(); this.primitiveIdentities = new Map(); this.nextIdentity = 0;
    }
    this.onChange?.();
  }

  /** @param {string} type - Converted event type. @param {Function} callback - Real callback adapter. @param {boolean} capture - Capture identity. @returns {void} Removes only the matching registration. */
  remove(type, callback, capture) {
    if (!this.native) return;
    const identity = this.identityMap(callback.objectReference).get(callback.objectReference);
    if (identity === undefined) return;
    const id = this.native.remove(type, identity, Boolean(capture));
    if (id) this.releaseRecord(this.records.get(id), !this.native.hasCallback(identity));
  }

  /** @param {string} type - Event type at invocation start. @param {boolean} capturing - Selected phase. @returns {object|null} Complete callback owners and native-selected indices. */
  snapshot(type, capturing) {
    if (!this.native) return null;
    const { ids, selected } = this.native.snapshotSelection(type, capturing);
    return ids.length ? { owners: ids.map((id) => this.records.get(id)), selected } : null;
  }

  /** @param {object} record - Owner captured before callbacks started. @param {boolean} capturing - Current phase. @returns {number} Native membership/options decision. */
  prepare(record, capturing) {
    const action = this.native.prepareInvocation(record.id, capturing);
    if (action & ListenerInvocation.Once) this.releaseRecord(record, Boolean(action & ListenerInvocation.ForgetCallback));
    return action;
  }
}

/** @returns {ListenerStorage} Empty host owner identity, with no native allocation yet. */
function createListenerStorage() { return new ListenerStorage(); }
module.exports = { createListenerStorage, ListenerInvocation };
