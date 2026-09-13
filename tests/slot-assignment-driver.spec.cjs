/** @file Exercises native assignment steps and the real bridge's signal/error boundary. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const runtime = require('../dist/index.cjs');
const { NativeTree, NativeRange, NativeSlotAssignmentDriver, SlotAssignmentAction } = require('../dist/native.cjs');
const { domSymbolTree } = require('../dist/vendor-jsdom/lib/jsdom/living/helpers/internal-constants.js');
const { implForWrapper } = require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils.js');

test('should expose signal, applied and complete steps while preserving captured candidates and atomic failures', () => {
  const tree = new NativeTree(); const host = tree.allocate(); tree.setHtmlElement(host, 'div', []);
  const root = tree.allocate(); tree.setData(root, '{"kind":11}'); tree.setRootHost(root, host, true);
  const slot = tree.allocate(); tree.setHtmlElement(slot, 'slot', []); tree.append(root, slot);
  const child = tree.allocate(); tree.setCharacterData(child, 3, 'child'); tree.append(host, child);
  const operation = new NativeSlotAssignmentDriver(root, true);
  const signal = tree.slotAssignmentStep(operation);
  assert.equal(signal.kind, SlotAssignmentAction.Signal); assert.deepEqual(signal.nodes, [child]);
  assert.deepEqual(tree.cachedSlotables(slot), []); assert.equal(tree.slotBacklink(child), 0);
  tree.setSlotableName(child, 'changed'); tree.queueSlotSignal(slot);
  const applied = tree.slotAssignmentStep(operation);
  assert.equal(applied.kind, SlotAssignmentAction.Applied); assert.equal(applied.cacheChanged, true);
  assert.deepEqual(tree.cachedSlotables(slot), [child]); assert.equal(tree.slotBacklink(child), slot);
  assert.equal(tree.slotAssignmentStep(operation).kind, SlotAssignmentAction.Complete); assert.equal(operation.complete, true);
  const cancelled = new NativeSlotAssignmentDriver(slot, false); assert.equal(tree.slotAssignmentStep(cancelled).kind, SlotAssignmentAction.Signal);
  cancelled.cancel(); assert.throws(() => tree.slotAssignmentStep(cancelled), { code: 'InvalidArg' });
  assert.deepEqual(tree.cachedSlotables(slot), [child]);
  const reserved = tree.reserveHandles(); const before = tree.statistics();
  for (const invalid of [0, -1, 0.5, NaN, Infinity]) assert.throws(() => new NativeSlotAssignmentDriver(invalid, true), { code: 'InvalidArg' });
  const unknown = new NativeSlotAssignmentDriver(reserved, true);
  assert.throws(() => tree.slotAssignmentStep(unknown), { code: 'InvalidArg' });
  assert.throws(() => tree.slotAssignmentStep(unknown), { code: 'InvalidArg', message: /cancelled or failed/ });
  for (const foreign of [{}, new NativeTree(), new NativeRange()]) {
    assert.throws(() => tree.slotAssignmentStep(foreign), { code: 'InvalidArg' });
    assert.throws(() => NativeSlotAssignmentDriver.prototype.cancel.call(foreign), { name: 'TypeError', message: 'Illegal invocation' });
  }
  assert.deepEqual(tree.statistics(), before);
  for (const node of [child, slot, root, host, reserved]) tree.release(node);
  assert.equal(tree.statistics().liveNodes, 0);
  assert.equal(tree.slotAssignmentStep(operation).kind, SlotAssignmentAction.Complete);
});

test('should preserve the own bridge signal boundary without mocking Promise or platform delivery', () => {
  const dom = new runtime.JSDOM('<main></main>');
  try {
    const document = dom.window.document; const host = document.querySelector('main');
    const root = host.attachShadow({ mode: 'open' }); root.innerHTML = '<slot name="a"></slot><slot name="b"></slot>';
    const [first, second] = root.children; const child = document.createElement('b'); child.slot = 'a'; host.append(child);
    const firstImpl = implForWrapper(first); const secondImpl = implForWrapper(second); const childImpl = implForWrapper(child);
    // Use the project's existing low-level cache boundary to arrange a pending assignment.
    domSymbolTree.commitSlotAssignment(firstImpl, []);
    const failure = new Error('assignment signal failure');
    assert.throws(() => domSymbolTree.runSlotAssignments(implForWrapper(root), true, (slot) => {
      assert.equal(slot, firstImpl); assert.deepEqual(first.assignedNodes(), []); throw failure;
    }), (error) => error === failure);
    assert.deepEqual(first.assignedNodes(), []);
    const signals = [];
    domSymbolTree.runSlotAssignments(implForWrapper(root), true, (slot) => {
      signals.push(slot === firstImpl ? 'first' : 'second');
      if (slot === firstImpl) {
        child.slot = 'b';
        assert.deepEqual(first.assignedNodes(), []);
        assert.deepEqual(second.assignedNodes(), [child]);
      }
    });
    assert.deepEqual(signals, ['first']);
    assert.deepEqual(first.assignedNodes(), [child]); assert.deepEqual(second.assignedNodes(), [child]);
    // The next unchanged slot repairs the backlink written by the outer captured commit.
    assert.equal(domSymbolTree.slotBacklink(childImpl), secondImpl);
    assert.equal(child.assignedSlot, second);
  } finally { dom.window.close(); }
});

test('should finish many unchanged real slots without changing notification counts or references', async () => {
  const dom = new runtime.JSDOM('<main></main>');
  try {
    const document = dom.window.document; const host = document.querySelector('main'); const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<slot></slot>'.repeat(300); const slots = [...root.children]; let calls = 0;
    await new Promise((resolve) => setImmediate(resolve));
    domSymbolTree.runSlotAssignments(implForWrapper(root), true, () => { calls++; });
    assert.equal(calls, 0); assert.deepEqual([...root.children], slots);
    assert.ok(slots.every((slot) => slot.assignedNodes().length === 0));
    assert.equal(runtime.getNativeTreeStatistics().slotSignals.pendingSlots, 0);
  } finally { dom.window.close(); }
});

test('should release trees and pending buffers even while raw driver objects remain retained', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/slot-assignment-driver-memory.cjs'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});
