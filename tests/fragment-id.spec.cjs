/** @file Differential DocumentFragment/ShadowRoot ID lookup contracts against independent jsdom. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const TEST_NAMESPACE = 'urn:fragment-id-query';
const report = { capturedAt: new Date().toISOString(), node: process.version,
  reference: require('jsdom/package.json').version, cases: [] };

/** @param {Document} document - Factory owner. @param {string} key - Observable identity. @param {string|null} id - Optional exact ID. @param {string|null} [namespace] - Element namespace. @returns {Element} Detached fixture. */
function entry(document, key, id, namespace = HTML_NAMESPACE) {
  const element = document.createElementNS(namespace, namespace === TEST_NAMESPACE ? 'p:entry' : 'div');
  element.setAttribute('data-key', key);
  if (id !== null) element.setAttributeNS(null, 'id', id);
  return element;
}
/** @param {Node} scope - Fragment lookup owner. @param {unknown} id - Public WebIDL input. @returns {string|null} Observable result identity. */
function lookup(scope, id) { return scope.getElementById(id)?.getAttribute('data-key') ?? null; }
/** @param {Function} operation - Public operation. @returns {object|null} Literal public error fields. */
function errorResult(operation) {
  try { operation(); return null; }
  catch (error) { return { name: error.name, message: error.message }; }
}
/** @param {string} title - Contract. @param {string} mode - Owner content type. @param {string} realm - Execution realm. @param {string} kind - Scope variant. @param {Function} observe - Public DOM scenario. @returns {void} Register an actual-engine differential. */
function compare(title, mode, realm, kind, observe) {
  test(`should ${title} in ${mode}/${realm}/${kind}`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const { window } = new runtime.JSDOM(mode === 'xml' ? '<root/>' : '<!doctype html><body>', {
        ...(mode === 'xml' ? { contentType: 'application/xml' } : {}),
        ...(realm === 'vm' ? { runScripts: 'outside-only' } : {}),
      });
      const document = window.document;
      let host = null;
      let scope;
      if (kind === 'shadow') {
        host = entry(document, 'host', 'host-id');
        scope = host.attachShadow({ mode: 'open' });
      } else if (kind === 'template') {
        host = document.createElementNS(HTML_NAMESPACE, 'template');
        scope = host.content;
      } else scope = document.createDocumentFragment();
      try { results[engine] = observe({ document, window, scope, host }); }
      finally { window.close(); }
    }
    report.cases.push({ title, mode, realm, kind, expected: results.jsdom, actual: results.rustdom });
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const mode of ['html', 'xml']) for (const realm of ['default', 'vm']) for (const kind of ['fragment', 'template', 'shadow']) {
  compare('match only exact null-namespace id attributes on every Element namespace', mode, realm, kind, ({ document, scope }) => {
    const absent = entry(document, 'absent', null);
    const namespaced = entry(document, 'namespaced-id', null);
    namespaced.setAttributeNS(TEST_NAMESPACE, 'p:id', 'chosen');
    const uppercase = entry(document, 'uppercase-id', null);
    uppercase.setAttributeNS(null, 'ID', 'chosen');
    scope.append(document.createComment('chosen'), document.createTextNode('chosen'), absent, namespaced, uppercase);
    const identities = [];
    for (const [index, namespace] of [HTML_NAMESPACE, TEST_NAMESPACE, null].entries()) {
      const element = entry(document, `namespace-${index}`, 'chosen', namespace);
      scope.append(element);
      assert.equal(scope.getElementById('chosen'), element);
      identities.push(lookup(scope, 'chosen'));
      element.remove();
    }
    return { identities, absent: lookup(scope, 'chosen'), namespaced: namespaced.getAttributeNS(TEST_NAMESPACE, 'id') };
  });
  compare('select the first duplicate in current physical tree order after moves and removals', mode, realm, kind, ({ document, scope }) => {
    const first = entry(document, 'first', 'chosen');
    const second = entry(document, 'second', 'chosen');
    const nested = entry(document, 'nested', null);
    const deep = entry(document, 'deep', 'chosen');
    nested.append(deep); scope.append(first, nested, second);
    const results = [lookup(scope, 'chosen')];
    scope.prepend(second); results.push(lookup(scope, 'chosen'));
    second.remove(); results.push(lookup(scope, 'chosen'));
    nested.prepend(first); results.push(lookup(scope, 'chosen'));
    nested.append(first); results.push(lookup(scope, 'chosen'));
    const clone = deep.cloneNode(true); clone.setAttribute('data-key', 'clone');
    scope.prepend(clone); results.push(lookup(scope, 'chosen'));
    assert.equal(scope.getElementById('chosen'), clone);
    scope.replaceChildren(document.createTextNode('gone'));
    results.push(lookup(scope, 'chosen'));
    return results;
  });
  compare('preserve literal values case whitespace NUL and UTF16 while excluding empty ID', mode, realm, kind, ({ document, scope }) => {
    const values = ['', 'A', 'a', '*', 'a b', '\t', '\0', '\ud800', '\udc00', '𠮷', 'null', 'undefined', '17', '[object Object]'];
    for (const [index, value] of values.entries()) scope.append(entry(document, `value-${index}`, value));
    return { values, results: values.map((value) => lookup(scope, value)), missing: lookup(scope, 'missing'),
      coerced: [null, undefined, 17, {}].map((value) => lookup(scope, value)) };
  });
  compare('observe canonical Attr writes replacement removal and detached subtrees immediately', mode, realm, kind, ({ document, scope }) => {
    const element = entry(document, 'target', 'before');
    const nested = entry(document, 'nested', null); nested.append(element); scope.append(nested);
    const results = [lookup(scope, 'before')];
    element.getAttributeNodeNS(null, 'id').value = 'after';
    results.push(lookup(scope, 'before'), lookup(scope, 'after'));
    const replacement = document.createAttributeNS(null, 'id'); replacement.value = 'replacement';
    element.setAttributeNodeNS(replacement); results.push(lookup(scope, 'after'), lookup(scope, 'replacement'));
    element.removeAttributeNS(null, 'id'); results.push(lookup(scope, 'replacement'));
    element.setAttributeNS(null, 'id', 'return'); results.push(lookup(scope, 'return'));
    nested.remove(); results.push(lookup(scope, 'return'));
    scope.append(nested); results.push(lookup(scope, 'return'));
    return results;
  });
  compare('bound lookup to its own fragment excluding nested templates shadow trees and external owners', mode, realm, kind, ({ document, scope, host }) => {
    const other = document.createDocumentFragment(); other.append(entry(document, 'other', 'other-id'));
    const template = document.createElementNS(HTML_NAMESPACE, 'template');
    template.content.append(entry(document, 'template-inner', 'template-id'));
    const shadowHost = entry(document, 'nested-shadow-host', 'shadow-host-id');
    shadowHost.attachShadow({ mode: 'open' }).append(entry(document, 'shadow-inner', 'shadow-id'));
    const nested = entry(document, 'nested', null); nested.append(entry(document, 'in-scope', 'chosen'));
    scope.append(template, shadowHost, nested);
    const external = entry(document, 'external', 'external-id'); document.documentElement.append(external);
    return { results: ['other-id', 'template-id', 'shadow-id', 'shadow-host-id', 'chosen', 'external-id', 'host-id'].map((value) => lookup(scope, value)),
      independent: lookup(other, 'other-id'), template: lookup(template.content, 'template-id'),
      shadow: lookup(shadowHost.shadowRoot, 'shadow-id'), ownHostOutside: host ? !scope.contains(host) : true };
  });
  compare('preserve identities and live attributes after adoption to another document', mode, realm, kind, ({ document, scope, host }) => {
    const element = entry(document, 'adopted', 'chosen'); scope.append(element);
    const target = document.implementation.createHTMLDocument('target');
    const adopted = kind === 'shadow' ? host : scope;
    assert.equal(target.adoptNode(adopted), adopted);
    assert.equal(scope.getElementById('chosen'), element);
    const before = lookup(scope, 'chosen');
    element.id = 'after';
    return { before, old: lookup(scope, 'chosen'), after: lookup(scope, 'after'),
      nodeOwner: element.ownerDocument === target, scopeOwner: scope.ownerDocument === target,
      independent: target.getElementById('after') === null };
  });
  compare('preserve receiver checks conversion ordering exceptions and one DOMString conversion', mode, realm, kind, ({ document, window, scope }) => {
    const method = scope.getElementById;
    let conversions = 0;
    const input = { toString() { conversions++; scope.append(entry(document, 'coercion-created', 'chosen')); return 'chosen'; } };
    const invalidReceiver = errorResult(() => method.call({}, input));
    assert.equal(conversions, 0);
    const found = lookup(scope, input);
    assert.equal(conversions, 1);
    const marker = new window.Error('fragment lookup conversion marker');
    let sameError = false;
    try { method.call(scope, { toString() { throw marker; } }); }
    catch (error) { sameError = error === marker; }
    return { invalidReceiver, found, conversions, sameError,
      missing: errorResult(() => method.call(scope)),
      symbol: errorResult(() => method.call(scope, Symbol('lookup'))),
      extraArgument: method.call(scope, 'chosen', { toString() { throw marker; } })?.getAttribute('data-key') };
  });
}
after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  const path = `reports/compatibility/${new Date().toISOString().replaceAll(':', '-')}-fragment-id.json`;
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
  console.log(`Guardado: ${path}`);
});

for (const realm of ['default', 'vm']) test(`should execute every fragment ID query in Rust in ${realm}`, () => {
  const runtime = runtimes.rustdom;
  const { window } = new runtime.JSDOM('<!doctype html><body>', realm === 'vm' ? { runScripts: 'outside-only' } : {});
  try {
    const document = window.document;
    const fragment = document.createDocumentFragment();
    const target = entry(document, 'fragment-target', 'chosen'); fragment.append(target);
    const host = entry(document, 'host', null); const shadow = host.attachShadow({ mode: 'open' });
    const shadowTarget = entry(document, 'shadow-target', 'chosen'); shadow.append(shadowTarget);
    const before = runtime.getNativeTreeStatistics().nativeCollectionQueries;
    assert.equal(fragment.getElementById('chosen'), target);
    assert.equal(fragment.getElementById('missing'), null);
    assert.equal(fragment.getElementById(''), null);
    assert.equal(shadow.getElementById('chosen'), shadowTarget);
    assert.equal(runtime.getNativeTreeStatistics().nativeCollectionQueries - before, 4);
  } finally { window.close(); }
});

test('should release fragment ID results removed members owners Documents and Windows', () => {
  const { spawnSync } = require('node:child_process');
  const { readFileSync } = require('node:fs');
  const { TEST_TIMEOUT_MS } = require('../scripts/constants/collection-query-memory.cjs');
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/fragment-id-memory.cjs'], { encoding: 'utf8', timeout: TEST_TIMEOUT_MS });
  assert.equal(child.error, undefined, child.stderr);
  assert.equal(child.status, 0, child.stdout + child.stderr);
  const path = child.stdout.match(/Guardado: ([^\r\n]+\.json)/)?.[1];
  assert.ok(path, child.stdout);
  const memory = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(memory.pass, true);
  assert.equal(memory.cases.length, 78);
  for (const sample of memory.cases) {
    assert.equal((sample.endpoint || sample.released).reached, true);
    if (sample.removed) assert.equal(sample.removed.reached, true);
  }
});
