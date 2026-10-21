/** @file Differential Document ID-index and inclusive SVG-root lookup contracts. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const TEST_NAMESPACE = 'urn:document-id-lookup';
const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version, cases: [] };
/** @param {Document} document - Owner. @param {string} key - Stable identity. @param {string|null} id - Optional ID. @param {string|null} [namespace] - Element namespace. @returns {Element} Detached fixture. */
function entry(document, key, id, namespace = HTML_NAMESPACE) {
  const element = document.createElementNS(namespace, namespace === SVG_NAMESPACE ? 'g' : namespace === TEST_NAMESPACE ? 'p:entry' : 'div');
  element.setAttribute('data-key', key); if (id !== null) element.setAttributeNS(null, 'id', id); return element;
}
/** @param {Document|SVGSVGElement} scope - Public receiver. @param {unknown} id - WebIDL input. @returns {string|null} Result identity. */
function lookup(scope, id) { return scope.getElementById(id)?.getAttribute('data-key') ?? null; }
/** @param {Function} operation - Actual platform operation. @returns {object|null} Public error fields only. */
function errorResult(operation) { try { operation(); return null; } catch (error) { return { name: error.name, message: error.message }; } }
/** @param {string} title - Contract. @param {string} mode - HTML/XML. @param {string} realm - Default/VM. @param {string} kind - Document/SVG. @param {Function} observe - Actual DOM scenario. @returns {void} Register an independent-engine differential. */
function compare(title, mode, realm, kind, observe) {
  test(`should ${title} in ${mode}/${realm}/${kind}`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(engines)) {
      const { window } = new runtime.JSDOM(mode === 'xml' ? '<root/>' : '<!doctype html><body>', {
        ...(mode === 'xml' ? { contentType: 'application/xml' } : {}), ...(realm === 'vm' ? { runScripts: 'outside-only' } : {}),
      });
      const document = window.document;
      const root = kind === 'document' ? document.createElementNS(HTML_NAMESPACE, 'section') : document.createElementNS(SVG_NAMESPACE, 'svg');
      root.setAttribute('data-key', 'scope-root');
      (mode === 'xml' ? document.documentElement : document.body).append(root);
      const scope = kind === 'document' ? document : root;
      try { results[engine] = observe({ document, window, root, scope }); }
      finally { window.close(); }
    }
    report.cases.push({ title, mode, realm, kind, expected: results.jsdom, actual: results.rustdom });
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}
for (const mode of ['html', 'xml']) for (const realm of ['default', 'vm']) for (const kind of ['document', 'svg']) {
  compare('match exact IDs on every Element namespace', mode, realm, kind, ({ document, root, scope }) => {
    const results = [];
    for (const [index, namespace] of [HTML_NAMESPACE, SVG_NAMESPACE, TEST_NAMESPACE, null].entries()) {
      const target = entry(document, `namespace-${index}`, 'chosen', namespace); root.append(target);
      assert.equal(scope.getElementById('chosen'), target); results.push(lookup(scope, 'chosen')); target.remove();
    }
    return { results, absent: lookup(scope, 'chosen'), empty: lookup(scope, '') };
  });
  compare('preserve duplicate candidate order across same-value writes and physical moves', mode, realm, kind, ({ document, root, scope }) => {
    const first = entry(document, 'first', 'chosen'), second = entry(document, 'second', 'chosen'); root.append(first, second);
    const results = [lookup(scope, 'chosen')];
    first.id = 'chosen'; results.push(lookup(scope, 'chosen'));
    first.id = 'other'; first.id = 'chosen'; results.push(lookup(scope, 'chosen'));
    const physicalOrder = Array.from(root.children, (element) => element.getAttribute('data-key'));
    root.prepend(second); results.push(lookup(scope, 'chosen'));
    second.remove(); results.push(lookup(scope, 'chosen'));
    root.prepend(second); results.push(lookup(scope, 'chosen'));
    return { results, physicalOrder };
  });
  compare('preserve literal empty whitespace prototype-like and UTF16 ID values', mode, realm, kind, ({ document, root, scope }) => {
    const values = ['', 'A', 'a', '*', 'a b', '\t', '\0', '\ud800', '\udc00', '𠮷', '__proto__', 'constructor', 'toString', 'null', 'undefined', '17'];
    for (const [index, value] of values.entries()) root.append(entry(document, `value-${index}`, value));
    return { values, results: values.map((value) => lookup(scope, value)), missing: lookup(scope, 'missing'),
      coerced: [null, undefined, 17].map((value) => lookup(scope, value)) };
  });
  compare('preserve namespaced ID mutation aliases while distinguishing physical attribute lookup', mode, realm, kind, ({ document, root, scope }) => {
    const target = entry(document, 'target', 'ordinary'); root.append(target);
    const keys = ['ordinary', 'foreign', 'foreign-change', 'replacement', 'upper'];
    const snapshot = () => keys.map((value) => lookup(scope, value));
    const results = [snapshot()];
    target.setAttributeNS(TEST_NAMESPACE, 'p:id', 'foreign'); results.push(snapshot());
    target.getAttributeNodeNS(TEST_NAMESPACE, 'id').value = 'foreign-change'; results.push(snapshot());
    target.setAttributeNS(null, 'ID', 'upper'); results.push(snapshot());
    const replacement = document.createAttributeNS(null, 'id'); replacement.value = 'replacement';
    target.setAttributeNodeNS(replacement); results.push(snapshot());
    target.removeAttributeNS(TEST_NAMESPACE, 'id'); results.push(snapshot());
    target.remove(); results.push(snapshot()); root.append(target); results.push(snapshot());
    return results;
  });
  compare('preserve unprefixed foreign-namespace aliases through detach and reattach', mode, realm, kind, ({ document, root, scope }) => {
    const target = entry(document, 'alias-target', 'ordinary'); root.append(target);
    const namespace = TEST_NAMESPACE + ':bare';
    const keys = ['ordinary', 'foreign', 'changed', 'detached'];
    const snapshot = () => keys.map((value) => lookup(scope, value));
    const results = [snapshot()];
    target.setAttributeNS(namespace, 'id', 'foreign'); results.push(snapshot());
    target.getAttributeNodeNS(namespace, 'id').value = 'changed'; results.push(snapshot());
    target.remove(); results.push(snapshot());
    target.setAttributeNS(namespace, 'id', 'detached'); results.push(snapshot());
    root.append(target); results.push(snapshot());
    target.removeAttributeNS(namespace, 'id'); results.push(snapshot());
    return results;
  });
  compare('bound lookup to current light-tree scope despite shadow template and external IDs', mode, realm, kind, ({ document, root, scope }) => {
    const host = entry(document, 'host', 'host-id'); const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(entry(document, 'shadow-child', 'shadow-id'));
    const template = document.createElementNS(HTML_NAMESPACE, 'template'); template.content.append(entry(document, 'template-child', 'template-id'));
    const nested = document.createElementNS(SVG_NAMESPACE, 'svg'); nested.append(entry(document, 'nested-svg', 'nested-id', SVG_NAMESPACE));
    root.append(host, template, nested);
    const external = entry(document, 'external', 'external-id'); document.documentElement.append(external);
    return ['host-id', 'shadow-id', 'template-id', 'nested-id', 'external-id'].map((value) => lookup(scope, value));
  });
  compare('preserve ID ownership through adoption and reconnection in another Document', mode, realm, kind, ({ document, root, scope }) => {
    const target = entry(document, 'adopted', 'chosen'); root.append(target);
    const other = document.implementation.createHTMLDocument('other');
    const results = [lookup(scope, 'chosen')];
    assert.equal(other.adoptNode(root), root); results.push(lookup(scope, 'chosen'), lookup(other, 'chosen'));
    other.body.append(root); results.push(lookup(scope, 'chosen'), lookup(other, 'chosen'));
    target.id = 'after'; results.push(lookup(scope, 'chosen'), lookup(other, 'after'));
    document.documentElement.append(document.adoptNode(root)); results.push(lookup(scope, 'after'), lookup(other, 'after'));
    return { results, owner: target.ownerDocument === document, identity: scope.getElementById('after') === target };
  });
  compare('preserve receiver checks conversion order and exception identity', mode, realm, kind, ({ document, window, root, scope }) => {
    const method = scope.getElementById; let conversions = 0;
    const input = { toString() { conversions++; root.append(entry(document, 'converted', 'chosen')); return 'chosen'; } };
    const receiver = errorResult(() => method.call({}, input)); assert.equal(conversions, 0);
    const result = lookup(scope, input); assert.equal(conversions, 1);
    const marker = new window.Error('ID conversion marker'); let sameError = false;
    try { method.call(scope, { toString() { throw marker; } }); } catch (error) { sameError = error === marker; }
    return { receiver, result, conversions, sameError, missing: errorResult(() => method.call(scope)),
      symbol: errorResult(() => method.call(scope, Symbol('id'))), extra: method.call(scope, 'chosen', { toString() { throw marker; } })?.getAttribute('data-key') };
  });
  compare('preserve independent clones and current Attr ownership after replacement', mode, realm, kind, ({ document, root, scope }) => {
    const original = entry(document, 'original', 'chosen'); root.append(original);
    const clone = original.cloneNode(true); clone.setAttribute('data-key', 'clone'); root.prepend(clone);
    const results = [lookup(scope, 'chosen')];
    original.removeAttributeNode(original.getAttributeNodeNS(null, 'id')); results.push(lookup(scope, 'chosen'));
    clone.id = 'clone-only'; results.push(lookup(scope, 'chosen'), lookup(scope, 'clone-only'));
    root.replaceChildren(original); results.push(lookup(scope, 'clone-only'));
    original.id = 'returned'; results.push(lookup(scope, 'returned'));
    return results;
  });
  if (kind === 'document') {
    compare('filter cached shadow candidates by their actual current root', mode, realm, kind, ({ document, root, scope }) => {
      const host = entry(document, 'host', null); root.append(host); const shadow = host.attachShadow({ mode: 'open' });
      const hidden = entry(document, 'hidden', 'chosen'); shadow.append(hidden);
      const visible = entry(document, 'visible', 'chosen'); root.append(visible);
      const results = [lookup(scope, 'chosen')]; visible.remove(); results.push(lookup(scope, 'chosen'));
      root.append(hidden); results.push(lookup(scope, 'chosen')); shadow.append(hidden); results.push(lookup(scope, 'chosen'));
      root.append(visible); host.remove(); results.push(lookup(scope, 'chosen'));
      return results;
    });
    compare('preserve Document open write close lifecycle and XML rejection', mode, realm, kind, ({ document, root, scope }) => {
      root.append(entry(document, 'old', 'old-id'));
      const openError = errorResult(() => document.open());
      const writeError = openError ? null : errorResult(() => document.write('<!doctype html><body><main id="rewritten" data-key="new"></main>'));
      const closeError = openError ? null : errorResult(() => document.close());
      return { openError, writeError, closeError, old: lookup(scope, 'old-id'), current: lookup(scope, 'rewritten') };
    });
  } else {
    compare('include SVG root itself and allow its explicit empty ID', mode, realm, kind, ({ document, root, scope }) => {
      root.append(entry(document, 'child', 'self', SVG_NAMESPACE), entry(document, 'empty-child', '', SVG_NAMESPACE));
      const results = [lookup(scope, 'self'), lookup(scope, '')];
      root.setAttributeNS(null, 'id', 'self'); results.push(lookup(scope, 'self'));
      root.setAttributeNS(null, 'id', ''); results.push(lookup(scope, ''));
      root.remove(); results.push(lookup(scope, ''), lookup(scope, 'self'));
      return { results, inclusive: scope.getElementById('') === root };
    });
    compare('preserve SVG lookup while disconnected and after importing into another realm owner', mode, realm, kind, ({ document, root, scope }) => {
      const target = entry(document, 'target', 'chosen', SVG_NAMESPACE); root.append(target); root.remove();
      const results = [lookup(scope, 'chosen')]; target.id = 'after'; results.push(lookup(scope, 'after'));
      const other = document.implementation.createHTMLDocument('other'); const clone = other.importNode(root, true);
      const copied = clone.getElementById('after');
      return { results, cloneKey: copied?.getAttribute('data-key'), different: copied !== target, owner: copied?.ownerDocument === other };
    });
  }
}
for (const realm of ['default', 'vm']) compare('preserve ID state during synchronous custom-element callbacks', 'html', realm, 'document', ({ document, window, root, scope }) => {
  const callbacks = [];
  class IdProbe extends window.HTMLElement {
    static get observedAttributes() { return ['id']; }
    attributeChangedCallback(name, oldValue, value) { callbacks.push([name, oldValue, value, scope.getElementById(value) === this]); }
  }
  window.customElements.define('id-probe', IdProbe);
  const target = document.createElement('id-probe'); root.append(target);
  target.id = 'first'; target.id = 'second'; target.id = 'second'; target.removeAttribute('id');
  return callbacks;
});
after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  const path = `reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-id-lookups.json`;
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n'); console.log(`Guardado: ${path}`);
});
