/** @file Repeated rectangle ownership cycles and independent scalar snapshots across both engine realms. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
/** Number of public rectangle allocations per owner cycle. */
const RECTANGLES_PER_CYCLE = 1000;

/** @param {object} runtime - Real engine. @param {string} mode - Realm mode. @returns {object} Strong rectangles, detached snapshots and weak observations. */
function fixture(runtime, mode) {
  const { window } = new runtime.JSDOM('', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const rectangles = Array.from({ length: RECTANGLES_PER_CYCLE }, (_, index) => index % 2 ? new window.DOMRectReadOnly(index, 2, -3, 4) : new window.DOMRect(index, 2, -3, 4));
  const snapshots = rectangles.map((rect) => rect.toJSON());
  const observed = { rectangles: rectangles.map((rect) => new WeakRef(rect)), documents: [new WeakRef(window.document)], windows: [new WeakRef(window)] };
  window.close(); return { rectangles, snapshots, observed };
}
/** @param {object} sample - Retained public objects. @returns {void} Verify outside any async frame holding loop owners. */
function verifyHeld(sample) {
  for (const [index, rect] of sample.rectangles.entries()) { assert.equal(rect.x, index); assert.equal(rect.left, index - 3); }
}
/** @returns {Promise<void>} Validate bounded release and persist complete scalar traces. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    for (const [engine, runtime] of Object.entries(engines)) for (const mode of ['default', 'vm']) {
      await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.();
      for (let cycle = 0; cycle < 3; cycle++) {
        const sample = fixture(runtime, mode); await collectGarbage(); verifyHeld(sample);
        const held = captureMemoryState(sample.observed, runtime); assert.equal(held.survivors.rectangles, RECTANGLES_PER_CYCLE);
        if (baseline) assert.equal(held.nativeTree.rectangles.live - baseline.rectangles.live, RECTANGLES_PER_CYCLE);
        sample.rectangles = null;
        const released = await waitForMemoryQuiescence({ label: `dom-rect-${engine}-${mode}-${cycle}`, sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        report.cycles.push({ engine, mode, held, released }); assert.equal(released.reached, true);
        assert.equal(sample.snapshots.length, RECTANGLES_PER_CYCLE); assert.equal(sample.snapshots.at(-1).x, RECTANGLES_PER_CYCLE - 1);
      }
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-dom-rect.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`); process.stdout.write(`${JSON.stringify({ pass: report.pass, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
