/** @file Exercises native extraction effects, source mutation, identities and controller cleanup. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

test('should preserve deep partial extraction, contained identity and the final live Range', () => {
  for (const engine of Object.values(engines)) {
    const dom = new engine.JSDOM('<main></main>');
    try {
      const document = dom.window.document; const root = document.querySelector('main'); let cursor = root;
      const depth = 160;
      for (let index = 0; index < depth; index++) cursor = cursor.appendChild(document.createElement('section'));
      const start = cursor.appendChild(document.createTextNode('left'));
      const middle = root.appendChild(document.createElement('aside')); middle.textContent = 'middle';
      const end = root.appendChild(document.createTextNode('right'));
      const range = document.createRange(); range.setStart(start, 1); range.setEnd(end, 1);
      const fragment = range.extractContents();
      assert.equal(fragment.textContent, 'eftmiddler'); assert.equal(root.textContent, 'light');
      assert.equal(fragment.childNodes[1], middle); assert.equal(middle.parentNode, fragment);
      assert.equal(start.data, 'l'); assert.equal(end.data, 'ight');
      assert.equal(range.startContainer, root); assert.equal(range.endContainer, root);
      assert.equal(range.startOffset, 1); assert.equal(range.endOffset, 1); assert.equal(range.collapsed, true);
      cursor = fragment.firstChild;
      for (let index = 0; index < depth; index++) { assert.equal(cursor.localName, 'section'); cursor = cursor.firstChild; }
      assert.equal(cursor.data, 'eft'); cursor.data = 'independent'; assert.equal(start.data, 'l');
    } finally { dom.window.close(); }
  }
});

test('should drive real native node moves and return the captured collapse point', () => {
  const { NativeTree, NativeRange, NativeRangeExtract, RangeExtractAction } = require('../dist/native.cjs');
  const tree = new NativeTree(); const root = tree.allocate(); tree.setHtmlElement(root, 'main', []);
  const first = tree.allocate(); tree.setHtmlElement(first, 'b', []);
  const last = tree.allocate(); tree.setCharacterData(last, 3, 'last'); tree.append(root, first); tree.append(root, last);
  const state = new NativeRange(); state.setStart(root, 0); state.setEnd(root, 2);
  const operation = new NativeRangeExtract(state);
  assert.equal(tree.rangeExtractStep(operation, 0).kind, RangeExtractAction.CreateFragment);
  const reserved = tree.reserveHandles(); const before = tree.statistics();
  assert.throws(() => tree.rangeExtractStep(operation, reserved), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), before);
  const fragment = tree.allocate(); tree.setSimpleData(fragment, 11, '');
  const pins = tree.rangeExtractStep(operation, fragment);
  assert.equal(pins.kind, RangeExtractAction.PinNodes); assert.ok(pins.nodes.includes(first)); assert.ok(pins.nodes.includes(last));
  for (const original of [first, last]) {
    const instruction = tree.rangeExtractStep(operation, 0);
    assert.equal(instruction.kind, RangeExtractAction.AppendChild); assert.equal(instruction.node, original);
    tree.remove(original); tree.append(instruction.parent, original);
  }
  const finished = tree.rangeExtractStep(operation, 0);
  assert.equal(finished.kind, RangeExtractAction.Complete); assert.equal(finished.node, fragment);
  assert.equal(finished.parent, root); assert.equal(finished.offset, 0); assert.equal(operation.complete, true);
  assert.equal(tree.textContent(root), ''); assert.equal(tree.textContent(fragment), 'last');
  assert.equal(state.endOffset, 2, 'The numeric controller leaves host Range updates to the completed instruction');
  state.setStart(finished.parent, finished.offset); state.setEnd(finished.parent, finished.offset); assert.equal(state.collapsed, true);
  operation.cancel(); assert.throws(() => tree.rangeExtractStep(operation, 0), { code: 'InvalidArg' });
  for (const node of [first, last, fragment, root]) tree.release(node); assert.equal(tree.statistics().liveNodes, 0);
});

test('should reject incorrect controller classes and incomplete state before native extraction', () => {
  const { NativeTree, NativeRange, NativeRangeClone, NativeRangeExtract } = require('../dist/native.cjs');
  const tree = new NativeTree(); const state = new NativeRange(); const before = NativeRangeExtract.statistics();
  assert.throws(() => new NativeRangeExtract(state), { code: 'InvalidArg' });
  assert.throws(() => new NativeRangeExtract(tree), { code: 'InvalidArg' });
  assert.deepEqual(NativeRangeExtract.statistics(), before);
  state.setStart(1, 0); state.setEnd(1, 0); const clone = new NativeRangeClone(state);
  assert.throws(() => tree.rangeExtractStep(clone, 0), { code: 'InvalidArg' });
  assert.throws(() => tree.rangeExtractStep(Object.create(NativeRangeExtract.prototype), 0), { code: 'InvalidArg' });
  const extract = new NativeRangeExtract(state);
  assert.throws(() => tree.rangeCloneStep(extract, 0), { code: 'InvalidArg' });
  extract.cancel(); clone.cancel();
});

test('should collect extraction controllers and DOM results after success and failure', (context) => {
  const child = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'helpers/range-content-memory.cjs'), 'extract'], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
  });
  if (child.error) throw child.error;
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.mode, 'extract');
  assert.equal(report.held.reached, false); assert.equal(report.released.reached, true);
  assert.equal(report.final.rangeExtracts.live, report.baseline.rangeExtracts.live);
  context.diagnostic(JSON.stringify({ node: report.node, rangeExtracts: report.final.rangeExtracts,
    heldSurvivors: report.held.state.survivors, survivors: report.cycles.map((cycle) => cycle.state.survivors) }));
});
