/** @file Native rectangle state, complete numeric snapshots and public activation. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeDomRect } = require('../dist/native.cjs');

test('should preserve mutable native dimensions and return independent ordered snapshots', () => {
  const rect = new NativeDomRect(2, 3, -5, -7);
  assert.deepEqual(rect.snapshot(), { x: 2, y: 3, width: -5, height: -7, top: -4, right: 2, bottom: 3, left: -3 });
  const snapshot = rect.snapshot(); snapshot.x = 99; rect.x = -0; rect.y = -1; rect.width = Infinity; rect.height = -Infinity;
  assert.ok(Object.is(rect.x, -0)); assert.equal(rect.y, -1); assert.equal(rect.width, Infinity); assert.equal(rect.height, -Infinity);
  assert.equal(rect.right, Infinity); assert.equal(rect.top, -Infinity); assert.ok(Object.is(rect.left, -0));
  assert.equal(snapshot.left, -3);
});

test('should match JavaScript numeric edges for every pair of special native values', () => {
  const values = [0, -0, 1, -1, NaN, Infinity, -Infinity, Number.MAX_VALUE, -Number.MAX_VALUE, Number.MIN_VALUE, -Number.MIN_VALUE];
  for (const origin of values) for (const size of values) {
    const rect = new NativeDomRect(origin, origin, size, size);
    assert.equal(rect.top, Math.min(origin, origin + size)); assert.equal(rect.left, Math.min(origin, origin + size));
    assert.equal(rect.right, Math.max(origin, origin + size)); assert.equal(rect.bottom, Math.max(origin, origin + size));
    const snapshot = rect.snapshot(); assert.equal(snapshot.x, origin); assert.equal(snapshot.height, size); assert.equal(snapshot.top, rect.top);
  }
});

test('should allocate native state for real DOMRect and DOMRectReadOnly factories', () => {
  const runtime = require('../dist/index.cjs'); const { window } = new runtime.JSDOM();
  try {
    const before = NativeDomRect.statistics();
    const rect = new window.DOMRect(2, 3, -4, -5); const readOnly = window.DOMRectReadOnly.fromRect(rect);
    rect.width = 10; assert.equal(rect.right, 12); assert.equal(readOnly.left, -2);
    const after = NativeDomRect.statistics();
    assert.equal(after.created - before.created, 2); assert.equal(after.live - before.live, 2);
  } finally { window.close(); }
});
