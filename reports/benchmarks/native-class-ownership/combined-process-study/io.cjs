/** @module combined-streaming-io Hashes independent snapshot artifacts or official executables with bounded reusable buffers. JSON decoding retains its separate smaller limit. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const capture = require('./constants/capture.json');

/** @param {string} filename - Current data file, never a module to import. @param {number} maximumBytes - Explicit resource bound for its role. @param {boolean} independent - Evidence files require independent inodes; installed SDKs may be shared. @param {string} role - Diagnostic role. @returns {string} SHA256 with deterministic descriptor cleanup on every path. */
function hashFile(filename, maximumBytes = capture.maximumSnapshotFileBytes, independent = true, role = 'snapshot') {
  const status = fs.lstatSync(filename);
  assert.ok(status.isFile() && (!independent || status.nlink === 1), 'Combined IO: an independent regular file is required');
  assert.ok(status.size <= maximumBytes, 'Combined IO: file exceeds the declared ' + role + ' reader bound');
  const descriptor = fs.openSync(filename, 'r');
  try {
    const opened = fs.fstatSync(descriptor);
    assert.equal(opened.dev, status.dev); assert.equal(opened.ino, status.ino); assert.equal(opened.size, status.size);
    const digest = createHash('sha256'); const buffer = Buffer.allocUnsafe(capture.hashChunkBytes);
    let length; let total = 0;
    while ((length = fs.readSync(descriptor, buffer, 0, buffer.length, null)) !== 0) {
      total += length; assert.ok(total <= maximumBytes, 'Combined IO: file grew beyond its declared reader bound');
      digest.update(buffer.subarray(0, length));
    }
    assert.equal(total, opened.size); return digest.digest('hex');
  } finally { fs.closeSync(descriptor); }
}
module.exports = { hashFile };
