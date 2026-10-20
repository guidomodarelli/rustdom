/** @file Compares the public DOMParser controller, MIME handling, parsererror documents and disabled scripting. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const native = require('../dist/native.cjs');
const capturedAt = new Date().toISOString();
const observations = [];
const MIME_TYPES = ['text/html', 'text/xml', 'application/xml', 'application/xhtml+xml', 'image/svg+xml'];
const MARKUPS = ['', '<root/>', '<root><child a="&amp;">text</child></root>', '<root>', '<a/><b/>',
  '<!doctype html><p>HTML&nbsp;</p>', '<root><![CDATA[<text>]]></root>', '<r xmlns="urn:root"><p:c xmlns:p="urn:child"/></r>',
  '<root>&missing;</root>', '<root>\ud800</root>', '<root>\u0000</root>', '<html><head><script>globalThis.__parserExecuted = true</script></head><body>body</body></html>'];

/** @param {object} runtime - Actual engine. @param {string} mode - Realm mode. @param {unknown} markup - Public markup argument. @param {unknown} mime - Public MIME argument. @returns {object} Actual document or exception contract. */
function observe(runtime, mode, markup, mime) {
  const dom = new runtime.JSDOM('', { url: 'https://parser.example.test/path?query=value', ...(mode === 'vm' ? { runScripts: 'outside-only' } : {}) });
  const { window } = dom;
  window.__parserExecuted = false;
  try {
    const document = new window.DOMParser().parseFromString(markup, mime);
    return { contentType: document.contentType, url: document.URL, baseURI: document.baseURI, characterSet: document.characterSet,
      readyState: document.readyState, compatMode: document.compatMode, nullView: document.defaultView === null,
      realm: document instanceof window.Document, root: document.documentElement?.outerHTML,
      rootName: document.documentElement?.localName, rootNamespace: document.documentElement?.namespaceURI,
      doctype: document.doctype && [document.doctype.name, document.doctype.publicId, document.doctype.systemId],
      text: document.documentElement?.textContent, scriptExecuted: window.__parserExecuted };
  } catch (error) { return { error: { name: error.name, message: error.message, code: error.code, typeRealm: error instanceof window.TypeError } }; }
  finally { window.close(); }
}
for (const mode of ['default', 'vm']) {
  for (const mime of MIME_TYPES) for (const markup of MARKUPS) {
    test(`should preserve ${mime} parsing of ${JSON.stringify(markup)} in ${mode}`, () => {
      const expected = observe(engines.jsdom, mode, markup, mime);
      const before = native.domParserStatistics().calls;
      const actual = observe(engines.rustdom, mode, markup, mime);
      observations.push({ mode, mime, markup, expected, actual });
      assert.deepEqual(actual, expected);
      assert.ok(native.domParserStatistics().calls > before);
      assert.equal(native.domParserStatistics().active, 0);
      assert.equal(expected.scriptExecuted, false);
    });
  }
  for (const mime of ['', 'TEXT/HTML', 'text/html; charset=utf-8', ' text/xml', null, 42, Symbol('mime')]) {
    test(`should preserve rejected MIME ${String(mime)} in ${mode}`, () => {
      const expected = observe(engines.jsdom, mode, '<root/>', mime);
      const actual = observe(engines.rustdom, mode, '<root/>', mime);
      assert.deepEqual(actual, expected); assert.equal(expected.error.name, 'TypeError');
      assert.equal(native.domParserStatistics().active, 0);
    });
  }
}
after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync('reports/compatibility/' + capturedAt.replaceAll(':', '-') + '-dom-parser-controller.json', JSON.stringify({ capturedAt, node: process.version, oracle: require('jsdom/package.json').version, cases: observations }, null, 2) + '\n');
});
