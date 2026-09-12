/** @file Verifies native deletion planning through real ranges, observers, XML and synchronous mutation callbacks. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {object} engine - Independent real DOM implementation. @returns {object[]} Observable deletion results and mutation order. */
function inspect(engine) {
  const dom = new engine.JSDOM('<main>A<span>mid<b>deep</b>tail</span><!--comment-->end<template>hidden</template>last</main>');
  try {
    const document = dom.window.document;
    const original = document.querySelector('main'); original.firstChild.data = 'A\ud800BC';
    const results = [];
    const descriptors = [[[], 0], [[], 1], [[], 3], [[], 6], [[0], 0], [[0], 1], [[0], 3],
      [[1], 0], [[1], 3], [[1, 0], 1], [[1, 1, 0], 2], [[2], 2], [[3], 1], [[5], 3]];
    for (const [startPath, startOffset] of descriptors) {
      for (const [endPath, endOffset] of descriptors) {
        const root = original.cloneNode(true);
        const nodes = [root]; const walker = document.createTreeWalker(root);
        while (walker.nextNode()) nodes.push(walker.currentNode);
        const start = startPath.reduce((node, index) => node.childNodes[index], root);
        const end = endPath.reduce((node, index) => node.childNodes[index], root);
        const range = document.createRange(); range.setStart(start, startOffset); range.setEnd(end, endOffset);
        const clone = range.cloneRange();
        const observer = new dom.window.MutationObserver(() => {});
        observer.observe(root, { childList: true, subtree: true, characterData: true, characterDataOldValue: true });
        range.deleteContents();
        const records = observer.takeRecords().map((record) => ({ type: record.type, target: nodes.indexOf(record.target),
          oldValue: record.oldValue, removed: [...record.removedNodes].map((node) => nodes.indexOf(node)),
          added: [...record.addedNodes].map((node) => node.nodeName) }));
        observer.disconnect();
        const state = (value) => [nodes.indexOf(value.startContainer), value.startOffset,
          nodes.indexOf(value.endContainer), value.endOffset, value.collapsed];
        results.push({ html: root.outerHTML, range: state(range), clone: state(clone), records });
      }
    }
    return results;
  } finally { dom.window.close(); }
}

test('should preserve deletion boundaries, UTF16, outermost removals and observer order', () => {
  assert.deepEqual(inspect(engines.rustdom), inspect(engines.jsdom));
});

test('should preserve XML CharacterData and CDATA deletion behavior', () => {
  const observations = [];
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('<!DOCTYPE root><root>first<![CDATA[cdata]]><!--comment--><?target instruction?><child>middle</child>last</root>', { contentType: 'application/xml' });
    try {
      const root = dom.window.document.documentElement;
      const range = dom.window.document.createRange(); range.setStart(root.firstChild, 2); range.setEnd(root.lastChild, 2);
      range.deleteContents();
      observations.push([dom.serialize(), range.startContainer === root, range.startOffset, range.endOffset]);
      for (const node of [dom.window.document.createComment('abcdef'), dom.window.document.createProcessingInstruction('target', 'abcdef')]) {
        range.setStart(node, 1); range.setEnd(node, 4); range.deleteContents(); assert.equal(node.data, 'aef');
      }
    } finally { dom.window.close(); }
  }
  assert.deepEqual(observations[0], observations[1]);
});

/** @param {object} engine - Real DOM implementation. @returns {object} Reentrant deletion observations. */
function inspectReentry(engine) {
  const virtualConsole = new engine.VirtualConsole();
  const dom = new engine.JSDOM('<main><style>}</style><span>remove</span><p>end</p></main><aside></aside>', { virtualConsole });
  try {
    const document = dom.window.document;
    const root = document.querySelector('main'); const outside = document.querySelector('aside');
    const removed = root.querySelector('span'); const first = root.querySelector('style').firstChild;
    const end = root.querySelector('p').firstChild;
    const range = document.createRange(); range.setStart(first, 1); range.setEnd(end, 1);
    let callbacks = 0;
    virtualConsole.on('jsdomError', () => {
      if (callbacks++) return;
      outside.append(removed); root.prepend(document.createElement('b'));
    });
    range.deleteContents();
    assert.ok(callbacks > 0, 'Fixture must execute a real synchronous stylesheet callback');
    return { html: root.innerHTML, outside: outside.innerHTML, removedParent: removed.parentNode?.nodeName ?? null,
      startIsRoot: range.startContainer === root, startOffset: range.startOffset, endOffset: range.endOffset };
  } finally { dom.window.close(); }
}

test('should preserve captured removals and collapse position when a synchronous hook moves nodes', () => {
  assert.deepEqual(inspectReentry(engines.rustdom), inspectReentry(engines.jsdom));
});

test('should return a read-only native deletion plan and reject released endpoints without mutation', () => {
  const { NativeTree, NativeRange, RangeDeletionKind } = require('../dist/native.cjs');
  const tree = new NativeTree(); const root = tree.allocate(); tree.setHtmlElement(root, 'main', []);
  const text = tree.allocate(); tree.setCharacterData(text, 3, 'text'); tree.append(root, text);
  const range = new NativeRange(); range.setStart(root, 0); range.setEnd(root, 1);
  const before = tree.statistics(); const plan = tree.rangeDeletionPlan(range);
  assert.equal(plan.kind, RangeDeletionKind.Tree); assert.deepEqual(plan.nodes, [text]);
  assert.equal(plan.collapseNode, root); assert.equal(plan.collapseOffset, 0);
  assert.deepEqual(tree.statistics(), before);
  tree.release(text); tree.release(root);
  assert.throws(() => tree.rangeDeletionPlan(range), { code: 'InvalidArg' });
  assert.equal(tree.statistics().liveNodes, 0);
});

test('should reproduce the independent HTML CDATA clone limitation blocking the upstream iframe fixture', () => {
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('');
    try {
      const xml = new dom.window.Document();
      dom.window.document.body.append(xml.createCDATASection('data'));
      assert.throws(() => dom.window.document.documentElement.cloneNode(true), {
        name: 'NotSupportedError', message: 'Cannot create CDATA sections in HTML documents',
      });
    } finally { dom.window.close(); }
  }
});
