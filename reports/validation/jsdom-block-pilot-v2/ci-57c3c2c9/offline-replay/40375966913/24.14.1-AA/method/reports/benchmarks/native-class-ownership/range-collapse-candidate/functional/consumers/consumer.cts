/** Exercises the declared CJS native-collapse result and numeric state with the actual addon. */
import assert = require('node:assert/strict');
import native = require('@rustdom/rustdom/native');
const range = new native.NativeRange(); range.setStart(1, -0); range.setEnd(2, 7.5);
const startUpdated: boolean = range.collapse(true);
assert.equal(startUpdated, false); assert.equal(range.start?.node, 1); assert.equal(range.end?.node, 1);
assert.ok(Object.is(range.startOffset, -0)); assert.ok(Object.is(range.endOffset, -0));
assert.throws(() => new native.NativeRange().collapse(false), { code: 'InvalidArg' });
console.log(JSON.stringify({ mode: 'CommonJS', collapsed: range.collapsed, startUpdated }));
