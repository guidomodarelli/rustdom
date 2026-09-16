/** @file Compares document creation effects, reentry and original exception identities. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const native = require('../dist/native.cjs');
const capturedAt = new Date().toISOString();
const observations = [];

/** @param {object} wrapper - Actual platform object. @returns {object} Associated implementation used to install observable input getters. */
function implementation(wrapper) { return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')]; }
/** @param {object} runtime - Real engine. @param {string} mode - Realm mode. @param {string} scenario - Effect fixture. @returns {object} Observable trace and identity flags. */
function observe(runtime, mode, scenario) {
  const dom = new runtime.JSDOM('<!doctype html><p>owner</p>', { url: 'https://owner.example.test/', ...(mode === 'vm' ? { runScripts: 'outside-only' } : {}) });
  const { window } = dom;
  const owner = window.document;
  const api = owner.implementation;
  const trace = [];
  try {
    if (scenario.startsWith('global-')) {
      const impl = implementation(api), globalObject = impl._globalObject;
      Object.defineProperty(impl, '_globalObject', { configurable: true, get() { trace.push('global'); return globalObject; } });
      if (scenario === 'global-doctype') api.createDocumentType('root', '', '');
      if (scenario === 'global-xml') api.createDocument(null, 'root', null);
      if (scenario === 'global-html') api.createHTMLDocument('title');
      return { trace };
    }
    if (scenario === 'reentrant-origin') {
      Object.defineProperty(implementation(owner), '_origin', { configurable: true, get() {
        trace.push('origin');
        trace.push(api.hasFeature());
        trace.push(api.createHTMLDocument('inner').title);
        return 'https://reentrant.example.test';
      } });
      const result = api.createDocument('urn:root', 'root', null);
      return { trace, origin: implementation(result)._origin, root: result.documentElement.nodeName };
    }
    if (scenario.startsWith('throw-origin-')) {
      const marker = scenario === 'throw-origin-object' ? { owner } : Symbol('original');
      const doctype = api.createDocumentType('root', '', '');
      Object.defineProperty(implementation(owner), '_origin', { configurable: true, get() { trace.push('origin'); throw marker; } });
      let caught;
      try { api.createDocument(null, 'root', doctype); } catch (error) { caught = error; }
      return { trace, sameError: caught === marker, adopted: doctype.ownerDocument !== owner, parentIsDocument: doctype.parentNode === doctype.ownerDocument, rootCreatedBeforeError: doctype.ownerDocument.documentElement.localName };
    }
    if (scenario === 'coercion-order') {
      const namespace = { [Symbol.toPrimitive](hint) { trace.push('namespace:' + hint); return 'urn:root'; } };
      const name = { [Symbol.toPrimitive](hint) { trace.push('name:' + hint); return 'p:root'; } };
      const document = api.createDocument(namespace, name, null);
      const title = { [Symbol.toPrimitive](hint) { trace.push('title:' + hint); return '<title>'; } };
      const html = api.createHTMLDocument(title);
      return { trace, root: document.documentElement.nodeName, title: html.title };
    }
    if (scenario === 'foreign-method') {
      const other = new runtime.JSDOM('', { runScripts: 'outside-only' });
      try {
        const document = other.window.DOMImplementation.prototype.createHTMLDocument.call(api, 'borrowed');
        return { title: document.title, ownerRealm: document instanceof window.Document, otherRealm: document instanceof other.window.Document };
      } finally { other.window.close(); }
    }
    throw new Error('Unknown document effect scenario');
  } finally { window.close(); }
}

for (const mode of ['default', 'vm']) for (const scenario of ['global-doctype', 'global-xml', 'global-html', 'reentrant-origin', 'throw-origin-object', 'throw-origin-symbol', 'coercion-order', 'foreign-method']) {
  test(`should preserve ${scenario} document effects in ${mode}`, () => {
    const expected = observe(engines.jsdom, mode, scenario);
    const before = native.documentImplementationStatistics().calls;
    const actual = observe(engines.rustdom, mode, scenario);
    observations.push({ mode, scenario, expected, actual });
    assert.deepEqual(actual, expected);
    assert.ok(native.documentImplementationStatistics().calls > before);
    assert.equal(native.documentImplementationStatistics().active, 0);
    if (scenario.startsWith('throw-origin-')) assert.equal(expected.sameError, true);
    if (scenario === 'reentrant-origin') assert.deepEqual(expected.trace, ['origin', true, 'inner']);
  });
}
after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${capturedAt.replaceAll(':', '-')}-document-implementation-effects.json`, JSON.stringify({ capturedAt, node: process.version, oracle: require('jsdom/package.json').version, cases: observations }, null, 2) + '\n');
});
