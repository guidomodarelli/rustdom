/** @file Measures complete FileReader operations through real loadend events, with content validation outside timing. */
'use strict';
const assert = require('node:assert/strict');

/** @param {object} runtime - Actual engine. @param {Window} window - Actual realm. @param {number} size - Input KiB. @param {string} name - Workload. @returns {object} Async read and untimed checks. */
function readerFixture(runtime, window, size, name) {
  const data = Buffer.alloc(size * 1024, 65);
  if (name === 'reader-text-legacy') for (let index = 0; index < data.length; index += 2) { data[index] = 0x82; data[index + 1] = 0xa0; }
  if (name === 'reader-binary') for (let index = 0; index < data.length; index++) data[index] = index % 256;
  const blob = new window.Blob([new Uint8Array(data)], { type: 'application/octet-stream' });
  const before = runtime.getNativeTreeStatistics?.().fileReaders; const reader = new window.FileReader();
  const method = name === 'reader-buffer' || name === 'reader-abort' ? 'readAsArrayBuffer' : name === 'reader-binary' ? 'readAsBinaryString' : name === 'reader-data-url' ? 'readAsDataURL' : 'readAsText';
  return {
    /** @returns {Promise<void>} Drain document readiness before the measured operation. */
    async prepare() { await new Promise((resolve) => setImmediate(resolve)); await new Promise((resolve) => setImmediate(resolve)); },
    /** @returns {Promise<number>} Handler setup, read request and completion through the real event loop. */
    run() {
      return new Promise((resolve, reject) => {
        reader.onerror = () => reject(reader.error);
        reader.onloadend = () => resolve(reader.result === null ? 0 : typeof reader.result === 'string' ? reader.result.length : reader.result.byteLength);
        reader[method](blob, name === 'reader-text-legacy' ? 'shift_jis' : 'utf-8');
        if (name === 'reader-abort') reader.abort();
      });
    },
    /** @param {number} result - Consumed size. @returns {void} Validate all bytes/text and final state after timing. */
    validate(result) {
      assert.equal(reader.readyState, window.FileReader.DONE); assert.equal(reader.error, null);
      if (name === 'reader-abort') { assert.equal(result, 0); assert.equal(reader.result, null); }
      else if (name === 'reader-buffer') { assert.equal(result, data.length); assert.ok(reader.result instanceof window.ArrayBuffer); assert.deepEqual(Buffer.from(new Uint8Array(reader.result)), data); }
      else {
        const expected = name === 'reader-data-url' ? `data:application/octet-stream;base64,${data.toString('base64')}` : name === 'reader-binary' ? data.toString('binary') : name === 'reader-text-legacy' ? 'あ'.repeat(data.length / 2) : data.toString('utf8');
        assert.equal(reader.result, expected); assert.equal(result, expected.length);
      }
      if (before) { const after = runtime.getNativeTreeStatistics().fileReaders; assert.ok(after.created > before.created); if (name !== 'reader-buffer' && name !== 'reader-abort') assert.ok(after.decoded > before.decoded); }
    },
    /** @returns {Promise<void>} Release event handlers and drain aborted callbacks before cleanup. */
    async dispose() { reader.onloadend = null; reader.onerror = null; await new Promise((resolve) => setImmediate(resolve)); await new Promise((resolve) => setImmediate(resolve)); },
  };
}
module.exports = { readerFixture };
