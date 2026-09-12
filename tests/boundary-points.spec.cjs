/** @file Exercises native boundary ordering through public Range APIs and real tree mutations. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {Function} operation - Public Range operation. @returns {unknown} Result or observable DOM error. */
function outcome(operation) {
  try { return operation(); } catch (error) { return { name: error.name, code: error.code, message: error.message }; }
}

/** @param {object} engine - Actual DOM implementation. @returns {object} Boundary behavior before and after moves. */
function inspect(engine) {
  const dom = new engine.JSDOM('<!doctype html><main><p>ab🦀</p><aside>cd<!--comment--></aside></main><footer>x</footer>');
  try {
    const document = dom.window.document;
    const root = document.querySelector('main');
    const paragraph = root.firstChild;
    const aside = root.lastChild;
    const footer = document.querySelector('footer');
    const fragment = document.createDocumentFragment();
    fragment.append(document.createTextNode('detached'));
    const attribute = document.createAttribute('id');
    root.setAttributeNode(attribute);
    const shadow = footer.attachShadow({ mode: 'open' });
    shadow.append(document.createTextNode('shadow'));
    const points = [[document, 0], [document, 1], [document, 2], [document.body, 0], [document.body, 1],
      [root, 0], [root, 1], [root, 2], [paragraph, 0], [paragraph, 1], [paragraph.firstChild, 0],
      [paragraph.firstChild, 2], [paragraph.firstChild, 4], [aside, 0], [aside, 1], [aside, 2],
      [aside.firstChild, 1], [aside.lastChild, 2], [fragment, 0], [fragment.firstChild, 1],
      [attribute, 0], [shadow, 0], [shadow.firstChild, 1]];
    const ranges = points.map(([node, offset]) => {
      const range = document.createRange(); range.setStart(node, offset); range.collapse(true); return range;
    });
    const expanded = document.createRange();
    expanded.setStart(paragraph.firstChild, 1); expanded.setEnd(aside.firstChild, 1); ranges.push(expanded);
    /** @returns {object} Public comparison, point and intersection outcomes for current live ranges. */
    function observe() {
      return {
        comparisons: ranges.map((left) => ranges.map((right) => [0, 1, 2, 3].map((how) =>
          outcome(() => left.compareBoundaryPoints(how, right))))),
        points: ranges.map((range) => points.map(([node, offset]) => [
          outcome(() => range.comparePoint(node, offset)), outcome(() => range.isPointInRange(node, offset)),
          outcome(() => range.intersectsNode(node))])),
      };
    }
    const before = observe();
    root.prepend(aside);
    paragraph.firstChild.insertData(1, 'inserted');
    const after = observe();
    return { before, after, errors: [
      outcome(() => expanded.compareBoundaryPoints(4, ranges[0])),
      outcome(() => expanded.comparePoint(paragraph.firstChild, 999)),
      outcome(() => expanded.comparePoint(document.doctype, 0)),
      outcome(() => expanded.isPointInRange(document.doctype, 0)),
    ] };
  } finally { dom.window.close(); }
}

test('should preserve Range comparisons, point queries, errors and intersections across live mutations', () => {
  assert.deepEqual(inspect(engines.rustdom), inspect(engines.jsdom));
});

test('should preserve XML and CDATA range ordering without treating Attr owners as parents', () => {
  const inspectXml = (engine) => {
    const dom = new engine.JSDOM('<root id="x">A<![CDATA[B]]><child>C</child></root>', { contentType: 'application/xml' });
    try {
      const root = dom.window.document.documentElement;
      const range = dom.window.document.createRange();
      range.setStart(root.firstChild, 0); range.setEnd(root.lastChild.firstChild, 1);
      return [...root.childNodes, root.getAttributeNode('id')].map((node) => [
        outcome(() => range.comparePoint(node, 0)), outcome(() => range.isPointInRange(node, 0)),
        outcome(() => range.intersectsNode(node))]);
    } finally { dom.window.close(); }
  };
  assert.deepEqual(inspectXml(engines.rustdom), inspectXml(engines.jsdom));
});

test('should expose native boundary ordering without activating unused handles', () => {
  const { NativeTree } = require('../dist/native.cjs');
  const tree = new NativeTree();
  const root = tree.allocate();
  const child = tree.allocate();
  tree.append(root, child);
  assert.equal(tree.compareBoundaryPointsPosition(root, 0, child, 0), -1);
  assert.equal(tree.compareBoundaryPointsPosition(root, 1, child, 0), 1);
  const reserved = tree.reserveHandles();
  const before = tree.statistics();
  assert.throws(() => tree.compareBoundaryPointsPosition(root, 0, reserved, 0), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), before);
  tree.remove(child);
  assert.equal(tree.compareBoundaryPointsPosition(root, 0, child, 0), null);
  tree.release(child); tree.release(root);
  assert.equal(tree.statistics().liveNodes, 0);
});
