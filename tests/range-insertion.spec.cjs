/** @file Exercises real Range insertion geometry, mutation ordering, live ranges and error realms. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {Node} node - Observed DOM node. @returns {object} Stable structure and location without retaining implementation details. */
function describeNode(node) {
  return { name: node.nodeName, value: node.nodeValue, parent: node.parentNode?.nodeName ?? null,
    index: node.parentNode ? [...node.parentNode.childNodes].indexOf(node) : -1 };
}
/** @param {Range} range - Live range after an operation. @returns {object} Observable endpoints and collapsed state. */
function describeRange(range) {
  return { start: describeNode(range.startContainer), startOffset: range.startOffset,
    end: describeNode(range.endContainer), endOffset: range.endOffset, collapsed: range.collapsed };
}
/** @param {object} engine - Independent DOM engine. @returns {object[]} Results including successful and rejected insertions. */
function inspectMatrix(engine) {
  const results = [];
  for (const boundary of ['first', 'middle', 'last', 'text', 'surrogate', 'comment', 'detached-text', 'attribute', 'fragment', 'document']) {
    for (const inserted of ['element', 'text', 'fragment', 'empty-fragment', 'reference', 'earlier', 'later', 'self', 'ancestor', 'doctype', 'attribute', 'document']) {
      const dom = new engine.JSDOM('<!doctype html><main>ab😀cd<span>middle</span><!--note--><b>tail</b></main>');
      try {
        const document = dom.window.document; const root = document.querySelector('main'); const first = root.firstChild;
        const range = document.createRange(); const observing = document.createRange(); observing.selectNodeContents(root);
        const boundaryNode = boundary === 'text' || boundary === 'surrogate' ? first : boundary === 'comment' ? root.childNodes[2]
          : boundary === 'detached-text' ? document.createTextNode('alone') : boundary === 'attribute' ? document.createAttribute('start')
          : boundary === 'fragment' ? document.createDocumentFragment() : boundary === 'document' ? document : root;
        const offset = boundary === 'middle' || boundary === 'text' ? 1 : boundary === 'last' ? root.childNodes.length
          : boundary === 'surrogate' ? 3 : 0;
        range.setStart(boundaryNode, offset); range.collapse(true);
        const node = inserted === 'element' ? document.createElement('em') : inserted === 'text' ? document.createTextNode('new')
          : inserted.endsWith('fragment') ? document.createDocumentFragment() : inserted === 'reference' ? root.childNodes[1]
          : inserted === 'earlier' ? first : inserted === 'later' ? root.lastChild : inserted === 'self' ? boundaryNode
          : inserted === 'ancestor' ? root : inserted === 'doctype' ? document.doctype
          : inserted === 'attribute' ? document.createAttribute('inserted') : document;
        if (inserted === 'fragment') node.append(document.createElement('i'), document.createTextNode('fragment'));
        const observer = new dom.window.MutationObserver(() => {});
        observer.observe(root, { childList: true, characterData: true, subtree: true, characterDataOldValue: true });
        let errorResult = null;
        try { range.insertNode(node); } catch (error) { errorResult = [error.name, error.message]; }
        const records = observer.takeRecords().map((record) => ({ type: record.type, target: describeNode(record.target), oldValue: record.oldValue,
          added: [...record.addedNodes].map(describeNode), removed: [...record.removedNodes].map(describeNode) }));
        results.push({ boundary, inserted, errorResult, html: document.documentElement.outerHTML,
          node: describeNode(node), children: [...node.childNodes].map(describeNode),
          range: describeRange(range), observing: describeRange(observing), records });
        observer.disconnect();
      } finally { dom.window.close(); }
    }
  }
  return results;
}

test('should match insertion and rejection side effects across 120 boundary and node combinations', () => {
  assert.deepEqual(inspectMatrix(engines.rustdom), inspectMatrix(engines.jsdom));
});

test('should preserve noncollapsed ranges, UTF-16 splits and inserted node identity', () => {
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('<main>ab😀cd</main>');
    try {
      const document = dom.window.document; const root = document.querySelector('main'); const first = root.firstChild;
      const range = document.createRange(); range.setStart(first, 3); range.setEnd(first, 5);
      const inserted = document.createElement('i'); inserted.textContent = 'new';
      range.insertNode(inserted);
      assert.equal(root.childNodes[1], inserted); assert.equal(root.firstChild, first);
      assert.equal(first.data, 'ab\ud83d'); assert.equal(root.lastChild.data, '\ude00cd');
      assert.equal(range.startContainer, first); assert.equal(range.startOffset, 3);
      assert.equal(range.endContainer, root.lastChild); assert.equal(range.endOffset, 2);
      assert.equal(range.toString(), 'new\ude00c');
    } finally { dom.window.close(); }
  }
});

test('should throw invalid-start errors in the inserted node realm and leave XML CDATA hierarchy validation late', () => {
  for (const engine of Object.values(engines)) {
    const owner = new engine.JSDOM('', { runScripts: 'outside-only' });
    const target = new engine.JSDOM('<root><![CDATA[data]]><!--note--><?target value?></root>',
      { contentType: 'application/xml', runScripts: 'outside-only' });
    try {
      const document = target.window.document; const range = owner.window.document.createRange();
      const inserted = document.createElement('inserted');
      for (const node of document.documentElement.childNodes) {
        range.setStart(node, 0); range.collapse(true);
        assert.throws(() => range.insertNode(inserted), (error) => {
          assert.ok(error instanceof target.window.DOMException); assert.equal(error.name, 'HierarchyRequestError');
          assert.equal(error.message, node.nodeType === 4 ? 'Node can\'t be inserted in a #cdata-section parent.' : 'Invalid start node.');
          return true;
        });
        assert.equal(inserted.parentNode, null);
      }
    } finally { owner.window.close(); target.window.close(); }
  }
});

/** @param {object} engine - Real DOM implementation. @returns {object} Reentrant stylesheet observations. */
function inspectReentry(engine) {
  const virtualConsole = new engine.VirtualConsole();
  const dom = new engine.JSDOM('<main><style>}}</style></main>', { virtualConsole });
  try {
    const document = dom.window.document; const root = document.querySelector('main'); const style = root.firstChild;
    const range = document.createRange(); range.setStart(style.firstChild, 1); range.collapse(true);
    const fragment = document.createDocumentFragment(); fragment.append(document.createTextNode('new'));
    let callbacks = 0;
    virtualConsole.on('jsdomError', () => {
      if (callbacks++) return;
      fragment.append(document.createTextNode('late')); style.prepend(document.createTextNode('prefix'));
    });
    range.insertNode(fragment);
    assert.ok(callbacks > 0, 'Fixture must exercise a synchronous stylesheet callback during splitText');
    assert.equal(fragment.childNodes.length, 0);
    return { html: root.innerHTML, range: describeRange(range), childData: [...style.childNodes].map((node) => node.data) };
  } finally { dom.window.close(); }
}

test('should calculate the insertion offset after synchronous callbacks change children and fragment size', () => {
  assert.deepEqual(inspectReentry(engines.rustdom), inspectReentry(engines.jsdom));
});

test('should expose read-only native insertion decisions and reject invalid handles without consuming reservations', () => {
  const { NativeTree, NativeRange } = require('../dist/native.cjs');
  const tree = new NativeTree(); const root = tree.allocate(); tree.setHtmlElement(root, 'main', []);
  const text = tree.allocate(); tree.setCharacterData(text, 3, 'text'); tree.append(root, text);
  const inserted = tree.allocate(); tree.setHtmlElement(inserted, 'i', []);
  const range = new NativeRange(); range.setStart(text, 1); range.setEnd(text, 1);
  const before = tree.statistics();
  const plan = tree.rangeInsertionPlan(range, inserted);
  assert.deepEqual(plan, { startNode: text, startOffset: 1, parent: root, reference: text, splitText: true });
  assert.equal(tree.rangeInsertionOffset(inserted, root, 0), 2);
  assert.deepEqual(tree.statistics(), before);
  const reserved = tree.reserveHandles(); const baseline = tree.statistics();
  for (const endpoint of ['setStart', 'setEnd']) {
    const invalid = range.copy(); invalid[endpoint](reserved, 0);
    assert.throws(() => tree.rangeInsertionPlan(invalid, inserted), { code: 'InvalidArg' });
  }
  for (const invalid of [reserved, Number.MAX_SAFE_INTEGER, -1, 0, 0.5, NaN]) {
    assert.throws(() => tree.rangeInsertionPlan(range, invalid), { code: 'InvalidArg' });
    assert.throws(() => tree.rangeInsertionOffset(invalid, root, 0), { code: 'InvalidArg' });
    assert.throws(() => tree.rangeInsertionOffset(inserted, invalid, 0), { code: 'InvalidArg' });
    if (invalid !== 0) assert.throws(() => tree.rangeInsertionOffset(inserted, root, invalid), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.statistics(), baseline);
  for (const node of [text, root, inserted]) tree.release(node);
  assert.equal(tree.statistics().liveNodes, 0); assert.equal(plan.reference, text);
  assert.throws(() => tree.rangeInsertionPlan(range, inserted), { code: 'InvalidArg' });
});
