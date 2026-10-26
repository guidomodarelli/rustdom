/** @file Complete FormData entry operations with full correctness checks outside the measured interval. */
'use strict';
const assert = require('node:assert/strict');
const { readDomFile } = require('../tests/integration/read-dom-file.cjs');

/** @param {object} runtime - Actual runtime. @param {Window} window - Actual realm. @param {number} size - Entry count. @param {string} name - Selected operation. @returns {object} Measured operation and untimed validation. */
function formDataFixture(runtime, window, size, name) {
  const before = runtime.getNativeTreeStatistics?.().formData;
  const names = Array.from({ length: size }, (_, index) => `field${index}`);
  const values = Array.from({ length: size }, (_, index) => `value${index}`);
  let data = name === 'form-data-construct' ? null : new window.FormData();
  let form = null; let file = null; let iterated = null;
  if (name === 'form-data-construct') {
    form = window.document.createElement('form');
    for (let index = 0; index < size; index++) { const input = window.document.createElement('input'); input.name = names[index]; input.value = values[index]; form.append(input); }
    window.document.body.append(form);
  } else if (name === 'form-data-files') file = new window.File([new Uint8Array([0, 128, 255])], 'source', { lastModified: 42 });
  else if (name !== 'form-data-append') {
    for (let index = 0; index < size; index++) data.append(name === 'form-data-get-all' ? 'repeated' : names[index], values[index]);
    if (name === 'form-data-set') for (let index = 0; index < size; index++) data.append(names[index], 'duplicate');
  }
  return {
    /** @returns {number} Consume the public operation result. */
    run() {
      let result = 0;
      if (name === 'form-data-construct') { data = new window.FormData(form); return size; }
      if (name === 'form-data-iterate') { iterated = Array.from(data); return iterated.length; }
      if (name === 'form-data-get-all') { for (let read = 0; read < 100; read++) result += data.getAll('repeated').length; return result; }
      for (let index = 0; index < size; index++) {
        if (name === 'form-data-append') data.append(names[index], values[index]);
        else if (name === 'form-data-set') data.set(names[index], `updated${index}`);
        else if (name === 'form-data-delete') data.delete(names[index]);
        else if (name === 'form-data-get') result += data.get(names[index]).length + Number(data.has(names[index]));
        else if (name === 'form-data-files') data.append(names[index], file, `copy${index}`);
      }
      return name === 'form-data-get' ? result : size;
    },
    /** @param {number} result - Measured checksum. @returns {Promise<void>} Validate all values, identities and bytes after timing. */
    async validate(result) {
      const actual = Array.from(data);
      if (name === 'form-data-delete') { assert.equal(actual.length, 0); assert.equal(result, size); }
      else if (name === 'form-data-files') {
        assert.equal(result, size); assert.equal(actual.length, size);
        for (let index = 0; index < size; index++) { assert.equal(actual[index][0], names[index]); assert.equal(actual[index][1].name, `copy${index}`); assert.equal(actual[index][1].lastModified, 42); assert.notEqual(actual[index][1], file); assert.deepEqual(await readDomFile(window, actual[index][1]), [0, 128, 255]); }
      } else {
        const expected = names.map((key, index) => [name === 'form-data-get-all' ? 'repeated' : key, name === 'form-data-set' ? `updated${index}` : values[index]]);
        assert.deepEqual(actual, expected); if (iterated) assert.deepEqual(iterated, expected);
        if (name === 'form-data-get-all') assert.equal(result, size * 100);
        else if (name === 'form-data-get') assert.equal(result, values.reduce((total, value) => total + value.length + 1, 0));
        else assert.equal(result, size);
      }
      if (before) assert.ok(runtime.getNativeTreeStatistics().formData.created > before.created);
    },
    /** @returns {void} Release auxiliary elements and references before GC. */
    dispose() { form?.remove(); form = null; file = null; data = null; iterated = null; },
  };
}
module.exports = { formDataFixture };
