/** @file Realm and WebIDL factory wiring around native rectangle state and calculations. */
'use strict';
const { NativeDomRect } = require('../../dist/native.cjs');

/** @param {object} factory - Realm-aware DOMRectReadOnly WebIDL factory. @returns {Function} Private read-only implementation. */
function createReadOnlyRectImplementation(factory) {
  return class DOMRectReadOnlyImpl {
    /** @param {object} globalObject - Creation realm, visible to V8 GC. @param {number[]} values - Converted unrestricted doubles. */
    constructor(globalObject, [x = 0, y = 0, width = 0, height = 0]) {
      this._globalObject = globalObject; this._rect = new NativeDomRect(x, y, width, height);
    }
    /** @param {object} globalObject - Creation realm. @param {object} other - Converted dictionary. @returns {object} Fresh base implementation. */
    static fromRect(globalObject, other) { return factory.createImpl(globalObject, [other.x, other.y, other.width, other.height]); }
    /** @returns {number} Native x coordinate. */
    get x() { return this._rect.x; }
    /** @returns {number} Native y coordinate. */
    get y() { return this._rect.y; }
    /** @returns {number} Native signed width. */
    get width() { return this._rect.width; }
    /** @returns {number} Native signed height. */
    get height() { return this._rect.height; }
    /** @returns {number} Native upper edge, including NaN and signed zero. */
    get top() { return this._rect.top; }
    /** @returns {number} Native right edge. */
    get right() { return this._rect.right; }
    /** @returns {number} Native lower edge. */
    get bottom() { return this._rect.bottom; }
    /** @returns {number} Native left edge. */
    get left() { return this._rect.left; }
    /** @returns {object} Independent data properties in the original implementation realm. */
    toJSON() { return { ...this._rect.snapshot() }; }
  };
}

/** @param {Function} ReadOnly - Shared implementation superclass for WebIDL branding. @param {object} factory - Mutable WebIDL factory. @returns {Function} Mutable implementation. */
function createMutableRectImplementation(ReadOnly, factory) {
  return class DOMRectImpl extends ReadOnly {
    /** @param {object} globalObject - Creation realm. @param {object} other - Converted dictionary. @returns {object} Fresh mutable implementation. */
    static fromRect(globalObject, other) { return factory.createImpl(globalObject, [other.x, other.y, other.width, other.height]); }
    /** @returns {number} Native x coordinate. */
    get x() { return this._rect.x; }
    /** @param {number} value - Converted x coordinate. */
    set x(value) { this._rect.x = value; }
    /** @returns {number} Native y coordinate. */
    get y() { return this._rect.y; }
    /** @param {number} value - Converted y coordinate. */
    set y(value) { this._rect.y = value; }
    /** @returns {number} Native signed width. */
    get width() { return this._rect.width; }
    /** @param {number} value - Converted signed width. */
    set width(value) { this._rect.width = value; }
    /** @returns {number} Native signed height. */
    get height() { return this._rect.height; }
    /** @param {number} value - Converted signed height. */
    set height(value) { this._rect.height = value; }
  };
}
module.exports = { createReadOnlyRectImplementation, createMutableRectImplementation };
