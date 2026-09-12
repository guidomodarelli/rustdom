/** @file Compares public text writes, mutation delivery, conversions and reactions with independent jsdom. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
/** Node families whose public text setters have distinct effects or ownership boundaries. */
const NODE_FAMILIES = ['text', 'cdata', 'comment', 'instruction', 'element', 'fragment', 'shadow',
  'template', 'template-content', 'attribute', 'detached-attribute', 'document', 'doctype'];

/** @param {Document} document - Live host document. @param {string} family - Fixture family. @returns {object} Target and observation scope. */
function fixture(document, family) {
  const scope = document.createElement('section');
  if (family === 'document') return { node: document, scope: document };
  if (family === 'doctype') return { node: document.doctype, scope: document };
  if (family.includes('attribute')) {
    const node = document.createAttribute('value'); node.value = 'initial';
    if (family === 'attribute') scope.setAttributeNode(node);
    return { node, scope };
  }
  if (family === 'cdata') {
    const xml = document.implementation.createDocument(null, 'root');
    const node = xml.createCDATASection('ab🦀cd'); xml.documentElement.append(node);
    return { node, scope: xml.documentElement };
  }
  const constructors = { text: () => document.createTextNode('ab🦀cd'),
    comment: () => document.createComment('ab🦀cd'), instruction: () => document.createProcessingInstruction('target', 'ab🦀cd') };
  if (constructors[family]) { const node = constructors[family](); scope.append(node); return { node, scope }; }
  let node;
  if (family === 'fragment') node = document.createDocumentFragment();
  else if (family === 'shadow') node = scope.attachShadow({ mode: 'closed' });
  else if (family.startsWith('template')) {
    const template = document.createElement('template'); template.innerHTML = '<i>inert</i>';
    scope.append(template); node = family === 'template' ? template : template.content;
  } else { node = document.createElement('div'); scope.append(node); }
  const child = document.createElement('b'); child.append('left'); node.append(child, 'tail');
  return { node, scope: family === 'fragment' || family === 'shadow' || family === 'template-content' ? node : scope };
}

/** @param {object} engine - Actual runtime. @returns {object[]} Public writes and their observable effects. */
function inspectWrites(engine) {
  const dom = new engine.JSDOM('<!doctype html><main></main>');
  const observations = [];
  try {
    for (const property of ['nodeValue', 'textContent']) {
      for (const family of NODE_FAMILIES) {
        for (const value of [null, undefined, '', 0, false, 'A\0🦀\ud800']) {
          const { node, scope } = fixture(dom.window.document, family);
          const identities = new Map();
          /** @param {Node} target - Observed node. @returns {number} Stable fixture-local identity. */
          function identity(target) { if (!identities.has(target)) identities.set(target, identities.size); return identities.get(target); }
          const originalChildren = [...node.childNodes]; originalChildren.forEach(identity); identity(node); identity(scope);
          const text = node.nodeType === 3 ? node : node.firstChild?.firstChild;
          const range = text?.nodeType === 3 ? text.ownerDocument.createRange() : null;
          if (range) { range.setStart(text, 1); range.setEnd(text, text.length); }
          const observer = new dom.window.MutationObserver(() => {});
          observer.observe(scope, { subtree: true, childList: true, characterData: true,
            characterDataOldValue: true, attributes: true, attributeOldValue: true });
          const writes = [];
          for (let repetition = 0; repetition < 2; repetition++) {
            node[property] = value;
            writes.push({ value: node.nodeValue, text: node.textContent,
              children: [...node.childNodes].map((child) => [identity(child), child.nodeType, child.nodeValue, child.textContent]),
              originalParents: originalChildren.map((child) => child.parentNode ? identity(child.parentNode) : null),
              template: node.content?.textContent,
              range: range ? [identity(range.startContainer), range.startOffset, identity(range.endContainer), range.endOffset] : null,
              records: observer.takeRecords().map((record) => ({ type: record.type, target: identity(record.target),
                oldValue: record.oldValue, attribute: record.attributeName,
                added: [...record.addedNodes].map(identity), removed: [...record.removedNodes].map(identity) })) });
          }
          observer.disconnect(); observations.push({ property, family, value, writes });
        }
      }
    }
    return observations;
  } finally { dom.window.close(); }
}

test('should preserve text writes and repeated-write effects for all node families and UTF16 values', () => {
  assert.deepEqual(inspectWrites(engines.rustdom), inspectWrites(engines.jsdom));
});

test('should convert public setter values before deciding whether a node ignores a write', () => {
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('<!doctype html><main>initial</main>');
    try {
      for (const property of ['nodeValue', 'textContent']) {
        for (const node of [dom.window.document, dom.window.document.doctype, dom.window.document.querySelector('main')]) {
          const sentinel = new Error('conversion sentinel'); let conversions = 0;
          const before = node.textContent;
          assert.throws(() => { node[property] = { toString() { conversions++; throw sentinel; } }; }, (error) => error === sentinel);
          assert.equal(conversions, 1); assert.equal(node.textContent, before);
          assert.throws(() => { node[property] = Symbol('invalid'); }, { name: 'TypeError' });
        }
      }
    } finally { dom.window.close(); }
  }
});

test('should deliver attribute reactions for identical writes and preserve reentrant text mutations', () => {
  const inspect = (engine) => {
    const dom = new engine.JSDOM('<!doctype html><body></body>');
    try {
      const events = [];
      class TextTarget extends dom.window.HTMLElement {
        static get observedAttributes() { return ['value']; }
        attributeChangedCallback(name, previous, value) { events.push([name, previous, value]); this.textContent = value; }
      }
      dom.window.customElements.define('text-target', TextTarget);
      const node = dom.window.document.createElement('text-target'); dom.window.document.body.append(node);
      node.setAttribute('value', 'initial'); const attribute = node.getAttributeNode('value'); events.length = 0;
      attribute.nodeValue = 'next'; const first = node.firstChild;
      attribute.textContent = 'next'; const second = node.firstChild;
      assert.notEqual(first, second); assert.equal(first.parentNode, null);
      attribute.textContent = null;
      return { events, text: node.textContent, children: node.childNodes.length, detachedValue: first.data };
    } finally { dom.window.close(); }
  };
  assert.deepEqual(inspect(engines.rustdom), inspect(engines.jsdom));
});

test('should choose scalar native text effects without changing nodes or activating reserved handles', () => {
  const { NativeTree, NodeTextWriteAction } = require('../dist/native.cjs');
  const tree = new NativeTree();
  for (const kind of [0, 1, 2, 3, 4, 7, 8, 9, 10, 11]) {
    const node = tree.allocate(); tree.setData(node, JSON.stringify({ kind, name: 'node', value: 'initial' }));
    const before = tree.statistics();
    for (const contents of [false, true]) {
      const expected = kind === 2 ? NodeTextWriteAction.Attribute
        : [3, 4, 7, 8].includes(kind) ? NodeTextWriteAction.CharacterData
          : contents && [1, 11].includes(kind) ? NodeTextWriteAction.ReplaceChildren : NodeTextWriteAction.Ignore;
      assert.equal(tree.textWriteAction(node, contents), expected);
      assert.deepEqual(tree.statistics(), before);
    }
    tree.release(node);
  }
  const reserved = tree.reserveHandles(); const untyped = tree.allocate(); const before = tree.statistics();
  for (const invalid of [0, -1, NaN, 0.5, reserved, untyped]) {
    assert.throws(() => tree.textWriteAction(invalid, false), { code: 'InvalidArg' });
    assert.throws(() => tree.textWriteAction(invalid, true), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.statistics(), before); tree.release(untyped); assert.equal(tree.statistics().liveNodes, 0);
});
