/** @file Verifies shared preparation does not retain the source tree or otherwise unreachable record wrappers. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { NativeTree } = require('../../dist/native.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @returns {object} Three native wrappers share at most two payloads and no source-tree reference. */
function preparedRecords() {
  const tree = new NativeTree(); const target = tree.allocate();
  for (const oldValue of [true, false, true]) { const observer = tree.allocateMutationObserver();
    tree.observeMutations(observer, target, { attributes: true, attributeOldValue: oldValue }); }
  const records = tree.prepareMutationRecords({ kind: 'attributes', target, previousSibling: 0, nextSibling: 0,
    attributeName: 'flag', attributeNamespace: null, oldValue: 'shared\ud800\0', addedNodes: [], removedNodes: [] });
  assert.equal(records.length, 3);
  return { records, target, tree: new WeakRef(tree), wrappers: records.map((item) => new WeakRef(item.record)), retained: null };
}

/** @returns {Promise<void>} Saves each bounded collector trace across five preparation/release cycles. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const owner = preparedRecords();
      const treeReleased = await waitForMemoryQuiescence({ label: `prepared-tree-${cycle}`,
        sample: () => captureMemoryState({ trees: [owner.tree] }, null) });
      assert.equal(treeReleased.reached, true);
      assert.deepEqual(owner.records.map((item) => item.record.oldValue), ['shared\ud800\0', null, 'shared\ud800\0']);
      owner.retained = owner.records[0].record; owner.records = null;
      const othersReleased = await waitForMemoryQuiescence({ label: `prepared-peers-${cycle}`,
        sample: () => captureMemoryState({ records: owner.wrappers.slice(1) }, null) });
      assert.equal(othersReleased.reached, true);
      assert.equal(owner.retained.oldValue, 'shared\ud800\0'); assert.equal(owner.retained.target, owner.target);
      assert.equal(runtime.getNativeTreeStatistics().mutationRecords.live, baseline.mutationRecords.live + 1);
      owner.retained = null;
      const released = await waitForMemoryQuiescence({ label: `prepared-final-${cycle}`,
        sample: () => captureMemoryState({ records: owner.wrappers }, runtime), expectedNative: baseline });
      assert.equal(released.reached, true); report.cycles.push({ treeReleased, othersReleased, released });
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-mutation-production.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
