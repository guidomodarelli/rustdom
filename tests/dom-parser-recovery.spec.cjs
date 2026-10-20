/** @file Exercises original thrown values, dynamic method lookup and XML recovery effect ordering. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const native = require('../dist/native.cjs');
const capturedAt = new Date().toISOString();
const observations = [];
/** @param {object} wrapper - Actual wrapper. @returns {object} Its implementation for observable method overrides. */
function implementation(wrapper) { return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')]; }
/** @param {object} runtime - Real engine. @param {string} mode - Realm mode. @param {string} mime - Valid public MIME. @param {string} kind - Error/lookup scenario. @returns {object} Observable trace, document and exception identity. */
function observe(runtime, mode, mime, kind) {
  const dom = new runtime.JSDOM('', { url: 'https://recovery.example.test/', ...(mode === 'vm' ? { runScripts: 'outside-only' } : {}) });
  const { window } = dom;
  const parser = new window.DOMParser();
  const owner = implementation(parser);
  const original = owner.createScriptingDisabledDocument;
  const trace = [];
  const replacement = { owner: window.document };
  const objectError = { get message() { trace.push('message'); if (kind === 'message-throw') throw replacement; return 'message <&>'; } };
  const thrown = kind === 'null' ? null : kind === 'undefined' ? undefined : kind === 'number' ? 42 : kind === 'symbol' ? Symbol('original') : objectError;
  let calls = 0, reads = 0;
  Object.defineProperty(owner, 'createScriptingDisabledDocument', { configurable: true, get() {
    reads++; trace.push('lookup:' + reads);
    if (kind === 'getter-throw' && reads === 1) throw thrown;
    if (kind === 'non-callable') return 42;
    return function () {
      calls++; trace.push({ call: calls, arity: arguments.length, sameReceiver: this === owner, mode: arguments[0], contentType: arguments[1] });
      if (calls === 1 && kind !== 'getter-throw') throw thrown;
      if (kind === 'recovery-throw') throw replacement;
      return Reflect.apply(original, this, arguments);
    };
  } });
  try {
    const document = parser.parseFromString('<root/>', mime);
    return { trace, root: document.documentElement?.outerHTML, url: document.URL, contentType: document.contentType, realm: document instanceof window.Document };
  } catch (error) {
    if (error === thrown || error === replacement) return { trace, sameOriginal: error === thrown, sameReplacement: error === replacement, kind: typeof error };
    return { trace, sameOriginal: error === thrown, sameReplacement: error === replacement,
      name: error?.name, message: error?.message, typeRealm: error instanceof window.TypeError };
  } finally { window.close(); }
}
for (const mode of ['default', 'vm']) for (const mime of ['text/html', 'text/xml']) {
  for (const kind of ['object', 'null', 'undefined', 'number', 'symbol', 'getter-throw', 'message-throw', 'recovery-throw', 'non-callable']) {
    test(`should preserve ${kind} recovery behavior for ${mime} in ${mode}`, () => {
      const expected = observe(engines.jsdom, mode, mime, kind);
      const before = native.domParserStatistics().calls;
      const actual = observe(engines.rustdom, mode, mime, kind);
      observations.push({ mode, mime, kind, expected, actual });
      assert.deepEqual(actual, expected);
      assert.ok(native.domParserStatistics().calls > before);
      assert.equal(native.domParserStatistics().active, 0);
      if (mime === 'text/xml' && kind === 'object') {
        assert.equal(expected.trace[1].arity, 3); assert.equal(expected.trace[3].arity, 2);
        assert.ok(expected.root.includes('message &lt;&amp;'));
      }
    });
  }
}
after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync('reports/compatibility/' + capturedAt.replaceAll(':', '-') + '-dom-parser-recovery.json', JSON.stringify({ capturedAt, node: process.version, oracle: require('jsdom/package.json').version, cases: observations }, null, 2) + '\n');
});
