/** @file Exercises listener removal and native-only retention without mocking callback or platform ownership. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { NativeListenerRegistry } = require('../../dist/native.cjs');
const utils = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
/** Simultaneous registrations exercise high-water capacity before removal. */
const BURST_SIZE = 500;

/** @returns {object} Native registry with metadata whose callback owners have been dropped. */
function retainedRegistry() {
  const dom = new runtime.JSDOM('<main></main>'); const document = dom.window.document; const target = document.querySelector('main');
  const listener = { target, document, window: dom.window, handleEvent() {} };
  const callback = () => document.body; const controller = new dom.window.AbortController();
  target.addEventListener('held', listener, { signal: controller.signal });
  target.addEventListener('held', callback); target.addEventListener('other', listener, true);
  const registry = utils.implForWrapper(target)._eventListeners.native;
  const observed = { callbacks: [new WeakRef(listener), new WeakRef(callback)], signals: [new WeakRef(controller.signal)],
    nodes: [new WeakRef(target)], documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)] };
  dom.window.close(); return { registry, observed };
}

/** @param {EventTarget} target - Live target with a persistent anchor listener. @param {boolean} sharedType - Whether the burst shares the anchor bucket. @returns {WeakRef[]} Removed callback observations. */
function removeBurst(target, sharedType) {
  const registrations = Array.from({ length: BURST_SIZE }, (_, index) => {
    const callback = () => index; const type = sharedType ? 'anchor' : `removed-${index}\ud800`;
    target.addEventListener(type, callback); return { type, callback };
  });
  for (const { type, callback } of registrations) target.removeEventListener(type, callback);
  return registrations.map(({ callback }) => new WeakRef(callback));
}

/** @returns {Promise<void>} Saves five cycles and complete quiescence traces, including failed attempts. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const owner = retainedRegistry();
      const ownersReleased = await waitForMemoryQuiescence({ label: `listener-owners-${cycle}`,
        sample: () => captureMemoryState(owner.observed, null) });
      assert.equal(ownersReleased.reached, true);
      assert.equal(NativeListenerRegistry.statistics().live, baseline.listenerRegistries.live + 1);
      assert.equal(owner.registry.storageStatistics().listeners, 3); assert.equal(owner.registry.snapshot('held').length, 2);
      owner.registry = null;
      const released = await waitForMemoryQuiescence({ label: `listener-native-${cycle}`,
        sample: () => captureMemoryState({}, runtime), expectedNative: baseline });
      assert.equal(released.reached, true);
      report.cycles.push({ ownersReleased, released });
    }
    let dom = new runtime.JSDOM('<body></body>'); let target = dom.window.document.createElement('section');
    let anchor = () => {}; target.addEventListener('anchor', anchor);
    report.bursts = [];
    for (const sharedType of [false, true]) {
      const callbacks = removeBurst(target, sharedType);
      const released = await waitForMemoryQuiescence({ label: `listener-burst-${sharedType}`,
        sample: () => captureMemoryState({ callbacks }, null) });
      assert.equal(released.reached, true);
      const statistics = utils.implForWrapper(target)._eventListeners.native.storageStatistics();
      assert.equal(statistics.listeners, 1); assert.equal(statistics.eventTypes, 1); assert.equal(statistics.callbacks, 1);
      for (const capacity of ['recordsCapacity', 'typesCapacity', 'callbacksCapacity', 'bucketCapacity']) assert.ok(statistics[capacity] <= 64);
      report.bursts.push({ sharedType, released, statistics });
    }
    target.removeEventListener('anchor', anchor); dom.window.close(); target = null; anchor = null; dom = null;
    report.final = await waitForMemoryQuiescence({ label: 'listener-burst-final', sample: () => captureMemoryState({}, runtime), expectedNative: baseline });
    assert.equal(report.final.reached, true); report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-event-listeners.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
