/** @file Verifies pending records, per-observer drains, reentrancy and callback order with both real engines. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
/** The reference runtime remains separate from rustdom's private implementation. */
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

test('should retain queued native data without retaining its wrapper or originating tree', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/mutation-observer-queue-memory.cjs'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});

test('should expose native queue order, immutable payload inspection and atomic invalid inputs', () => {
  const { NativeTree, NativeMutationRecord, NativeRange } = require('../dist/native.cjs');
  const tree = new NativeTree(); const target = tree.allocate(); const observer = tree.allocateMutationObserver();
  const record = new NativeMutationRecord(tree, { kind: 'attributes', target, previousSibling: 0, nextSibling: 0,
    attributeName: 'flag', attributeNamespace: null, oldValue: 'old\ud800', addedNodes: [], removedNodes: [] });
  tree.observeMutations(observer, target, { attributes: true });
  const first = tree.enqueueMutationRecord(observer, record); const second = tree.enqueueMutationRecord(observer, record);
  const before = tree.observerRegistryStatistics();
  for (const invalid of [0, -1, 0.5, NaN, Infinity, 999]) {
    assert.throws(() => tree.enqueueMutationRecord(invalid, record), { code: 'InvalidArg' });
    assert.throws(() => tree.takeMutationRecords(invalid), { code: 'InvalidArg' });
  }
  for (const foreign of [{}, tree, new NativeRange(), Object.create(NativeMutationRecord.prototype)]) {
    assert.throws(() => tree.enqueueMutationRecord(observer, foreign), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.observerRegistryStatistics(), before);
  const snapshot = tree.queuedMutationRecord(observer, first); assert.ok(snapshot instanceof NativeMutationRecord);
  assert.notEqual(snapshot, record); assert.equal(snapshot.oldValue, 'old\ud800'); assert.equal(snapshot.target, target);
  assert.equal(tree.queuedMutationRecord(observer, 999), null);
  tree.observeMutations(observer, target, { childList: true }); tree.release(target);
  assert.equal(tree.observerRegistryStatistics().queuedRecords, 2);
  assert.deepEqual(tree.takeMutationRecords(observer), [first, second]); assert.deepEqual(tree.takeMutationRecords(observer), []);
  assert.equal(snapshot.oldValue, 'old\ud800'); assert.equal(tree.queuedMutationRecord(observer, first), null);
  const third = tree.enqueueMutationRecord(observer, record); assert.ok(third > second);
  assert.deepEqual(tree.disconnectMutationObserver(observer), []); assert.equal(tree.observerRegistryStatistics().queuedRecords, 0);
  tree.enqueueMutationRecord(observer, record); tree.releaseMutationObserver(observer);
  for (const value of Object.values(tree.observerRegistryStatistics())) assert.equal(value, 0);
});

for (const [name, runtime] of Object.entries(runtimes)) {
  test(`should keep pending records across option changes and return independent ordered snapshots in ${name}`, async () => {
    const dom = new runtime.JSDOM('<main flag="zero"></main>'); const target = dom.window.document.querySelector('main');
    let callbacks = 0; const observer = new dom.window.MutationObserver(() => { callbacks++; });
    const initialQueued = runtime.getNativeTreeStatistics?.().mutationObservers.queuedRecords;
    try {
      observer.observe(target, { attributes: true }); target.setAttribute('flag', 'one');
      observer.observe(target, { attributeOldValue: true }); target.setAttribute('flag', 'two');
      assert.throws(() => observer.observe(target, {}), { name: 'TypeError' });
      if (name === 'rustdom') assert.equal(runtime.getNativeTreeStatistics().mutationObservers.queuedRecords, initialQueued + 2);
      const first = observer.takeRecords(); assert.equal(first.length, 2);
      if (name === 'rustdom') assert.equal(runtime.getNativeTreeStatistics().mutationObservers.queuedRecords, initialQueued);
      assert.deepEqual(first.map((record) => record.oldValue), [null, 'one']);
      for (const record of first) assert.equal(record.target, target);
      const retained = first[1]; first.length = 0;
      target.setAttribute('flag', 'three'); const second = observer.takeRecords();
      assert.equal(second.length, 1); assert.equal(second[0].oldValue, 'two'); assert.equal(retained.oldValue, 'one');
      assert.notEqual(second[0], retained); assert.deepEqual(observer.takeRecords(), []);
      target.setAttribute('flag', 'discard'); observer.disconnect(); assert.deepEqual(observer.takeRecords(), []);
      await new Promise((resolve) => setImmediate(resolve)); assert.equal(callbacks, 0);
    } finally { observer.disconnect(); dom.window.close(); }
  });

  test(`should drain later observers after earlier callbacks enqueue more records in ${name}`, async () => {
    const dom = new runtime.JSDOM('<main flag="zero"></main>'); const target = dom.window.document.querySelector('main');
    const calls = []; let modified = false;
    const first = new dom.window.MutationObserver((records) => {
      calls.push(['first', records.map((record) => record.oldValue)]);
      if (!modified) { modified = true; target.setAttribute('flag', 'two'); }
    });
    const second = new dom.window.MutationObserver((records) => { calls.push(['second', records.map((record) => record.oldValue)]); });
    try {
      first.observe(target, { attributeOldValue: true }); second.observe(target, { attributeOldValue: true });
      target.setAttribute('flag', 'one'); await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(calls, [['first', ['zero']], ['second', ['zero', 'one']], ['first', ['one']]]);
      assert.deepEqual(first.takeRecords(), []); assert.deepEqual(second.takeRecords(), []);
    } finally { first.disconnect(); second.disconnect(); dom.window.close(); }
  });

  test(`should honor takeRecords and disconnect inside an earlier callback without losing later new records in ${name}`, async () => {
    const dom = new runtime.JSDOM('<main flag="zero"></main>'); const target = dom.window.document.querySelector('main');
    const calls = []; const drained = []; let modified = false;
    const first = new dom.window.MutationObserver((records) => {
      calls.push(['first', records.map((record) => record.oldValue)]);
      if (!modified) {
        modified = true; drained.push(...second.takeRecords()); second.disconnect();
        second.observe(target, { attributeOldValue: true }); target.setAttribute('flag', 'two');
      }
    });
    const second = new dom.window.MutationObserver((records) => { calls.push(['second', records.map((record) => record.oldValue)]); });
    try {
      first.observe(target, { attributeOldValue: true }); second.observe(target, { attributeOldValue: true });
      target.setAttribute('flag', 'one'); await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(calls, [['first', ['zero']], ['second', ['one']], ['first', ['one']]]);
      assert.equal(drained.length, 1); assert.equal(drained[0].oldValue, 'zero'); assert.equal(drained[0].target, target);
    } finally { first.disconnect(); second.disconnect(); dom.window.close(); }
  });
}
