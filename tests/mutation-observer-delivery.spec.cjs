/** @file Verifies complete observer/slot delivery order, errors and retained batch identities. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
/** Independent reference and private native runtime use the same public scenario. */
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

test('should release forests and records while native delivery controllers remain retained', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/mutation-delivery-memory.cjs'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 3);
});

test('should drive native batches with per-turn drains, captured slots and foreign-forest rejection', () => {
  const { NativeTree, NativeMutationRecord, NativeObserverDelivery, NativeRange, ObserverDeliveryAction } = require('../dist/native.cjs');
  const tree = new NativeTree(); const target = tree.allocate(); const slot = tree.allocate(); tree.setHtmlElement(slot, 'slot', []);
  const first = tree.allocateMutationObserver(); const second = tree.allocateMutationObserver();
  const record = new NativeMutationRecord(tree, { kind: 'childList', target, previousSibling: 0, nextSibling: 0, addedNodes: [], removedNodes: [] });
  const initialFirst = tree.enqueueMutationRecord(first, record); const initialSecond = tree.enqueueMutationRecord(second, record);
  tree.queueSlotSignal(slot); tree.requestMutationObserverMicrotask();
  const operation = tree.startMutationObserverDelivery(); assert.ok(operation instanceof NativeObserverDelivery);
  assert.equal(tree.observerNotificationStatistics().microtaskQueued, false); assert.equal(tree.slotSignalStatistics().pendingSlots, 0);
  assert.deepEqual(tree.mutationObserverDeliveryStep(operation), { kind: ObserverDeliveryAction.Observer, observer: first, slot: 0, records: [initialFirst], complete: false });
  const additional = tree.enqueueMutationRecord(second, record);
  assert.deepEqual(tree.mutationObserverDeliveryStep(operation), { kind: ObserverDeliveryAction.Observer, observer: second, slot: 0, records: [initialSecond, additional], complete: false });
  assert.deepEqual(tree.mutationObserverDeliveryStep(operation), { kind: ObserverDeliveryAction.Slot, observer: 0, slot, records: [], complete: true });
  assert.equal(operation.complete, true); assert.equal(operation.remainingObservers, 0); assert.equal(operation.remainingSlots, 0);
  assert.equal(tree.mutationObserverDeliveryStep(operation).kind, ObserverDeliveryAction.Complete);
  tree.enqueueMutationRecord(first, record); const pending = tree.startMutationObserverDelivery(); const foreign = new NativeTree();
  const before = tree.observerRegistryStatistics();
  assert.throws(() => foreign.mutationObserverDeliveryStep(pending), { code: 'InvalidArg' });
  assert.equal(pending.remainingObservers, 0); assert.deepEqual(tree.observerRegistryStatistics(), before);
  for (const invalid of [{}, tree, record, new NativeRange(), Object.create(NativeObserverDelivery.prototype)]) {
    assert.throws(() => tree.mutationObserverDeliveryStep(invalid), { code: 'InvalidArg' });
  }
  assert.equal(tree.mutationObserverDeliveryStep(new NativeObserverDelivery()).kind, ObserverDeliveryAction.Complete);
  tree.releaseMutationObserver(first); tree.releaseMutationObserver(second); tree.release(target); tree.release(slot);
});

for (const [name, runtime] of Object.entries(runtimes)) {
  test(`should preserve partial delivery when the real error reporter throws in ${name}`, () => {
    const child = spawnSync(process.execPath, ['tests/helpers/mutation-delivery-abort.cjs', name], {
      encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
    });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
    assert.equal(JSON.parse(child.stdout).pass, true);
  });
  test(`should continue after observer errors and deliver captured detached slots after observers in ${name}`, async () => {
    const trace = []; const virtualConsole = new runtime.VirtualConsole();
    virtualConsole.on('jsdomError', () => { trace.push('error'); });
    const dom = new runtime.JSDOM('<main></main>', { virtualConsole }); const host = dom.window.document.querySelector('main');
    const root = host.attachShadow({ mode: 'closed' }); root.innerHTML = '<slot>fallback</slot>'; const slot = root.firstChild;
    slot.addEventListener('slotchange', () => { trace.push('slot'); });
    let changed = false;
    const first = new dom.window.MutationObserver(() => {
      trace.push(changed ? 'first-again' : 'first');
      if (!changed) { changed = true; slot.remove(); host.setAttribute('flag', 'two'); throw new Error('delivery failure'); }
    });
    const second = new dom.window.MutationObserver((records) => { trace.push(`second-${records.length}`); });
    try {
      first.observe(host, { attributes: true }); second.observe(host, { attributes: true });
      await new Promise((resolve) => setImmediate(resolve)); trace.length = 0;
      slot.append('more'); host.setAttribute('flag', 'one');
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(trace, ['first', 'error', 'second-2', 'slot', 'first-again']);
      assert.equal(slot.parentNode, null); assert.equal(first.takeRecords().length, 0); assert.equal(second.takeRecords().length, 0);
    } finally { first.disconnect(); second.disconnect(); dom.window.close(); }
  });
}
