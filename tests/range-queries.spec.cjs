/** @file Verifies native Range query error ordering, realms, legacy CDATA limits and raw decisions. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

for (const [name, engine] of Object.entries(engines)) {
  test(`should preserve Range query error ordering and exception realms in ${name}`, () => {
    const owner = new engine.JSDOM('<!doctype html><main>owner</main>', { runScripts: 'outside-only' });
    const target = new engine.JSDOM('<!doctype html><p>target</p>', { runScripts: 'outside-only' });
    const foreign = new engine.JSDOM('<!doctype html><p>foreign</p>', { runScripts: 'outside-only' });
    try {
      const range = owner.window.document.createRange();
      const paragraph = target.window.document.querySelector('p');
      range.selectNodeContents(paragraph);
      assert.throws(() => range.comparePoint(paragraph.firstChild, 99), (error) => {
        assert.ok(error instanceof target.window.DOMException);
        assert.equal(error instanceof owner.window.DOMException, false);
        assert.equal(error.name, 'IndexSizeError'); return true;
      });
      assert.throws(() => range.comparePoint(target.window.document.doctype, 99), (error) => {
        assert.ok(error instanceof target.window.DOMException);
        assert.equal(error.name, 'InvalidNodeTypeError'); return true;
      });
      assert.throws(() => range.comparePoint(foreign.window.document.doctype, 99), (error) => {
        assert.ok(error instanceof owner.window.DOMException);
        assert.equal(error instanceof foreign.window.DOMException, false);
        assert.equal(error.name, 'WrongDocumentError'); return true;
      });
      assert.equal(range.isPointInRange(foreign.window.document.doctype, 99), false);
      assert.equal(range.intersectsNode(foreign.window.document.doctype), false);
      assert.equal(range.intersectsNode(target.window.document), true);
      assert.equal(range.comparePoint(paragraph.firstChild, 0), 0);
      assert.equal(range.isPointInRange(paragraph.firstChild, 6), true);
    } finally { owner.window.close(); target.window.close(); foreign.window.close(); }
  });

  test(`should retain pinned CDATA offset validation in ${name}`, () => {
    const dom = new engine.JSDOM('<root><![CDATA[data]]></root>', { contentType: 'application/xml' });
    try {
      const root = dom.window.document.documentElement;
      const range = dom.window.document.createRange(); range.selectNodeContents(root);
      assert.equal(root.firstChild.data.length, 4);
      assert.equal(range.comparePoint(root.firstChild, 0), 0);
      assert.throws(() => range.comparePoint(root.firstChild, 1), { name: 'IndexSizeError', message: 'Offset out of bound.' });
      assert.throws(() => range.isPointInRange(root.firstChild, 1), { name: 'IndexSizeError' });
      assert.equal(range.intersectsNode(root.firstChild), true);
    } finally { dom.window.close(); }
  });
}

test('should expose typed native Range decisions and preserve resources after invalid queries', () => {
  const { NativeTree, RangePointRelation } = require('../dist/native.cjs');
  const tree = new NativeTree();
  const root = tree.allocate(); tree.setHtmlElement(root, 'main', []);
  const text = tree.allocate(); tree.setCharacterData(text, 3, 'value'); tree.append(root, text);
  const foreign = tree.allocate(); tree.setHtmlElement(foreign, 'other', []);
  assert.equal(tree.rangePointRelation(text, 5, root, 0, root, 1), RangePointRelation.Inside);
  assert.equal(tree.rangePointRelation(text, 6, root, 0, root, 1), RangePointRelation.InvalidOffset);
  assert.equal(tree.rangePointRelation(foreign, 99, root, 0, root, 1), RangePointRelation.DifferentRoot);
  assert.equal(tree.rangeIntersectsNode(text, root, 0, root, 1), true);
  assert.equal(tree.rangeIntersectsNode(foreign, root, 0, root, 1), false);
  const reserved = tree.reserveHandles();
  const before = tree.statistics();
  assert.throws(() => tree.rangePointRelation(reserved, 0, root, 0, root, 1), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), before);
  for (const handle of [text, foreign, root]) tree.release(handle);
  assert.equal(tree.statistics().liveNodes, 0);
});
