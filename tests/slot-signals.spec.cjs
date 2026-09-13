/** @file Verifies slot signal ordering across windows, callback errors and reentrant mutations. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
/** Both engines exercise real MutationObserver and EventTarget delivery. */
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {object} runtime - Actual DOM implementation. @returns {Promise<object[]>} Captures delivery without retaining DOM objects in the trace. */
async function deliveryTrace(runtime) {
  const windows = [new runtime.JSDOM('<main></main>'), new runtime.JSDOM('<main></main>')];
  const observers = []; const trace = []; const identities = new Map();
  try {
    const fixtures = windows.map((dom, index) => {
      const document = dom.window.document; const host = document.querySelector('main');
      const root = host.attachShadow({ mode: index ? 'closed' : 'open' });
      root.innerHTML = '<slot name="a"></slot><slot name="b"></slot>';
      const slots = [...root.children]; const targets = ['a', 'b'].map((name) => {
        const target = document.createElement('b'); target.slot = name; identities.set(target, `${index}${name}`); return target;
      });
      for (const [position, slot] of slots.entries()) identities.set(slot, `${index}${position ? 'b' : 'a'}`);
      return { host, slots, targets };
    });
    await new Promise((resolve) => setImmediate(resolve));
    const observerFailure = new Error('observer fixture failure'); const listenerFailure = new Error('listener fixture failure');
    let mutateObserver = true; let mutateListener = true;
    for (const [index, dom] of windows.entries()) {
      dom.window.addEventListener('error', (event) => {
        assert.ok(event.error === observerFailure || event.error === listenerFailure);
        trace.push({ error: index, kind: event.error === observerFailure ? 'observer' : 'listener' }); event.preventDefault();
      });
      const observer = new dom.window.MutationObserver((records) => {
        trace.push({ observer: index, records: records.map((record) => ({ type: record.type,
          attribute: record.attributeName, added: record.addedNodes.length, removed: record.removedNodes.length })) });
        if (index === 0 && mutateObserver) {
          mutateObserver = false; fixtures[0].targets[0].slot = 'b'; throw observerFailure;
        }
      });
      observer.observe(fixtures[index].host, { childList: true, attributes: true, subtree: true }); observers.push(observer);
      for (const slot of fixtures[index].slots) {
        slot.addEventListener('slotchange', (event) => {
          trace.push({ slot: identities.get(slot), assignments: slot.assignedNodes().map((node) => identities.get(node)),
            trusted: event.isTrusted, bubbles: event.bubbles, composed: event.composed });
          if (slot === fixtures[1].slots[1] && mutateListener) {
            mutateListener = false; fixtures[1].targets[1].slot = 'a'; throw listenerFailure;
          }
        });
        slot.addEventListener('slotchange', () => trace.push({ afterListener: identities.get(slot) }));
      }
    }
    // Signal order differs from observer creation order, and repeated mutations deduplicate slots.
    fixtures[1].host.append(fixtures[1].targets[1]);
    fixtures[0].host.append(fixtures[0].targets[0]);
    fixtures[1].host.append(fixtures[1].targets[0]);
    fixtures[0].host.append(fixtures[0].targets[1]);
    fixtures[0].targets[0].remove(); fixtures[0].host.append(fixtures[0].targets[0]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(fixtures[0].slots[0].assignedNodes(), []);
    assert.deepEqual(fixtures[1].slots[1].assignedNodes(), []);
    return trace;
  } finally { for (const observer of observers) observer.disconnect(); for (const dom of windows) dom.window.close(); }
}

test('should preserve first-signal order and subsequent batches when observers or listeners throw and requeue', async () => {
  const reference = await deliveryTrace(runtimes.jsdom);
  const delivered = reference.filter((entry) => entry.slot).map((entry) => entry.slot);
  assert.deepEqual(delivered, ['1b', '0a', '1a', '0b', '0a', '0b', '1b', '1a']);
  assert.deepEqual(reference.filter((entry) => entry.error !== undefined).map((entry) => entry.kind), ['observer', 'listener']);
  assert.deepEqual(reference.filter((entry) => entry.afterListener).map((entry) => entry.afterListener), delivered);
  assert.deepEqual(await deliveryTrace(runtimes.rustdom), reference);
});

/** @param {object} runtime - Actual DOM engine. @returns {Promise<string[]>} Captures queued delivery after window teardown starts. */
async function closedWindowTrace(runtime) {
  const dom = new runtime.JSDOM('<main></main>'); const trace = [];
  const document = dom.window.document; const host = document.querySelector('main');
  const root = host.attachShadow({ mode: 'open' }); root.innerHTML = '<slot></slot>';
  const slot = root.firstChild;
  await new Promise((resolve) => setImmediate(resolve));
  slot.addEventListener('slotchange', () => trace.push('slot'));
  host.append(document.createElement('b')); host.firstChild.remove(); host.append('text');
  dom.window.close(); trace.push('closed');
  await new Promise((resolve) => setImmediate(resolve));
  return trace;
}

test('should preserve a pending slot notification after closing its window', async () => {
  const reference = await closedWindowTrace(runtimes.jsdom);
  assert.deepEqual(reference, ['closed', 'slot']);
  assert.deepEqual(await closedWindowTrace(runtimes.rustdom), reference);
});

test('should expose native ordered batches without accepting invalid slots or retaining released handles', () => {
  const { NativeTree } = require('../dist/native.cjs'); const tree = new NativeTree();
  const first = tree.allocate(); tree.setHtmlElement(first, 'slot', []);
  const second = tree.allocate(); tree.setHtmlElement(second, 'slot', []);
  const nonSlot = tree.allocate(); tree.setHtmlElement(nonSlot, 'div', []);
  const foreign = tree.allocate(); tree.setData(foreign, '{"kind":1,"name":"slot","namespace":"urn:foreign"}');
  const reserved = tree.reserveHandles();
  assert.equal(tree.queueSlotSignal(first), true); assert.equal(tree.queueSlotSignal(second), true);
  assert.equal(tree.queueSlotSignal(first), false);
  const before = tree.statistics(); const pending = tree.slotSignalStatistics();
  for (const invalid of [0, -1, 0.5, NaN, Infinity, nonSlot, foreign, reserved]) {
    assert.throws(() => tree.queueSlotSignal(invalid), { code: 'InvalidArg' });
  }
  assert.throws(() => tree.setHtmlElementMetadata(first, 'div'), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), before); assert.deepEqual(tree.slotSignalStatistics(), pending);
  const batch = tree.takeSlotSignals(); assert.deepEqual(batch, [first, second]);
  assert.deepEqual(tree.slotSignalStatistics(), { pendingSlots: 0, queueEntries: 0, queueCapacity: 0, membershipCapacity: 0 });
  assert.equal(tree.queueSlotSignal(second), true); assert.equal(tree.queueSlotSignal(first), true);
  tree.release(second); assert.deepEqual(tree.takeSlotSignals(), [first]); assert.deepEqual(batch, [first, second]);
  tree.queueSlotSignal(first); tree.release(first); assert.deepEqual(tree.takeSlotSignals(), []);
  for (const node of [nonSlot, foreign, reserved]) tree.release(node);
  assert.equal(tree.statistics().liveNodes, 0);
  assert.equal(tree.slotSignalStatistics().membershipCapacity, 0);
});

test('should drain native state before observers and preserve signals queued during their callbacks', async () => {
  const runtime = runtimes.rustdom; const dom = new runtime.JSDOM('<main></main>'); let observer;
  try {
    const document = dom.window.document; const host = document.querySelector('main');
    const root = host.attachShadow({ mode: 'open' }); root.innerHTML = '<slot name="a"></slot><slot name="b"></slot>';
    const target = document.createElement('b'); target.slot = 'a'; const trace = [];
    await new Promise((resolve) => setImmediate(resolve));
    observer = new dom.window.MutationObserver(() => {
      trace.push(['observer', runtime.getNativeTreeStatistics().slotSignals.pendingSlots]);
      target.slot = 'b'; trace.push(['requeued', runtime.getNativeTreeStatistics().slotSignals.pendingSlots]);
    });
    observer.observe(host, { childList: true });
    for (const slot of root.children) slot.addEventListener('slotchange', () =>
      trace.push([slot.name, runtime.getNativeTreeStatistics().slotSignals.pendingSlots]));
    host.append(target); target.remove(); host.append(target);
    assert.equal(runtime.getNativeTreeStatistics().slotSignals.pendingSlots, 1);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(trace, [['observer', 0], ['requeued', 2], ['a', 2], ['a', 0], ['b', 0]]);
    assert.deepEqual(runtime.getNativeTreeStatistics().slotSignals,
      { pendingSlots: 0, queueEntries: 0, queueCapacity: 0, membershipCapacity: 0 });
  } finally { observer?.disconnect(); dom.window.close(); }
});

test('should release queued signal owners and closed windows after each notification burst', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/slot-signal-memory.cjs'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});
