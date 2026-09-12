/** @file Exercises native content selection through cloneContents/extractContents and real creation hooks. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {object} engine - Real engine. @param {string} operation - Public content method. @returns {object[]} Results with identity and live-range observations. */
function inspect(engine, operation) {
  const dom = new engine.JSDOM('<main>start<b data-q="x">middle<i>deep</i>tail</b>last<!--note--></main>');
  try {
    const document = dom.window.document; const original = document.querySelector('main');
    const cases = [[[0], 2, [2], 2], [[1, 0], 1, [1, 1, 0], 2], [[], 0, [], 3],
      [[], 1, [], 2], [[1], 0, [1], 3], [[3], 1, [3], 3], [[0], 2, [0], 2]];
    return cases.map(([startPath, startOffset, endPath, endOffset]) => {
      const root = original.cloneNode(true); const fullChild = root.childNodes[1];
      const nodes = [root]; const walker = document.createTreeWalker(root);
      while (walker.nextNode()) nodes.push(walker.currentNode);
      const start = startPath.reduce((node, index) => node.childNodes[index], root);
      const end = endPath.reduce((node, index) => node.childNodes[index], root);
      const range = document.createRange(); range.setStart(start, startOffset); range.setEnd(end, endOffset);
      const before = root.outerHTML;
      const observer = new dom.window.MutationObserver(() => {}); observer.observe(root, {
        childList: true, subtree: true, characterData: true, characterDataOldValue: true,
      });
      const fragment = range[operation]();
      const records = observer.takeRecords().map((record) => ({ type: record.type, target: nodes.indexOf(record.target),
        oldValue: record.oldValue, removed: [...record.removedNodes].map((node) => nodes.indexOf(node)) }));
      observer.disconnect();
      assert.equal(fragment.ownerDocument, document);
      if (operation === 'cloneContents') { assert.equal(root.outerHTML, before); assert.equal(records.length, 0); }
      if (start === root && startOffset === 1 && end === root && endOffset === 2) {
        assert.equal(fragment.firstChild === fullChild, operation === 'extractContents');
      }
      const wrapper = document.createElement('section'); wrapper.append(fragment);
      return { source: root.outerHTML, fragment: wrapper.innerHTML, records,
        range: [nodes.indexOf(range.startContainer), range.startOffset, nodes.indexOf(range.endContainer), range.endOffset] };
    });
  } finally { dom.window.close(); }
}

for (const operation of ['cloneContents', 'extractContents']) {
  test(`should preserve ${operation} fragments, node identities and live mutations`, () => {
    assert.deepEqual(inspect(engines.rustdom, operation), inspect(engines.jsdom, operation));
  });
}

/** @param {object} engine - Real engine. @param {string} operation - Public content operation. @returns {object} Original tree and fragment after synchronous custom-element construction. */
function inspectReentry(engine, operation) {
  const dom = new engine.JSDOM('<main><x-partial>abc</x-partial><span>middle</span><p>end</p></main><aside></aside>');
  try {
    const document = dom.window.document; const root = document.querySelector('main');
    const partial = root.firstChild; const middle = root.querySelector('span'); const outside = document.querySelector('aside');
    let armed = false; let changed = false;
    class PartialElement extends dom.window.HTMLElement {
      constructor() {
        super();
        if (armed && !changed) {
          changed = true; partial.append(' added'); outside.append(middle); root.prepend(document.createElement('em'));
        }
      }
    }
    dom.window.customElements.define('x-partial', PartialElement);
    const range = document.createRange(); range.setStart(partial.firstChild, 1); range.setEnd(root.querySelector('p').firstChild, 1);
    armed = true;
    const fragment = range[operation]();
    assert.equal(changed, true, 'Fixture must execute the real custom-element constructor during cloning');
    const wrapper = document.createElement('section'); wrapper.append(fragment);
    return { source: root.innerHTML, outside: outside.innerHTML, fragment: wrapper.innerHTML,
      startInRoot: range.startContainer === root, startOffset: range.startOffset, endOffset: range.endOffset };
  } finally { dom.window.close(); }
}

test('should retain captured children and read partial lengths after reentrant construction', () => {
  for (const operation of ['cloneContents', 'extractContents']) {
    assert.deepEqual(inspectReentry(engines.rustdom, operation), inspectReentry(engines.jsdom, operation));
  }
});

test('should preserve XML fragments and reject contained doctypes in the Range realm', () => {
  const observations = [];
  for (const engine of Object.values(engines)) {
    const owner = new engine.JSDOM('', { runScripts: 'outside-only' });
    const dom = new engine.JSDOM('<!DOCTYPE root><root>a<item><![CDATA[data]]><!--note--><?target pi?></item>z</root>', { contentType: 'application/xml' });
    try {
      const root = dom.window.document.documentElement; const range = owner.window.document.createRange();
      range.selectNodeContents(root);
      const fragment = range.cloneContents(); observations.push(new dom.window.XMLSerializer().serializeToString(fragment));
      range.selectNodeContents(dom.window.document);
      for (const operation of ['cloneContents', 'extractContents']) {
        assert.throws(() => range[operation](), (error) => {
          assert.ok(error instanceof owner.window.DOMException); assert.equal(error.name, 'HierarchyRequestError'); return true;
        });
        assert.ok(dom.window.document.doctype);
      }
    } finally { owner.window.close(); dom.window.close(); }
  }
  assert.deepEqual(observations[0], observations[1]);
});

test('should expose a read-only native selection with partial and fully contained children', () => {
  const { NativeTree, NativeRange } = require('../dist/native.cjs');
  const tree = new NativeTree(); const root = tree.allocate(); tree.setHtmlElement(root, 'main', []);
  const children = ['first', 'middle', 'last'].map((value) => { const node = tree.allocate(); tree.setCharacterData(node, 3, value); tree.append(root, node); return node; });
  const state = new NativeRange(); state.setStart(children[0], 1); state.setEnd(children[2], 2);
  const before = tree.statistics(); const selection = tree.rangeContentSelection(state);
  assert.deepEqual(selection, { commonAncestor: root, firstPartial: children[0], lastPartial: children[2],
    contained: [children[1]], hasDoctype: false, collapseNode: root, collapseOffset: 1 });
  assert.deepEqual(tree.statistics(), before);
  for (const node of children) tree.release(node); tree.release(root);
  assert.equal(selection.contained[0], children[1]); assert.equal(tree.statistics().liveNodes, 0);
  assert.throws(() => tree.rangeContentSelection(state), { code: 'InvalidArg' });
});
