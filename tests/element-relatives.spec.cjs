/** @file Compares physical Element children and siblings with real DOM mutation/adoption in both realms. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const report = { capturedAt: new Date().toISOString(), node: process.version, cases: [] };
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

/** @param {Node|null|undefined} node - Observable node. @returns {unknown} Stable identity without cross-engine references. */
function describe(node) {
  if (!node) return node === undefined ? 'undefined' : null;
  return node.nodeType === 1 ? [node.getAttribute('data-label'), node.localName, node.namespaceURI] : [node.nodeType, node.nodeValue];
}
/** @param {ParentNode} parent - Public physical parent. @param {Window} window - Collection realm. @returns {object} Values checked against actual childNodes and original identities. */
function snapshot(parent, window) {
  const nodes = Array.from(parent.childNodes);
  const elements = nodes.filter((node) => node.nodeType === 1);
  const collection = parent.children;
  assert.equal(parent.children, collection);
  assert.equal(collection instanceof window.HTMLCollection, true);
  assert.equal(parent.firstElementChild, elements[0] || null);
  assert.equal(parent.lastElementChild, elements.at(-1) || null);
  assert.equal(parent.childElementCount, elements.length);
  assert.deepEqual(Array.from(collection), elements);
  const siblings = nodes.map((node, index) => {
    if (!('nextElementSibling' in node)) return [describe(node), 'unsupported'];
    const previous = nodes.slice(0, index).findLast((sibling) => sibling.nodeType === 1) || null;
    const next = nodes.slice(index + 1).find((sibling) => sibling.nodeType === 1) || null;
    assert.equal(node.previousElementSibling, previous);
    assert.equal(node.nextElementSibling, next);
    return [describe(node), describe(previous), describe(next)];
  });
  return { children: elements.map(describe), first: describe(parent.firstElementChild), last: describe(parent.lastElementChild),
    count: parent.childElementCount, siblings };
}
/** @param {Document} document - Owning document. @param {string} label - Fixture identity. @param {string|null} namespace - Element namespace. @returns {Element} Public node with stable label. */
function element(document, label, namespace = HTML_NAMESPACE) {
  const node = document.createElementNS(namespace, 'entry'); node.setAttribute('data-label', label); return node;
}
/** @param {Document} document - Owner. @param {ParentNode} root - Physical destination. @returns {void} Create mixed node kinds and a nested element that is excluded from direct relatives. */
function populate(document, root) {
  const first = element(document, 'first'); first.append(element(document, 'nested'));
  const cdata = document.implementation.createDocument(null, 'xml').createCDATASection('cdata');
  root.append(document.createTextNode('leading'), document.createComment('before'), first, document.createTextNode('middle'),
    element(document, 'foreign', 'urn:relatives'), cdata, document.createProcessingInstruction('target', 'instruction'),
    element(document, 'none', null), document.createComment('trailing'));
}
/** @param {string} title - Behavioral contract. @param {string} mode - HTML/quirks/XML. @param {string} realm - Default/VM globals. @param {Function} scenario - Real DOM interaction. @returns {void} Register a differential regression. */
function compare(title, mode, realm, scenario) {
  test(`should ${title} for ${mode} ${realm} element relatives`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const options = { ...(mode === 'xml' ? { contentType: 'application/xml' } : {}), ...(realm === 'vm' ? { runScripts: 'outside-only' } : {}) };
      const { window } = new runtime.JSDOM(mode === 'xml' ? '<root/>' : `${mode === 'html' ? '<!doctype html>' : ''}<body>`, options);
      const document = window.document;
      const root = document.createElementNS(HTML_NAMESPACE, 'div');
      (document.body || document.documentElement).append(root);
      try { results[engine] = scenario({ window, document, root, runtime }); }
      finally { window.close(); }
    }
    report.cases.push({ title, mode, realm, expected: results.jsdom, actual: results.rustdom });
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const mode of ['html', 'quirks', 'xml']) for (const realm of ['default', 'vm']) {
  compare('exclude text comments PI CDATA and nested descendants', mode, realm, ({ document, root, window }) => {
    populate(document, root); return snapshot(root, window);
  });
  compare('keep empty and non-element-only parents empty', mode, realm, ({ document, root, window }) => {
    const empty = snapshot(root, window); root.append('text', document.createComment('comment'));
    return [empty, snapshot(root, window)];
  });
  compare('refresh a SameObject collection after every physical mutation', mode, realm, ({ document, root, window }) => {
    populate(document, root); const collection = root.children, values = [snapshot(root, window)];
    root.firstElementChild.remove(); values.push(snapshot(root, window));
    root.prepend(root.lastElementChild); values.push(snapshot(root, window));
    root.replaceChildren('replacement', element(document, 'new')); values.push(snapshot(root, window));
    root.replaceChildren(); values.push(snapshot(root, window));
    assert.equal(root.children, collection); return values;
  });
  compare('handle physical Document and detached DocumentFragment children', mode, realm, ({ document, window }) => {
    const fragment = document.createDocumentFragment(); populate(document, fragment);
    return [snapshot(document, window), snapshot(fragment, window)];
  });
  compare('keep template contents and physical children separate', mode, realm, ({ document, root, window }) => {
    const template = document.createElementNS(HTML_NAMESPACE, 'template'); root.append(template);
    populate(document, template.content);
    const before = [snapshot(template, window), snapshot(template.content, window)];
    template.append(element(document, 'physical')); return [...before, snapshot(template, window), snapshot(template.content, window)];
  });
  compare('keep host shadow and assigned nodes in their physical scopes', mode, realm, ({ document, root, window }) => {
    populate(document, root); const shadow = root.attachShadow({ mode: 'open' });
    const slot = document.createElementNS(HTML_NAMESPACE, 'slot'); shadow.append(slot, element(document, 'shadow'));
    slot.append(element(document, 'fallback'));
    return [snapshot(root, window), snapshot(shadow, window), snapshot(slot, window)];
  });
  compare('preserve node and collection identity when adopting a subtree', mode, realm, ({ document, root, window }) => {
    populate(document, root); const collection = root.children;
    const before = snapshot(root, window); const destination = document.implementation.createHTMLDocument('destination');
    destination.body.append(destination.adoptNode(root));
    root.append(element(destination, 'adopted')); assert.equal(root.children, collection);
    return [before, snapshot(root, window), snapshot(destination, window)];
  });
  compare('update detached fragments moved into and out of a parent', mode, realm, ({ document, root, window }) => {
    const fragment = document.createDocumentFragment(); populate(document, fragment); const collection = fragment.children;
    const before = snapshot(fragment, window); root.append(fragment);
    const inserted = [snapshot(root, window), snapshot(fragment, window)];
    fragment.append(...root.childNodes); assert.equal(fragment.children, collection);
    return [before, ...inserted, snapshot(root, window), snapshot(fragment, window)];
  });
  compare('create children after the host Array.from is replaced', mode, realm, ({ document, root }) => {
    populate(document, root);
    const first = root.firstElementChild, last = root.lastElementChild;
    const originalFrom = Array.from;
    let replacedCalls = 0;
    try {
      Array.from = () => { replacedCalls++; throw new Error('host Array.from must not construct physical children'); };
      const collection = root.children;
      assert.equal(collection.item(0), first);
      assert.equal(collection.item(collection.length - 1), last);
      assert.equal(root.childElementCount, 3);
      assert.equal(replacedCalls, 0);
      return { count: collection.length, first: describe(first), last: describe(last), replacedCalls };
    } finally { Array.from = originalFrom; }
  });
}
test('should execute public Element relatives and refresh cached children during native mutation', () => {
  const runtime = runtimes.rustdom;
  const { window } = new runtime.JSDOM('<!doctype html><body>');
  const root = window.document.createElement('main');
  const first = window.document.createElement('i'), second = window.document.createElement('b');
  window.document.body.append(root); root.append(first, window.document.createComment('gap'), second);
  /** @param {Function} operation - Public getter. @returns {unknown} Result whose native path has been observed before auxiliary reads. */
  function read(operation) {
    const before = runtime.getNativeTreeStatistics().nativeElementRelationReads;
    assert.equal(typeof before, 'number');
    const result = operation();
    assert.ok(runtime.getNativeTreeStatistics().nativeElementRelationReads > before);
    return result;
  }
  try {
    assert.equal(read(() => root.firstElementChild), first);
    assert.equal(read(() => root.lastElementChild), second);
    assert.equal(read(() => first.nextElementSibling), second);
    assert.equal(read(() => second.previousElementSibling), first);
    const collection = read(() => root.children);
    assert.deepEqual(Array.from(collection), [first, second]);
    const beforeMutation = runtime.getNativeTreeStatistics().nativeElementRelationReads;
    first.remove();
    const afterMutation = runtime.getNativeTreeStatistics().nativeElementRelationReads;
    assert.ok(afterMutation > beforeMutation);
    assert.equal(root.childElementCount, 1);
    assert.equal(runtime.getNativeTreeStatistics().nativeElementRelationReads, afterMutation);
    assert.equal(root.children, collection); assert.equal(collection.item(0), second);
    assert.equal(read(() => first.nextElementSibling), null);
    assert.equal(read(() => first.previousElementSibling), null);
  } finally { window.close(); }
});

after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-element-relatives.json`, JSON.stringify(report, null, 2) + '\n');
});
