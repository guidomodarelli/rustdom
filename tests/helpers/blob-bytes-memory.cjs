/** @file Exercises native byte copies under forced GC without loading the full DOM; also supports a Node control. */
'use strict';
const assert = require('node:assert/strict');
const mode = process.argv[2] ?? 'native';
const addon = mode === 'control' ? null : require('../../dist/native.cjs');
const native = mode === 'native' ? addon : null;
const cycles = Number(process.argv[3] ?? 100);
assert.ok(Number.isSafeInteger(cycles) && cycles > 0);
/** @param {Buffer[]} parts - Actual byte buffers. @returns {Buffer} Independent bytes through the selected real implementation. */
function concatenate(parts) { return native ? native.concatenateBlobBuffers(parts, Buffer) : Buffer.concat(parts); }

for (let cycle = 0; cycle < cycles; cycle++) {
  const byte = cycle % 256;
  const first = Buffer.alloc(4096, byte); const second = Buffer.from([1, 2, 3]); const output = concatenate([first, second]);
  first.fill(0); assert.equal(output[2048], byte); assert.deepEqual([...output.subarray(4096)], [1, 2, 3]);
  const shared = Buffer.from(new SharedArrayBuffer(8)); shared.fill(byte); assert.equal(concatenate([shared])[7], byte);
  if (native) {
    const values = [Buffer.from([4, 5])];
    Object.defineProperty(values, 1, { get() { values[0] = null; global.gc(); return Buffer.from([6]); } });
    assert.deepEqual([...concatenate(values)], [4, 5, 6]);
  }
  global.gc();
}
process.stdout.write(JSON.stringify({ mode, pass: true, cycles, native: addon?.NativeBlobMetadata.statistics(), references: addon?.classReferenceStatistics() }) + '\n');
