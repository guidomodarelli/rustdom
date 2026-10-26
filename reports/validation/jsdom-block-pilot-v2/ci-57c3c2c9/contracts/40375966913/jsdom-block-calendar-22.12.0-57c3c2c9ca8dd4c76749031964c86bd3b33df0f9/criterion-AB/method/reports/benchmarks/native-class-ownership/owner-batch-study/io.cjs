/** @module owner-batch-data-io Bounded data decoding and atomic owned progress; no captured implementation is imported. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('./constants/capture.json');
const { hashFile } = require('../combined-process-study/io.cjs');

/** @param {string} filename - Physical bounded JSON data file. @returns {object} Parsed data after stable-size checks and descriptor cleanup. */
function readJSON(filename) {
  const status = fs.lstatSync(filename);
  assert.ok(status.isFile() && status.nlink === 1 && status.size <= policy.maximumJSONBytes,
    'Owner batch IO: bounded independent JSON file required');
  const descriptor = fs.openSync(filename, 'r');
  try {
    const opened = fs.fstatSync(descriptor);
    assert.equal(opened.dev, status.dev); assert.equal(opened.ino, status.ino); assert.equal(opened.size, status.size);
    const bytes = Buffer.allocUnsafe(opened.size); let total = 0;
    while (total < bytes.length) {
      const length = fs.readSync(descriptor, bytes, total, bytes.length - total, null);
      assert.ok(length > 0, 'Owner batch IO: JSON truncated while reading'); total += length;
    }
    assert.equal(fs.readSync(descriptor, Buffer.allocUnsafe(1), 0, 1, null), 0, 'Owner batch IO: JSON grew while reading');
    assert.equal(fs.fstatSync(descriptor).size, opened.size);
    return JSON.parse(bytes.toString('utf8'));
  } finally { fs.closeSync(descriptor); }
}

/** @param {string} filename - Target path. @param {object} value - Scalar data only. @returns {string} New complete sibling; interrupted partials are preserved. */
function writePendingJSON(filename, value) {
  const bytes = JSON.stringify(value, null, 2) + '\n';
  assert.ok(Buffer.byteLength(bytes) <= policy.maximumJSONBytes, 'Owner batch IO: metadata exceeds declared JSON bound');
  const pending = path.join(path.dirname(filename), '.' + path.basename(filename) + '.next');
  fs.writeFileSync(pending, bytes, { flag: 'wx' });
  return pending;
}
/** @param {string} filename - Owned progress target. @param {object} value - Scalar data only. @returns {void} Replace owned progress atomically. */
function writeJSON(filename, value) {
  fs.renameSync(writePendingJSON(filename, value), filename);
}

/** @param {string} filename - New verification path. @param {object} value - Scalar data only. @returns {void} Publish complete data exclusively; preserve every existing target entry, including dangling links and concurrent results. */
function writeNewJSON(filename, value) {
  const pending = writePendingJSON(filename, value);
  fs.linkSync(pending, filename);
  fs.unlinkSync(pending);
}
module.exports = { readJSON, writeJSON, writeNewJSON, hashFile };
