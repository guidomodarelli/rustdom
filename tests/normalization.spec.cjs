/** @file Verifies native normalization planning while exercising real range, observer and reentrant hooks. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {object} engine - Real DOM engine. @returns {object} Normalized XML, identity, ranges and records. */
function inspectNormalization(engine) {
  const dom = new engine.JSDOM('<root/>', { contentType: 'application/xml' });
  try {
    const document = dom.window.document;
    const root = document.documentElement;
    const nodes = [document.createTextNode(''), document.createTextNode('A\ud800'),
      document.createTextNode('B\0'), document.createCDATASection('C'),
      document.createTextNode('D'), document.createTextNode('E'), document.createComment('comment')];
    root.append(...nodes);
    const nested = document.createElement('nested');
    nested.append(document.createTextNode('F'), document.createTextNode('G'));
    root.append(nested);
    const range = document.createRange();
    range.setStart(nodes[2], 1); range.setEnd(nodes[5], 1);
    const identities = new Map([...nodes, root, nested, ...nested.childNodes].map((node, index) => [node, index]));
    const observer = new dom.window.MutationObserver(() => {});
    observer.observe(root, { subtree: true, childList: true, characterData: true, characterDataOldValue: true });
    root.normalize();
    const records = observer.takeRecords().map((record) => ({ type: record.type,
      target: identities.get(record.target), oldValue: record.oldValue,
      removed: [...record.removedNodes].map((node) => identities.get(node)) }));
    observer.disconnect();
    return { xml: dom.serialize(), children: [...root.childNodes].map((node) => identities.get(node)),
      originalValues: nodes.map((node) => node.nodeValue), records,
      range: [identities.get(range.startContainer), range.startOffset, identities.get(range.endContainer), range.endOffset] };
  } finally { dom.window.close(); }
}

test('should preserve normalization identity, UTF16, CDATA boundaries, ranges and mutation records', () => {
  assert.deepEqual(inspectNormalization(engines.rustdom), inspectNormalization(engines.jsdom));
});

test('should retain jsdom behavior when normalizing a connected Text context with preceding siblings', () => {
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('<main></main>');
    try {
      const root = dom.window.document.querySelector('main');
      const nodes = ['A', 'B', 'C'].map((value) => dom.window.document.createTextNode(value));
      root.append(...nodes);
      nodes[1].normalize();
      assert.equal(root.firstChild, nodes[1]);
      assert.equal(root.childNodes.length, 1);
      assert.equal(root.textContent, 'BAC');
      const detached = dom.window.document.createTextNode('standalone');
      detached.normalize();
      assert.equal(detached.data, 'standalone');
    } finally { dom.window.close(); }
  }
});

/** @param {object} engine - Real DOM engine. @param {boolean} [createRangeDuringCallback] - Delay range creation until the hook runs. @returns {object} State after a synchronous CSS-error callback mutates siblings. */
function inspectReentrantNormalization(engine, createRangeDuringCallback = false) {
  const virtualConsole = new engine.VirtualConsole();
  const dom = new engine.JSDOM('', { virtualConsole });
  let armed = false;
  let mutated = false;
  let callbacks = 0;
  const document = dom.window.document;
  const style = document.createElement('style');
  const first = document.createTextNode('}');
  const second = document.createTextNode('fragment');
  const added = document.createTextNode(' added');
  let range = null;
  /** @returns {Range} A live parent boundary affected by subsequent normalization steps. */
  function createRange() {
    const result = document.createRange();
    result.setStart(style, 2); result.collapse(true);
    return result;
  }
  virtualConsole.on('jsdomError', () => {
    if (!armed) return;
    callbacks++;
    if (!mutated) {
      mutated = true;
      if (createRangeDuringCallback) range = createRange();
      style.appendChild(added);
    }
  });
  try {
    document.head.append(style);
    style.append(first, second);
    if (!createRangeDuringCallback) range = createRange();
    armed = true;
    style.normalize();
    assert.equal(mutated, true, 'fixture must execute a synchronous callback during normalization');
    assert.ok(range, 'fixture must create the range at the requested point');
    const identity = (node) => node === first ? 'first' : node === second ? 'second' : node === added ? 'added' : 'style';
    return { text: style.textContent, children: [...style.childNodes].map(identity),
      values: [first.data, second.data, added.data], callbacks,
      range: [identity(range.startContainer), range.startOffset, identity(range.endContainer), range.endOffset] };
  } finally { virtualConsole.removeAllListeners(); dom.window.close(); }
}

test('should capture removals before mutation hooks and read live siblings for ranges after reentrant callbacks', () => {
  assert.deepEqual(inspectReentrantNormalization(engines.rustdom), inspectReentrantNormalization(engines.jsdom));
});

test('should adjust ranges created inside a synchronous mutation callback', () => {
  assert.deepEqual(inspectReentrantNormalization(engines.rustdom, true), inspectReentrantNormalization(engines.jsdom, true));
});
