/** @file Verifies native preparation, lossless string boundaries and prefix commits through real WebIDL factories. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const runtime = require('../dist/index.cjs');
const { NativeTree, NativeMutationRecord } = require('../dist/native.cjs');

test('should release source trees and peer wrappers while retaining one shared snapshot', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/mutation-production-memory.cjs'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});

test('should prepare ordered native snapshots with independent getters and per-observer old values without enqueuing', () => {
  const tree = new NativeTree(); const parent = tree.allocate(); const target = tree.allocate(); tree.append(parent, target);
  const first = tree.allocateMutationObserver(); const lean = tree.allocateMutationObserver(); const third = tree.allocateMutationObserver();
  tree.observeMutations(first, parent, { attributeOldValue: true, subtree: true });
  tree.observeMutations(lean, target, { attributes: true }); tree.observeMutations(third, target, { attributeOldValue: true });
  const input = { kind: 'attributes', target, previousSibling: parent, nextSibling: 0,
    attributeName: 'flag\ud800\0', attributeNamespace: 'urn:\0', oldValue: 'old\udc00\0', addedNodes: [target, target], removedNodes: [parent] };
  const before = tree.observerRegistryStatistics(); const prepared = tree.prepareMutationRecords(input);
  assert.deepEqual(prepared.map((item) => item.observer), [lean, third, first]);
  assert.deepEqual(prepared.map((item) => item.record.oldValue), [null, input.oldValue, input.oldValue]);
  assert.notEqual(prepared[1].record, prepared[2].record);
  input.addedNodes.length = 0; prepared[1].record.addedNodes.pop();
  for (const { record } of prepared) {
    assert.ok(record instanceof NativeMutationRecord); assert.equal(record.target, target); assert.equal(record.previousSibling, parent);
    assert.equal(record.nextSibling, 0); assert.equal(record.attributeName, 'flag\ud800\0'); assert.equal(record.attributeNamespace, 'urn:\0');
    assert.deepEqual(record.addedNodes, [target, target]); assert.deepEqual(record.removedNodes, [parent]);
  }
  assert.deepEqual(tree.observerRegistryStatistics(), before);
  const created = NativeMutationRecord.statistics().created;
  assert.throws(() => tree.prepareMutationRecords({ ...input, addedNodes: [999] }), { code: 'InvalidArg' });
  assert.equal(NativeMutationRecord.statistics().created, created); assert.deepEqual(tree.observerRegistryStatistics(), before);
  for (const observer of [first, lean, third]) tree.disconnectMutationObserver(observer);
  assert.deepEqual(tree.prepareMutationRecords({ ...input, addedNodes: [999] }), []);
  tree.observeMutations(lean, target, { attributeOldValue: true });
  const empty = tree.prepareMutationRecords({ ...input, attributeName: '', attributeNamespace: null, oldValue: '', addedNodes: [] });
  assert.equal(empty[0].record.attributeName, ''); assert.equal(empty[0].record.attributeNamespace, null); assert.equal(empty[0].record.oldValue, '');
  for (const observer of [first, lean, third]) tree.releaseMutationObserver(observer);
  tree.release(target); tree.release(parent);
});

test('should preserve committed prefixes when a binding factory fails and leave the original scheduler point unchanged', async () => {
  const { domSymbolTree } = require('../dist/vendor-jsdom/lib/jsdom/living/helpers/internal-constants');
  const utils = require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils');
  const MutationRecord = require('../dist/vendor-jsdom/lib/jsdom/living/generated/MutationRecord');
  const dom = new runtime.JSDOM('<main></main>'); const target = dom.window.document.querySelector('main'); const implementation = utils.implForWrapper(target);
  const observers = Array.from({ length: 3 }, () => new dom.window.MutationObserver(() => {}));
  for (const observer of observers) observer.observe(target, { attributeOldValue: true });
  try {
    await new Promise((resolve) => setImmediate(resolve)); let created = 0;
    assert.throws(() => domSymbolTree.produceMutationRecords({ type: 'attributes', target: implementation, attributeName: 'flag',
      attributeNamespace: null, oldValue: 'old', addedNodes: [], removedNodes: [], previousSibling: null, nextSibling: null },
    (nativeRecord, owners) => {
      if (++created === 2) throw new Error('factory failure');
      return MutationRecord.createImpl(implementation._globalObject, [], { nativeRecord, owners });
    }), /factory failure/);
    const prefix = observers[0].takeRecords(); assert.equal(prefix.length, 1); assert.equal(prefix[0].target, target); assert.equal(prefix[0].oldValue, 'old');
    assert.equal(observers[1].takeRecords().length, 0); assert.equal(observers[2].takeRecords().length, 0);
    assert.equal(runtime.getNativeTreeStatistics().mutationNotifications.microtaskQueued, false);
    target.setAttribute('cleanup', 'flush'); await new Promise((resolve) => setImmediate(resolve));
  } finally { for (const observer of observers) observer.disconnect(); dom.window.close(); }
});
