/** @file Checks that retained assignment drivers with weak forest identities cannot keep windows or documents alive. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { NativeTree, NativeSlotAssignmentDriver, SlotAssignmentAction } = require('../../dist/native.cjs');
const { domSymbolTree } = require('../../dist/vendor-jsdom/lib/jsdom/living/helpers/internal-constants.js');
const { implForWrapper } = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils.js');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {string} mode - Completed, pending or cancelled controller. @returns {object} Driver plus weak observations after closing its window. */
function closedDriver(mode) {
  const dom = new runtime.JSDOM('<main></main>'); const document = dom.window.document;
  const host = document.querySelector('main'); const root = host.attachShadow({ mode: 'open' });
  const slot = root.appendChild(document.createElement('slot')); const child = host.appendChild(document.createElement('b'));
  if (mode !== 'complete') domSymbolTree.commitSlotAssignment(implForWrapper(slot), []);
  const driver = new NativeSlotAssignmentDriver(domSymbolTree._ensure(implForWrapper(root)), true);
  const step = domSymbolTree._arena.slotAssignmentStep(driver);
  assert.equal(step.kind, mode === 'complete' ? SlotAssignmentAction.Complete : SlotAssignmentAction.Signal);
  if (mode === 'cancelled') driver.cancel();
  const observed = { documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)],
    nodes: [host, root, slot, child].map((node) => new WeakRef(node)) };
  dom.window.close(); return { driver, observed };
}

/** @param {string} mode - Completed, pending or cancelled controller. @returns {object} Driver and weak observation after dropping its standalone forest. */
function releasedForestDriver(mode) {
  const tree = new NativeTree();
  const host = tree.allocate(); tree.setHtmlElement(host, 'div', []);
  const root = tree.allocate(); tree.setData(root, '{"kind":11}'); tree.setRootHost(root, host, true);
  const slot = tree.allocate(); tree.setHtmlElement(slot, 'slot', []); tree.append(root, slot);
  const child = tree.allocate(); tree.setCharacterData(child, 3, 'child'); tree.append(host, child);
  const driver = new NativeSlotAssignmentDriver(root, true);
  assert.equal(tree.slotAssignmentStep(driver).kind, SlotAssignmentAction.Signal);
  if (mode === 'complete') {
    assert.equal(tree.slotAssignmentStep(driver).kind, SlotAssignmentAction.Applied);
    assert.equal(tree.slotAssignmentStep(driver).kind, SlotAssignmentAction.Complete);
  } else if (mode === 'cancelled') driver.cancel();
  return { driver, observed: { trees: [new WeakRef(tree)] } };
}

/** @returns {Promise<void>} Saves lifetime endpoints for held drivers and their eventual finalization. */
async function main() {
  assert.equal(typeof global.gc, 'function', 'Run with --expose-gc');
  const retained = []; const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [], rawForestCycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const outcomes = [];
      for (const mode of ['complete', 'pending', 'cancelled']) {
        const owner = closedDriver(mode); retained.push(owner.driver);
        const expectedNative = { ...baseline, slotAssignmentDrivers: { ...baseline.slotAssignmentDrivers,
          live: baseline.slotAssignmentDrivers.live + retained.length } };
        const released = await waitForMemoryQuiescence({ label: `driver-${mode}-${cycle}`,
          sample: () => captureMemoryState(owner.observed, runtime), expectedNative });
        assert.equal(released.reached, true);
        if (mode === 'complete') assert.equal(domSymbolTree._arena.slotAssignmentStep(owner.driver).kind, SlotAssignmentAction.Complete);
        else assert.throws(() => domSymbolTree._arena.slotAssignmentStep(owner.driver), { code: 'InvalidArg' });
        owner.driver.cancel(); outcomes.push({ mode, released });
      }
      report.cycles.push(outcomes);
      const rawOutcomes = [];
      for (const mode of ['complete', 'pending', 'cancelled']) {
        const owner = releasedForestDriver(mode); retained.push(owner.driver);
        const expectedNative = { ...baseline, slotAssignmentDrivers: { ...baseline.slotAssignmentDrivers,
          live: baseline.slotAssignmentDrivers.live + retained.length } };
        const released = await waitForMemoryQuiescence({ label: `raw-forest-${mode}-${cycle}`,
          sample: () => captureMemoryState(owner.observed, runtime), expectedNative });
        assert.equal(released.reached, true);
        const other = new NativeTree();
        if (mode === 'complete') assert.equal(other.slotAssignmentStep(owner.driver).kind, SlotAssignmentAction.Complete);
        else assert.throws(() => other.slotAssignmentStep(owner.driver), { code: 'InvalidArg',
          message: mode === 'pending' ? /originating native forest was released/ : /cancelled or failed/ });
        owner.driver.cancel(); rawOutcomes.push({ mode, released });
      }
      report.rawForestCycles.push(rawOutcomes);
    }
    retained.length = 0;
    report.finalized = await waitForMemoryQuiescence({ label: 'driver-boxes-finalized',
      sample: () => captureMemoryState({}, runtime), expectedNative: baseline });
    assert.equal(report.finalized.reached, true); report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-slot-assignment-driver.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, rawForestCycles: report.rawForestCycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
