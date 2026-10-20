/** @file Differential live Document name-query contracts against independent jsdom. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const TEST_NAMESPACE = 'urn:document-name-query';
const report = { capturedAt: new Date().toISOString(), node: process.version,
  reference: require('jsdom/package.json').version, cases: [] };

/** @param {Document} document - Owner. @param {string} key - Stable observable identity. @param {string|null} name - Optional null-namespace name. @param {string|null} [namespace] - Element namespace. @returns {Element} Detached real element. */
function entry(document, key, name, namespace = HTML_NAMESPACE) {
  const element = document.createElementNS(namespace, namespace === TEST_NAMESPACE ? 'p:entry' : 'div');
  element.setAttribute('data-key', key);
  if (name !== null) element.setAttributeNS(null, 'name', name);
  return element;
}
/** @param {NodeList} list - Live result. @param {Document} document - Expected owner. @param {Window} window - Original realm. @returns {object} Primitive public observations. */
function snapshot(list, document, window) {
  return { length: list.length, keys: Array.from(list, (element) => element.getAttribute('data-key')),
    nodeList: list instanceof window.NodeList, namedItem: typeof list.namedItem,
    names: Object.keys(list), missing: list.item(999), negative: list.item(-1),
    owners: Array.from(list, (element) => element.ownerDocument === document) };
}
/** @param {string} title - Observable contract. @param {string} mode - HTML/quirks/XML. @param {string} realm - Default/VM. @param {Function} observe - Real DOM scenario. @returns {void} Register the same scenario on both engines. */
function compare(title, mode, realm, observe) {
  test(`should ${title} in ${mode}/${realm}`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const markup = mode === 'xml' ? '<root/>' : `${mode === 'html' ? '<!doctype html>' : ''}<body>`;
      const { window } = new runtime.JSDOM(markup, { ...(mode === 'xml' ? { contentType: 'application/xml' } : {}),
        ...(realm === 'vm' ? { runScripts: 'outside-only' } : {}) });
      const document = window.document;
      const root = entry(document, 'owner', null);
      (mode === 'xml' ? document.documentElement : document.body).append(root);
      try { results[engine] = observe({ document, root, window }); }
      finally { window.close(); }
    }
    report.cases.push({ title, mode, realm, expected: results.jsdom, actual: results.rustdom });
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}
for (const mode of ['html', 'quirks', 'xml']) for (const realm of ['default', 'vm']) {
  compare('match null-namespace name on every Element namespace in document order', mode, realm, ({ document, root, window }) => {
    document.documentElement.setAttributeNS(null, 'name', 'chosen');
    document.documentElement.setAttribute('data-key', 'document-element');
    root.setAttributeNS(null, 'name', 'chosen');
    for (const [index, namespace] of [HTML_NAMESPACE, TEST_NAMESPACE, null].entries()) root.append(entry(document, `match-${index}`, 'chosen', namespace));
    const wrongNamespace = entry(document, 'wrong-namespace', null);
    wrongNamespace.setAttributeNS(TEST_NAMESPACE, 'p:name', 'chosen');
    root.append(wrongNamespace, entry(document, 'missing', null), entry(document, 'empty', ''), 'text', document.createComment('gap'));
    return ['chosen', '', 'missing'].map((name) => snapshot(document.getElementsByName(name), document, window));
  });
  compare('preserve exact case whitespace wildcard literals and UTF16 name values', mode, realm, ({ document, root, window }) => {
    const values = ['chosen', 'Chosen', ' chosen ', '*', '', 'a\0b', '\uD800', '\uDC00', 'A😀\uD800'];
    values.forEach((value, index) => root.append(entry(document, `value-${index}`, value)));
    return values.map((name) => snapshot(document.getElementsByName(name), document, window));
  });
  compare('refresh after direct Attr changes namespace changes and removal', mode, realm, ({ document, root, window }) => {
    const first = entry(document, 'first', 'chosen'), second = entry(document, 'second', 'other'); root.append(first, second);
    const list = document.getElementsByName('chosen'), values = [snapshot(list, document, window)];
    second.getAttributeNodeNS(null, 'name').value = 'chosen'; values.push(snapshot(list, document, window));
    first.removeAttributeNS(null, 'name'); values.push(snapshot(list, document, window));
    second.setAttributeNS(TEST_NAMESPACE, 'p:name', 'other'); values.push(snapshot(list, document, window));
    second.removeAttributeNode(second.getAttributeNodeNS(null, 'name')); values.push(snapshot(list, document, window));
    return values;
  });
  compare('update tree order through prepend replacement cloning and detachment', mode, realm, ({ document, root, window }) => {
    const first = entry(document, 'first', 'chosen'), second = entry(document, 'second', 'chosen'); root.append(first, second);
    const list = document.getElementsByName('chosen'), values = [snapshot(list, document, window)];
    root.prepend(second); values.push(snapshot(list, document, window));
    const clone = first.cloneNode(true); clone.setAttribute('data-key', 'clone'); second.replaceWith(clone);
    values.push(snapshot(list, document, window)); first.remove(); values.push(snapshot(list, document, window)); return values;
  });
  compare('exclude detached fragments and track insertion and removal of a subtree', mode, realm, ({ document, root, window }) => {
    const fragment = document.createDocumentFragment(); fragment.append(entry(document, 'fragment', 'chosen'));
    const list = document.getElementsByName('chosen'), values = [snapshot(list, document, window)];
    root.append(fragment); values.push(snapshot(list, document, window));
    const parent = root.parentNode; root.remove(); values.push(snapshot(list, document, window));
    parent.append(root); values.push(snapshot(list, document, window)); return values;
  });
  compare('keep shadow and template content outside the physical document query', mode, realm, ({ document, root, window }) => {
    const host = entry(document, 'host', null); root.append(host);
    host.append(entry(document, 'light', 'chosen'));
    host.attachShadow({ mode: 'open' }).append(entry(document, 'shadow', 'chosen'));
    const template = document.createElementNS(HTML_NAMESPACE, 'template'); root.append(template);
    template.content.append(entry(document, 'template-content', 'chosen')); template.append(entry(document, 'template-physical', 'chosen'));
    return snapshot(document.getElementsByName('chosen'), document, window);
  });
  compare('return distinct live NodeLists with stable member identity', mode, realm, ({ document, root, window }) => {
    const first = entry(document, 'first', 'chosen'); root.append(first);
    const list = document.getElementsByName('chosen'), other = document.getElementsByName('chosen');
    assert.notEqual(list, other); assert.equal(list.item(0), first); assert.equal(other[0], first);
    root.append(entry(document, 'added', 'chosen'));
    return [snapshot(list, document, window), snapshot(other, document, window)];
  });
  compare('reflect Window.close body cleanup in an already retained document NodeList', mode, realm, ({ document, root, window }) => {
    root.append(entry(document, 'first', 'chosen'), entry(document, 'second', 'chosen'));
    const list = document.getElementsByName('chosen');
    const before = snapshot(list, document, window);
    window.close();
    assert.equal(list.length, mode === 'xml' ? 2 : 0);
    return [before, snapshot(list, document, window)];
  });
  compare('update both owner documents after adoption without replacing members', mode, realm, ({ document, root, window }) => {
    const element = entry(document, 'adopted', 'chosen'); root.append(element);
    const destination = document.implementation.createHTMLDocument('destination');
    const sourceList = document.getElementsByName('chosen'), destinationList = destination.getElementsByName('chosen');
    const before = [snapshot(sourceList, document, window), snapshot(destinationList, destination, window)];
    destination.body.append(destination.adoptNode(element)); assert.equal(destinationList.item(0), element);
    return [...before, snapshot(sourceList, document, window), snapshot(destinationList, destination, window)];
  });
  compare('convert names once before the live query and preserve WebIDL receiver errors', mode, realm, ({ document, root, window }) => {
    let conversions = 0;
    const list = document.getElementsByName({ toString() { conversions++; root.append(entry(document, 'coerced', 'chosen')); return 'chosen'; } });
    const observations = [snapshot(list, document, window), snapshot(list, document, window)];
    assert.equal(conversions, 1);
    const errors = [];
    for (const invoke of [() => document.getElementsByName(), () => document.getElementsByName(Symbol('name')),
      () => window.Document.prototype.getElementsByName.call({}, { toString() { conversions++; return 'chosen'; } })]) {
      try { invoke(); errors.push(null); } catch (error) { errors.push({ name: error.name, message: error.message }); }
    }
    assert.equal(conversions, 1); assert.ok(errors.every((error) => error !== null));
    return { observations, conversions, errors };
  });
}
test('should execute live document name filtering in Rust and preserve the stable NodeList cache', () => {
  const runtime = runtimes.rustdom;
  const { window } = new runtime.JSDOM('<!doctype html><body>');
  const document = window.document;
  const first = entry(document, 'first', 'chosen'), second = entry(document, 'second', 'other');
  document.body.append(first, second);
  try {
    const before = runtime.getNativeTreeStatistics().nativeCollectionQueries;
    assert.equal(typeof before, 'number');
    const list = document.getElementsByName('chosen');
    assert.equal(list.length, 1); assert.equal(list.item(0), first);
    assert.equal(runtime.getNativeTreeStatistics().nativeCollectionQueries, before + 1);
    assert.equal(list.length, 1);
    assert.equal(runtime.getNativeTreeStatistics().nativeCollectionQueries, before + 1);
    second.getAttributeNodeNS(null, 'name').value = 'chosen';
    assert.equal(runtime.getNativeTreeStatistics().nativeCollectionQueries, before + 1);
    assert.equal(list.length, 2); assert.equal(list.item(1), second);
    assert.equal(runtime.getNativeTreeStatistics().nativeCollectionQueries, before + 2);
    first.remove(); assert.equal(list.length, 1); assert.equal(list.item(0), second);
    assert.equal(runtime.getNativeTreeStatistics().nativeCollectionQueries, before + 3);
  } finally { window.close(); }
});
after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-name-queries.json`, JSON.stringify(report, null, 2) + '\n');
});
