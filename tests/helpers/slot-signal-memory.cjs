/** @file Verifies that queued signals deliver once and release owners of closed windows after draining. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
/** Exercise several unrelated roots in one pending batch without creating an unbounded stress loop. */
const WINDOWS_PER_BURST = 12;
const SLOTS_PER_WINDOW = 3;

/** @returns {object} Closed-window observations, queued counts and a scalar delivery counter. */
function queuedWindows() {
  const observed = { documents: [], windows: [], nodes: [] }; const notifications = { count: 0 };
  for (let index = 0; index < WINDOWS_PER_BURST; index++) {
    const dom = new runtime.JSDOM('<main></main>'); const document = dom.window.document;
    const host = document.querySelector('main'); const root = host.attachShadow({ mode: index % 2 ? 'closed' : 'open' });
    const slots = Array.from({ length: SLOTS_PER_WINDOW }, (_, position) => {
      const slot = document.createElement('slot'); slot.name = String(position); root.append(slot);
      slot.addEventListener('slotchange', () => { notifications.count++; }); return slot;
    });
    const targets = slots.map((slot) => { const target = document.createElement('b'); target.slot = slot.name; return target; });
    host.append(...targets); targets[0].remove(); host.append(targets[0]);
    observed.documents.push(new WeakRef(document)); observed.windows.push(new WeakRef(dom.window));
    observed.nodes.push(...[host, root, ...slots, ...targets].map((node) => new WeakRef(node)));
    dom.window.close();
  }
  return { observed, notifications, queued: runtime.getNativeTreeStatistics().slotSignals };
}

/** @returns {Promise<void>} Saves every bounded GC endpoint and verifies exact notification counts. */
async function main() {
  assert.equal(typeof global.gc, 'function', 'Run with --expose-gc');
  const report = { capturedAt: new Date().toISOString(), node: process.version, windowsPerBurst: WINDOWS_PER_BURST,
    slotsPerWindow: SLOTS_PER_WINDOW, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const burst = queuedWindows(); const expectedSignals = WINDOWS_PER_BURST * SLOTS_PER_WINDOW;
      assert.equal(burst.queued.pendingSlots, expectedSignals); assert.equal(burst.queued.queueEntries, expectedSignals);
      const released = await waitForMemoryQuiescence({ label: `signals-released-${cycle}`,
        sample: () => captureMemoryState(burst.observed, runtime), expectedNative: baseline });
      assert.equal(burst.notifications.count, expectedSignals); assert.equal(released.reached, true);
      assert.deepEqual(released.state.nativeTree.slotSignals, baseline.slotSignals);
      report.cycles.push({ queued: burst.queued, delivered: burst.notifications.count, released });
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-slot-signals.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
