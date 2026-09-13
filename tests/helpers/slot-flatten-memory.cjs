/** @file Checks lifetime of flattened snapshots and empty results with real asynchronous GC. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {boolean} populated - Include an assigned leaf. @returns {object} Snapshot plus weak observations after closing its window. */
function closedSnapshot(populated) {
  const dom = new runtime.JSDOM('<main></main>'); const document = dom.window.document;
  const host = document.querySelector('main'); const root = host.attachShadow({ mode: 'closed' });
  const innerHost = root.appendChild(document.createElement('section'));
  const relay = innerHost.appendChild(document.createElement('slot'));
  const innerRoot = innerHost.attachShadow({ mode: 'open' }); const slot = innerRoot.appendChild(document.createElement('slot'));
  const leaf = populated ? host.appendChild(document.createElement('b')) : null;
  const snapshot = slot.assignedNodes({ flatten: true });
  assert.deepEqual(snapshot, populated ? [leaf] : []);
  const observed = { documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)],
    nodes: [host, root, innerHost, relay, innerRoot, slot, ...(leaf ? [leaf] : [])].map((node) => new WeakRef(node)) };
  dom.window.close(); return { snapshot, observed };
}

/** @returns {Promise<void>} Saves scalar GC evidence, including the retained-result control. */
async function main() {
  assert.equal(typeof global.gc, 'function', 'Run with --expose-gc');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  const emptyResults = [];
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const owner = closedSnapshot(true);
      const held = await waitForMemoryQuiescence({ label: `flatten-held-${cycle}`, maxRounds: 2,
        sample: () => captureMemoryState(owner.observed, runtime), expectedNative: baseline });
      assert.equal(held.reached, false); assert.ok(held.state.survivors.nodes > 0);
      owner.snapshot = null;
      const released = await waitForMemoryQuiescence({ label: `flatten-released-${cycle}`,
        sample: () => captureMemoryState(owner.observed, runtime), expectedNative: baseline });
      assert.equal(released.reached, true);
      const empty = closedSnapshot(false); emptyResults.push(empty.snapshot);
      const emptyReleased = await waitForMemoryQuiescence({ label: `flatten-empty-${cycle}`,
        sample: () => captureMemoryState(empty.observed, runtime), expectedNative: baseline });
      assert.equal(emptyReleased.reached, true);
      report.cycles.push({ held, released, emptyReleased });
    }
    assert.equal(emptyResults.length, 5); report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-slot-flatten.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error }) + '\n');
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
