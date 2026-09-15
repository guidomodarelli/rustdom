/** @file Retains completed, pending and cancelled native delivery boxes while their forests are collected. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { NativeTree, NativeMutationRecord, NativeObserverDelivery, ObserverDeliveryAction } = require('../../dist/native.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {string} mode - Desired retained driver state. @returns {object} Numeric driver and weak input observations. */
function retainedDelivery(mode) {
  const tree = new NativeTree(); const observer = tree.allocateMutationObserver(); const target = tree.allocate();
  const slot = tree.allocate(); tree.setHtmlElement(slot, 'slot', []);
  const record = new NativeMutationRecord(tree, { kind: 'childList', target, previousSibling: 0, nextSibling: 0, addedNodes: [], removedNodes: [] });
  tree.enqueueMutationRecord(observer, record); tree.queueSlotSignal(slot);
  const operation = tree.startMutationObserverDelivery();
  if (mode === 'complete') {
    let step; do { step = tree.mutationObserverDeliveryStep(operation); } while (!step.complete);
  } else if (mode === 'cancelled') operation.cancel();
  return { operation, observed: { trees: [new WeakRef(tree)], records: [new WeakRef(record)] } };
}

/** @returns {Promise<void>} Preserves scalar GC traces and requires all native lifetimes to return to baseline. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (const mode of ['complete', 'pending', 'cancelled']) {
      const owner = retainedDelivery(mode);
      const inputsReleased = await waitForMemoryQuiescence({ label: `delivery-inputs-${mode}`,
        sample: () => captureMemoryState(owner.observed, null) });
      assert.equal(inputsReleased.reached, true);
      assert.equal(NativeObserverDelivery.statistics().live, baseline.observerDeliveries.live + 1);
      const foreign = new NativeTree();
      if (mode === 'complete') assert.equal(foreign.mutationObserverDeliveryStep(owner.operation).kind, ObserverDeliveryAction.Complete);
      else assert.throws(() => foreign.mutationObserverDeliveryStep(owner.operation), { code: 'InvalidArg' });
      assert.equal(owner.operation.remainingObservers, 0); assert.equal(owner.operation.remainingSlots, 0);
      owner.operation = null;
      const released = await waitForMemoryQuiescence({ label: `delivery-released-${mode}`,
        sample: () => captureMemoryState({}, runtime), expectedNative: baseline });
      assert.equal(released.reached, true); report.cycles.push({ mode, inputsReleased, released });
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-observer-delivery.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
