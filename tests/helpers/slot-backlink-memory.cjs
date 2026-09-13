/** @file Distinguishes intended backlink ownership from retention after replacement or finalization. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @returns {object} Retains only a foreign-realm target whose old slot lives in a closed window. */
function retainedForeignTarget() {
  const first = new runtime.JSDOM('<main></main>'); const second = new runtime.JSDOM('<main></main>');
  const host = first.window.document.querySelector('main'); const root = host.attachShadow({ mode: 'closed' });
  const slot = root.appendChild(first.window.document.createElement('slot'));
  // Construct in the second realm so the original realm cannot keep the first window alive.
  const target = second.window.document.createElement('b'); host.append(target);
  assert.deepEqual(slot.assignedNodes(), [target]);
  second.window.document.body.append(target);
  assert.equal(target.assignedSlot, null); assert.deepEqual(slot.assignedNodes(), []);
  const oldObserved = { documents: [new WeakRef(first.window.document)], windows: [new WeakRef(first.window)],
    nodes: [host, root, slot].map((node) => new WeakRef(node)) };
  const newObserved = { documents: [new WeakRef(second.window.document)], windows: [new WeakRef(second.window)],
    nodes: [new WeakRef(target)] };
  first.window.close(); return { target, oldObserved, newObserved };
}

/** @param {object} owner - Target and weak observations. @returns {void} Replaces the recorded slot, then closes the second window. */
function replaceBacklink(owner) {
  const document = owner.target.ownerDocument; const host = document.querySelector('main');
  const root = host.attachShadow({ mode: 'open' }); const slot = root.appendChild(document.createElement('slot'));
  host.append(owner.target); assert.equal(owner.target.assignedSlot, slot);
  owner.newObserved.nodes.push(...[host, root, slot].map((node) => new WeakRef(node)));
  document.defaultView.close();
}

/** @returns {Promise<void>} Saves retained, replaced and released controls for five real GC cycles. */
async function main() {
  assert.equal(typeof global.gc, 'function', 'Run with --expose-gc');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const owner = retainedForeignTarget();
      const held = await waitForMemoryQuiescence({ label: `backlink-held-${cycle}`, maxRounds: 2,
        sample: () => captureMemoryState(owner.oldObserved, null) });
      assert.equal(held.reached, false); assert.equal(held.state.survivors.documents, 1);
      assert.equal(held.state.survivors.windows, 1); assert.equal(held.state.survivors.nodes, 3);
      replaceBacklink(owner);
      const replaced = await waitForMemoryQuiescence({ label: `backlink-replaced-${cycle}`,
        sample: () => captureMemoryState(owner.oldObserved, null) });
      assert.equal(replaced.reached, true);
      const active = runtime.getNativeTreeStatistics().slotBacklinks;
      assert.equal(active.assignedNodes, baseline.slotBacklinks.assignedNodes + 1);
      assert.equal(active.slotOwners, baseline.slotBacklinks.slotOwners + 1);
      owner.target = null;
      const released = await waitForMemoryQuiescence({ label: `backlink-released-${cycle}`,
        sample: () => captureMemoryState(owner.newObserved, runtime), expectedNative: baseline });
      assert.equal(released.reached, true);
      assert.deepEqual(released.state.nativeTree.slotBacklinks, baseline.slotBacklinks);
      report.cycles.push({ held, replaced, active, released });
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-slot-backlinks.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
