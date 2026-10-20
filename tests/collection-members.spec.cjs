/** @file Public HTMLCollection name lookup and property visibility across canonical attributes and live snapshots. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version, cases: [] };

/** @param {Element} element - Public result. @returns {string} Stable independent-engine identity. */
function label(element) { return element.getAttribute('data-label') || element.localName; }
/** @param {unknown} value - Public property. @param {Window} window - Real realm. @returns {unknown} Comparable value without retaining DOM in reports. */
function describe(value, window) {
  if (value === undefined) return { undefined: true };
  if (value === null) return null;
  if (value instanceof window.Element) return { element: label(value) };
  if (typeof value === 'function') return { function: value.name };
  if (typeof value === 'object') return { tag: Object.prototype.toString.call(value) };
  return value;
}
/** @param {object|undefined} descriptor - Actual property descriptor. @param {Window} window - Real realm. @returns {object|null} Public descriptor flags and normalized values. */
function describeDescriptor(descriptor, window) {
  if (!descriptor) return null;
  return { enumerable: descriptor.enumerable, configurable: descriptor.configurable,
    writable: descriptor.writable, value: describe(descriptor.value, window),
    get: descriptor.get?.name ?? null, set: descriptor.set?.name ?? null };
}
/** @param {Function} operation - Public operation. @param {Window} window - Exception realm. @returns {unknown} Observable result or exception. */
function attempt(operation, window) {
  try { return describe(operation(), window); }
  catch (error) { return { error: error.name, message: error.message, code: error.code ?? null, typeError: error instanceof window.TypeError }; }
}
/** @param {object} runtime - Independent engine. @param {string} mode - HTML/quirks/XML. @returns {object} Actual collection fixture. */
function fixture(runtime, mode) {
  const { window } = new runtime.JSDOM(mode === 'xml' ? '<root/>' : `${mode === 'html' ? '<!doctype html>' : ''}<body>`,
    mode === 'xml' ? { contentType: 'application/xml' } : {});
  const { document } = window;
  const root = document.createElementNS(HTML_NAMESPACE, 'main');
  (document.body || document.documentElement).append(root);
  const definitions = [
    ['first-name', HTML_NAMESPACE, 'first', 'shared'], ['later-id', HTML_NAMESPACE, 'shared', 'later'],
    ['foreign', 'urn:members', 'foreign-id', 'foreign-name'], ['plain', null, 'plain-id', 'plain-name'],
    ['empty', HTML_NAMESPACE, '', ''], ['zero', HTML_NAMESPACE, '0', '01'],
    ['unicode', HTML_NAMESPACE, '\ud800', '\udc00'], ['prototype', HTML_NAMESPACE, '__proto__', 'constructor'],
    ['reserved', HTML_NAMESPACE, 'length', 'item'], ['nul', HTML_NAMESPACE, '\0', 'namedItem'],
  ];
  const elements = {};
  for (const [name, namespace, id, named] of definitions) {
    const element = document.createElementNS(namespace, 'i');
    element.setAttribute('data-label', name); element.setAttribute('id', id); element.setAttribute('name', named);
    root.append(element); elements[name] = element;
  }
  return { window, document, root, elements, collection: root.children };
}
/** @param {HTMLCollection} collection - Public live collection. @param {Window} window - Owner realm. @returns {object} Indexed and named properties with full descriptors. */
function snapshot(collection, window) {
  const names = Object.getOwnPropertyNames(collection);
  return { entries: Array.from(collection, label), length: collection.length, keys: Object.keys(collection), names,
    descriptors: names.map((name) => [name, describeDescriptor(Object.getOwnPropertyDescriptor(collection, name), window)]) };
}
/** @param {string} title - Behavioral contract. @param {string} mode - Real document mode. @param {Function} scenario - Public interactions. @returns {void} Registers a differential regression. */
function compare(title, mode, scenario) {
  test(`should ${title} for ${mode} collection members`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const context = fixture(runtime, mode);
      try { results[engine] = scenario(context, runtime); }
      finally { context.window.close(); }
    }
    report.cases.push({ title, mode, expected: results.jsdom, actual: results.rustdom });
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const mode of ['html', 'quirks', 'xml']) {
  for (const key of ['', 'shared', 'first', 'later', 'foreign-id', 'foreign-name', 'plain-id', 'plain-name',
    '0', '01', '4294967295', '-1', '__proto__', 'constructor', 'length', 'item', 'namedItem', 'toString',
    '\ud800', '\udc00', '\0', 'missing', null, undefined]) {
    compare(`preserve lookup priority and visibility for ${JSON.stringify(key)}`, mode, ({ window, collection }) => ({
      named: describe(collection.namedItem(key), window), property: describe(collection[key], window),
      own: Object.hasOwn(collection, key), present: key in collection,
      descriptor: describeDescriptor(Object.getOwnPropertyDescriptor(collection, key), window),
    }));
  }
  compare('preserve ordered supported names and descriptor flags', mode, ({ window, collection }) => snapshot(collection, window));
  compare('refresh names after canonical Attr writes, moves and removals', mode, ({ window, root, elements, collection }) => {
    const states = []; const read = () => states.push({ snapshot: snapshot(collection, window), shared: describe(collection.namedItem('shared'), window) });
    read(); elements['first-name'].getAttributeNode('name').value = 'renamed'; read();
    elements['later-id'].getAttributeNode('id').value = 'renamed'; read();
    root.prepend(elements['later-id']); read();
    elements.foreign.setAttribute('id', 'renamed'); read();
    elements['first-name'].removeAttribute('name'); read(); root.replaceChildren(elements.empty); read();
    return states;
  });
  compare('ignore namespaced and differently cased id/name attributes', mode, ({ window, elements, collection }) => {
    const element = elements.empty;
    element.setAttributeNS('urn:attributes', 'p:id', 'namespaced-id'); element.setAttributeNS('urn:attributes', 'p:name', 'namespaced-name');
    element.setAttributeNS(null, 'ID', 'uppercase-id'); element.setAttributeNS(null, 'NAME', 'uppercase-name');
    return { state: snapshot(collection, window), values: ['namespaced-id', 'namespaced-name', 'uppercase-id', 'uppercase-name']
      .map((key) => [key, describe(collection.namedItem(key), window)]) };
  });
  compare('convert names before refreshing the collection and preserve WebIDL errors', mode, ({ window, elements, collection }) => {
    const trace = [];
    const key = { toString() { trace.push('convert'); elements.empty.setAttribute('id', 'converted'); return 'converted'; } };
    return { converted: describe(collection.namedItem(key), window), trace,
      missing: attempt(() => collection.namedItem(), window), symbol: attempt(() => collection.namedItem(Symbol('name')), window),
      receiver: attempt(() => window.HTMLCollection.prototype.namedItem.call({}, 'first'), window) };
  });
  compare('preserve expandos, readonly names, index rejection and symbolic properties', mode, ({ window, collection }) => {
    const symbol = Symbol('expando'); collection[symbol] = 42;
    const operations = {
      indexed: Reflect.defineProperty(collection, '0', { value: 'replacement' }),
      named: Reflect.defineProperty(collection, 'shared', { value: 'replacement' }),
      added: Reflect.defineProperty(collection, 'extra', { value: 'expando', enumerable: true, configurable: true }),
      deletedNamed: Reflect.deleteProperty(collection, 'shared'), deletedIndex: Reflect.deleteProperty(collection, '0'),
      deletedMissing: Reflect.deleteProperty(collection, 'absent'), symbolic: collection[symbol],
    };
    const state = snapshot(collection, window); Reflect.deleteProperty(collection, symbol);
    return { operations, state };
  });
}

for (const kind of ['forms', 'images', 'options', 'rows', 'cells', 'controls']) {
  compare(`preserve inherited named access in ${kind} collections`, 'html', ({ window, document, root }) => {
    let collection;
    if (kind === 'forms' || kind === 'images') {
      root.innerHTML = kind === 'forms' ? '<form id="same" name="first"></form><form name="same"></form>'
        : '<img id="same" name="first"><img name="same">';
      collection = kind === 'forms' ? document.forms : document.images;
    } else if (kind === 'options') {
      root.innerHTML = '<select><option id="same" name="first">one</option><option name="same">two</option></select>';
      collection = root.firstElementChild.options;
    } else if (kind === 'rows' || kind === 'cells') {
      root.innerHTML = '<table><tbody><tr id="same" name="first"><td id="same" name="first"></td><td name="same"></td></tr><tr name="same"></tr></tbody></table>';
      collection = kind === 'rows' ? root.firstElementChild.rows : root.firstElementChild.rows[0].cells;
    } else {
      root.innerHTML = '<form><input id="same" name="first"><input name="same"></form>';
      collection = root.firstElementChild.elements;
    }
    const named = collection.namedItem('same');
    return { state: snapshot(collection, window), named: named instanceof window.Element ? describe(named, window)
      : { radio: named instanceof window.RadioNodeList, values: Array.from(named, label) } };
  });
}

test('should resolve public names and supported property enumeration in native storage', () => {
  const context = fixture(runtimes.rustdom, 'html');
  try {
    const before = runtimes.rustdom.getNativeTreeStatistics();
    assert.equal(context.collection.namedItem('shared'), context.elements['first-name']);
    const names = Object.getOwnPropertyNames(context.collection);
    assert.ok(names.includes('shared'));
    const after = runtimes.rustdom.getNativeTreeStatistics();
    assert.ok(after.nativeCollectionNamedReads > before.nativeCollectionNamedReads);
    assert.ok(after.nativeCollectionNameEnumerations > before.nativeCollectionNameEnumerations);
  } finally { context.window.close(); }
});

after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-collection-members.json`, `${JSON.stringify(report, null, 2)}\n`);
});
