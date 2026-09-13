/** @file Exercises notification coalescing and batch boundaries with real Promise jobs and observers. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
/** Keep the upstream engine independent from the private native runtime. */
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

test('should expose native creation-order batches and preserve the scheduled flag after drains and finalization', () => {
  const { NativeTree, NativeMutationRecord } = require('../dist/native.cjs');
  const tree = new NativeTree(); const target = tree.allocate();
  const record = new NativeMutationRecord(tree, { kind: 'childList', target, previousSibling: 0, nextSibling: 0, addedNodes: [], removedNodes: [] });
  const first = tree.allocateMutationObserver(); const second = tree.allocateMutationObserver(); const third = tree.allocateMutationObserver();
  tree.enqueueMutationRecord(third, record); tree.enqueueMutationRecord(first, record); tree.enqueueMutationRecord(third, record);
  assert.equal(tree.observerNotificationStatistics().pendingObservers, 2);
  assert.equal(tree.requestMutationObserverMicrotask(), true); assert.equal(tree.requestMutationObserverMicrotask(), false);
  tree.takeMutationRecords(third); tree.disconnectMutationObserver(first);
  assert.equal(tree.observerNotificationStatistics().pendingObservers, 2);
  tree.releaseMutationObserver(third);
  assert.equal(tree.observerNotificationStatistics().microtaskQueued, true);
  const batch = tree.beginMutationObserverNotification(); assert.deepEqual(batch, [first]);
  tree.enqueueMutationRecord(second, record); assert.equal(tree.requestMutationObserverMicrotask(), true);
  assert.deepEqual(batch, [first]); assert.deepEqual(tree.beginMutationObserverNotification(), [second]);
  assert.deepEqual(tree.observerNotificationStatistics(), { pendingObservers: 0, capacity: 0, microtaskQueued: false });
  tree.releaseMutationObserver(first); tree.releaseMutationObserver(second); tree.release(target);
  const before = tree.observerNotificationStatistics();
  assert.throws(() => tree.enqueueMutationRecord(third, record), { code: 'InvalidArg' });
  assert.deepEqual(tree.observerNotificationStatistics(), before);
});

for (const [name, runtime] of Object.entries(runtimes)) {
  test(`should preserve notification position between existing Promise jobs in ${name}`, async () => {
    const dom = new runtime.JSDOM('<main></main>'); const target = dom.window.document.querySelector('main');
    const trace = []; const observer = new dom.window.MutationObserver(() => { trace.push('observer'); });
    try {
      observer.observe(target, { attributes: true }); await new Promise((resolve) => setImmediate(resolve));
      Promise.resolve().then(() => { trace.push('before'); }); target.setAttribute('flag', 'one');
      target.setAttribute('flag', 'two'); Promise.resolve().then(() => { trace.push('after'); });
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(trace, ['before', 'observer', 'after']);
    } finally { observer.disconnect(); dom.window.close(); }
  });

  for (const clearsQueue of ['takeRecords', 'disconnect']) {
    test(`should retain the existing microtask after ${clearsQueue} and avoid extra reentrant deliveries in ${name}`, async () => {
      const dom = new runtime.JSDOM('<main><b></b></main>'); const firstTarget = dom.window.document.querySelector('main');
      const secondTarget = firstTarget.firstChild; const trace = []; let secondCalls = 0;
      const first = new dom.window.MutationObserver(() => { trace.push('unexpected-first'); });
      const second = new dom.window.MutationObserver(() => {
        secondCalls++; trace.push(`second-${secondCalls}`);
        if (secondCalls === 1) {
          Promise.resolve().then(() => { trace.push('inside'); }); secondTarget.setAttribute('flag', 'two');
        }
      });
      try {
        first.observe(firstTarget, { attributes: true }); second.observe(secondTarget, { attributes: true });
        await new Promise((resolve) => setImmediate(resolve));
        firstTarget.setAttribute('flag', 'one'); first[clearsQueue]();
        Promise.resolve().then(() => { trace.push('between'); }); secondTarget.setAttribute('flag', 'one');
        await new Promise((resolve) => setImmediate(resolve));
        assert.deepEqual(trace, ['second-1', 'between', 'inside', 'second-2']);
      } finally { first.disconnect(); second.disconnect(); dom.window.close(); }
    });
  }

  test(`should defer newly active observers while preserving the original batch creation order in ${name}`, async () => {
    const dom = new runtime.JSDOM('<main></main>'); const target = dom.window.document.querySelector('main');
    const trace = []; let third; let changed = false;
    const first = new dom.window.MutationObserver(() => {
      trace.push('first');
      if (!changed) {
        changed = true; third = new dom.window.MutationObserver(() => { trace.push('third'); });
        third.observe(target, { attributes: true });
        Promise.resolve().then(() => { trace.push('between-batches'); }); target.setAttribute('flag', 'two');
      }
    });
    const second = new dom.window.MutationObserver((records) => { trace.push(`second-${records.length}`); });
    try {
      second.observe(target, { attributes: true }); first.observe(target, { attributes: true });
      await new Promise((resolve) => setImmediate(resolve)); target.setAttribute('flag', 'one');
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(trace, ['first', 'second-2', 'between-batches', 'first', 'third']);
    } finally { first.disconnect(); second.disconnect(); third?.disconnect(); dom.window.close(); }
  });
}
