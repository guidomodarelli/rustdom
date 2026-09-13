/** @file Verifies shared native payload wrappers preserve independent public MutationRecord and NodeList identities. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { NativeTree, NativeMutationRecord } = require('../dist/native.cjs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

test('should collect peer public records independently and release the last shared payload and DOM roots', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/shared-mutation-memory.cjs'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 5);
});

test('should share native batch payload wrappers while preserving the existing independent raw API', () => {
  const tree = new NativeTree(); const target = tree.allocate(); const observers = [];
  for (const oldValue of [true, false, true, false]) { const observer = tree.allocateMutationObserver(); observers.push(observer);
    tree.observeMutations(observer, target, { attributes: true, attributeOldValue: oldValue }); }
  const input = { kind: 'attributes', target, previousSibling: 0, nextSibling: 0, attributeName: 'flag\0',
    attributeNamespace: null, oldValue: 'old\ud800\0', addedNodes: [], removedNodes: [] };
  const before = NativeMutationRecord.statistics().created; const batch = tree.prepareMutationRecordBatch(input);
  assert.deepEqual(batch.observers, observers); assert.deepEqual(batch.payloadIndices, [0, 1, 0, 1]);
  assert.equal(batch.payloads.length, 2); assert.equal(NativeMutationRecord.statistics().created, before + 2);
  assert.deepEqual(batch.payloads.map((record) => record.oldValue), ['old\ud800\0', null]);
  const independent = tree.prepareMutationRecords(input); assert.equal(independent.length, 4);
  assert.equal(new Set(independent.map((item) => item.record)).size, 4);
  assert.deepEqual(independent.map((item) => item.record.oldValue), ['old\ud800\0', null, 'old\ud800\0', null]);
  for (const observer of observers) tree.disconnectMutationObserver(observer);
  assert.equal(tree.prepareMutationRecordBatch(input), null);
  for (const observer of observers) tree.releaseMutationObserver(observer); tree.release(target);
});

for (const [name, runtime] of Object.entries(runtimes)) {
  test(`should keep public record and SameObject list identities independent with mixed old-value observers in ${name}`, () => {
    const dom = new runtime.JSDOM('<main flag="old"></main>'); const target = dom.window.document.querySelector('main');
    const observers = [true, false, true, false].map((oldValue) => {
      const observer = new dom.window.MutationObserver(() => {}); observer.observe(target, { attributes: true, attributeOldValue: oldValue }); return observer;
    });
    try {
      const before = NativeMutationRecord.statistics().created; target.setAttribute('flag', 'new');
      const records = observers.map((observer) => observer.takeRecords()[0]);
      assert.equal(new Set(records).size, 4); assert.deepEqual(records.map((record) => record.oldValue), ['old', null, 'old', null]);
      for (const record of records) { assert.equal(record.target, target); assert.equal(record.addedNodes, record.addedNodes);
        assert.equal(record.removedNodes, record.removedNodes); assert.equal(record.attributeName, 'flag'); }
      assert.notEqual(records[0].addedNodes, records[2].addedNodes); assert.notEqual(records[1].removedNodes, records[3].removedNodes);
      if (name === 'rustdom') assert.equal(NativeMutationRecord.statistics().created, before + 2);
    } finally { for (const observer of observers) observer.disconnect(); dom.window.close(); }
  });
}
