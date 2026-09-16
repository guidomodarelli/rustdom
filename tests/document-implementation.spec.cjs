/** @file Exercises native DOMImplementation through real public wrappers and an independent jsdom reference. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const native = require('../dist/native.cjs');
const capturedAt = new Date().toISOString();
const observations = [];

/** @param {object} value - Actual DOM wrapper. @returns {object} Underlying implementation for observable ownership checks. */
function implementation(value) { return value[Object.getOwnPropertySymbols(value).find((symbol) => symbol.description === 'impl')]; }
/** @param {object} document - Created document. @param {object} window - Factory realm. @returns {object} Public structure and observable realm/ownership. */
function documentSnapshot(document, window) {
  return {
    contentType: document.contentType, URL: document.URL, baseURI: document.baseURI,
    characterSet: document.characterSet, readyState: document.readyState, compatMode: document.compatMode,
    defaultViewIsNull: document.defaultView === null, realm: document instanceof window.Document,
    origin: implementation(document)._origin,
    children: Array.from(document.childNodes, (node) => [node.nodeType, node.nodeName, node.nodeValue]),
    doctype: document.doctype && [document.doctype.name, document.doctype.publicId, document.doctype.systemId, document.doctype.ownerDocument === document],
    root: document.documentElement && [document.documentElement.namespaceURI, document.documentElement.prefix, document.documentElement.localName, document.documentElement.outerHTML],
    title: document.title,
  };
}
/** @param {object} window - Factory realm. @param {Function} operation - Actual public operation. @returns {object} Return contract or original exception diagnostics. */
function outcome(window, operation) {
  try { return { value: operation() }; }
  catch (error) { return { error: { name: error.name, message: error.message, code: error.code, domRealm: error instanceof window.DOMException, typeRealm: error instanceof window.TypeError } }; }
}
/** @param {object} runtime - Real engine. @param {string} mode - Realm mode. @param {Function} operation - Public operations to compare. @returns {object} Recorded result with deterministic cleanup. */
function observe(runtime, mode, operation) {
  const dom = new runtime.JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://owner.example.test/path', ...(mode === 'vm' ? { runScripts: 'outside-only' } : {}) });
  try { return outcome(dom.window, () => operation(dom.window)); }
  finally { dom.window.close(); }
}
/** @param {string} mode - Realm mode. @param {string} label - Scenario identifier. @param {Function} operation - Actual public behavior. @returns {void} Compare engines and prove the native driver was reached. */
function compare(mode, label, operation) {
  const expected = observe(engines.jsdom, mode, operation);
  const before = native.documentImplementationStatistics().calls;
  const actual = observe(engines.rustdom, mode, operation);
  observations.push({ mode, label, expected, actual });
  assert.deepEqual(actual, expected);
  assert.ok(native.documentImplementationStatistics().calls > before);
  assert.equal(native.documentImplementationStatistics().active, 0);
}

for (const mode of ['default', 'vm']) {
  test(`should preserve legacy hasFeature without inspecting arguments in ${mode}`, () => {
    compare(mode, 'hasFeature', (window) => {
      const value = { toString() { throw new Error('arguments must stay unused'); } };
      return [window.document.implementation.hasFeature(), window.document.implementation.hasFeature(value, Symbol('version'))];
    });
  });
  for (const title of [undefined, '', 'title', ' <&> ', 'a\u0000b', 'a\ud800b', null, 42]) {
    test(`should preserve HTML document title and structure for ${JSON.stringify(title)} in ${mode}`, () => {
      compare(mode, `html:${JSON.stringify(title)}`, (window) => documentSnapshot(window.document.implementation.createHTMLDocument(title), window));
    });
  }
  for (const name of ['root', 'prefix:root', 'é:node', '𐀀:𐀁', '', ':node', 'node:', 'a:b:c', '1node', 'a:1node', 'a b', 'a/b', '\ud800', '\udc00', '\udb80\udc00', 'a\u0000b', 'root\u0000', 'prefix:root\u0000']) {
    test(`should preserve doctype QName validation for ${JSON.stringify(name)} in ${mode}`, () => {
      compare(mode, `doctype:${JSON.stringify(name)}`, (window) => {
        const owner = window.document;
        const node = owner.implementation.createDocumentType(name, 'public\ud800', 'system\nidentifier');
        return { name: node.name, publicId: node.publicId, systemId: node.systemId, owner: node.ownerDocument === owner, parent: node.parentNode, realm: node instanceof window.DocumentType };
      });
    });
  }
  for (const namespace of [null, '', 'urn:custom', 'http://www.w3.org/1999/xhtml', 'http://www.w3.org/2000/svg', 'http://www.w3.org/XML/1998/namespace', 'http://www.w3.org/2000/xmlns/', '\ud800']) {
    for (const name of ['', 'root', 'p:root', 'xml:root', 'xmlns']) {
      test(`should preserve XML creation for ${JSON.stringify(namespace)} and ${JSON.stringify(name)} in ${mode}`, () => {
        compare(mode, `xml:${JSON.stringify([namespace, name])}`, (window) => documentSnapshot(window.document.implementation.createDocument(namespace, name, null), window));
      });
    }
  }
  for (const attached of [false, true]) {
    test(`should adopt the original ${attached ? 'attached' : 'detached'} doctype in ${mode}`, () => {
      compare(mode, `adopt:${attached}`, (window) => {
        const owner = window.document;
        const doctype = attached ? owner.doctype : owner.implementation.createDocumentType('root', 'public', 'system');
        const created = owner.implementation.createDocument('urn:root', 'root', doctype);
        return { document: documentSnapshot(created, window), same: created.doctype === doctype, adopted: doctype.ownerDocument === created, originalStillHasDoctype: owner.doctype !== null };
      });
    });
    test(`should reject an invalid element before adopting a ${attached ? 'attached' : 'detached'} doctype in ${mode}`, () => {
      compare(mode, `invalid-before-adopt:${attached}`, (window) => {
        const owner = window.document;
        const doctype = attached ? owner.doctype : owner.implementation.createDocumentType('root', '', '');
        const result = outcome(window, () => owner.implementation.createDocument(null, 'p:root', doctype));
        return { result, unchangedOwner: doctype.ownerDocument === owner, originalParent: doctype.parentNode === (attached ? owner : null) };
      });
    });
  }
  test(`should copy XML origin late and preserve HTML origin behavior in ${mode}`, () => {
    compare(mode, 'origin', (window) => {
      const owner = window.document;
      const marker = {};
      const trace = [];
      Object.defineProperty(implementation(owner), '_origin', { configurable: true, get() { trace.push('owner-origin'); return marker; } });
      const xml = owner.implementation.createDocument(null, 'root', null);
      const html = owner.implementation.createHTMLDocument();
      return { xmlSame: implementation(xml)._origin === marker, htmlSame: implementation(html)._origin === marker, trace };
    });
  });
}

after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${capturedAt.replaceAll(':', '-')}-document-implementation.json`, JSON.stringify({ capturedAt, node: process.version, oracle: require('jsdom/package.json').version, cases: observations }, null, 2) + '\n');
});
