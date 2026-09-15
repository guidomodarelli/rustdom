/** @file Native Blob algorithms, safe callback boundaries and byte-copy fallbacks. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeBlobMetadata, concatenateBlobBuffers, normalizeBlobEndings, blobSliceRange } = require('../dist/native.cjs');

test('should copy ordinary buffers into independent storage and preserve empty input', () => {
  const first = Buffer.from([1, 2]); const second = Buffer.from([3, 4]); const before = NativeBlobMetadata.statistics();
  const result = concatenateBlobBuffers([first, second], Buffer); first.fill(9); second.fill(8);
  assert.deepEqual([...result], [1, 2, 3, 4]); assert.equal(concatenateBlobBuffers([], Buffer).length, 0);
  const after = NativeBlobMetadata.statistics(); assert.equal(after.concatenations - before.concatenations, 2); assert.equal(after.copiedBytes - before.copiedBytes, 4);
});

test('should finish all array getters before acquiring pointers or copying bytes', () => {
  const first = Buffer.from([1, 2]); const second = Buffer.from([3, 4]); const inputs = [first];
  Object.defineProperty(inputs, 1, { get() { first[0] = 7; return second; } });
  assert.deepEqual([...concatenateBlobBuffers(inputs, Buffer)], [7, 2, 3, 4]);
  for (const marker of [null, undefined, 42, Symbol('original'), { original: true }]) {
    const throwing = [first]; Object.defineProperty(throwing, 1, { get() { throw marker; } });
    assert.throws(() => concatenateBlobBuffers(throwing, Buffer), (error) => error === marker);
  }
});

test('should delegate shared and detached buffers without reading their bytes in Rust', () => {
  const shared = Buffer.from(new SharedArrayBuffer(4)); shared.set([1, 2, 3, 4]);
  const before = NativeBlobMetadata.statistics(); assert.deepEqual([...concatenateBlobBuffers([shared], Buffer)], [1, 2, 3, 4]);
  const backing = new ArrayBuffer(2); const detached = Buffer.from(backing); structuredClone(backing, { transfer: [backing] });
  let expected; let actual;
  try { expected = [...Buffer.concat([detached])]; } catch (error) { expected = { name: error.name, message: error.message }; }
  try { actual = [...concatenateBlobBuffers([detached], Buffer)]; } catch (error) { actual = { name: error.name, message: error.message }; }
  assert.deepEqual(actual, expected); const after = NativeBlobMetadata.statistics();
  assert.equal(after.concatenations, before.concatenations); assert.equal(after.hostConcatenations - before.hostConcatenations, 2);
});

test('should reject sparse oversized input through the host error without reserving its length', () => {
  const sparse = []; sparse.length = 0xffffffff;
  assert.throws(() => concatenateBlobBuffers(sparse, Buffer), { name: 'TypeError' });
});

test('should retain native MIME and File metadata and exact line and slice rules', () => {
  const metadata = new NativeBlobMetadata('TEXT/PLAIN; CHARSET=UTF-8'); metadata.setFile('name\0\ud800', -0);
  assert.equal(metadata.mimeType, 'text/plain; charset=utf-8'); assert.equal(metadata.fileName, 'name\0\ud800'); assert.ok(Object.is(metadata.lastModified, -0));
  assert.equal(new NativeBlobMetadata('text/é').mimeType, ''); assert.equal(normalizeBlobEndings('a\r\nb\rc\n\ud800'), 'a\nb\nc\n\ud800');
  assert.deepEqual(blobSliceRange(6, -3, -1), { start: 3, end: 5 }); assert.deepEqual(blobSliceRange(6, 4, 1), { start: 4, end: 4 });
});

test('should use native metadata and byte construction through real Blob and File factories', () => {
  const runtime = require('../dist/index.cjs'); const { window } = new runtime.JSDOM();
  try {
    const before = NativeBlobMetadata.statistics(); const blob = new window.Blob(['text'], { type: 'TEXT/PLAIN' });
    const file = new window.File([blob], 'name', { lastModified: 42 }); const slice = file.slice(1, 3);
    assert.equal(blob.type, 'text/plain'); assert.equal(file.name, 'name'); assert.equal(slice.size, 2);
    const after = NativeBlobMetadata.statistics(); assert.equal(after.created - before.created, 3); assert.ok(after.concatenations - before.concatenations >= 3);
  } finally { window.close(); }
});
