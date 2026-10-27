/** @file Public and actual-addon regressions for the integrated native-collapse implementation. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { NativeRange, NativeTree } = require('../dist/native.cjs');
const settings = require('./helpers/constants/range-native-collapse.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

test('native collapse rejects partial states atomically and preserves the native receiver contract', () => {
  for (const initialized of ['none', 'start', 'end']) {
    const range = new NativeRange();
    if (initialized === 'start') range.setStart(1, 2);
    if (initialized === 'end') range.setEnd(2, 3);
    const before = { start: range.start, end: range.end };
    for (const toStart of [true, false]) {
      assert.throws(() => range.collapse(toStart), { code: 'InvalidArg' });
      assert.deepEqual({ start: range.start, end: range.end }, before);
    }
  }
  const tree = new NativeTree();
  assert.throws(() => NativeRange.prototype.collapse.call(tree, true), TypeError);
  assert.throws(() => NativeRange.prototype.collapse.call({}, true), TypeError);
});

test('native collapse preserves copied numeric payloads including negative zero and non-finite offsets', () => {
  for (const offset of [-0, -1.5, 2 ** 32 + 1, Infinity, NaN]) {
    const original = new NativeRange(); original.setStart(1, offset); original.setEnd(2, 7.5);
    const snapshot = original.start;
    for (const toStart of [true, false]) {
      const copy = original.copy(); const retained = toStart ? original.start : original.end;
      assert.equal(copy.collapse(toStart), !toStart);
      assert.equal(copy.start.node, retained.node); assert.equal(copy.end.node, retained.node);
      assert.ok(Object.is(copy.startOffset, retained.offset)); assert.ok(Object.is(copy.endOffset, retained.offset));
      assert.equal(copy.collapsed, !Number.isNaN(retained.offset));
      assert.equal(original.start.node, 1); assert.equal(original.end.node, 2);
      assert.ok(Object.is(snapshot.offset, offset));
    }
  }
});

/**
 * Observe complete public calls against independent jsdom, preserving cross-realm identity.
 * @param {object} engine - Real independently loaded runtime.
 * @returns {object[]} Scalar observations through collapse, clone, mutation and Selection.
 */
function observe(engine) {
  const owner = new engine.JSDOM('', { runScripts: 'outside-only' });
  const other = new engine.JSDOM('<main>abcdef<span>ghijkl</span></main>', { runScripts: 'outside-only' });
  try {
    const document = other.window.document; const main = document.querySelector('main');
    const first = main.firstChild; const second = main.querySelector('span').firstChild;
    const values = [undefined, false, true, 0, 1, null, '', 'false', {}, Symbol('truthy'),
      { valueOf() { throw new Error('Boolean conversion must not invoke valueOf'); } }];
    const records = [];
    for (const sameOwner of [true, false]) for (const input of values) {
      const range = owner.window.document.createRange();
      range.setStart(first, 1); range.setEnd(sameOwner ? first : second, 4);
      const clone = range.cloneRange();
      owner.window.Range.prototype.collapse.call(range, input);
      const target = input ? first : (sameOwner ? first : second);
      assert.equal(range.startContainer, target); assert.equal(range.endContainer, target);
      assert.equal(clone.startContainer, first); assert.equal(clone.endContainer, sameOwner ? first : second);
      assert.equal(clone.startOffset, 1); assert.equal(clone.endOffset, 4);
      first.insertData(0, '!'); second.insertData(0, '?');
      records.push({ sameOwner, start: range.startOffset, end: range.endOffset, collapsed: range.collapsed,
        cloneStart: clone.startOffset, cloneEnd: clone.endOffset, contents: clone.toString() });
      first.deleteData(0, 1); second.deleteData(0, 1);
    }
    const range = document.createRange(); range.setStart(first, 1); range.setEnd(second, 4);
    const selection = other.window.getSelection(); selection.addRange(range);
    range.collapse(true); assert.equal(selection.isCollapsed, true);
    assert.equal(selection.anchorNode, first); assert.equal(selection.focusNode, first);
    first.splitText(1); main.normalize();
    records.push({ selected: selection.toString(), collapsed: range.collapsed,
      start: range.startOffset, end: range.endOffset, contents: main.textContent });
    return records;
  } finally { owner.window.close(); other.window.close(); }
}

test('same-owner fast path and distinct-owner route match independent jsdom across realms and live mutations', () => {
  assert.deepEqual(observe(engines.rustdom), observe(engines.jsdom));
});

test('repeated same-node collapse preserves wrapper/state identity, native counts and copied snapshots', () => {
  const owner = new engines.rustdom.JSDOM('<main>abcdefgh</main>');
  try {
    const text = owner.window.document.querySelector('main').firstChild;
    const range = owner.window.document.createRange(); range.setStart(text, 1); range.setEnd(text, 6);
    const { implForWrapper } = require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils');
    const state = implForWrapper(range)._nativeRange; const snapshot = state.end;
    const baseline = NativeRange.statistics();
    for (const toStart of [true, false, true, false]) {
      range.setStart(text, 1); range.setEnd(text, 6); range.collapse(toStart);
      assert.equal(implForWrapper(range)._nativeRange, state);
      assert.equal(range.startOffset, toStart ? 1 : 6);
      assert.equal(range.endOffset, range.startOffset);
    }
    assert.deepEqual(state.end, { node: snapshot.node, offset: 6 });
    assert.deepEqual(snapshot, { node: snapshot.node, offset: 6 });
    assert.deepEqual(NativeRange.statistics(), baseline);
  } finally { owner.window.close(); }
});

test('same-owner collapse releases Window, Document, ranges and native state in repeated real-GC cycles', () => {
  const result = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'helpers/range-native-collapse-memory.cjs')],
    { encoding: 'utf8', timeout: settings.subprocessTimeoutMs, maxBuffer: settings.maximumOutputBytes });
  if (process.env.RUSTDOM_RANGE_MEMORY_OUTPUT) fs.writeFileSync(process.env.RUSTDOM_RANGE_MEMORY_OUTPUT, result.stdout, { flag: 'wx' });
  assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.pass, true); assert.equal(report.cycles.length, settings.cycles);
  assert.ok(report.baseline.napiClasses.live > 0);
  for (const cycle of report.cycles) {
    assert.equal(cycle.retained.reached, false); assert.equal(cycle.released.reached, true);
    assert.deepEqual(cycle.released.state.survivors, { window: 0, document: 0, ranges: 0, native: 0 });
    assert.equal(cycle.released.state.nativeTree.napiClasses.live, report.baseline.napiClasses.live);
    assert.equal(cycle.released.state.nativeTree.rangeStates.live, report.baseline.rangeStates.live);
  }
});
