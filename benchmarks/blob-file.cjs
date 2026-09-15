/** @file Public Blob/File construction and slicing with complete byte validation via FileReader outside timing. */
'use strict';
const assert = require('node:assert/strict');
const { readDomFile } = require('../tests/integration/read-dom-file.cjs');
const SLICES_PER_SAMPLE = 100;
const SLICE_BYTES = 64;

/** @param {object} runtime - Actual engine. @param {Window} window - Actual realm. @param {number} size - Part count or KiB, according to workload. @param {string} name - Workload. @returns {object} Timed construction and asynchronous public validation. */
function blobFixture(runtime, window, size, name) {
  let parts; let expected; let source; let result; let slices; let options = { type: 'TEXT/PLAIN' };
  if (name === 'blob-endings') {
    parts = ['a\r\nb\rc\n🦀\ud800'.repeat(size)]; expected = Buffer.from('a\nb\nc\n🦀\ufffd'.repeat(size)); options = { type: 'TEXT/PLAIN', endings: 'native' };
  } else if (name === 'blob-nested') {
    const unit = Buffer.alloc(256, 65); source = new window.Blob([unit]); parts = Array(size).fill(source); expected = Buffer.alloc(size * 256, 65);
  } else if (name === 'blob-construct') {
    parts = Array.from({ length: size }, (_, index) => new Uint8Array(Buffer.alloc(256, index % 256))); expected = Buffer.concat(parts.map((part) => Buffer.from(part)));
  } else {
    expected = Buffer.alloc(size * 1024, 65); parts = [new Uint8Array(expected)];
    if (name === 'blob-slice') source = new window.Blob(parts);
  }
  const before = runtime.getNativeTreeStatistics?.().blobs;
  return {
    /** @returns {number} Consume actual sizes while retaining results for independent validation. */
    run() {
      if (name === 'blob-slice') { slices = []; let total = 0; for (let index = 0; index < SLICES_PER_SAMPLE; index++) { const slice = source.slice(index, index + SLICE_BYTES, 'IMAGE/PNG'); slices.push(slice); total += slice.size; } return total; }
      result = name === 'file-construct' ? new window.File(parts, 'fixture.txt', { ...options, lastModified: 42 }) : new window.Blob(parts, options);
      return result.size;
    },
    /** @param {number} checksum - Timed result. @returns {Promise<void>} Verify all bytes, types, metadata and native activity outside timing. */
    async validate(checksum) {
      if (before) { const after = runtime.getNativeTreeStatistics().blobs; assert.ok(after.created > before.created); assert.ok(after.concatenations > before.concatenations); assert.equal(after.hostConcatenations, before.hostConcatenations); }
      if (slices) {
        assert.equal(checksum, SLICES_PER_SAMPLE * SLICE_BYTES);
        for (const slice of slices) { assert.equal(slice.type, 'image/png'); assert.equal(slice.size, SLICE_BYTES); }
        const joined = new window.Blob(slices); assert.deepEqual(Buffer.from(await readDomFile(window, joined)), Buffer.alloc(checksum, 65));
      } else {
        assert.equal(checksum, expected.length); assert.equal(result.type, 'text/plain');
        if (name === 'file-construct') { assert.equal(result.name, 'fixture.txt'); assert.equal(result.lastModified, 42); }
        assert.deepEqual(Buffer.from(await readDomFile(window, result)), expected);
      }
    },
  };
}
module.exports = { blobFixture };
