/** @file Public dataset naming, namespaces, descriptor behavior and attribute mutation contracts. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const report = { capturedAt: new Date().toISOString(), cases: [] };

/** @param {Function} action - Public operation. @param {Window} window - Exception realm. @returns {*} Value or observable error. */
function capture(action, window) {
  try { const result = action(); return result === undefined ? { undefined: true } : result; }
  catch (error) { return { error: error.name, message: error.message, code: error.code ?? null, domException: error instanceof window.DOMException }; }
}
/** @param {Element} element - Actual owner. @returns {object} Named properties and ordered canonical attributes. */
function snapshot(element) {
  const dataset = element.dataset;
  return { keys: Object.keys(dataset), entries: Object.entries(dataset), attributes: [...element.attributes].map((attribute) => [attribute.name, attribute.localName, attribute.namespaceURI, attribute.value]),
    descriptors: Object.keys(dataset).map((key) => { const descriptor = Object.getOwnPropertyDescriptor(dataset, key); return [key, descriptor.value, descriptor.enumerable, descriptor.configurable, descriptor.writable]; }) };
}
/** @param {string} title - Contract. @param {string} kind - HTML/SVG/XHTML owner. @param {Function} scenario - Real interactions. @returns {void} Registers a comparison. */
function compare(title, kind, scenario) {
  test(`should ${title} for ${kind} dataset`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const xml = kind === 'xhtml'; const { window } = new runtime.JSDOM(xml ? '<r xmlns="http://www.w3.org/1999/xhtml"/>' : '<!doctype html><body>', xml ? { contentType: 'application/xhtml+xml' } : {});
      try {
        const element = xml ? window.document.documentElement : kind === 'svg' ? window.document.createElementNS('http://www.w3.org/2000/svg', 'g') : window.document.createElement('div');
        if (!xml) window.document.body.append(element);
        const dataset = element.dataset; assert.equal(dataset instanceof window.DOMStringMap, true);
        results[engine] = scenario(window, element, dataset); assert.equal(element.dataset, dataset);
      } finally { window.close(); }
    }
    report.cases.push({ title, kind, expected: results.jsdom, actual: results.rustdom }); assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const kind of ['html', 'svg', 'xhtml']) {
  for (const key of ['', 'simple', 'camelCase', 'UPPER', 'foo-Bar', '-a', '--a', 'a-b', 'a--b', 'a-', 'éÀ', 'K', 'x:y', 'a.b', '_private', '__proto__', 'constructor', 'toString', '\0', '\ud800', '🦀', 'space key', 'line\nkey']) {
    compare(`preserve assignment/deletion for key ${JSON.stringify(key)}`, kind, (window, element, dataset) => {
      const observer = new window.MutationObserver(() => {}); observer.observe(element, { attributes: true, attributeOldValue: true });
      const set = capture(() => { dataset[key] = 'value\0\ud800'; }, window);
      const beforeDelete = snapshot(element); const value = capture(() => dataset[key], window);
      const present = key in dataset; const deleted = capture(() => Reflect.deleteProperty(dataset, key), window);
      const records = observer.takeRecords().map((record) => [record.attributeName, record.attributeNamespace, record.oldValue]); observer.disconnect();
      return { set, beforeDelete, value: typeof value === 'function' ? { function: value.name } : value, present, deleted, final: snapshot(element), records };
    });
  }
  compare('map local names across namespaces and preserve setter/delete asymmetry', kind, (window, element, dataset) => {
    element.setAttributeNS('urn:first', 'p:data-name', 'first'); element.setAttributeNS('urn:second', 'q:data-name', 'second');
    element.setAttributeNS(null, 'data-UPPER', 'excluded'); element.setAttribute('data--double', 'double');
    const initial = snapshot(element); dataset.name = 'plain'; const afterSet = snapshot(element);
    const deleted = Reflect.deleteProperty(dataset, 'name'); const afterDelete = snapshot(element);
    element.removeAttributeNS('urn:first', 'data-name');
    return { initial, afterSet, deleted, afterDelete, final: snapshot(element), remaining: dataset.name };
  });
  compare('apply defineProperty through named setters and preserve symbolic expandos', kind, (window, element, dataset) => {
    const symbol = Symbol('expando'); dataset[symbol] = 42;
    const defined = capture(() => Reflect.defineProperty(dataset, 'value', { value: 'defined' }), window);
    const accessor = capture(() => Reflect.defineProperty(dataset, 'getter', { get() { return 'not installed'; } }), window);
    const frozen = capture(() => Object.preventExtensions(dataset), window);
    const inherited = Object.create(dataset); inherited.child = 'own';
    return { defined, accessor, frozen, symbolValue: dataset[symbol], symbolDeleted: Reflect.deleteProperty(dataset, symbol), inheritedOwn: Object.hasOwn(inherited, 'child'), inheritedValue: inherited.child, state: snapshot(element) };
  });
  compare('convert values before validating property names and preserve reentrant writes', kind, (window, element, dataset) => {
    const trace = []; const value = { toString() { trace.push('convert'); dataset.before = 'effect'; return 'converted'; } };
    const invalid = capture(() => { dataset['bad-name'] = value; }, window);
    const symbol = capture(() => { dataset.valid = Symbol('value'); }, window);
    dataset.count = 12; dataset.nil = null; dataset.missing = undefined;
    return { invalid, symbol, trace, state: snapshot(element) };
  });
  compare('observe external attribute mutations and independent clones', kind, (window, element, dataset) => {
    element.setAttribute('data-foo-bar', 'first'); const originalKeys = Object.keys(dataset);
    element.getAttributeNode('data-foo-bar').value = 'changed'; const read = dataset.fooBar;
    const clone = element.cloneNode(true); dataset.fooBar = 'original'; element.removeAttribute('data-foo-bar');
    return { originalKeys, read, original: snapshot(element), clone: snapshot(clone) };
  });
}

after(() => { mkdirSync('reports/compatibility', { recursive: true }); writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-dom-string-map.json`, `${JSON.stringify(report, null, 2)}\n`); });
