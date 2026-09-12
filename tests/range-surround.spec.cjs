/** @file Exercises surroundContents validation order, late errors and real wrapping/mutation behavior. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {object} engine - Independent real DOM engine. @returns {object[]} Wrapping results including mutations before late failures. */
function inspect(engine) {
  const results = [];
  for (const kind of ['element', 'text', 'comment', 'attribute', 'fragment', 'document', 'doctype']) {
    for (const partial of [false, true]) {
      const dom = new engine.JSDOM('<!doctype html><main><b>first</b>last</main>');
      try {
        const document = dom.window.document; const root = document.querySelector('main');
        const range = document.createRange();
        if (partial) { range.setStart(root.firstChild.firstChild, 1); range.setEnd(root.lastChild, 2); }
        else range.selectNodeContents(root);
        const parent = kind === 'element' ? document.createElement('section') : kind === 'text' ? document.createTextNode('new')
          : kind === 'comment' ? document.createComment('new') : kind === 'attribute' ? document.createAttribute('new')
          : kind === 'fragment' ? document.createDocumentFragment() : kind === 'document' ? document : document.doctype;
        if (kind === 'element') parent.innerHTML = '<i>old</i>';
        let errorResult = null;
        try { range.surroundContents(parent); } catch (error) { errorResult = [error.name, error.message]; }
        if (!partial && kind === 'element') {
          assert.equal(root.firstChild, parent); assert.equal(parent.textContent, 'firstlast');
          assert.equal(range.startContainer, root); assert.equal(range.startOffset, 0); assert.equal(range.endOffset, 1);
        }
        results.push({ kind, partial, errorResult, source: root.outerHTML, parentParent: parent.parentNode?.nodeName ?? null,
          range: [range.startContainer.nodeName, range.startOffset, range.endContainer.nodeName, range.endOffset] });
      } finally { dom.window.close(); }
    }
  }
  return results;
}

test('should preserve surround results and the mutations that precede late hierarchy failures', () => {
  assert.deepEqual(inspect(engines.rustdom), inspect(engines.jsdom));
});

for (const [name, engine] of Object.entries(engines)) {
  test(`should preserve preflight order and exception realm in ${name}`, () => {
    const owner = new engine.JSDOM('', { runScripts: 'outside-only' });
    const target = new engine.JSDOM('<!doctype html><main><b>first</b>last</main>', { runScripts: 'outside-only' });
    try {
      const root = target.window.document.querySelector('main');
      const range = owner.window.document.createRange();
      range.setStart(root.firstChild.firstChild, 1); range.setEnd(root.lastChild, 1);
      assert.throws(() => range.surroundContents(target.window.document), (error) => {
        assert.ok(error instanceof owner.window.DOMException); assert.equal(error.name, 'InvalidStateError'); return true;
      });
      range.selectNodeContents(root);
      assert.throws(() => range.surroundContents(target.window.document), (error) => {
        assert.ok(error instanceof owner.window.DOMException); assert.equal(error.name, 'InvalidNodeTypeError'); return true;
      });
      assert.equal(root.textContent, 'firstlast');
    } finally { owner.window.close(); target.window.close(); }
  });
}

test('should return native preflight statuses without changing data or accepting unallocated handles', () => {
  const { NativeTree, NativeRange, RangeSurroundStatus } = require('../dist/native.cjs');
  const tree = new NativeTree(); const root = tree.allocate(); tree.setHtmlElement(root, 'main', []);
  const text = tree.allocate(); tree.setCharacterData(text, 3, 'text'); tree.append(root, text);
  const parent = tree.allocate(); tree.setHtmlElement(parent, 'section', []);
  const state = new NativeRange(); state.setStart(root, 0); state.setEnd(root, 1);
  const before = tree.statistics(); assert.equal(tree.rangeSurroundStatus(state, parent), RangeSurroundStatus.Ready);
  assert.deepEqual(tree.statistics(), before);
  const reserved = tree.reserveHandles(); const baseline = tree.statistics();
  assert.throws(() => tree.rangeSurroundStatus(state, reserved), { code: 'InvalidArg' });
  for (const endpoint of ['setStart', 'setEnd']) {
    const invalid = state.copy(); invalid[endpoint](reserved, 0);
    assert.throws(() => tree.rangeSurroundStatus(invalid, parent), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.statistics(), baseline);
  for (const node of [text, root, parent]) tree.release(node);
  assert.equal(tree.statistics().liveNodes, 0);
});

test('should preserve CDATA as a partial non-Text node in XML', () => {
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('<root><![CDATA[data]]>tail</root>', { contentType: 'application/xml' });
    try {
      const root = dom.window.document.documentElement;
      const range = dom.window.document.createRange(); range.setStart(root.firstChild, 0); range.setEnd(root.lastChild, 1);
      assert.throws(() => range.surroundContents(dom.window.document.createElement('wrapper')), { name: 'InvalidStateError' });
      assert.equal(root.childNodes.length, 2); assert.equal(root.firstChild.data, 'data');
    } finally { dom.window.close(); }
  }
});
