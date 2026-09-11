/** @file Verifies native data and selectors against an independent jsdom runtime. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const reference = require('jsdom');
const runtime = require('../dist/index.cjs');

const HTML = '<!doctype html><body><main id="main"><section id="one" class="panel selected" data-kind="A">' +
  '<h2 id="heading">Title</h2><ul id="list"><li id="first" class="item" data-n="10">One</li>' +
  '<!-- gap --><li id="second" class="item selected" data-n="20">Two</li><li id="third" class="item" data-n="30">Three</li></ul>' +
  '<p id="empty"></p><input id="input" type="checkbox" checked></section><section id="two" class="panel"><p id="last">End</p></section>' +
  '<svg id="svg"><rect id="rect" viewBox="0 0 10 10"></rect><foreignObject id="foreign"><p id="html">HTML</p></foreignObject></svg></main>';

const SELECTORS = ['*', 'li', '.item', '#second', 'main > section', 'section ul li.selected',
  '[data-n]', '[data-n="20"]', '[data-n^="2"]', '[data-n$="0"]', '[data-kind="a" i]',
  ':root', ':scope', ':scope > *', 'li:first-child', 'li:last-child', 'li:nth-child(2n+1)',
  'li:nth-last-child(2)', 'li:nth-of-type(2)', 'li:only-child', 'p:empty', 'li:not(.selected)',
  'li:is(.selected, :nth-child(1))', 'li:where(.item)', 'section:has(li.selected)',
  'li:has(+ li.selected)', 'li:nth-child(2 of .item)', 'svg > rect', 'foreignObject',
  'foreignobject', 'rect[viewBox]', 'rect[viewbox]', '.selected, #second, li', 'body .item'];

/** @param {Element|null} node - A result. @returns {string|null} An identity independent of the runtime instance. */
function identity(node) { return node ? `${node.namespaceURI}|${node.localName}|${node.id}` : null; }

for (const selector of SELECTORS) test(`should match jsdom query contracts for ${selector}`, () => {
  const expected = new reference.JSDOM(HTML);
  const actual = new runtime.JSDOM(HTML);
  try {
    for (const context of [null, '#one', '#second']) {
      const left = context ? expected.window.document.querySelector(context) : expected.window.document;
      const right = context ? actual.window.document.querySelector(context) : actual.window.document;
      assert.deepEqual([...right.querySelectorAll(selector)].map(identity), [...left.querySelectorAll(selector)].map(identity));
      assert.equal(identity(right.querySelector(selector)), identity(left.querySelector(selector)));
      if (context) {
        assert.equal(right.matches(selector), left.matches(selector));
        assert.equal(identity(right.closest(selector)), identity(left.closest(selector)));
      }
    }
  } finally { expected.window.close(); actual.window.close(); }
});

test('should read updated attributes and text through cached native selectors', () => {
  const dom = new runtime.JSDOM(HTML);
  try {
    const document = dom.window.document;
    const before = runtime.getNativeTreeStatistics();
    assert.equal(document.querySelectorAll('.selected').length, 2);
    document.querySelector('#third').classList.add('selected');
    assert.equal(document.querySelectorAll('.selected').length, 3);
    document.querySelector('#empty').textContent = 'filled';
    assert.equal(document.querySelectorAll('p:empty').length, 0);
    document.querySelector('#third').dataset.n = '40';
    assert.equal(document.querySelector('[data-n="40"]').id, 'third');
    document.querySelector('#list').prepend(document.querySelector('#third'));
    assert.equal(document.querySelector('li:first-child').id, 'third');
    const after = runtime.getNativeTreeStatistics();
    assert.ok(after.nativeQueries > before.nativeQueries);
    assert.ok(after.selectorCacheHits > before.selectorCacheHits);
    assert.ok(after.dataUpdates > before.dataUpdates);
  } finally { dom.window.close(); }
});

test('should retain compatibility handling for dynamic, XML, shadow and invalid selectors', () => {
  const dom = new runtime.JSDOM(HTML);
  try {
    const document = dom.window.document;
    assert.equal(document.querySelector('input:checked').id, 'input');
    document.querySelector('#input').checked = false;
    assert.equal(document.querySelector('input:checked'), null);
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<span id="shadow">Inside</span>';
    assert.equal(shadow.querySelector('span').id, 'shadow');
    assert.equal(document.querySelector('#shadow'), null);
    assert.throws(() => document.querySelector('['), { name: 'SyntaxError' });
  } finally { dom.window.close(); }
  const xml = new runtime.JSDOM('<root><Item id="upper"/><item id="lower"/></root>', { contentType: 'application/xml' });
  try { assert.equal(xml.window.document.querySelector('Item').id, 'upper'); }
  finally { xml.window.close(); }
});

test('should serialize changes, templates and Unicode from native storage', () => {
  const expected = new reference.JSDOM('<!doctype html><template><p>inert</p></template><main></main>');
  const actual = new runtime.JSDOM('<!doctype html><template><p>inert</p></template><main></main>');
  const before = runtime.getNativeTreeStatistics().serializations;
  try {
    for (const dom of [expected, actual]) {
      const document = dom.window.document;
      const element = document.querySelector('main');
      element.setAttribute('title', '\ud800 & " < > \u00a0');
      element.append(document.createTextNode('\udc00 & < > \u00a0'));
      const attr = document.createAttributeNS('urn:example', 'example:value');
      attr.value = 'namespaced';
      element.setAttributeNodeNS(attr);
      document.querySelector('template').content.firstChild.textContent = 'updated';
    }
    assert.equal(actual.serialize(), expected.serialize());
    assert.ok(runtime.getNativeTreeStatistics().serializations > before);
  } finally { expected.window.close(); actual.window.close(); }
});

test('should preserve native results after moves and bound the compiled-selector cache', () => {
  const dom = new runtime.JSDOM(HTML);
  try {
    const document = dom.window.document;
    const before = runtime.getNativeTreeStatistics();
    assert.equal(document.querySelectorAll('li:has(+ li.selected)')[0].id, 'first');
    const original = document.querySelector('#first');
    document.querySelector('#list').append(original);
    assert.equal(document.querySelector('li:last-child'), original);
    for (let index = 0; index < 300; index++) document.querySelector(`.uncached-${index}`);
    const after = runtime.getNativeTreeStatistics();
    assert.ok(after.nativeQueries > before.nativeQueries);
    assert.ok(after.selectorCacheSize <= 256);
    const size = after.selectorCacheSize;
    document.querySelector(`[data-long="${'x'.repeat(5000)}"]`);
    assert.equal(runtime.getNativeTreeStatistics().selectorCacheSize, size);
  } finally { dom.window.close(); }
});

test('should handle detached fragments and quirks without changing selector semantics', () => {
  const expected = new reference.JSDOM('<div id="UPPER" class="Selected"><p id="child"></p></div>');
  const actual = new runtime.JSDOM('<div id="UPPER" class="Selected"><p id="child"></p></div>');
  try {
    for (const selector of ['#upper', '.selected', 'div:has(p)', ':scope', ':scope > p']) {
      assert.deepEqual([...actual.window.document.querySelectorAll(selector)].map(identity),
        [...expected.window.document.querySelectorAll(selector)].map(identity));
      const fragments = [expected, actual].map((dom) => {
        const fragment = dom.window.document.createDocumentFragment();
        fragment.append(dom.window.document.querySelector('div').cloneNode(true));
        return [...fragment.querySelectorAll(selector)].map(identity);
      });
      assert.deepEqual(fragments[1], fragments[0]);
    }
  } finally { expected.window.close(); actual.window.close(); }
});
