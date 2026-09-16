/** @file Native Selection activation and scalar contracts through the actual addon. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeSelectionState, SelectionOperation, selectionOperation, selectionOperationResult, selectionOperationStatistics } = require('../dist/native.cjs');
const { JSDOM } = require('../dist/index.cjs');

test('should preserve native direction, association and containment decisions', () => {
  const state = new NativeSelectionState(); assert.equal(state.direction, 0);
  assert.equal(state.associate(false, true, false, true, true), true); assert.equal(state.anchorIsStart, true);
  state.orient(true); assert.equal(state.direction, -1); assert.equal(state.anchorIsStart, false);
  assert.equal(state.associate(true, true, false, true, true), false); assert.equal(state.direction, 1);
  assert.equal(NativeSelectionState.selectionType(false, true), 'None'); assert.equal(NativeSelectionState.selectionType(true, true), 'Caret');
  assert.equal(NativeSelectionState.contains(true, false, true), true); assert.equal(NativeSelectionState.contains(true, false, false), false);
  assert.equal(SelectionOperation[SelectionOperation.Anchor], undefined);
});

test('should run public Selection operations through native control while retaining shared Range identity', () => {
  const dom = new JSDOM('<p>abcdef</p>');
  try {
    const before = selectionOperationStatistics(); const selection = dom.window.getSelection(); const text = dom.window.document.querySelector('p').firstChild;
    selection.setBaseAndExtent(text, 5, text, 1); assert.equal(selection.anchorOffset, 5); assert.equal(selection.focusOffset, 1); assert.equal(String(selection), 'bcde');
    const range = selection.getRangeAt(0); range.setEnd(text, 6); assert.equal(String(selection), 'bcdef');
    selection.removeAllRanges(); assert.equal(selection.rangeCount, 0);
    const after = selectionOperationStatistics(); assert.ok(after.calls > before.calls); assert.equal(after.active, 0);
  } finally { dom.window.close(); }
});

/** @param {object} wrapper - Actual generated DOM wrapper. @returns {object} Its real implementation for the documented native adapter boundary. */
function implementation(wrapper) {
  return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
}

test('should return original Selection values directly while preserving legacy callback delivery', () => {
  const dom = new JSDOM('<p>abcdef</p>');
  try {
    const selection = dom.window.getSelection(); const owner = implementation(selection);
    const text = dom.window.document.querySelector('p').firstChild;
    assert.equal(selectionOperationResult(owner, SelectionOperation.AnchorNode, undefined, {}), null);
    selection.collapse(text, 2);
    assert.equal(selectionOperationResult(owner, SelectionOperation.RangeCount, undefined, {}), 1);
    assert.equal(selectionOperationResult(owner, SelectionOperation.AnchorOffset, undefined, {}), 2);
    assert.equal(selectionOperationResult(owner, SelectionOperation.AnchorNode, undefined, {}), implementation(text));
    const range = implementation(selection.getRangeAt(0));
    assert.equal(selectionOperationResult(owner, SelectionOperation.GetRangeAt, [0], {}), range);
    let delivered;
    const returned = selectionOperation(owner, SelectionOperation.GetRangeAt, [0], {}, (value) => { delivered = value; });
    assert.equal(delivered, range); assert.equal(returned, undefined);
    assert.equal(selectionOperationStatistics().active, 0);
  } finally { dom.window.close(); }
});

test('should preserve primitive throws and reentry in direct results and legacy receivers', () => {
  const dom = new JSDOM('<p>abcdef</p>');
  try {
    const selection = dom.window.getSelection(); const text = dom.window.document.querySelector('p').firstChild;
    selection.collapse(text, 2);
    const owner = implementation(selection); const range = implementation(selection.getRangeAt(0));
    const original = range.toString;
    try {
      for (const marker of [undefined, null, false, 42, 'failure', Symbol('failure'), { reason: 'failure' }]) {
        range.toString = () => { assert.equal(selection.anchorOffset, 2); throw marker; };
        let directCaught = false;
        try { selectionOperationResult(owner, SelectionOperation.ToString, undefined, {}); }
        catch (error) { directCaught = Object.is(error, marker); }
        assert.equal(directCaught, true);
        let receiverCaught = false;
        try { selectionOperation(owner, SelectionOperation.RangeCount, [], {}, () => { assert.equal(selection.rangeCount, 1); throw marker; }); }
        catch (error) { receiverCaught = Object.is(error, marker); }
        assert.equal(receiverCaught, true); assert.equal(selectionOperationStatistics().active, 0);
      }
    } finally { range.toString = original; }
  } finally { dom.window.close(); }
});
