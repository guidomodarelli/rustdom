/** @file Distinguishes MutationRecord, static list, node, Document and Window ownership with real GC. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { NativeTree, NativeMutationRecord } = require('../../dist/native.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {boolean} keepList - Materialize a static list that may outlive its record. @returns {object} Owners and separate weak observations after window closure. */
function closedRecord(keepList) {
  const dom = new runtime.JSDOM('<main></main>'); const document = dom.window.document; const host = document.querySelector('main');
  const observer = new dom.window.MutationObserver(() => {}); observer.observe(host, { childList: true });
  const element = document.createElement('b'); const text = document.createTextNode('snapshot'); host.append(element, text);
  const records = observer.takeRecords(); assert.equal(records.length, 1); const record = records[0]; observer.disconnect();
  const list = keepList ? record.addedNodes : null;
  if (list) assert.deepEqual([...list], [element, text]);
  const observed = { records: [new WeakRef(record)], documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)],
    nodes: [host, element, text].map((node) => new WeakRef(node)) };
  dom.window.close(); return { record, list, observed };
}

/** @returns {object} A numeric snapshot that must not keep the supplied NativeTree alive. */
function detachedRawRecord() {
  const tree = new NativeTree(); const target = tree.allocate(); const child = tree.allocate();
  const record = new NativeMutationRecord(tree, { kind: 'childList', target, previousSibling: 0, nextSibling: 0,
    addedNodes: [child], removedNodes: [], oldValue: 'raw\ud800' });
  return { record, tree: new WeakRef(tree), target, child };
}

/** @returns {Promise<void>} Saves retained/released record and list controls without returning strong observations. */
async function main() {
  assert.equal(typeof global.gc, 'function', 'Run with --expose-gc');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const owner = closedRecord(false);
      const held = await waitForMemoryQuiescence({ label: `record-held-${cycle}`, maxRounds: 2,
        sample: () => captureMemoryState(owner.observed, runtime), expectedNative: baseline });
      assert.equal(held.reached, false); assert.equal(held.state.survivors.records, 1);
      assert.equal(held.state.nativeTree.mutationRecords.live, baseline.mutationRecords.live + 1);
      owner.record = null;
      const released = await waitForMemoryQuiescence({ label: `record-released-${cycle}`,
        sample: () => captureMemoryState(owner.observed, runtime), expectedNative: baseline });
      assert.equal(released.reached, true);
      const listOwner = closedRecord(true); listOwner.record = null;
      const recordReleased = await waitForMemoryQuiescence({ label: `list-record-released-${cycle}`,
        sample: () => captureMemoryState({ records: listOwner.observed.records }, null) });
      assert.equal(recordReleased.reached, true);
      assert.equal(NativeMutationRecord.statistics().live, baseline.mutationRecords.live);
      const heldList = captureMemoryState(listOwner.observed, runtime);
      assert.ok(heldList.survivors.nodes > 0); assert.equal(listOwner.list.length, 2);
      listOwner.list = null;
      const listReleased = await waitForMemoryQuiescence({ label: `list-released-${cycle}`,
        sample: () => captureMemoryState(listOwner.observed, runtime), expectedNative: baseline });
      assert.equal(listReleased.reached, true); report.cycles.push({ held, released, recordReleased, heldList, listReleased });
    }
    const raw = detachedRawRecord();
    report.rawTreeReleased = await waitForMemoryQuiescence({ label: 'raw-record-tree-released',
      sample: () => captureMemoryState({ trees: [raw.tree] }, null) });
    assert.equal(report.rawTreeReleased.reached, true);
    assert.equal(raw.record.target, raw.target); assert.deepEqual(raw.record.addedNodes, [raw.child]); assert.equal(raw.record.oldValue, 'raw\ud800');
    raw.record = null;
    report.finalized = await waitForMemoryQuiescence({ label: 'raw-record-finalized',
      sample: () => captureMemoryState({}, runtime), expectedNative: baseline });
    assert.equal(report.finalized.reached, true); report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-mutation-records.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
