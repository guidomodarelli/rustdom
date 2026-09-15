/** @file Separates native queue payload ownership from V8 wrappers and the originating native tree. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { NativeTree, NativeMutationRecord } = require('../../dist/native.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @returns {object} The queue owns native data but must not keep the supplied record wrapper alive. */
function queuedPayload() {
  const tree = new NativeTree(); const observer = tree.allocateMutationObserver(); const target = tree.allocate();
  const record = new NativeMutationRecord(tree, { kind: 'attributes', target, previousSibling: 0, nextSibling: 0,
    attributeName: 'flag', attributeNamespace: null, oldValue: 'queued\0\ud800', addedNodes: [], removedNodes: [] });
  const token = tree.enqueueMutationRecord(observer, record);
  return { tree, observer, target, token, original: new WeakRef(record), treeReference: new WeakRef(tree), snapshot: null };
}

/** @returns {Promise<void>} Exercises both explicit draining and tree finalization over repeated ownership cycles. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const owner = queuedPayload();
      const wrapperReleased = await waitForMemoryQuiescence({ label: `queued-wrapper-${cycle}`,
        sample: () => captureMemoryState({ records: [owner.original] }, null) });
      assert.equal(wrapperReleased.reached, true); assert.equal(owner.tree.observerRegistryStatistics().queuedRecords, 1);
      assert.equal(NativeMutationRecord.statistics().live, baseline.mutationRecords.live);
      owner.snapshot = owner.tree.queuedMutationRecord(owner.observer, owner.token);
      assert.equal(owner.snapshot.oldValue, 'queued\0\ud800'); owner.tree.release(owner.target);
      if (cycle % 2 === 0) {
        assert.deepEqual(owner.tree.takeMutationRecords(owner.observer), [owner.token]);
        assert.equal(owner.tree.observerRegistryStatistics().queuedRecords, 0);
      }
      owner.tree = null;
      const treeReleased = await waitForMemoryQuiescence({ label: `queued-tree-${cycle}`,
        sample: () => captureMemoryState({ trees: [owner.treeReference] }, null) });
      assert.equal(treeReleased.reached, true);
      assert.equal(owner.snapshot.target, owner.target); assert.equal(owner.snapshot.oldValue, 'queued\0\ud800');
      owner.snapshot = null;
      const released = await waitForMemoryQuiescence({ label: `queued-snapshot-${cycle}`,
        sample: () => captureMemoryState({}, runtime), expectedNative: baseline });
      assert.equal(released.reached, true); report.cycles.push({ wrapperReleased, treeReleased, released });
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-observer-queues.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
