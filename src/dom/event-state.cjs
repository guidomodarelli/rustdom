/** @module rustdom/event-state Binds native Event scalars while references and subclass data remain visible to V8. */
'use strict';
const { NativeEventState, EventStateFlag, EventDispatchStatus, EventInvocationEncoding } = require('../../dist/native.cjs');
/** Base dictionary members initialized together; subclass fields retain their original assignment loop. */
const nativeEventInitFields = new Set(['bubbles', 'cancelable', 'composed']);
/** Native bit assignments shared by base properties and dispatch's existing internal flags. */
const flags = { bubbles: EventStateFlag.Bubbles, cancelable: EventStateFlag.Cancelable, composed: EventStateFlag.Composed,
  _initializedFlag: EventStateFlag.Initialized, _stopPropagationFlag: EventStateFlag.PropagationStopped,
  _stopImmediatePropagationFlag: EventStateFlag.ImmediatePropagationStopped, _canceledFlag: EventStateFlag.Canceled,
  _inPassiveListenerFlag: EventStateFlag.PassiveListener, _dispatchFlag: EventStateFlag.Dispatching, isTrusted: EventStateFlag.Trusted };

/** @param {string} type - Converted DOMString. @param {object} init - Converted or internal dictionary. @param {object} defaults - Actual subclass defaults. @returns {object} Native state with base flags. */
function createNativeEvent(type, init, defaults) {
  return new NativeEventState(type, Boolean('bubbles' in init ? init.bubbles : defaults.bubbles),
    Boolean('cancelable' in init ? init.cancelable : defaults.cancelable), Boolean('composed' in init ? init.composed : defaults.composed));
}

/** @param {Function} EventImpl - Actual private Event base class. @returns {void} Installs scalar projections used by WebIDL and dispatch. */
function installNativeEventProperties(EventImpl) {
  for (const [property, flag] of Object.entries(flags)) Object.defineProperty(EventImpl.prototype, property, {
    configurable: true, enumerable: true,
    get() { return this._eventState.flag(flag); },
    set(value) { this._eventState.setFlag(flag, value); },
  });
  for (const [property, nativeProperty] of Object.entries({ type: 'eventType', eventPhase: 'eventPhase', timeStamp: 'timeStamp' })) {
    Object.defineProperty(EventImpl.prototype, property, { configurable: true, enumerable: true,
      get() { return this._eventState[nativeProperty]; }, set(value) { this._eventState[nativeProperty] = value; } });
  }
}

module.exports = { createNativeEvent, nativeEventInitFields, installNativeEventProperties, EventDispatchStatus, EventInvocationEncoding };
