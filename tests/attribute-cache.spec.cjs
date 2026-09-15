/** @file Observable contracts for canonical attribute readers across mutation, metadata and release. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const { NativeTree, QueryMode } = require('../dist/native.cjs');

/** @returns {object} Real native document with one canonical HTML element. */
function nativeFixture() {
  const tree = new NativeTree(); const document = tree.allocate(); const element = tree.allocate();
  tree.setData(document, JSON.stringify({ kind: 9 })); tree.setHtmlElement(element, 'div', []);
  tree.initializeAttributeCollection(element); tree.append(document, element); return { tree, document, element };
}
/** @param {object} fixture - Native owner. @param {object} data - Attr metadata. @returns {number} Owned canonical Attr. */
function appendAttribute(fixture, data) {
  const attribute = fixture.tree.allocate(); fixture.tree.initializeAttribute(attribute, JSON.stringify({ kind: 2, ...data }));
  fixture.tree.appendAttribute(fixture.element, attribute); return attribute;
}
/** @param {object} fixture - Native tree. @param {string} selector - Supported selector. @returns {number[]|null} Native matches or compatibility request. */
function query(fixture, selector) {
  const result = fixture.tree.query(selector, fixture.document, fixture.document, QueryMode.All, false);
  return result === null ? null : [...result];
}

test('should keep canonical selectors and serialization current through writes and metadata replacement', () => {
  const fixture = nativeFixture(); const { tree, element } = fixture;
  const attribute = appendAttribute(fixture, { name: 'id', value: 'before' });
  assert.deepEqual(query(fixture, '#before'), [element]); tree.setAttributeValue(attribute, 'after');
  assert.deepEqual(query(fixture, '#before'), []); assert.deepEqual(query(fixture, '#after'), [element]);
  tree.setElementMetadata(element, JSON.stringify({ kind: 1, name: 'article', namespace: 'http://www.w3.org/1999/xhtml', attributes: [{ name: 'id', value: 'ignored' }] }));
  assert.equal(tree.serializeHtml(element, true, false), '<article id="after"></article>');
  assert.deepEqual(query(fixture, 'article[id="after"]'), [element]); assert.deepEqual(query(fixture, '#ignored'), []);
  tree.removeAttribute(element, attribute); assert.deepEqual(query(fixture, '[id]'), []);
  assert.equal(tree.serializeHtml(element, true, false), '<article></article>');
});

test('should isolate canonical UTF16 compatibility decisions and recover after mutation or release', () => {
  const fixture = nativeFixture(); const { tree, element, document } = fixture;
  const attribute = appendAttribute(fixture, { name: 'data-value', value: 'valid' });
  const unrelated = tree.allocate(); tree.initializeAttribute(unrelated, JSON.stringify({ kind: 2, name: 'detached', value: [0xd800] }));
  assert.deepEqual(query(fixture, '[data-value="valid"]'), [element]);
  tree.setAttributeValue(attribute, '\ud800'); assert.equal(query(fixture, '[data-value]'), null);
  assert.equal(tree.serializeHtml(element, true, false), '<div data-value="\ud800"></div>');
  tree.setAttributeValue(attribute, 'valid\0again'); assert.deepEqual(query(fixture, '[data-value]'), [element]);
  tree.setAttributeValue(attribute, '\udfff'); tree.release(attribute);
  assert.deepEqual(query(fixture, 'div'), [element]); assert.equal(tree.serializeHtml(element, true, false), '<div></div>');
  for (const handle of [unrelated, element, document]) tree.release(handle);
  assert.equal(tree.statistics().liveNodes, 0); assert.equal(tree.statistics().attributeOwners, 0);
});

test('should preserve snapshot-only serialization and synthetic is attributes beside canonical namespaces', () => {
  const fixture = nativeFixture(); const { tree, element } = fixture;
  tree.setElementMetadata(element, JSON.stringify({ kind: 1, name: 'button', namespace: 'http://www.w3.org/1999/xhtml', isValue: 'custom-button' }));
  const attribute = appendAttribute(fixture, { name: 'is', prefix: 'p', namespace: 'urn:p', value: 'prefixed' });
  assert.equal(tree.serializeHtml(element, true, false), '<button is="custom-button" p:is="prefixed"></button>');
  const plain = appendAttribute(fixture, { name: 'is', value: 'plain' });
  assert.equal(tree.serializeHtml(element, true, false), '<button p:is="prefixed" is="plain"></button>');
  tree.removeAttribute(element, plain); tree.release(attribute);
  assert.equal(tree.serializeHtml(element, true, false), '<button is="custom-button"></button>');
  const snapshot = tree.allocate(); tree.setHtmlElement(snapshot, 'p', ['class', 'snapshot']);
  assert.equal(tree.serializeHtml(snapshot, true, false), '<p class="snapshot"></p>');
});

for (const [engine, runtime] of Object.entries(runtimes)) {
  test(`should expose current attributes to queries, serialization, clones and observers in ${engine}`, () => {
    const { window } = new runtime.JSDOM('<!doctype html><body><section></section>');
    try {
      const element = window.document.querySelector('section');
      for (let index = 0; index < 128; index++) element.setAttribute(`data-key-${index}`, `value${index}`);
      const observer = new window.MutationObserver(() => {}); observer.observe(element, { attributes: true, attributeOldValue: true });
      element.getAttributeNode('data-key-64').value = 'updated'; element.id = 'current'; element.className = 'active';
      assert.equal(window.document.querySelector('section#current.active[data-key-64="updated"]'), element);
      const clone = element.cloneNode(true); assert.ok(clone.isEqualNode(element));
      const removed = element.getAttributeNode('data-key-64'); element.removeAttributeNode(removed);
      assert.equal(removed.value, 'updated'); assert.equal(removed.ownerElement, null); assert.equal(element.matches('[data-key-64]'), false);
      assert.equal(element.isEqualNode(clone), false); assert.ok(clone.outerHTML.includes('data-key-64="updated"'));
      const records = observer.takeRecords(); observer.disconnect();
      assert.deepEqual(records.map((record) => [record.attributeName, record.oldValue]), [['data-key-64', 'value64'], ['id', null], ['class', null], ['data-key-64', 'updated']]);
    } finally { window.close(); }
  });

  test(`should preserve namespaced replacement and detached aliases in ${engine}`, () => {
    const { window } = new runtime.JSDOM('<!doctype html><body><div></div>');
    try {
      const element = window.document.querySelector('div'); const old = window.document.createAttributeNS('urn:p', 'p:key'); old.value = 'old'; element.setAttributeNodeNS(old);
      const next = window.document.createAttributeNS('urn:p', 'q:key'); next.value = 'next';
      assert.equal(element.setAttributeNodeNS(next), old); old.value = 'detached';
      assert.equal(element.outerHTML, '<div q:key="next"></div>');
      assert.equal(element.getAttributeNS('urn:p', 'key'), 'next'); next.value = 'changed';
      assert.equal(element.outerHTML, '<div q:key="changed"></div>'); element.removeAttributeNode(next);
      assert.equal(element.outerHTML, '<div></div>'); assert.equal(old.value, 'detached');
    } finally { window.close(); }
  });

  test(`should update native slot selection after direct Attr writes and removals in ${engine}`, () => {
    const { window } = new runtime.JSDOM('<!doctype html><body><main><span slot="chosen"></span></main>');
    try {
      const host = window.document.querySelector('main'); const child = host.firstChild; const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<slot name="chosen"></slot><slot></slot>'; const [named, fallback] = shadow.children;
      assert.equal(child.assignedSlot, named); named.getAttributeNode('name').value = 'other'; assert.equal(child.assignedSlot, null);
      child.slot = ''; assert.equal(child.assignedSlot, fallback); named.removeAttribute('name'); assert.equal(child.assignedSlot, named);
      named.name = '\ud800'; child.slot = '\ud800'; assert.equal(child.assignedSlot, named); assert.deepEqual(named.assignedNodes(), [child]);
    } finally { window.close(); }
  });
}
