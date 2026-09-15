/** @file Measures retained observers independently from their former targets, documents and windows. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
/** Run each engine in its own process; reference retention is evidence, not the desired lifetime contract. */
const engine = process.argv[2] || 'rustdom';
const runtime = engine === 'jsdom' ? require('jsdom') : require('../../dist/index.cjs');

/** @param {boolean} disconnect - Remove registrations before dropping the only target reference. @returns {object} One deliberately retained observer and weak observations. */
function retainedObserver(disconnect) {
  const dom = new runtime.JSDOM('<body></body>'); const document = dom.window.document;
  const target = document.createElement('section');
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(target, { childList: true, attributes: true, subtree: true });
  if (disconnect) observer.disconnect();
  const observed = { observers: [new WeakRef(observer)], nodes: [new WeakRef(target)],
    documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)] };
  dom.window.close(); return { observer, observed };
}

/** @returns {object} A live target must keep its registered observer and callback operational. */
function retainedTarget() {
  const dom = new runtime.JSDOM('<main></main>'); const document = dom.window.document;
  const target = document.querySelector('main'); const deliveries = { count: 0 };
  const observer = new dom.window.MutationObserver((records) => { deliveries.count += records.length; });
  observer.observe(target, { attributes: true });
  return { dom, target, deliveries, observed: { observers: [new WeakRef(observer)], nodes: [new WeakRef(target)],
    documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)] } };
}

/** @returns {Promise<void>} Saves both intentional observer retention and terminal release without keeping target objects in reports. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const report = { capturedAt: new Date().toISOString(), node: process.version, engine, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.();
    for (const disconnect of [true, false]) {
      const owner = retainedObserver(disconnect);
      const targetReleased = await waitForMemoryQuiescence({ label: `observer-target-${disconnect}`, maxRounds: 4,
        sample: () => captureMemoryState({ nodes: owner.observed.nodes }, null) });
      const held = captureMemoryState(owner.observed, runtime);
      assert.equal(held.survivors.observers, 1);
      owner.observer = null;
      const released = await waitForMemoryQuiescence({ label: `observer-released-${disconnect}`,
        sample: () => captureMemoryState(owner.observed, runtime), expectedNative: baseline });
      report.cycles.push({ disconnect, targetReleased, held, released });
      assert.equal(released.reached, true);
      if (engine === 'rustdom') {
        assert.equal(targetReleased.reached, true, 'A retained observer must not retain an otherwise unreachable target');
        assert.equal(held.nativeTree.mutationObservers.observers, baseline.mutationObservers.observers + 1);
        assert.equal(held.nativeTree.mutationObservers.observedNodes, baseline.mutationObservers.observedNodes);
        assert.equal(held.nativeTree.mutationObservers.registrations, baseline.mutationObservers.registrations);
      }
    }
    const targetOwner = retainedTarget();
    const observerHeld = await waitForMemoryQuiescence({ label: 'observer-owned-by-target', maxRounds: 2,
      sample: () => captureMemoryState({ observers: targetOwner.observed.observers }, null) });
    assert.equal(observerHeld.reached, false); assert.equal(observerHeld.state.survivors.observers, 1);
    targetOwner.target.setAttribute('flag', 'after collection');
    await new Promise((resolve) => setImmediate(resolve)); assert.equal(targetOwner.deliveries.count, 1);
    targetOwner.dom.window.close(); targetOwner.dom = null; targetOwner.target = null;
    const targetOwnerReleased = await waitForMemoryQuiescence({ label: 'target-and-observer-released',
      sample: () => captureMemoryState(targetOwner.observed, runtime), expectedNative: baseline });
    report.liveTarget = { observerHeld, delivered: targetOwner.deliveries.count, released: targetOwnerReleased };
    assert.equal(targetOwnerReleased.reached, true);
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-observer-registration-${engine}.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, path, cycles: report.cycles.length,
    liveTargetDelivered: report.liveTarget?.delivered, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
