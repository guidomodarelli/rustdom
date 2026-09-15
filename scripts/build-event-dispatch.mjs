/** @file Connects the pinned Event/EventTarget implementation to native path and dispatch decisions. */

/**
 * @param {string} source - Pinned implementation already read by the build.
 * @param {string} start - Unique beginning of the replaced region.
 * @param {string} end - Beginning of the first retained statement.
 * @param {string} replacement - Runtime code using native decisions.
 * @param {Function} substituteOnce - Build's exact substitution guard.
 * @returns {string} Updated implementation.
 * @throws {Error} When the pinned implementation no longer has the expected region.
 */
export function replaceRegion(source, start, end, replacement, substituteOnce) {
  const startIndex = source.indexOf(start); const endIndex = source.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex <= startIndex) throw new Error(`rustdom Event dispatch build: missing boundary ${start}`);
  return substituteOnce(source, source.slice(startIndex, endIndex), replacement);
}

/**
 * @param {string} eventSource - Event implementation with native scalars installed.
 * @param {string} targetSource - Original pinned EventTarget implementation.
 * @param {Function} substituteOnce - Build's exact substitution guard.
 * @returns {{eventSource: string, targetSource: string}} Implementations preserving host callbacks and ownership.
 */
export function patchEventDispatch(eventSource, targetSource, substituteOnce) {
  eventSource = replaceRegion(eventSource, '  composedPath() {', '  _initialize(type, bubbles, cancelable) {',
    '  composedPath() {\n' +
    '    return this._eventState.visiblePathIndices().map(index =>\n' +
    '      index < 0 ? this.currentTarget : idlUtils.wrapperForImpl(this._path[index].item));\n  }\n\n', substituteOnce);
  targetSource = substituteOnce(targetSource, 'const DOMException = require("../generated/DOMException");',
    'const DOMException = require("../generated/DOMException");\n' +
    'const { EventDispatchStatus, EventInvocationEncoding } = require("../../../../../event-state.cjs");');
  targetSource = substituteOnce(targetSource,
    '    if (eventImpl._dispatchFlag || !eventImpl._initializedFlag) {',
    '    const dispatchStatus = eventImpl._eventState.prepareDispatch();\n' +
    '    if (dispatchStatus === EventDispatchStatus.UninitializedOrDispatching) {');
  targetSource = substituteOnce(targetSource, '    if (eventImpl.eventPhase !== EVENT_PHASE.NONE) {',
    '    if (dispatchStatus === EventDispatchStatus.InvalidPhase) {');
  targetSource = substituteOnce(targetSource, '    eventImpl.isTrusted = false;\n\n', '');
  targetSource = substituteOnce(targetSource, '    eventImpl._dispatchFlag = true;', '    eventImpl._eventState.beginDispatch();');
  targetSource = replaceRegion(targetSource,
    '      for (let i = eventImpl._path.length - 1; i >= 0; --i) {',
    '    eventImpl.eventPhase = EVENT_PHASE.NONE;',
    '      let code;\n' +
    '      while ((code = eventImpl._eventState.advanceInvocation()) !== EventInvocationEncoding.Complete) {\n' +
    '        const struct = eventImpl._path[Math.floor(code / EventInvocationEncoding.Stride)];\n' +
    '        invokeEventListeners(struct, eventImpl, code & EventInvocationEncoding.Capturing ? "capturing" : "bubbling",\n' +
    '          Boolean(code & EventInvocationEncoding.Invoke));\n' +
    '      }\n    }\n\n', substituteOnce);
  targetSource = substituteOnce(targetSource,
    '    eventImpl._dispatchFlag = false;\n    eventImpl._stopPropagationFlag = false;\n    eventImpl._stopImmediatePropagationFlag = false;',
    '    eventImpl._eventState.finishDispatch();');
  targetSource = substituteOnce(targetSource,
    'function invokeEventListeners(struct, eventImpl, phase) {',
    'function invokeEventListeners(struct, eventImpl, phase, invoke) {');
  targetSource = replaceRegion(targetSource, '  const structIndex = eventImpl._path.indexOf(struct);',
    '  eventImpl.relatedTarget = idlUtils.wrapperForImpl(struct.relatedTarget);',
    '  if (struct.nativeTargetIndex >= 0) eventImpl.target = eventImpl._path[struct.nativeTargetIndex].target;\n\n', substituteOnce);
  targetSource = substituteOnce(targetSource, '  if (eventImpl._stopPropagationFlag) {', '  if (!invoke) {');
  targetSource = substituteOnce(targetSource, '    slotInClosedTree\n  });\n}',
    '    slotInClosedTree\n  });\n' +
    '  eventImpl._path[eventImpl._path.length - 1].nativeTargetIndex =\n' +
    '    eventImpl._eventState.appendPath(rootOfClosedTree, slotInClosedTree, targetOverride !== null);\n}');
  return { eventSource, targetSource };
}
