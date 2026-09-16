/** @file Exercises actual Selection native scopes, exceptions and cleanup under GC and Memcheck. */
'use strict';
const assert = require('node:assert/strict');
const addon = require('../../dist/native.cjs');
const mode = process.argv[2] ?? 'native'; const cycles = Number(process.argv[3] ?? 1000);
assert.ok(mode === 'control' || mode === 'native'); assert.ok(Number.isSafeInteger(cycles) && cycles > 0);
const runtime = mode === 'native' ? require('../../dist/index.cjs') : require('jsdom');

/** @returns {object} Strong owners released before final weak observation. */
function fixture() {
  const { window } = new runtime.JSDOM('<p>abcdef</p>'); const document = window.document;
  const selection = window.getSelection(); const text = document.querySelector('p').firstChild;
  return { window, selection, text, observed: { windows: new WeakRef(window), documents: new WeakRef(document), selections: new WeakRef(selection) } };
}

/** @param {object} sample - Actual realm. @param {WeakRef[]} ranges - Non-owning observations. @returns {void} Exercise state replacement, live mutation and primitive throws through real Range methods. */
function exercise(sample, ranges) {
  const { selection, text } = sample;
  selection.setBaseAndExtent(text, 5, text, 1); const wrapper = selection.getRangeAt(0); ranges.push(new WeakRef(wrapper));
  wrapper.setEnd(text, 6); assert.equal(String(selection), 'bcdef');
  const range = wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
  const original = range.toString;
  try {
    range.toString = () => { assert.equal(selection.anchorOffset, 6); throw null; };
    let caught = false; try { String(selection); } catch (error) { caught = error === null; } assert.equal(caught, true);
  } finally { range.toString = original; }
  selection.collapseToStart(); selection.extend(text, 4); selection.removeAllRanges();
}

/** @returns {Promise<void>} Release all realms and inspect native counters after separate GC turns. */
async function main() {
  const before = addon.NativeSelectionState.statistics(); const sample = fixture(); const ranges = [];
  for (let cycle = 0; cycle < cycles; cycle++) {
    exercise(sample, ranges);
    if (cycle % 25 === 0) { global.gc(); await new Promise((resolve) => setTimeout(resolve, 0)); }
  }
  sample.window.close(); sample.window = null; sample.selection = null; sample.text = null;
  for (let turn = 0; turn < 8; turn++) { global.gc(); await new Promise((resolve) => setTimeout(resolve, 0)); }
  const survivors = Object.fromEntries(Object.entries(sample.observed).map(([name, reference]) => [name, Number(Boolean(reference.deref()))]));
  survivors.ranges = ranges.filter((reference) => reference.deref()).length;
  assert.deepEqual(survivors, { windows: 0, documents: 0, selections: 0, ranges: 0 });
  const after = addon.NativeSelectionState.statistics(); assert.equal(after.live, before.live);
  assert.equal(addon.selectionOperationStatistics().active, 0); assert.equal(addon.classReferenceStatistics().cleanupErrors, 0);
  process.stdout.write(`${JSON.stringify({ pass: true, mode, cycles, survivors, before, after, operations: addon.selectionOperationStatistics(), classes: addon.classReferenceStatistics() })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
