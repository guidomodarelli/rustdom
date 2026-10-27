/** @file Integrates native listener membership into the pinned EventTarget implementation. */
import { replaceRegion } from './build-event-dispatch.mjs';

/** @param {string} source - EventTarget with native dispatch already installed. @param {Function} substituteOnce - Exact pinned-source guard. @returns {string} EventTarget preserving original option conversion, callbacks and error reporting. */
export function patchEventListeners(source, substituteOnce) {
  source = substituteOnce(source, 'const DOMException = require("../generated/DOMException");',
    'const DOMException = require("../generated/DOMException");\n' +
    'const { createListenerStorage, ListenerInvocation } = require("../../../../../event-listeners.cjs");');
  source = substituteOnce(source, '    this._eventListeners = Object.create(null);', '    this._eventListeners = createListenerStorage();');
  source = replaceRegion(source, '    if (!this._eventListeners[type]) {', '    if (signal !== null) {',
    '    if (!this._eventListeners.add(type, callback, capture, once, passive, signal)) return;\n\n', substituteOnce);
  source = replaceRegion(source, '    if (!this._eventListeners[type]) {', '  dispatchEvent(eventImpl) {',
    '    this._eventListeners.remove(type, callback, capture);\n  }\n\n', substituteOnce);
  source = replaceRegion(source, '  if (!listeners || !listeners[type]) {', '    let window = null;',
    '  const snapshot = listeners?.snapshot(type, phase === "capturing");\n  if (snapshot === null || snapshot === undefined) return found;\n' +
    '  found = snapshot.owners.length > 0;\n\n' +
    '  for (const index of snapshot.selected) {\n    const listener = snapshot.owners[index];\n' +
    '    const action = listeners.prepare(listener, phase === "capturing");\n' +
    '    if (action === ListenerInvocation.Missing) continue;\n    found = true;\n' +
    '    if (!(action & ListenerInvocation.Invoke)) continue;\n' +
    '    const callback = listener.callback;\n    const passive = Boolean(action & ListenerInvocation.Passive);\n\n', substituteOnce);
  return source;
}
