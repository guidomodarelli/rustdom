/** @file Exercises native live-range mutation plans through real DOM operations and the numeric state API. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {Node} node - Observed node. @returns {object} Current public structure and location. */
function describeNode(node) {
  const path = []; let current = node;
  while (current.parentNode) { path.unshift([...current.parentNode.childNodes].indexOf(current)); current = current.parentNode; }
  return { root: current.nodeName, path, name: node.nodeName, value: node.nodeValue };
}
/** @param {Range|StaticRange} range - Observed range. @returns {object} Public endpoints. */
function describeRange(range) {
  return { start: describeNode(range.startContainer), startOffset: range.startOffset,
    end: describeNode(range.endContainer), endOffset: range.endOffset, collapsed: range.collapsed };
}
/** @param {object} engine - Actual DOM runtime. @returns {object[]} Differential mutation observations. */
function inspectMutations(engine) {
  const observations = [];
  for (const operation of ['replace-data', 'insert-data', 'delete-data', 'append-data', 'set-data', 'split-text',
    'insert-fragment', 'append-fragment', 'remove-subtree', 'replace-subtree', 'text-content', 'normalize']) {
    const dom = new engine.JSDOM('<main>ab😀cd<span>middle</span><!--note--><b>tail</b>last</main>');
    try {
      const document = dom.window.document; const root = document.querySelector('main');
      const text = root.firstChild; const middle = root.querySelector('span'); const end = root.lastChild;
      root.insertBefore(document.createTextNode('joined'), middle);
      const points = [[root, 0], [root, 1], [root, 3], [root, root.childNodes.length], [text, 0], [text, 3],
        [text, text.length], [middle.firstChild, 1], [middle.firstChild, 5], [end, 2]];
      const ranges = points.flatMap(([start, startOffset]) => points.map(([finish, endOffset]) => {
        const range = document.createRange(); range.setStart(start, startOffset); range.setEnd(finish, endOffset); return range;
      }));
      const copies = ranges.map((range) => range.cloneRange());
      const frozen = ranges.map((range) => new dom.window.StaticRange({ startContainer: range.startContainer,
        startOffset: range.startOffset, endContainer: range.endContainer, endOffset: range.endOffset }));
      const frozenOffsets = frozen.map((range) => [range.startOffset, range.endOffset]);
      const fragment = document.createDocumentFragment(); fragment.append(document.createElement('i'), document.createTextNode('inserted'));
      const observer = new dom.window.MutationObserver(() => {});
      observer.observe(root, { subtree: true, childList: true, characterData: true, characterDataOldValue: true });
      switch (operation) {
        case 'replace-data': text.replaceData(1, 3, '🦀'); break;
        case 'insert-data': text.insertData(1, '\ud800'); break;
        case 'delete-data': text.deleteData(2, 3); break;
        case 'append-data': text.appendData('extra'); break;
        case 'set-data': text.data = 'changed'; break;
        case 'split-text': text.splitText(3); break;
        case 'insert-fragment': root.insertBefore(fragment, root.childNodes[1]); break;
        case 'append-fragment': root.append(fragment); break;
        case 'remove-subtree': middle.remove(); break;
        case 'replace-subtree': root.replaceChild(fragment, middle); break;
        case 'text-content': root.textContent = 'replacement'; break;
        case 'normalize': root.normalize(); break;
      }
      const snapshots = ranges.map(describeRange);
      assert.deepEqual(copies.map(describeRange), snapshots, 'Cloned live ranges must follow the same mutations');
      assert.deepEqual(frozen.map((range) => [range.startOffset, range.endOffset]), frozenOffsets);
      const records = observer.takeRecords().map((record) => ({ type: record.type, target: describeNode(record.target), oldValue: record.oldValue,
        added: [...record.addedNodes].map(describeNode), removed: [...record.removedNodes].map(describeNode) }));
      observations.push({ operation, html: root.innerHTML, snapshots, frozen: frozen.map(describeRange), records });
      observer.disconnect();
    } finally { dom.window.close(); }
  }
  return observations;
}

test('should preserve 100 live ranges and their copies through each of 12 real DOM mutations', () => {
  assert.deepEqual(inspectMutations(engines.rustdom), inspectMutations(engines.jsdom));
});

test('should preserve the pinned insertion adjustment when the other endpoint belongs to a Text node', () => {
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('<main><i></i><span>abcdef</span></main>');
    try {
      const document = dom.window.document; const root = document.querySelector('main');
      const range = document.createRange(); range.setStart(root, 0); range.setEnd(root.lastChild.firstChild, 5);
      root.insertBefore(document.createElement('b'), root.firstChild);
      assert.equal(range.startContainer, root); assert.equal(range.startOffset, 0);
      assert.equal(range.endContainer, root); assert.equal(range.endOffset, 6);
    } finally { dom.window.close(); }
  }
});

test('should preserve native plan order, independent snapshots and explicit numeric mutation contracts', () => {
  const { NativeRange } = require('../dist/native.cjs'); const range = new NativeRange();
  range.setStart(1, 8); range.setEnd(1, 3); const before = [range.start, range.end];
  assert.deepEqual(range.characterDataPlan(1, 2, 3, 1), [
    { start: false, node: 1, offset: 2 }, { start: true, node: 1, offset: 6 },
  ]);
  assert.deepEqual([range.start, range.end], before);
  assert.deepEqual(range.splitTextPlan(1, 2, 4), [{ start: true, node: 2, offset: 4 }]);
  assert.deepEqual(range.splitParentPlan(1, 2), [{ start: false, node: 1, offset: 4 }]);
  assert.deepEqual(range.insertPlan(2, 4, 3), [{ start: true, node: 2, offset: 11 }]);
  assert.deepEqual(range.removeDescendantPlan(1, 2, 4), [
    { start: true, node: 2, offset: 4 }, { start: false, node: 2, offset: 4 },
  ]);
  assert.deepEqual(range.removeParentPlan(1, 4), [{ start: true, node: 1, offset: 7 }]);
  assert.deepEqual(range.normalizeTextPlan(1, 2, 4), [
    { start: true, node: 2, offset: 12 }, { start: false, node: 2, offset: 7 },
  ]);
  assert.deepEqual(range.normalizeParentPlan(1, 2, 3, 4), [{ start: false, node: 2, offset: 4 }]);
  assert.deepEqual([range.start, range.end], before);
  const copy = range.copy();
  for (const update of copy.characterDataPlan(1, 2, 3, 1)) copy[update.start ? 'setStart' : 'setEnd'](update.node, update.offset);
  assert.equal(copy.startOffset, 6); assert.equal(copy.endOffset, 2); assert.equal(range.startOffset, 8);
});

test('should reject malformed mutation handles and uninitialized Range state before changing endpoints', () => {
  const { NativeRange } = require('../dist/native.cjs'); const range = new NativeRange();
  range.setStart(1, 8); range.setEnd(2, 3); const before = [range.start, range.end];
  const operations = [
    ['characterDataPlan', [1, 0, 2, 1], [0]], ['splitTextPlan', [1, 2, 0], [0, 1]], ['splitParentPlan', [1, 0], [0]],
    ['insertPlan', [1, 0, 2], [0]], ['removeDescendantPlan', [1, 2, 0], [0, 1]], ['removeParentPlan', [1, 0], [0]],
    ['normalizeTextPlan', [1, 2, 0], [0, 1]], ['normalizeParentPlan', [1, 2, 0, 2], [0, 1]],
  ];
  for (const [method, args, handles] of operations) {
    assert.throws(() => new NativeRange()[method](...args), { code: 'InvalidArg' });
    for (const position of handles) for (const invalid of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const supplied = [...args]; supplied[position] = invalid;
      assert.throws(() => range[method](...supplied), { code: 'InvalidArg' });
    }
  }
  assert.deepEqual([range.start, range.end], before);
});

test('should apply native offsets atomically and report only node ownership moves', () => {
  const { NativeRange, RangeMutationKind, RangeEndpoint } = require('../dist/native.cjs');
  const range = new NativeRange(); range.setStart(1, 2); range.setEnd(1, 7);
  const before = range.end; range.applyCharacterData(1, 3, 0, 2);
  assert.equal(range.startOffset, 2); assert.equal(range.endOffset, 9); assert.equal(before.offset, 7);
  assert.equal(range.applyTreeMutation(RangeMutationKind.SplitText, 1, 2, 3, 0), RangeEndpoint.End);
  assert.deepEqual(range.end, { node: 2, offset: 6 });
  assert.equal(range.applyTreeMutation(RangeMutationKind.Insert, 3, 3, 0, 1), RangeEndpoint.Start | RangeEndpoint.End);
  assert.deepEqual(range.start, { node: 3, offset: 3 }); assert.deepEqual(range.end, { node: 3, offset: 7 });
  assert.equal(range.applyTreeMutation(RangeMutationKind.RemoveParent, 3, 3, 0, 0), 0);
  assert.equal(range.startOffset, 2); assert.equal(range.endOffset, 6);
  const snapshot = [range.start, range.end];
  for (const invalid of [0, -1, 0.5, NaN, Infinity]) {
    assert.throws(() => range.applyCharacterData(invalid, 0, 1, 1), { code: 'InvalidArg' });
    assert.throws(() => range.applyTreeMutation(RangeMutationKind.Insert, invalid, 3, 0, 1), { code: 'InvalidArg' });
    assert.throws(() => range.applyTreeMutation(RangeMutationKind.Insert, 3, invalid, 0, 1), { code: 'InvalidArg' });
  }
  for (const invalid of [-1, 7, 999]) assert.throws(() => range.applyTreeMutation(invalid, 3, 3, 0, 1), { code: 'InvalidArg' });
  assert.deepEqual([range.start, range.end], snapshot);
  assert.throws(() => new NativeRange().applyCharacterData(1, 0, 1, 0), { code: 'InvalidArg' });
});
