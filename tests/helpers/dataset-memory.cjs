/** @file Verifies dataset ownership and detached primitive snapshots across repeated GC cycles. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @returns {object} Retained map, independent strings and weak DOM observations. */
function fixture() {
  const { window } = new runtime.JSDOM('<div></div>'); const element = window.document.querySelector('div'); const map = element.dataset;
  for (let index = 0; index < 1000; index++) map[`key${index}`] = `value${index}`;
  const keys = Object.keys(map); const values = Object.values(map);
  for (let index = 1; index < 1000; index++) delete map[`key${index}`];
  const observed = { documents: [new WeakRef(window.document)], windows: [new WeakRef(window)], elements: [new WeakRef(element)], maps: [new WeakRef(map)] };
  window.close(); return { map, keys, values, observed };
}

/** @param {object} sample - Strong view. @returns {void} Ends all strong loop bindings before async collection. */
function verifyHeld(sample) { assert.equal(sample.map.key0, 'value0'); assert.deepEqual(Object.keys(sample.map), ['key0']); }

/** @returns {Promise<void>} Save held/released scenarios and exact native liveness endpoints. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 6; cycle++) {
      const sample = fixture(); await collectGarbage(); verifyHeld(sample); sample.map = null;
      const released = await waitForMemoryQuiescence({ label: `dataset-${cycle}`, sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
      report.cycles.push(released); assert.equal(released.reached, true);
      assert.equal(sample.keys.length, 1000); assert.equal(sample.values.at(-1), 'value999');
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-dom-string-map.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`); process.stdout.write(`${JSON.stringify({ pass: report.pass, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
