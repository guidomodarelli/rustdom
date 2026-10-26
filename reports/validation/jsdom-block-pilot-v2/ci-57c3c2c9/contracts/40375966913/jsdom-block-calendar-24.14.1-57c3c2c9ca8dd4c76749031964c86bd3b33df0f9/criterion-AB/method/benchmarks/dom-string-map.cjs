/** @file Measures public dataset reads, enumeration and mutations on equivalent canonical attributes. */
'use strict';
const assert = require('node:assert/strict');

/** @param {object} runtime - Actual engine. @param {Window} window - Real realm. @param {number} size - Attribute count. @param {string} name - Workload. @returns {object} Timed operation and untimed checks. */
function datasetFixture(runtime, window, size, name) {
  const keys = Array.from({ length: size }, (_, index) => `key${index}`);
  const values = keys.map((key) => `value-${key}`); const updated = keys.map((key) => `updated-${key}`);
  const element = window.document.createElement('div'); window.document.body.append(element);
  for (let index = 0; index < size; index++) element.setAttribute(`data-${keys[index]}`, values[index]);
  const dataset = element.dataset; let entries; const before = runtime.getNativeTreeStatistics?.().dataset;
  return {
    /** @returns {number} Consume actual returned values/keys or mutation results. */
    run() {
      if (name === 'dataset-read') { let total = 0; for (const key of keys) total += dataset[key].length; return total; }
      if (name === 'dataset-enumerate') { entries = Object.entries(dataset); return entries.length; }
      if (name === 'dataset-write') { let total = 0; for (let index = 0; index < size; index++) total += (dataset[keys[index]] = updated[index]).length; return total; }
      let removed = 0; for (const key of keys) removed += Number(Reflect.deleteProperty(dataset, key)); return removed;
    },
    /** @param {number} result - Checksum. @returns {void} Verify every attribute, key order and backend activity. */
    validate(result) {
      if (name === 'dataset-read') assert.equal(result, values.reduce((sum, value) => sum + value.length, 0));
      else if (name === 'dataset-write') assert.equal(result, updated.reduce((sum, value) => sum + value.length, 0));
      else assert.equal(result, size);
      if (name === 'dataset-enumerate') assert.deepEqual(entries, keys.map((key, index) => [key, values[index]]));
      assert.deepEqual(Object.keys(dataset), name === 'dataset-delete' ? [] : keys);
      for (let index = 0; index < size; index++) assert.equal(element.getAttribute(`data-${keys[index]}`), name === 'dataset-delete' ? null : name === 'dataset-write' ? updated[index] : values[index]);
      if (before) { const after = runtime.getNativeTreeStatistics().dataset; assert.ok(after.reads > before.reads || after.enumerations > before.enumerations); }
    },
  };
}
module.exports = { datasetFixture };
