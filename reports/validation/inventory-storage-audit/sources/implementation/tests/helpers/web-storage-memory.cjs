/** @file Tracks Storage owners separately from native area/cursor lifetimes and retained primitive snapshots. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const runtime = require('../../dist/index.cjs');
const { NativeStorageArea } = require('../../dist/native.cjs');
const engines = { jsdom: require('jsdom'), rustdom: runtime };
const ENTRY_COUNT = 1000;

/** @returns {Promise<void>} Drain real storage notifications before ownership measurements. */
async function flushEvents() { for (let turn = 0; turn < 2; turn++) await new Promise((resolve) => setTimeout(resolve, 0)); }
/** @param {object} engine - Actual runtime. @returns {object} Closed origin group with one intentionally retained Storage wrapper. */
function publicFixture(engine) {
  const { window } = new engine.JSDOM('<iframe></iframe>', { url: 'https://memory.example.test/' });
  const peer = window.document.querySelector('iframe').contentWindow; const storage = window.localStorage;
  for (let index = 0; index < ENTRY_COUNT; index++) storage.setItem(`key${index}`, `value${index}\ud800`);
  window.sessionStorage.setItem('other', 'session'); const keys = Object.keys(storage); const values = keys.map((key) => storage.getItem(key));
  for (let index = 1; index < ENTRY_COUNT; index++) storage.removeItem(`key${index}`);
  const observed = { documents: [new WeakRef(window.document), new WeakRef(peer.document)], windows: [new WeakRef(window), new WeakRef(peer)],
    storages: [new WeakRef(storage), new WeakRef(window.sessionStorage), new WeakRef(peer.localStorage), new WeakRef(peer.sessionStorage)] };
  window.close(); return { storage, keys, values, observed };
}
/** @param {object} sample - Closed but retained Storage. @returns {void} Verify without keeping a target in an async loop binding. */
function verifyHeld(sample) { assert.equal(sample.storage.getItem('key0'), 'value0\ud800'); assert.equal(sample.storage.length, 1); }
/** @returns {object} A cursor that owns primitive Rust data independently of the JavaScript area wrapper. */
function cursorFixture() {
  const area = new NativeStorageArea(); area.set('a', 'value'); area.set('b', '\ud800'); const cursor = area.keyCursor();
  return { cursor, areaReference: new WeakRef(area), cursorReference: new WeakRef(cursor) };
}

/** @returns {Promise<void>} Save repeated real GC endpoints and retained memory observations. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, publicCycles: [], cursorCycles: [] };
  try {
    for (const [name, engine] of Object.entries(engines)) {
      await collectGarbage(); const baseline = engine.getNativeTreeStatistics?.();
      for (let cycle = 0; cycle < 3; cycle++) {
        const sample = publicFixture(engine); await flushEvents(); await collectGarbage(); verifyHeld(sample);
        const held = captureMemoryState(sample.observed, engine); sample.storage = null;
        const released = await waitForMemoryQuiescence({ label: `storage-${name}-${cycle}`, sample: () => captureMemoryState(sample.observed, engine), expectedNative: baseline });
        report.publicCycles.push({ name, held, released }); assert.equal(released.reached, true);
        assert.equal(sample.keys.length, ENTRY_COUNT); assert.equal(sample.values.at(-1), `value${ENTRY_COUNT - 1}\ud800`);
      }
    }
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 6; cycle++) {
      const sample = cursorFixture(); await collectGarbage();
      assert.equal(sample.areaReference.deref(), undefined); assert.equal(NativeStorageArea.statistics().live, baseline.webStorage.live + 1);
      assert.equal(sample.cursor.next(), 'a'); assert.equal(sample.cursor.next(), 'b'); assert.equal(sample.cursor.next(), null);
      const expectedWithCursor = { ...baseline, webStorage: { ...baseline.webStorage, cursors: baseline.webStorage.cursors + 1 } };
      const exhausted = await waitForMemoryQuiescence({ label: `storage-cursor-exhausted-${cycle}`, sample: () => captureMemoryState({ areas: [sample.areaReference] }, runtime), expectedNative: expectedWithCursor });
      assert.equal(exhausted.reached, true); sample.cursor = null;
      const released = await waitForMemoryQuiescence({ label: `storage-cursor-released-${cycle}`, sample: () => captureMemoryState({ cursors: [sample.cursorReference] }, runtime), expectedNative: baseline });
      report.cursorCycles.push({ exhausted, released }); assert.equal(released.reached, true);
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-web-storage.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`); process.stdout.write(`${JSON.stringify({ pass: report.pass, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
