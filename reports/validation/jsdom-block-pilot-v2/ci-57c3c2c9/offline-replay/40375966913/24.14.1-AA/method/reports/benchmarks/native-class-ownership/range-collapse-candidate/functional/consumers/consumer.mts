/** Exercises the declared ESM named/default contracts with the actual native collapse implementation. */
import assert from 'node:assert/strict';
import native, { NativeRange } from '@rustdom/rustdom/native';
assert.equal(native.NativeRange, NativeRange);
const range = new NativeRange(); range.setStart(1, 2); range.setEnd(2, 7.5);
const startUpdated: boolean = range.collapse(false);
assert.equal(startUpdated, true); assert.equal(range.start?.node, 2); assert.equal(range.end?.node, 2);
assert.equal(range.startOffset, 7.5); assert.equal(range.endOffset, 7.5);
assert.throws(() => new NativeRange().collapse(true), { code: 'InvalidArg' });
console.log(JSON.stringify({ mode: 'ESM', collapsed: range.collapsed, startUpdated }));
