/** @module pilot-data-io Reuses Linux evidence IO and binds Windows paths through real descriptor identities. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const original = require('../../../owner-batch-study/io.cjs');
const streaming = require('../../../combined-process-study/constants/capture.json');
const policy = require('../constants/capture.json');

/**
 * Windows path stats in the pinned SDKs can report dev=0 while fstat reports the actual volume ID.
 * Preserve those observations: require path inode/size/stamps and independently reopened descriptor dev+inode equality.
 * @param {string} filename - Physical independent file.
 * @param {number} maximumBytes - Explicit size bound.
 * @param {boolean} independent - Whether shared inodes are forbidden for this role.
 * @param {function(number,number):any} consume - Reads only from the retained owned descriptor.
 * @returns {any} Result after path/descriptor revalidation and deterministic cleanup.
 */
function windowsRead(filename, maximumBytes, independent, consume) {
  const status = fs.lstatSync(filename, { bigint: true });
  assert.ok(status.isFile() && (!independent || status.nlink === 1n));
  assert.ok(status.size <= BigInt(maximumBytes));
  const descriptor = fs.openSync(filename, 'r');
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    assert.ok(opened.dev !== 0n && opened.ino > 0n, 'Pilot IO: descriptor identity is unavailable');
    const sameFile = (actual, compareDevice) => {
      assert.ok(actual.isFile() && (!independent || actual.nlink === 1n));
      if (compareDevice) assert.equal(actual.dev, opened.dev);
      for (const field of ['ino', 'size', 'mtimeNs', 'ctimeNs']) {
        assert.equal(typeof actual[field], 'bigint'); assert.equal(actual[field], opened[field]);
      }
    };
    sameFile(status, status.dev !== 0n);
    const recheck = () => {
      const current = fs.lstatSync(filename, { bigint: true });
      sameFile(current, current.dev !== 0n);
      const probe = fs.openSync(filename, 'r');
      try { sameFile(fs.fstatSync(probe, { bigint: true }), true); }
      finally { fs.closeSync(probe); }
      sameFile(fs.fstatSync(descriptor, { bigint: true }), true);
    };
    recheck();
    const result = consume(descriptor, Number(opened.size));
    recheck();
    return result;
  } finally { fs.closeSync(descriptor); }
}

/** @param {string} filename - Physical JSON data. @returns {object} Bounded parsed data; a parse failure cannot retain descriptors. */
function readJSON(filename) {
  if (process.platform !== 'win32') return original.readJSON(filename);
  const raw = windowsRead(filename, policy.maximumJSONBytes, true, (descriptor, size) => {
    const buffer = Buffer.allocUnsafe(size); let offset = 0;
    while (offset < size) {
      const length = fs.readSync(descriptor, buffer, offset, size - offset, null);
      assert.ok(length > 0, 'Pilot IO: JSON truncated while reading'); offset += length;
    }
    assert.equal(fs.readSync(descriptor, Buffer.allocUnsafe(1), 0, 1, null), 0, 'Pilot IO: JSON grew while reading');
    return buffer;
  });
  return JSON.parse(raw.toString('utf8'));
}

/** @param {string} filename - Current data or installed SDK. @param {number} [maximumBytes] - Explicit streaming role bound. @param {boolean} [independent] - Whether shared inodes are forbidden. @returns {string} SHA256 of unchanged raw bytes. */
function hashFile(filename, maximumBytes = streaming.maximumSnapshotFileBytes, independent = true) {
  if (process.platform !== 'win32') return original.hashFile(filename, maximumBytes, independent);
  return windowsRead(filename, maximumBytes, independent, (descriptor, expectedBytes) => {
    const digest = createHash('sha256'); const buffer = Buffer.allocUnsafe(streaming.hashChunkBytes);
    let total = 0; let length;
    while ((length = fs.readSync(descriptor, buffer, 0, buffer.length, null)) !== 0) {
      total += length; assert.ok(total <= maximumBytes); digest.update(buffer.subarray(0, length));
    }
    assert.equal(total, expectedBytes, 'Pilot IO: changed file size'); return digest.digest('hex');
  });
}
/** @param {string} source - Stopped controller's bounded physical journal/log. @param {string} destination - Fresh evidence path. @returns {void} Copy raw bytes exclusively; concurrent existing output remains intact. */
function copyNewFile(source, destination) {
  const expected = hashFile(source, policy.maximumJSONBytes);
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  assert.equal(hashFile(destination, policy.maximumJSONBytes), expected, 'Pilot IO: copied evidence differs');
}
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 5); assert.equal(process.argv[2], '--copy-new');
    copyNewFile(process.argv[3], process.argv[4]);
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = 2; }
}
module.exports = { readJSON, hashFile, copyNewFile, writeJSON: original.writeJSON, writeNewJSON: original.writeNewJSON };
