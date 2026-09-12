/** @file Exercises the native clone controller's effect protocol and the real public DOM driver. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

test('should preserve deeply nested partial clones and source identities with both real engines', () => {
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('<main></main>');
    try {
      const document = dom.window.document; const root = document.querySelector('main'); let cursor = root;
      const depth = 180;
      for (let index = 0; index < depth; index++) cursor = cursor.appendChild(document.createElement('section'));
      const start = cursor.appendChild(document.createTextNode('left'));
      const end = root.appendChild(document.createTextNode('right'));
      const range = document.createRange(); range.setStart(start, 1); range.setEnd(end, 1);
      const cloned = range.cloneContents();
      assert.equal(cloned.textContent, 'eftr'); assert.equal(root.textContent, 'leftright');
      assert.equal(range.startContainer, start); assert.equal(range.endContainer, end);
      cursor = cloned.firstChild;
      for (let index = 0; index < depth; index++) { assert.equal(cursor.localName, 'section'); cursor = cursor.firstChild; }
      assert.equal(cursor.data, 'eft'); assert.equal(cloned.lastChild.data, 'r');
      cursor.data = 'independent'; assert.equal(start.data, 'left');
    } finally { dom.window.close(); }
  }
});

test('should deliver a real native partial-text clone and reject invalid protocol inputs without mutating the source', () => {
  const { NativeTree, NativeRange, NativeRangeClone, RangeCloneAction } = require('../dist/native.cjs');
  const tree = new NativeTree(); const source = tree.allocate(); tree.setCharacterData(source, 3, 'abcd');
  const state = new NativeRange(); state.setStart(source, 1); state.setEnd(source, 3);
  const operation = new NativeRangeClone(state);
  let instruction = tree.rangeCloneStep(operation, 0);
  assert.equal(instruction.kind, RangeCloneAction.CreateFragment); assert.equal(instruction.node, source);
  const reserved = tree.reserveHandles(); const baseline = tree.statistics();
  assert.throws(() => tree.rangeCloneStep(operation, reserved), { code: 'InvalidArg' });
  assert.throws(() => tree.rangeCloneStep(operation, 0), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), baseline);
  const fragment = tree.allocate(); tree.setSimpleData(fragment, 11, '');
  instruction = tree.rangeCloneStep(operation, fragment);
  assert.equal(instruction.kind, RangeCloneAction.CloneNode); assert.equal(instruction.node, source); assert.equal(instruction.deep, false);
  const copied = tree.allocate(); tree.setCharacterData(copied, 3, tree.getCharacterData(source));
  instruction = tree.rangeCloneStep(operation, copied);
  assert.equal(instruction.kind, RangeCloneAction.SliceData); assert.equal(instruction.offset, 1); assert.equal(instruction.count, 2);
  tree.setCharacterData(copied, 3, tree.substringData(copied, instruction.offset, instruction.count));
  instruction = tree.rangeCloneStep(operation, 0);
  assert.equal(instruction.kind, RangeCloneAction.AppendChild); assert.equal(instruction.parent, fragment); assert.equal(instruction.node, copied);
  tree.append(instruction.parent, instruction.node);
  instruction = tree.rangeCloneStep(operation, 0);
  assert.equal(instruction.kind, RangeCloneAction.Complete); assert.equal(instruction.node, fragment); assert.equal(operation.complete, true);
  assert.equal(tree.textContent(fragment), 'bc'); assert.equal(tree.getCharacterData(source), 'abcd');
  assert.deepEqual(state.start, { node: source, offset: 1 }); assert.deepEqual(state.end, { node: source, offset: 3 });
  assert.throws(() => tree.rangeCloneStep(operation, copied), { code: 'InvalidArg' });
  for (const node of [copied, fragment, source]) tree.release(node);
  assert.equal(tree.statistics().liveNodes, 0); assert.equal(tree.rangeCloneStep(operation, 0).node, fragment);
  operation.cancel(); operation.cancel(); assert.throws(() => tree.rangeCloneStep(operation, 0), { code: 'InvalidArg' });
});

test('should reject foreign native classes and incomplete state before creating a clone controller', () => {
  const { NativeTree, NativeRange, NativeRangeClone } = require('../dist/native.cjs');
  const tree = new NativeTree(); const state = new NativeRange();
  const before = NativeRangeClone.statistics();
  assert.throws(() => new NativeRangeClone(state), { code: 'InvalidArg' });
  assert.throws(() => new NativeRangeClone(tree), { code: 'InvalidArg' });
  assert.throws(() => new NativeRangeClone({}), { code: 'InvalidArg' });
  assert.deepEqual(NativeRangeClone.statistics(), before);
  assert.throws(() => tree.rangeCloneStep(state, 0), { code: 'InvalidArg' });
  assert.throws(() => tree.rangeCloneStep(Object.create(NativeRangeClone.prototype), 0), { code: 'InvalidArg' });
});

test('should release clone controllers and DOM roots after successful and rejected operations', (context) => {
  const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'helpers/range-clone-memory.cjs')], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
  });
  if (child.error) throw child.error;
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true);
  assert.equal(report.held.reached, false); assert.equal(report.released.reached, true);
  assert.equal(report.cycles.length, 5); assert.equal(report.final.rangeClones.live, report.baseline.rangeClones.live);
  context.diagnostic(JSON.stringify({ node: report.node, rangeClones: report.final.rangeClones,
    heldSurvivors: report.held.state.survivors, survivors: report.cycles.map((cycle) => cycle.state.survivors) }));
});
