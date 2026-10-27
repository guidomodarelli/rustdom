/** @file Complete public Storage workloads; setup, correctness checks and timer drainage stay outside timing. */
'use strict';
const assert = require('node:assert/strict');

/** @param {number} index - Entry index. @returns {string} Deterministic public key. */
function keyAt(index) { return `key${index}`; }
/** @param {number} index - Entry index. @returns {string} Deterministic UTF16 value. */
function valueAt(index) { return `value${index}\ud800`; }
/** @param {number} size - Entry count. @returns {number} Exact budget for a fully populated fixture. */
function storageQuotaForSize(size) { let units = 0; for (let index = 0; index < size; index++) units += keyAt(index).length + valueAt(index).length; return units; }

/** @param {object} runtime - Real engine. @param {Window} window - Nonopaque realm. @param {number} size - Entry count. @param {string} name - Workload. @returns {object} Timed operation and untimed contracts. */
function storageFixture(runtime, window, size, name) {
  const storage = window.localStorage; const keys = Array.from({ length: size }, (_, index) => keyAt(index));
  const values = keys.map((key, index) => valueAt(index)); const updated = keys.map((key, index) => `next${index}\0`);
  if (name !== 'storage-insert') for (let index = 0; index < size; index++) storage.setItem(keys[index], values[index]);
  let entries; let failure; const before = runtime.getNativeTreeStatistics?.().webStorage;
  return {
    /** @returns {number} Consume results from actual public operations. */
    run() {
      let total = 0;
      if (name === 'storage-insert' || name === 'storage-write') { const target = name === 'storage-insert' ? values : updated; for (let index = 0; index < size; index++) storage.setItem(keys[index], target[index]); return storage.length; }
      if (name === 'storage-get') { for (const key of keys) total += storage.getItem(key).length; return total; }
      if (name === 'storage-key') { for (let index = 0; index < size; index++) total += storage.key(index).length; return total; }
      if (name === 'storage-enumerate') { entries = Object.entries(storage); return entries.length; }
      if (name === 'storage-remove') { for (const key of keys) storage.removeItem(key); return storage.length; }
      if (name === 'storage-clear') { storage.clear(); return storage.length; }
      try { storage.setItem('overflow', 'value'); } catch (error) { failure = error; }
      return failure?.code ?? 0;
    },
    /** @param {number} result - Checksum. @returns {void} Validate every key/value, complete order and quota outcome. */
    validate(result) {
      const removed = name === 'storage-remove' || name === 'storage-clear'; const expectedValues = name === 'storage-write' ? updated : values;
      assert.equal(storage.length, removed ? 0 : size);
      assert.deepEqual(Object.keys(storage), removed ? [] : keys);
      for (let index = 0; index < size; index++) { assert.equal(storage.getItem(keys[index]), removed ? null : expectedValues[index]); if (!removed) assert.equal(storage.key(index), keys[index]); }
      if (entries) assert.deepEqual(entries, keys.map((key, index) => [key, values[index]]));
      if (name === 'storage-get') assert.equal(result, values.reduce((sum, value) => sum + value.length, 0));
      else if (name === 'storage-key') assert.equal(result, keys.reduce((sum, key) => sum + key.length, 0));
      else if (name === 'storage-quota') { assert.equal(result, 22); assert.equal(failure.name, 'QuotaExceededError'); assert.equal(storage.getItem('overflow'), null); }
      else assert.equal(result, removed ? 0 : size);
      if (before) { const after = runtime.getNativeTreeStatistics().webStorage; assert.equal(after.entries - before.entries, name === 'storage-insert' ? size : removed ? -size : 0); }
    },
    /** @returns {Promise<void>} Wait for already-scheduled host notifications before releasing the fixture. */
    async dispose() { await new Promise((resolve) => setTimeout(resolve, 0)); },
  };
}
module.exports = { storageFixture, storageQuotaForSize };
