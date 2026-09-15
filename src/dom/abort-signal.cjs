/** @module rustdom/abort-signal Keeps collectible V8 owners and observable dependents while Rust owns abort decisions. */
'use strict';
const { NativeAbortState } = require('../../dist/native.cjs');

/** Resolve native identities without retaining signals, documents or realms. */
const signalOwners = new Map();
/** Holdings are numeric identities only; delayed finalizers cannot root a realm. */
const collectedSignals = new FinalizationRegistry((id) => signalOwners.delete(id));

/** @param {Function} EventTargetImpl - Real private EventTarget base. @param {object} AbortSignal - Generated interface factory. @param {object} DOMException - Generated realm-aware exception factory. @param {Function} fireAnEvent - Existing event host. @param {Function} setupAccessors - Existing onabort integration. @returns {Function} AbortSignal implementation backed by native state. */
function createAbortSignalImplementation(EventTargetImpl, AbortSignal, DOMException, fireAnEvent, setupAccessors) {
  /** Preserve observable abort callbacks without making native graph links V8 ownership edges. @extends EventTargetImpl */
  class AbortSignalImpl extends EventTargetImpl {
    /** @param {object} globalObject - Creation realm. @param {unknown[]} args - Converted constructor arguments. @param {object} privateData - Existing constructor metadata. */
    constructor(globalObject, args, privateData) {
      super(globalObject, args, privateData);
      this._ownerDocument = globalObject.document;
      this._abortState = new NativeAbortState(); this._abortId = this._abortState.id;
      this._reason = undefined; this._dependentRetention = false;
      this._dependentSignals = new Map();
      signalOwners.set(this._abortId, new WeakRef(this));
      collectedSignals.register(this, this._abortId);
      this._eventListeners.onChange = () => this._updateDependentRetention();
      this._algorithmOwners = new Map(); this._algorithmIds = new WeakMap();
      this._primitiveAlgorithmIds = null;
    }
    /** @returns {unknown} Reason owned by the host, without native persistent references. */
    get reason() { return this._reason; }
    /** @param {unknown} value - Exact reason, including undefined initialization. */
    set reason(value) { this._reason = value; this._abortState.aborted = value !== undefined; }
    /** @returns {boolean} Canonical native aborted state. */
    get aborted() { return this._abortState.aborted; }
    /** @returns {boolean} Native composition marker used by the pinned implementation. */
    get dependent() { return this._abortState.dependent; }
    /** @param {boolean} value - Internal composition marker. */
    set dependent(value) { this._abortState.dependent = value; }
    /** @returns {void} @throws {unknown} The exact reason if aborted. */
    throwIfAborted() { if (this.aborted) throw this.reason; }
    /** @param {object} globalObject - Creation realm. @param {unknown} reason - Optional exact reason. @returns {AbortSignalImpl} Already-aborted signal without an abort event. */
    static abort(globalObject, reason) {
      const signal = AbortSignal.createImpl(globalObject, []);
      signal.reason = reason !== undefined ? reason : DOMException.create(globalObject, ['The operation was aborted.', 'AbortError']);
      return signal;
    }
    /** @param {object} globalObject - Creation realm. @param {AbortSignalImpl[]} signals - Fully converted input sequence. @returns {AbortSignalImpl} Native-planned composition with weak graph ownership. */
    static any(globalObject, signals) {
      const result = AbortSignal.createImpl(globalObject, []);
      const plan = result._abortState.initializeAny(signals.map((signal) => signal._abortId));
      if (plan.reasonSource) {
        // The native plan already marked this receiver; only its V8-owned value remains to assign.
        result._reason = signals.find((signal) => signal._abortId === plan.reasonSource).reason;
        return result;
      }
      return result;
    }
    /** @param {object} globalObject - Timer and exception realm. @param {number} milliseconds - Converted unsigned delay. @returns {AbortSignalImpl} Signal using the host's real timer lifecycle. */
    static timeout(globalObject, milliseconds) {
      const signal = AbortSignal.createImpl(globalObject, []);
      globalObject.setTimeout(() => signal._signalAbort(DOMException.create(globalObject, ['The operation timed out.', 'TimeoutError'])), milliseconds);
      return signal;
    }
    /** @param {unknown} reason - Optional abort reason. @returns {void} Applies native dependency decisions before executing any callbacks. */
    _signalAbort(reason) {
      if (this.aborted) return;
      this.reason = reason !== undefined ? reason : DOMException.create(this._globalObject, ['The operation was aborted.', 'AbortError']);
      const dependents = [];
      for (const id of this._abortState.markDependents()) {
        const signal = signalOwners.get(id)?.deref();
        // V8 can collect an unobserved owner before the N-API handle's Drop removes its ID.
        if (!signal) continue;
        signal._reason = this.reason;
        dependents.push(signal);
      }
      // Pin the complete delivery list before releasing roots, including when an algorithm throws.
      this._updateDependentRetention();
      for (const signal of dependents) signal._updateDependentRetention();
      this._runAbortStep();
      for (const signal of dependents) signal._runAbortStep();
    }
    /** @returns {void} Retains only pending dependents with observable abort work, per DOM garbage-collection rules. */
    _updateDependentRetention() {
      const aborted = this.aborted;
      // The pinned accessor leaves its internal listener installed after onabort becomes null.
      const inactiveHandler = this._registeredHandlers?.has('abort') && !this._getEventHandlerFor('abort') ? 1 : 0;
      const retain = !aborted && (this._algorithmOwners.size > 0 || this._eventListeners.listenerCount('abort') > inactiveHandler);
      if (retain === this._dependentRetention && !aborted) return;
      this._dependentRetention = retain;
      for (const id of this._abortState.sourceIds()) {
        const source = signalOwners.get(id)?.deref();
        if (!source) continue;
        if (retain) source._dependentSignals.set(this._abortId, this);
        else source._dependentSignals.delete(this._abortId);
      }
      if (aborted) this._abortState.detachSources();
    }
    /** @returns {void} Runs a live native-ordered algorithm sequence; exceptions preserve remaining state. */
    _runAbortStep() {
      let cursor = 0;
      while ((cursor = this._abortState.nextAlgorithm(cursor)) !== 0) {
        const algorithm = this._algorithmOwners.get(cursor);
        if (!this._algorithmOwners.has(cursor)) throw new Error(`AbortSignal._runAbortStep: missing owner for native algorithm ${cursor}`);
        algorithm();
      }
      this._abortState.clearAlgorithms(); this._algorithmOwners = new Map(); this._algorithmIds = new WeakMap(); this._primitiveAlgorithmIds = null;
      fireAnEvent('abort', this);
    }
    /** @param {unknown} algorithm - Existing internal Set value. @returns {WeakMap|Map} Identity storage preserving Set's primitive behavior. */
    _algorithmIdentityMap(algorithm) {
      if (algorithm !== null && (typeof algorithm === 'object' || typeof algorithm === 'function')) return this._algorithmIds;
      return this._primitiveAlgorithmIds ??= new Map();
    }
    /** @param {Function} algorithm - Real host operation. @returns {void} Keeps callback identity weak and active ownership explicit. */
    _addAlgorithm(algorithm) {
      if (this.aborted) return;
      const identities = this._algorithmIdentityMap(algorithm);
      const id = this._abortState.addAlgorithm(identities.get(algorithm) ?? 0);
      if (id) { identities.set(algorithm, id); this._algorithmOwners.set(id, algorithm); this._updateDependentRetention(); }
    }
    /** @param {Function} algorithm - Existing host operation. @returns {void} Releases its active ownership after native removal. */
    _removeAlgorithm(algorithm) {
      const identities = this._algorithmIdentityMap(algorithm); const id = identities.get(algorithm);
      if (id === undefined) return;
      this._abortState.removeAlgorithm(id); identities.delete(algorithm); this._algorithmOwners.delete(id);
      if (this._algorithmOwners.size === 0) { this._algorithmOwners = new Map(); this._algorithmIds = new WeakMap(); this._primitiveAlgorithmIds = null; }
      this._updateDependentRetention();
    }
  }
  setupAccessors(AbortSignalImpl.prototype, ['abort']);
  const setEventHandler = AbortSignalImpl.prototype._setEventHandlerFor;
  /** @param {string} event - Accessor event name. @param {Function|null} handler - Converted callback. @returns {void} Preserves handler ordering and releases inactive handlers. */
  AbortSignalImpl.prototype._setEventHandlerFor = function (event, handler) {
    setEventHandler.call(this, event, handler);
    this._updateDependentRetention();
  };
  return AbortSignalImpl;
}
module.exports = { createAbortSignalImplementation };
