/** @file Measures XML document construction, context fragments and late errors through public APIs. */
'use strict';
const assert = require('node:assert/strict');

/** @param {object} runtime - Real implementation. @param {number} size - XML row count. @param {string} name - Public operation. @returns {object} Fixture with untimed checks and cleanup. */
function xmlFixture(runtime, size, name) {
  const rows = Array.from({ length: size }, (_, index) => `<p:row id="r${index}" p:k="v${index}"><value>Row ${index} &amp; value</value><![CDATA[c${index}]]></p:row>`).join('');
  const documentMarkup = `<?xml version="1.0"?><root xmlns="urn:root" xmlns:p="urn:row">${rows}${name === 'xml-parse-error' ? '<broken>' : ''}</root>`;
  const markup = name === 'xml-fragment' ? rows : documentMarkup;
  let window; let failure = null; let nativeBefore;
  if (name === 'xml-fragment') window = new runtime.JSDOM('<root xmlns="urn:root" xmlns:p="urn:row"/>', { contentType: 'text/xml' }).window;
  return {
    inputBytes: Buffer.byteLength(markup),
    /** @returns {void} Capture counters outside timing. */
    prepare() { nativeBefore = runtime.getNativeTreeStatistics?.().xmlParsers.created; },
    /** @returns {number} Public operation result code. */
    run() {
      if (name === 'xml-fragment') window.document.documentElement.innerHTML = markup;
      else {
        try { new runtime.JSDOM(markup, { contentType: 'text/xml', url: 'https://xml.test/benchmark.xml', beforeParse(created) { window = created; } }); }
        catch (error) { if (name !== 'xml-parse-error') throw error; failure = { name: error.name, message: error.message }; }
      }
      return failure ? 1 : 0;
    },
    /** @param {number} result - Timed result. @returns {void} Check all rows, attributes, text, CDATA and actual native parsing. */
    validate(result) {
      assert.equal(result, name === 'xml-parse-error' ? 1 : 0);
      if (failure) assert.equal(failure.name, 'SyntaxError');
      const elements = Array.from(window.document.getElementsByTagNameNS('urn:row', 'row')); assert.equal(elements.length, size);
      for (const [index, element] of elements.entries()) {
        assert.equal(element.getAttributeNS('urn:row', 'k'), `v${index}`);
        assert.equal(element.firstChild.textContent, `Row ${index} & value`); assert.equal(element.lastChild.nodeType, 4); assert.equal(element.lastChild.data, `c${index}`);
      }
      if (nativeBefore !== undefined) assert.ok(runtime.getNativeTreeStatistics().xmlParsers.created > nativeBefore);
    },
    /** @returns {string} Complete output and exact error for cross-engine comparison. */
    serialize() { return new window.XMLSerializer().serializeToString(window.document) + JSON.stringify(failure); },
    /** @returns {void} Release the auxiliary realm. */
    dispose() { window?.close(); window = null; },
  };
}
module.exports = { xmlFixture };
