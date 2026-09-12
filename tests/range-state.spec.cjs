/** @file Verifies canonical native Range state, public live/static behavior, and actual V8 finalization. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const { NativeTree, NativeRange, RangeBoundaryMode, RangePointRelation } = require('../dist/native.cjs');

test('should preserve native snapshots, numeric offsets and errors without retaining tree nodes', () => {
  const tree = new NativeTree();
  const root = tree.allocate(); tree.setHtmlElement(root, 'main', []);
  const text = tree.allocate(); tree.setCharacterData(text, 3, 'A\ud800BC'); tree.append(root, text);
  const state = new NativeRange();
  assert.equal(state.start, null); assert.equal(state.end, null);
  assert.throws(() => state.collapsed, { code: 'InvalidArg' });
  assert.throws(() => tree.rangeTextFromState(state), { code: 'InvalidArg' });
  state.setStart(text, 1); state.setEnd(text, 3);
  const snapshot = state.start;
  assert.equal(state.collapsed, false);
  assert.equal(tree.rangeTextFromState(state), '\ud800B');
  assert.equal(tree.rangePointRelationFromState(state, text, 2), RangePointRelation.Inside);
  assert.equal(tree.rangeIntersectsNodeFromState(state, text), true);
  assert.equal(tree.commonAncestorFromState(state), text);
  assert.deepEqual(tree.rangeBoundaryPlanFromState(state, RangeBoundaryMode.Start, text, 2),
    tree.rangeBoundaryPlan(RangeBoundaryMode.Start, text, 2, text, 1, text, 3));
  for (const node of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => state.setStart(node, 2), { code: 'InvalidArg' });
    assert.throws(() => state.setEnd(node, 2), { code: 'InvalidArg' });
    assert.deepEqual(state.start, snapshot); assert.equal(state.endOffset, 3);
  }
  for (const offset of [-0, -1.5, 2 ** 32 + 1, Infinity, NaN]) {
    state.setStart(text, offset); state.setEnd(text, offset);
    assert.ok(Object.is(state.startOffset, offset));
    assert.equal(state.collapsed, !Number.isNaN(offset));
    assert.equal(tree.rangeTextFromState(state), tree.rangeText(text, offset, text, offset));
  }
  assert.deepEqual(snapshot, { node: text, offset: 1 });
  state.setStart(text, 2 ** 32 + 1); state.setEnd(text, 2 ** 32 + 3);
  assert.equal(tree.rangeTextFromState(state), '\ud800B');
  tree.release(text); tree.release(root);
  assert.equal(state.start.node, text); assert.equal(tree.statistics().liveNodes, 0);
  assert.throws(() => tree.rangeTextFromState(state), { code: 'InvalidArg' });
});

test('should reject foreign native objects and forged state prototypes before borrowing Rust memory', () => {
  const tree = new NativeTree();
  const text = tree.allocate(); tree.setCharacterData(text, 3, 'text');
  for (const invalid of [{}, tree, Object.create(NativeRange.prototype), null, 1]) {
    assert.throws(() => tree.rangeTextFromState(invalid), { code: 'InvalidArg' });
    assert.throws(() => tree.rangePointRelationFromState(invalid, text, 0), { code: 'InvalidArg' });
    assert.throws(() => tree.rangeIntersectsNodeFromState(invalid, text), { code: 'InvalidArg' });
    assert.throws(() => tree.commonAncestorFromState(invalid), { code: 'InvalidArg' });
    assert.throws(() => tree.rangeBoundaryPlanFromState(invalid, RangeBoundaryMode.SelectContents, text, 0), { code: 'InvalidArg' });
  }
  // V8 rejects an incompatible method receiver before Node-API argument conversion.
  assert.throws(() => NativeRange.prototype.setStart.call(tree, text, 0), TypeError);
  assert.equal(tree.getCharacterData(text), 'text'); tree.release(text);
  assert.equal(tree.statistics().liveNodes, 0);
});

/** @param {object} engine - Real engine. @param {string} name - Independent implementation identifier. @returns {object} Public observations through mutations and Selection. */
function inspect(engine, name) {
  const dom = new engine.JSDOM('<!doctype html><main>abc<span>def</span>ghi</main>');
  const foreign = new engine.JSDOM('<p>foreign</p>');
  try {
    const document = dom.window.document;
    const root = document.querySelector('main');
    const first = root.firstChild; const middle = root.querySelector('span').firstChild; const last = root.lastChild;
    const range = document.createRange();
    assert.equal(range.startContainer, document); assert.equal(range.endContainer, document); assert.equal(range.collapsed, true);
    range.setStart(first, 1); range.setEnd(last, 2);
    const utilities = name === 'jsdom' ? require('jsdom/lib/jsdom/living/generated/utils')
      : require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils');
    const savedStart = utilities.implForWrapper(range)._start;
    range.setStart(middle, 1);
    assert.equal(savedStart.node, utilities.implForWrapper(first)); assert.equal(savedStart.offset, 1);
    const clone = range.cloneRange();
    const frozen = new dom.window.StaticRange({ startContainer: middle, startOffset: 1, endContainer: last, endOffset: 2 });
    middle.insertData(0, 'X');
    assert.equal(range.startOffset, 2); assert.equal(clone.startOffset, 2); assert.equal(frozen.startOffset, 1);
    assert.equal(range.toString(), 'efgh'); assert.equal(clone.toString(), 'efgh');
    middle.splitText(2); middle.parentNode.normalize();
    assert.equal(range.startContainer, middle); assert.equal(clone.startContainer, middle); assert.equal(frozen.startContainer, middle);
    const invalidLength = new dom.window.StaticRange({ startContainer: middle, startOffset: 999, endContainer: middle, endOffset: 1 });
    assert.equal(invalidLength.startOffset, 999); assert.equal(invalidLength.collapsed, false);
    const otherText = foreign.window.document.querySelector('p').firstChild;
    const disconnected = new dom.window.StaticRange({ startContainer: first, startOffset: 0, endContainer: otherText, endOffset: 1 });
    assert.equal(disconnected.endContainer, otherText);
    assert.throws(() => new dom.window.StaticRange({ startContainer: document.doctype, startOffset: 0,
      endContainer: first, endOffset: 0 }), { name: 'InvalidNodeTypeError' });
    const selection = dom.window.getSelection();
    selection.collapse(first, 1); selection.extend(last, 2);
    const selectedText = selection.toString();
    selection.setBaseAndExtent(last, 2, first, 1);
    assert.equal(selection.toString(), selectedText);
    const selected = selection.getRangeAt(0); selected.collapse(false);
    assert.equal(selected.startContainer, last); assert.equal(selected.startOffset, 2);
    assert.equal(selection.isCollapsed, true);
    return { text: range.toString(), clone: clone.toString(), liveOffset: range.startOffset,
      staticOffset: frozen.startOffset, selectedText, selectionOffset: selected.startOffset };
  } finally { dom.window.close(); foreign.window.close(); }
}

test('should preserve independent live/static endpoints, snapshots and Selection across mutations', () => {
  assert.deepEqual(inspect(engines.rustdom, 'rustdom'), inspect(engines.jsdom, 'jsdom'));
});

test('should reject a retained native state and release live/static Range ownership through real GC', (context) => {
  const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'helpers/range-state-memory.cjs')], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
  });
  if (child.error) throw child.error;
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout);
  assert.equal(report.pass, true); assert.equal(report.cycles.length, 6);
  assert.equal(report.retainedNativeState.reached, false);
  assert.equal(report.releasedNativeState.reached, true);
  context.diagnostic(JSON.stringify({ node: report.node, nativeRanges: report.nativeRanges,
    retainedNativeAccepted: report.retainedNativeState.reached, retainedSnapshots: report.retainedSnapshots,
    cycles: report.cycles.map((cycle) => ({ cycle: cycle.cycle,
      held: cycle.retained.state.nativeTree.rangeStates.live,
      staticOnly: cycle.staticOnly.state.nativeTree.rangeStates.live,
      released: cycle.released.state.nativeTree.rangeStates.live,
      survivors: cycle.released.state.survivors })) }));
});
