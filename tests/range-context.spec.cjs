/** @file Compares Range fragment contexts, namespaces, scripts and errors using both real engines. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {Document} document - Fixture document. @param {string} kind - Context variant. @returns {Node} Start node for a collapsed Range. */
function contextNode(document, kind) {
  switch (kind) {
    case 'document': return document;
    case 'html': return document.documentElement;
    case 'body-text': return document.body.appendChild(document.createTextNode('context'));
    case 'table-comment': return document.querySelector('table').appendChild(document.createComment('context'));
    case 'detached-text': return document.createTextNode('context');
    case 'detached-comment': return document.createComment('context');
    case 'fragment': return document.createDocumentFragment();
    case 'fragment-text': return document.createDocumentFragment().appendChild(document.createTextNode('context'));
    case 'template-content': return document.querySelector('template').content;
    case 'shadow-root': return document.body.appendChild(document.createElement('div')).attachShadow({ mode: 'open' });
    case 'svg-text': return document.querySelector('svg text').firstChild;
    default: return document.querySelector(kind);
  }
}

/** @param {object} engine - Actual DOM implementation. @returns {object[]} Parsed fragment observations and unchanged source state. */
function inspectHtmlContexts(engine) {
  const results = [];
  const kinds = ['document', 'html', 'body', 'table', 'tbody', 'tr', 'td', 'select', 'option', 'template',
    'template-content', 'svg', 'g', 'svg-text', 'body-text', 'table-comment', 'detached-text', 'detached-comment', 'fragment', 'fragment-text', 'shadow-root'];
  const fragments = ['<tr><td>A&amp;B</td></tr>', '<option>option</option><p>tail</p>',
    '<circle/><foreignObject><p>text</p></foreignObject>', 'x\ud800y', '<table>loose<tr><td>cell'];
  for (const kind of kinds) {
    const dom = new engine.JSDOM('<!doctype html><main><table><tbody><tr><td>cell</td></tr></tbody></table>' +
      '<select><option>one</option></select><template><p>inert</p></template><svg><g><text>svg</text></g></svg></main>');
    try {
      const document = dom.window.document; const node = contextNode(document, kind);
      const range = document.createRange(); range.setStart(node, 0); range.collapse(true);
      const original = dom.serialize(); const serializer = new dom.window.XMLSerializer();
      for (const markup of fragments) {
        const fragment = range.createContextualFragment(markup);
        assert.equal(fragment.nodeType, 11); assert.equal(dom.serialize(), original);
        assert.equal(range.startContainer, node); assert.equal(range.endContainer, node);
        assert.equal(range.startOffset, 0); assert.equal(range.endOffset, 0);
        results.push({ kind, markup, content: serializer.serializeToString(fragment),
          ownerIsDocument: fragment.ownerDocument === document,
          children: [...fragment.childNodes].map((child) => [child.nodeName, child.namespaceURI ?? null]) });
      }
    } finally { dom.window.close(); }
  }
  return results;
}

test('should preserve 105 HTML context and markup combinations without mutating the source Range', () => {
  assert.deepEqual(inspectHtmlContexts(engines.rustdom), inspectHtmlContexts(engines.jsdom));
});

test('should preserve XML namespace inheritance, synthetic body contexts and invalid-start errors', () => {
  const observations = [];
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('<root xmlns="urn:root" xmlns:p="urn:p">text<!--note--><![CDATA[data]]><?target value?></root>',
      { contentType: 'application/xml', runScripts: 'outside-only' });
    try {
      const document = dom.window.document; const root = document.documentElement; const serializer = new dom.window.XMLSerializer();
      const range = document.createRange();
      for (const node of [document, root, root.firstChild, root.childNodes[1], document.createTextNode('detached')]) {
        range.setStart(node, 0); range.collapse(true);
        let fragment = null; let errorResult = null;
        try { fragment = serializer.serializeToString(range.createContextualFragment('<p:item/><child/>')); }
        catch (error) { errorResult = [error.name, error.message]; }
        observations.push({ start: node.nodeName, fragment, errorResult });
      }
      for (const node of [root.childNodes[2], root.lastChild, document.createAttribute('attribute')]) {
        range.setStart(node, 0); range.collapse(true);
        assert.throws(() => range.createContextualFragment('<child/>'), (error) => {
          assert.equal(error.constructor, Error); assert.equal(error.message, 'Internal error: Invalid range start node'); return true;
        });
      }
    } finally { dom.window.close(); }
  }
  assert.deepEqual(observations.slice(0, 5), observations.slice(5));
});

test('should keep fragment scripts inert until insertion and honor the adopted context document', () => {
  const observations = [];
  for (const engine of Object.values(engines)) {
    const owner = new engine.JSDOM('', { runScripts: 'dangerously' });
    const target = new engine.JSDOM('<table><tbody></tbody></table>', { runScripts: 'dangerously' });
    try {
      const context = owner.window.document.createElement('tbody');
      target.window.document.querySelector('table').append(target.window.document.adoptNode(context));
      const range = owner.window.document.createRange(); range.selectNodeContents(context);
      const fragment = range.createContextualFragment('<tr><td>adopted</td></tr><script>window.fragmentRuns = (window.fragmentRuns || 0) + 1</script>');
      assert.equal(target.window.fragmentRuns, undefined);
      assert.equal(fragment.ownerDocument, target.window.document);
      assert.equal(fragment.firstChild.nodeName, 'TR'); assert.equal(fragment.firstChild.textContent, 'adopted');
      context.append(fragment);
      observations.push({ html: context.innerHTML, runs: target.window.fragmentRuns ?? null, ownerRuns: owner.window.fragmentRuns ?? null });
    } finally { owner.window.close(); target.window.close(); }
  }
  assert.deepEqual(observations[0], observations[1]);
});

test('should select raw native contexts without mutation or accepting unallocated endpoints', () => {
  const { NativeTree, NativeRange } = require('../dist/native.cjs'); const tree = new NativeTree();
  const root = tree.allocate(); tree.setHtmlElement(root, 'html', []);
  const text = tree.allocate(); tree.setCharacterData(text, 3, 'context'); tree.append(root, text);
  const range = new NativeRange(); range.setStart(text, 0); range.setEnd(text, 0);
  const before = tree.statistics();
  assert.equal(tree.rangeFragmentContext(range, true), 0); assert.equal(tree.rangeFragmentContext(range, false), root);
  assert.deepEqual(tree.statistics(), before);
  const reserved = tree.reserveHandles(); const baseline = tree.statistics();
  for (const endpoint of ['setStart', 'setEnd']) {
    const invalid = range.copy(); invalid[endpoint](reserved, 0);
    assert.throws(() => tree.rangeFragmentContext(invalid, true), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.statistics(), baseline);
  tree.release(text); tree.release(root); assert.equal(tree.statistics().liveNodes, 0);
  assert.throws(() => tree.rangeFragmentContext(range, true), { code: 'InvalidArg' });
});
