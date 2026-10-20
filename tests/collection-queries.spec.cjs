/** @file Public live getElementsBy* contracts across namespaces, quirks modes and ownership changes. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const report = { capturedAt: new Date().toISOString(), node: process.version, cases: [] };
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** @param {Element} element - Public result. @returns {string} Stable fixture identity. */
function label(element) { return element.getAttribute('data-label') || element.localName; }

/** @param {HTMLCollection} collection - Public live collection. @param {Window} window - Owner realm. @returns {object} Values and binding identity checks. */
function snapshot(collection, window) {
  assert.equal(collection instanceof window.HTMLCollection, true);
  const entries = Array.from(collection);
  assert.equal(collection.length, entries.length);
  assert.equal(collection.item(entries.length), null);
  assert.equal(collection.item(0), entries[0] || null);
  for (const [index, element] of entries.entries()) assert.equal(collection[index], element);
  return { entries: entries.map((element) => [label(element), element.localName, element.prefix, element.namespaceURI]),
    keys: Object.keys(collection), named: ['plain', 'mixed', 'named', 'missing'].map((name) => {
      const element = collection.namedItem(name); return element ? label(element) : null;
    }) };
}

/** @param {Function} operation - Public operation. @param {Window} window - Exception realm. @returns {unknown} Result or observable exception. */
function attempt(operation, window) {
  try { return operation(); }
  catch (error) { return { name: error.name, message: error.message, code: error.code ?? null,
    typeError: error instanceof window.TypeError, domException: error instanceof window.DOMException }; }
}

/** @param {object} runtime - Independent engine. @param {string} mode - Parsing/quirks context. @returns {object} Actual DOM fixture. */
function fixture(runtime, mode) {
  const dom = new runtime.JSDOM(mode === 'xml' ? '<collection-root/>' : `${mode === 'html' ? '<!doctype html>' : ''}<body>`,
    mode === 'xml' ? { contentType: 'application/xml' } : {});
  const { window } = dom;
  const { document } = window;
  const root = mode === 'xml' ? document.documentElement : document.createElement('main');
  root.setAttribute('id', 'root'); root.setAttribute('class', 'Alpha beta');
  if (mode !== 'xml') document.body.append(root);
  const definitions = [
    ['plain', HTML_NAMESPACE, 'div', 'Alpha beta named'],
    ['mixed', HTML_NAMESPACE, 'p:MiXeD', 'alpha BETA'],
    ['svg', SVG_NAMESPACE, 'svg:MiXeD', 'Alpha beta'],
    ['none', null, 'MiXeD', 'ALPHA beta'],
    ['other', 'urn:collection', 'other:MiXeD', 'Alpha\tbeta'],
    ['empty', null, 'empty', ''],
    ['space', HTML_NAMESPACE, 'span', 'one\vtwo one\u00a0two'],
    ['unicode', HTML_NAMESPACE, 'span', 'é É K k \ud800 \udc00 \0'],
    ['special', HTML_NAMESPACE, 'span', '__proto__ constructor toString'],
  ];
  const elements = {};
  for (const [name, namespace, qualifiedName, classes] of definitions) {
    const element = document.createElementNS(namespace, qualifiedName);
    element.setAttribute('data-label', name); element.setAttribute('id', name); element.setAttribute('class', classes);
    root.append(element); elements[name] = element;
  }
  elements.plain.setAttribute('name', 'named');
  const nested = document.createElementNS(HTML_NAMESPACE, 'div');
  nested.setAttribute('data-label', 'nested'); nested.setAttribute('class', 'Alpha beta');
  elements.plain.append(nested);
  root.append(document.createComment('excluded'), document.createTextNode('excluded'));
  return { window, document, root, elements };
}

/** @param {string} name - Observable contract. @param {string} mode - Real parsing mode. @param {Function} scenario - Public interaction. @returns {void} Registers a differential case. */
function compare(name, mode, scenario) {
  test(`should ${name} in ${mode} collections`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const context = fixture(runtime, mode);
      try { results[engine] = scenario(context, runtime); }
      finally { context.window.close(); }
    }
    report.cases.push({ name, mode, expected: results.jsdom, actual: results.rustdom });
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const mode of ['html', 'quirks', 'xml']) {
  for (const classes of ['', ' ', '\t\n\f\r ', 'Alpha', 'alpha', 'ALPHA', 'Alpha beta', 'Alpha Alpha beta', 'beta Alpha',
    'Alpha\tbeta\n', 'one\vtwo', 'one\u00a0two', 'one two', 'é', 'É', 'K', 'k', '\ud800', '\udc00', '\0',
    '__proto__', 'constructor toString', 'missing', null, undefined]) {
    compare(`preserve class matching for ${JSON.stringify(classes)}`, mode, ({ window, document, root }) => ({
      element: snapshot(root.getElementsByClassName(classes), window),
      document: snapshot(document.getElementsByClassName(classes), window),
      rootExcluded: !Array.from(root.getElementsByClassName(classes)).includes(root),
      stable: root.getElementsByClassName(classes) === root.getElementsByClassName(classes),
    }));
  }
  for (const name of ['*', 'div', 'DIV', 'p:MiXeD', 'p:mixed', 'P:MIXED', 'svg:MiXeD', 'svg:mixed', 'MiXeD', 'mixed',
    'other:MiXeD', 'main', 'collection-root', '', '\ud800', null, undefined]) {
    compare(`preserve qualified-name matching for ${JSON.stringify(name)}`, mode, ({ window, document, root }) => ({
      element: snapshot(root.getElementsByTagName(name), window),
      document: snapshot(document.getElementsByTagName(name), window),
    }));
  }
  for (const namespace of ['*', null, '', HTML_NAMESPACE, SVG_NAMESPACE, 'urn:collection', 'missing', '\ud800', undefined]) {
    for (const name of ['*', 'MiXeD', 'div', 'mixed']) {
      compare(`preserve namespace/local-name matching for ${JSON.stringify([namespace, name])}`, mode, ({ window, document, root }) => ({
        element: snapshot(root.getElementsByTagNameNS(namespace, name), window),
        document: snapshot(document.getElementsByTagNameNS(namespace, name), window),
      }));
    }
  }
  compare('keep old collections live through attribute writes, insertion, reordering and removal', mode, ({ window, document, root, elements }) => {
    const collections = [root.getElementsByClassName('Alpha beta'), root.getElementsByTagName('*'), root.getElementsByTagNameNS('*', 'div')];
    const states = [];
    const read = () => states.push(collections.map((collection) => snapshot(collection, window)));
    read(); elements.plain.getAttributeNode('class').value = 'gone'; read();
    const added = document.createElementNS(HTML_NAMESPACE, 'div');
    added.setAttribute('data-label', 'added'); added.setAttribute('class', 'Alpha beta'); root.prepend(added); read();
    root.append(elements.plain); read(); elements.svg.remove(); read();
    added.removeAttribute('class'); read(); root.replaceChildren(); read();
    return states;
  });
  compare('keep class matching limited to the unnamespaced lowercase class attribute', mode, ({ window, root, elements }) => {
    const collection = root.getElementsByClassName('sentinel');
    const states = [];
    const read = () => states.push(snapshot(collection, window));
    elements.empty.setAttributeNS('urn:attributes', 'p:class', 'sentinel'); read();
    elements.empty.setAttributeNS(null, 'CLASS', 'sentinel'); read();
    elements.empty.setAttributeNS(null, 'class', 'sentinel'); read();
    elements.empty.removeAttributeNS(null, 'class'); read();
    return states;
  });
  compare('apply WebIDL conversion and argument errors before querying the tree', mode, ({ window, root, elements }) => {
    const trace = [];
    const classes = { toString() { trace.push('classes'); elements.empty.setAttribute('class', 'converted'); return 'converted'; } };
    const namespace = { toString() { trace.push('namespace'); return HTML_NAMESPACE; } };
    const name = { toString() { trace.push('name'); root.append(elements.plain); return 'div'; } };
    return { classes: snapshot(root.getElementsByClassName(classes), window),
      namespace: snapshot(root.getElementsByTagNameNS(namespace, name), window), trace,
      missingClass: attempt(() => root.getElementsByClassName(), window),
      missingName: attempt(() => root.getElementsByTagName(), window),
      missingLocal: attempt(() => root.getElementsByTagNameNS('*'), window),
      symbolClass: attempt(() => root.getElementsByClassName(Symbol('class')), window),
      symbolName: attempt(() => root.getElementsByTagName(Symbol('name')), window),
      symbolNamespace: attempt(() => root.getElementsByTagNameNS(Symbol('namespace'), '*'), window),
      wrongReceiver: attempt(() => window.Element.prototype.getElementsByClassName.call({}, 'class'), window) };
  });
}

for (const initialMode of ['html', 'quirks', 'xml']) {
  compare('preserve captured tag mode and live quirks mode after cross-document adoption', initialMode, ({ window, root, elements }, runtime) => {
    const destination = new runtime.JSDOM('<!doctype html><body>');
    const xml = new runtime.JSDOM('<outer/>', { contentType: 'application/xml' });
    try {
      const oldClass = root.getElementsByClassName('alpha');
      const oldTag = root.getElementsByTagName('DIV');
      const states = [snapshot(oldClass, window), snapshot(oldTag, window)];
      for (const target of [xml.window.document.documentElement, destination.window.document.body]) {
        target.append(target.ownerDocument.adoptNode(root));
        elements.empty.setAttribute('class', 'ALPHA');
        states.push(snapshot(oldClass, window), snapshot(oldTag, window),
          snapshot(root.getElementsByClassName('alpha'), window),
          snapshot(root.getElementsByTagName('DIV'), window));
      }
      return states;
    } finally { destination.window.close(); xml.window.close(); }
  });
}

for (const mode of ['html', 'quirks', 'xml']) {
  for (const [actual, query] of [['É', 'é'], ['é', 'É'], ['[', '{'], ['{', '['], ['@', '`'], ['`', '@'],
    ['Ā', 'Ġ'], ['Ġ', 'Ā'], ['\ud800', '\ud820'], ['\ud820', '\ud800'], ['\udc00', '\udc20'], ['\udc20', '\udc00'],
    ['Δ', 'δ'], ['δ', 'Δ'], ['K', 'k'], ['ß', 'SS'], ['Ａ', 'ａ'], ['İ', 'i']]) {
    compare(`preserve isolated class equivalence for ${JSON.stringify([actual, query])}`, mode, ({ window, document, root }) => {
      const element = document.createElement('i'); element.setAttribute('class', actual); element.setAttribute('data-label', 'isolated');
      root.replaceChildren(element);
      return snapshot(root.getElementsByClassName(query), window);
    });
  }
}

compare('exclude shadow and template contents while querying detached light descendants', 'html', ({ window, document, root }) => {
  const host = document.createElement('section'); host.setAttribute('data-label', 'host'); root.append(host);
  const shadow = host.attachShadow({ mode: 'open' }); shadow.innerHTML = '<div class="private">shadow</div>';
  const template = document.createElement('template'); template.innerHTML = '<div class="private">template</div>'; root.append(template);
  const all = root.getElementsByTagName('*'); const privateClass = root.getElementsByClassName('private');
  const before = [snapshot(all, window), snapshot(privateClass, window)];
  root.remove(); host.append(template.content); const after = [snapshot(all, window), snapshot(privateClass, window)];
  return { before, after, shadowChildren: shadow.children.length, detached: !root.isConnected };
});

test('should execute each public collection filter in the native tree', () => {
  const context = fixture(runtimes.rustdom, 'html');
  try {
    for (const query of [() => context.root.getElementsByClassName('Alpha'),
      () => context.root.getElementsByTagName('DIV'), () => context.root.getElementsByTagNameNS('*', 'MiXeD')]) {
      const before = runtimes.rustdom.getNativeTreeStatistics().nativeCollectionQueries;
      assert.equal(typeof before, 'number');
      assert.ok(query().length > 0);
      assert.ok(runtimes.rustdom.getNativeTreeStatistics().nativeCollectionQueries > before);
    }
  } finally { context.window.close(); }
});

after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-collection-queries.json`, `${JSON.stringify(report, null, 2)}\n`);
});
