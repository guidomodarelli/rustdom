/** @file Observes native cached assignments and separate Document/Window lifetimes across real GC. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {boolean} populated - Include assigned Element/Text nodes. @returns {object} Public cache snapshot and weak observations. */
function closedSnapshot(populated) {
  const dom = new runtime.JSDOM('<main></main>'); const document = dom.window.document;
  const host = document.querySelector('main'); const root = host.attachShadow({ mode: 'closed' });
  const slot = root.appendChild(document.createElement('slot'));
  const leaves = populated ? [document.createElement('b'), document.createTextNode('assigned')] : [];
  host.append(...leaves);
  const snapshot = slot.assignedNodes(); assert.deepEqual(snapshot, leaves);
  if (populated) assert.ok(runtime.getNativeTreeStatistics().slotAssignments.entries >= leaves.length);
  const observed = { documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)],
    nodes: [host, root, slot, ...leaves].map((node) => new WeakRef(node)) };
  dom.window.close(); return { snapshot, observed };
}

/** @returns {Promise<void>} Saves scalar evidence for retained, released and empty snapshot controls. */
async function main() {
  assert.equal(typeof global.gc, 'function', 'Run with --expose-gc');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  const emptyResults = [];
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const owner = closedSnapshot(true);
      const held = await waitForMemoryQuiescence({ label: `assignment-held-${cycle}`, maxRounds: 2,
        sample: () => captureMemoryState(owner.observed, runtime), expectedNative: baseline });
      assert.equal(held.reached, false); assert.ok(held.state.survivors.nodes > 0);
      assert.ok(held.state.nativeTree.slotAssignments.entries > baseline.slotAssignments.entries);
      owner.snapshot = null;
      const released = await waitForMemoryQuiescence({ label: `assignment-released-${cycle}`,
        sample: () => captureMemoryState(owner.observed, runtime), expectedNative: baseline });
      assert.equal(released.reached, true);
      assert.deepEqual(released.state.nativeTree.slotAssignments, baseline.slotAssignments);
      const empty = closedSnapshot(false); emptyResults.push(empty.snapshot);
      const emptyReleased = await waitForMemoryQuiescence({ label: `assignment-empty-${cycle}`,
        sample: () => captureMemoryState(empty.observed, runtime), expectedNative: baseline });
      assert.equal(emptyReleased.reached, true);
      report.cycles.push({ held, released, emptyReleased });
    }
    assert.equal(emptyResults.length, 5); report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-slot-assignment.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error }) + '\n');
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
