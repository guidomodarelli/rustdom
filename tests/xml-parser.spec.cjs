/** @file Captures complete XML trees, errors and token-time effects through public jsdom APIs. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
/** Fixed URL makes parser error locations reproducible across engines. */
const DOCUMENT_URL = 'https://xml.test/base.xml';
/** Preserve successful and failing reference observations, not just a pass count. */
const report = { capturedAt: new Date().toISOString(), reference: require('jsdom/package.json').version, cases: [] };

/** @param {Node} root - Public document or fragment. @returns {object[]} Iterative node, attribute and template-content descriptions. */
function describeTree(root) {
  const document = root.nodeType === 9 ? root : root.ownerDocument; const result = [];
  const pending = [{ node: root, parent: -1, template: false }];
  while (pending.length) {
    const { node, parent, template } = pending.pop(); const index = result.length;
    result.push({ parent, template, kind: node.nodeType, name: node.nodeName, local: node.localName ?? null,
      prefix: node.prefix ?? null, namespace: node.namespaceURI ?? null, value: node.nodeValue,
      owner: node.ownerDocument === document, publicId: node.publicId ?? null, systemId: node.systemId ?? null,
      attributes: node.attributes ? Array.from(node.attributes, (attribute) => [attribute.name, attribute.localName, attribute.prefix, attribute.namespaceURI, attribute.value]) : [] });
    if (node.content) pending.push({ node: node.content, parent: index, template: true });
    const children = Array.from(node.childNodes);
    for (let child = children.length - 1; child >= 0; child--) pending.push({ node: children[child], parent: index, template: false });
  }
  return result;
}

/** @param {object} runtime - Actual engine. @param {string} markup - XML input. @returns {object} Full result or partial document and exact exception. */
function parseDocument(runtime, markup) {
  let window;
  try {
    const dom = new runtime.JSDOM(markup, { contentType: 'application/xml', url: DOCUMENT_URL, runScripts: 'dangerously',
      beforeParse(created) { window = created; created.xmlTrace = []; } });
    return { ok: true, tree: describeTree(dom.window.document), serialized: dom.serialize(), trace: Array.from(window.xmlTrace) };
  } catch (error) {
    return { ok: false, error: { name: error.name, message: error.message, code: error.code ?? null },
      tree: window ? describeTree(window.document) : [], trace: window ? Array.from(window.xmlTrace) : [] };
  } finally { window?.close(); }
}

const documentCases = [
  ['plain', '<root a="1">text<b/>tail</root>'],
  ['nodes', '<?before value?><root><![CDATA[a<b&c]]><!--comment--><?inside data?></root><!--after-->'],
  ['namespaces', '<r xmlns="urn:r" xmlns:p="urn:p"><p:a a="v" p:a="n" xmlns=""><b/></p:a></r>'],
  ['xml-attributes', '<r xml:lang="es" xml:space="preserve" xmlns:q="urn:q" q:value="x"/>'],
  ['normalization', '\r\n<r a="a\r\nb\tc">a\r\nb\rc&#13;&#10;&#9;</r>\n'],
  ['entities', '<!DOCTYPE r [<!ENTITY first "A"><!ENTITY second "&first;B">]><r a="&second;">&first;&second;&amp;&#65;&#x1F600;</r>'],
  ['single-quoted-entity', "<!DOCTYPE r [<!ENTITY first 'A'>]><r>&first;</r>"],
  ['public-doctype', '<!DOCTYPE r PUBLIC "public" "system"><r/>'],
  ['single-quoted-doctype', "<!DOCTYPE r PUBLIC 'public' 'system'><r/>"],
  ['doctype-garbage', '<!DOCTYPE r anything ignored><r/>'],
  ['unicode', '<\u{10000} attr="á😀">á😀</\u{10000}>'],
  ['declaration', '<?xml version="1.1" encoding="UTF-8" standalone="yes"?><r/>'],
  ['template', '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><template><p>inside</p><![CDATA[cdata]]></template></body></html>'],
  ['script', '<html xmlns="http://www.w3.org/1999/xhtml"><head><script><![CDATA[window.xmlTrace.push(document.getElementsByTagName("after").length);]]></script></head><body><after/></body></html>'],
  ['script-before-error', '<html xmlns="http://www.w3.org/1999/xhtml"><head><script>window.xmlTrace.push("ran")</script></head><body><broken></body></html>'],
  ['empty', ''], ['unclosed', '<r>'], ['mismatch', '<r><a></b></r>'], ['extra-root', '<a/><b/>'],
  ['outside-text', 'before<r/>after'], ['unknown-prefix', '<p:r/>'], ['unknown-attribute-prefix', '<r p:a="x"/>'],
  ['duplicate', '<r a="1" a="2"/>'], ['duplicate-expanded', '<r xmlns:a="urn:x" xmlns:b="urn:x" a:x="1" b:x="2"/>'],
  ['wrong-xml-binding', '<r xmlns:xml="urn:wrong"/>'], ['xmlns-binding', '<r xmlns:p="http://www.w3.org/2000/xmlns/"/>'],
  ['empty-prefixed-binding', '<r xmlns:p=""><p:a/></r>'], ['bad-name', '<1root/>'], ['bad-qname', '<a:b:c/>'],
  ['unknown-entity', '<r>&missing;</r>'], ['unterminated-entity', '<r>&amp</r>'], ['invalid-number', '<r>&#0;</r>'],
  ['comment-hyphen', '<r><!--a--b--></r>'], ['cdata-end-text', '<r>]]></r>'], ['nul', '<r>\0</r>'],
  ['unpaired-text', '<r>\ud800</r>'], ['unpaired-attribute', '<r a="\udc00"/>'],
  ['xml11-control', '<?xml version="1.1"?><r>&#x1;</r>'], ['unfinished-attribute', '<r a="value'],
];

for (const [name, markup] of documentCases) {
  test(`should preserve XML document tree, effects and errors for ${name}`, () => {
    const expected = parseDocument(runtimes.jsdom, markup); const actual = parseDocument(runtimes.rustdom, markup);
    report.cases.push({ name, route: 'document', markup, expected, actual }); assert.deepEqual(actual, expected);
    if (name === 'script') assert.deepEqual(expected.trace, [0]);
    if (name === 'script-before-error') { assert.equal(expected.ok, false); assert.deepEqual(expected.trace, ['ran']); }
  });
}

/** @param {object} runtime - Actual engine. @param {string} markup - Fragment input. @returns {object} Fragment replacement or preserved document after rejection. */
function parseFragment(runtime, markup) {
  const dom = new runtime.JSDOM('<r xmlns="urn:default" xmlns:p="urn:parent"><context><old/></context></r>', { contentType: 'application/xml', url: DOCUMENT_URL });
  const context = dom.window.document.documentElement.firstChild;
  try {
    context.innerHTML = markup;
    return { ok: true, tree: describeTree(context), serialized: context.innerHTML };
  } catch (error) { return { ok: false, error: { name: error.name, message: error.message, code: error.code }, tree: describeTree(context) }; }
  finally { dom.window.close(); }
}

for (const markup of [' text <p:a p:x="y"/><b/> tail ', '<p:a xmlns:p="urn:local"><p:b/></p:a><p:c/>', '<![CDATA[x]]><?pi body?><!--c-->', '<u:a/>', '<p:a><b></p:a>', '<a x="1" x="2"/>']) {
  test(`should preserve XML fragment context and atomic replacement for ${JSON.stringify(markup)}`, () => {
    const expected = parseFragment(runtimes.jsdom, markup); const actual = parseFragment(runtimes.rustdom, markup);
    report.cases.push({ route: 'fragment', markup, expected, actual }); assert.deepEqual(actual, expected);
  });
}

test('should preserve DOMParser parsererror documents and MIME behavior', () => {
  const capture = (runtime) => {
    const dom = new runtime.JSDOM('<body></body>');
    try {
      return ['application/xml', 'text/xml', 'image/svg+xml', 'application/xhtml+xml'].flatMap((mime) =>
        ['<r/>', '<r><bad></r>', '<p:r/>'].map((markup) => {
          const document = new dom.window.DOMParser().parseFromString(markup, mime);
          return { mime, markup, contentType: document.contentType, tree: describeTree(document) };
        }));
    } finally { dom.window.close(); }
  };
  const expected = capture(runtimes.jsdom); const actual = capture(runtimes.rustdom);
  report.cases.push({ route: 'DOMParser', expected, actual }); assert.deepEqual(actual, expected);
});

after(() => { mkdirSync('reports/compatibility', { recursive: true }); writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-xml-contracts.json`, `${JSON.stringify(report, null, 2)}\n`); });
