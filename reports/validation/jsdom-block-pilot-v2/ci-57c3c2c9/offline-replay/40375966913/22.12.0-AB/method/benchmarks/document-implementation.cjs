/** @file Measures complete document factories, including wrappers, native control and actual node construction. */
'use strict';
const assert = require('node:assert/strict');

/** @param {object} runtime - Actual engine. @param {Window} window - Prepared owner realm. @param {number} size - Public operation count. @param {string} mode - Canonical factory mode. @returns {object} Timed work with untimed validation and release. */
function documentImplementationFixture(runtime, window, size, mode) {
  const before = runtime.getNativeTreeStatistics?.().documentImplementationOperations?.calls;
  if (runtime.getNativeTreeStatistics && !process.env.RUSTDOM_BENCHMARK_PACKAGE) assert.equal(typeof before, 'number', 'Workspace document controller must expose native activity');
  let api = window.document.implementation;
  let results = [];
  return {
    /** @returns {number} Consume and retain every result until validation. */
    run() {
      for (let index = 0; index < size; index++) {
        if (mode === 'html') results.push(api.createHTMLDocument('title'));
        else if (mode === 'xml') results.push(api.createDocument('urn:root', 'p:root', null));
        else if (mode === 'doctype') results.push(api.createDocumentType('root', 'public', 'system'));
        else if (mode === 'invalid-qname') {
          try { api.createDocumentType('invalid:name:part', '', ''); }
          catch (error) { results.push(error); }
        } else throw new Error('Unsupported document creation benchmark mode: ' + mode);
      }
      return results.length;
    },
    /** @param {number} count - Timed result count. @returns {void} Check all structures, identities and native activation outside timing. */
    validate(count) {
      assert.equal(count, size);
      for (const result of results) {
        if (mode === 'html') {
          assert.equal(result.contentType, 'text/html'); assert.equal(result.title, 'title');
          assert.equal(result.documentElement.localName, 'html'); assert.equal(result.body.localName, 'body');
          assert.equal(result.doctype.name, 'html'); assert.equal(result.doctype.ownerDocument, result); assert.equal(result.defaultView, null);
        } else if (mode === 'xml') {
          assert.equal(result.contentType, 'application/xml'); assert.equal(result.documentElement.namespaceURI, 'urn:root');
          assert.equal(result.documentElement.nodeName, 'p:root'); assert.equal(result.documentElement.ownerDocument, result); assert.equal(result.defaultView, null);
        } else if (mode === 'doctype') {
          assert.equal(result.name, 'root'); assert.equal(result.publicId, 'public'); assert.equal(result.systemId, 'system');
          assert.equal(result.ownerDocument, window.document); assert.equal(result.parentNode, null);
        } else { assert.equal(result.name, 'InvalidCharacterError'); assert.equal(result.code, 5); assert.equal(result instanceof window.DOMException, true); }
      }
      if (before !== undefined) assert.ok(runtime.getNativeTreeStatistics().documentImplementationOperations.calls > before);
    },
    /** @returns {void} Release auxiliary document, error and implementation owners. */
    dispose() { results = null; api = null; },
  };
}
module.exports = { documentImplementationFixture };
