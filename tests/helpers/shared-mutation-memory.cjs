/** @file Proves shared native payload wrappers do not keep independent public records or closed DOM roots alive. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @returns {object} Four public records reference two immutable native payload wrappers. */
function closedSharedRecords() {
  const dom = new runtime.JSDOM('<main flag="old"></main>'); const document = dom.window.document; const target = document.querySelector('main');
  const observers = [true, false, true, false].map((oldValue) => {
    const observer = new dom.window.MutationObserver(() => {}); observer.observe(target, { attributes: true, attributeOldValue: oldValue }); return observer;
  });
  target.setAttribute('flag', 'new'); const records = observers.map((observer) => observer.takeRecords()[0]);
  for (const observer of observers) observer.disconnect();
  const observed = { records: records.map((record) => new WeakRef(record)), nodes: [new WeakRef(target)],
    documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)] };
  dom.window.close(); return { records, retained: null, observed };
}

/** @returns {Promise<void>} Saves five complete hold/drop cycles with independent record and root observations. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const owner = closedSharedRecords(); await collectGarbage();
      assert.equal(runtime.getNativeTreeStatistics().mutationRecords.live, baseline.mutationRecords.live + 2);
      owner.retained = owner.records[0]; owner.records = null;
      const peersReleased = await waitForMemoryQuiescence({ label: `shared-peers-${cycle}`,
        sample: () => captureMemoryState({ records: owner.observed.records.slice(1) }, null) });
      assert.equal(peersReleased.reached, true); assert.equal(owner.retained.oldValue, 'old');
      assert.equal(runtime.getNativeTreeStatistics().mutationRecords.live, baseline.mutationRecords.live + 1);
      const held = captureMemoryState(owner.observed, runtime); assert.equal(held.survivors.records, 1); assert.equal(held.survivors.nodes, 1);
      owner.retained = null;
      const released = await waitForMemoryQuiescence({ label: `shared-final-${cycle}`,
        sample: () => captureMemoryState(owner.observed, runtime), expectedNative: baseline });
      assert.equal(released.reached, true); report.cycles.push({ peersReleased, held, released });
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-shared-mutation-bindings.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
