/** @module rustdom/window-errors Forwards unhandled errors without treating duplicate or expired listeners as handlers. */
'use strict';

/**
 * Track actual window error registrations and remove every auxiliary listener at teardown.
 * @param {Window} window - Isolated browser window.
 * @returns {Function} An idempotent disposer for forwarding and user-listener wrappers.
 */
function forwardWindowErrors(window) {
  const add = window.addEventListener;
  const remove = window.removeEventListener;
  const listeners = new Map();

  /** @param {object} record - Listener registration. @returns {void} Removes bookkeeping and its abort hook. */
  function forget(record) {
    const entries = listeners.get(record.callback);
    entries?.delete(record.capture);
    if (!entries?.size) listeners.delete(record.callback);
    record.signal?.removeEventListener('abort', record.onAbort);
  }

  /** @param {ErrorEvent} event - Browser exception. @returns {void} Forwards unhandled errors to the runner. */
  function report(event) {
    if (listeners.size === 0 && typeof window.onerror !== 'function' && event.error != null) {
      event.preventDefault();
      process.emit('uncaughtException', event.error);
    }
  }

  add.call(window, 'error', report);
  window.addEventListener = function (type, callback, options) {
    if (type !== 'error' || callback == null || this !== window ||
      !['object', 'function'].includes(typeof callback)) return add.call(this, type, callback, options);
    const capture = options && ['object', 'function'].includes(typeof options) ? Boolean(options.capture) : Boolean(options);
    const existing = listeners.get(callback)?.get(capture);
    if (existing) return add.call(this, type, existing.wrapper, options);
    const record = { callback, capture, once: Boolean(options?.once), signal: options?.signal, onAbort: null, wrapper: null };
    record.wrapper = function (event) {
      if (record.once) forget(record);
      if (typeof callback === 'function') callback.call(this, event);
      else callback.handleEvent(event);
    };
    const result = add.call(this, type, record.wrapper, options);
    if (!record.signal?.aborted) {
      if (!listeners.has(callback)) listeners.set(callback, new Map());
      listeners.get(callback).set(capture, record);
      record.onAbort = () => forget(record);
      record.signal?.addEventListener('abort', record.onAbort, { once: true });
    }
    return result;
  };
  window.removeEventListener = function (type, callback, options) {
    if (type !== 'error' || this !== window) return remove.call(this, type, callback, options);
    const capture = options && ['object', 'function'].includes(typeof options) ? Boolean(options.capture) : Boolean(options);
    const record = listeners.get(callback)?.get(capture);
    if (!record) return remove.call(this, type, callback, options);
    remove.call(this, type, record.wrapper, options);
    forget(record);
  };
  return () => {
    remove.call(window, 'error', report);
    for (const entries of [...listeners.values()]) for (const record of [...entries.values()]) {
      remove.call(window, 'error', record.wrapper, record.capture);
      forget(record);
    }
    window.addEventListener = add;
    window.removeEventListener = remove;
  };
}

module.exports = { forwardWindowErrors };
