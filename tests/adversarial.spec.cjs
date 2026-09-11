/** @file Exercises stateful DOM changes and adversarial selector/metadata inputs against real jsdom. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const reference = require('jsdom');
const runtime = require('../dist/index.cjs');
const { NativeTree } = require('../dist/native.cjs');

/** Stable cross-runtime node observations preserve order and duplicate handling. */
const identify = (node) => node && `${node.localName}|${node.id}|${node.getAttribute('data-value')}`;

/** @param {Function} operation - Real public API call. @returns {object} Result or WebIDL error name. */
function outcome(operation) {
  try { return { value: operation() }; }
  catch (error) { return { error: error.name }; }
}

test('should preserve selector edge cases and errors across all public query methods', () => {
  const markup = '<!doctype html><body><main id="scope"><input id="input" type="TEXT"><ol type="A"><li id="item" class="a\vb a\fb" lang="en-US">Text</li></ol>' +
    '<a id="link" rel="NEXT" href="#"></a><div id="empty"><!--comment--></div><div id="vertical" class="vertical\vtab"></div><svg><rect id="rectangle" viewBox="0 0 1 1"/></svg></main>';
  const expected = new reference.JSDOM(markup);
  const actual = new runtime.JSDOM(markup);
  const selectors = ['input[type="text"]', '[rel="next"]', '[lang|="en"]', '[type="A" s]',
    '.a', '.b', '.vertical', '.tab', ':scope + *', ':scope:has(> ol)', ':not(:is(input, a))', 'main:has(ol > li)',
    'li:nth-child(-n+3)', '*|rect', '|rect', '[*|id="item"]', '[|id]', '[viewBox]', '[viewbox]',
    ':is(:unknown, li)', ':where([, li)', ':not(:unknown)', '::before', ':has(:has(li))',
    '[data-value=""]', '[class~=""]', '[class^=""]', '[class*=""]', 'main, main',
    ':root', ':scope', '\\69 nput', '#\\69 tem', 'li\\0', '', ',', 'li >', 'li\u0000'];
  try {
    const before = runtime.getNativeTreeStatistics();
    for (const selector of selectors) {
      const left = expected.window.document.getElementById('scope');
      const right = actual.window.document.getElementById('scope');
      for (const method of ['querySelector', 'querySelectorAll', 'matches', 'closest']) {
        const observe = (node) => method === 'querySelectorAll' ? [...node[method](selector)].map(identify)
          : method === 'matches' ? node[method](selector) : identify(node[method](selector));
        assert.deepEqual(outcome(() => observe(right)), outcome(() => observe(left)), `${method}: ${JSON.stringify(selector)}`);
      }
    }
    assert.ok(runtime.getNativeTreeStatistics().nativeQueries > before.nativeQueries);
  } finally { expected.window.close(); actual.window.close(); }
});

test('should keep native data coherent through seeded mutation sequences and UTF16 transitions', () => {
  const markup = '<!doctype html><body><main>' + Array.from({ length: 12 }, (_, index) =>
    `<section id="node-${index}" class="item"><p>Initial ${index}</p></section>`).join('') + '</main>';
  const expected = new reference.JSDOM(markup);
  const actual = new runtime.JSDOM(markup);
  const documents = [expected.window.document, actual.window.document];
  const nodeSets = documents.map((document) => [...document.querySelectorAll('section')]);
  let seed = 48271;
  try {
    for (let iteration = 0; iteration < 240; iteration++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const index = seed % 12;
      const text = iteration % 9 === 0 ? `isolated\ud800-${iteration}` : `🦀 &<> ${iteration}`;
      for (let engine = 0; engine < documents.length; engine++) {
        const document = documents[engine];
        const node = nodeSets[engine][index];
        switch (iteration % 8) {
          case 0: node.setAttribute('data-value', text); break;
          case 1: node.textContent = text; break;
          case 2: node.classList.toggle('selected'); break;
          case 3: document.querySelector('main').prepend(node); break;
          case 4: node.innerHTML = `<template><em>${iteration}</em></template><p>Text</p>`; break;
          case 5: node.setAttributeNS('urn:sample', 'sample:value', text); break;
          case 6: node.removeAttributeNS('urn:sample', 'value'); node.removeAttribute('data-value'); break;
          case 7: node.replaceChildren(document.createComment(text), document.createTextNode(text)); break;
        }
      }
      assert.equal(actual.serialize(), expected.serialize(), `serialize after mutation ${iteration}`);
      for (const selector of ['section.selected', 'section:nth-child(2n)', 'section:empty', 'section:has(> p)', '[data-value]', ':scope > section']) {
        const observe = (document) => [...document.querySelector('main').querySelectorAll(selector)].map(identify);
        assert.deepEqual(observe(documents[1]), observe(documents[0]), `${selector} after mutation ${iteration}`);
      }
    }
  } finally { expected.window.close(); actual.window.close(); }
});

test('should reject malformed direct attribute pairs without losing existing native data', () => {
  const tree = new NativeTree();
  const handle = tree.allocate();
  tree.setHtmlElement(handle, 'p', ['title', 'before']);
  assert.throws(() => tree.setHtmlElement(handle, 'div', ['missing-value']), { code: 'InvalidArg' });
  assert.equal(tree.serializeHtml(handle, true, false), '<p title="before"></p>');
  tree.release(handle);
  assert.equal(tree.statistics().dataNodes, 0);
});

test('should serialize and release a deeply nested native tree without recursive ownership', () => {
  const tree = new NativeTree();
  const root = tree.allocate();
  tree.setSimpleData(root, 11, '');
  const handles = [root];
  const depth = 10000;
  let parent = root;
  for (let level = 0; level < depth; level++) {
    const child = tree.allocate();
    tree.setHtmlElement(child, 'b', []);
    tree.append(parent, child);
    handles.push(child);
    parent = child;
  }
  assert.equal(tree.serializeHtml(root, false, false), '<b>'.repeat(depth) + '</b>'.repeat(depth));
  for (const handle of handles) tree.release(handle);
  assert.equal(tree.statistics().liveNodes, 0);
  assert.equal(tree.statistics().dataNodes, 0);
});
