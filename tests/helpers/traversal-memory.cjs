/** @file Verifies V8 ownership and native cursor/operation release, including throwing callbacks. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {boolean} throwing - Exercise cancellation by unwinding. @returns {object} Retained cursors and weak independent observations. */
function fixture(throwing) {
  const { window } = new runtime.JSDOM('<main><a>A<b>B</b></a><p>P</p></main>');
  const root = window.document.querySelector('main');
  const filter = (node) => { if (throwing) throw new Error('traversal memory callback'); return node.nodeType === 1 ? 1 : 3; };
  const iterator = window.document.createNodeIterator(root, 0xffffffff, filter);
  const walker = window.document.createTreeWalker(root, 0xffffffff, filter);
  if (throwing) { assert.throws(() => iterator.nextNode(), /traversal memory callback/); assert.throws(() => walker.nextNode(), /traversal memory callback/); }
  else { assert.equal(iterator.nextNode(), root); assert.equal(walker.nextNode(), root.firstChild); }
  const observed = { windows: [new WeakRef(window)], documents: [new WeakRef(window.document)], roots: [new WeakRef(root)],
    filters: [new WeakRef(filter)], cursors: [new WeakRef(iterator), new WeakRef(walker)] };
  root.remove(); window.close();
  return { retained: [iterator, walker], observed };
}

/** @returns {Promise<void>} Preserve ownership while retained, then verify collection after release. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 8; cycle++) {
      const sample = fixture(cycle % 2 === 1);
      await collectGarbage();
      assert.equal(sample.retained[0].root.textContent, 'ABP');
      assert.equal(sample.retained[1].root, sample.retained[0].root);
      assert.equal(runtime.getNativeTreeStatistics().traversals.operations, baseline.traversals.operations);
      const retainedState = captureMemoryState(sample.observed, runtime);
      assert.equal(retainedState.survivors.cursors, 2); assert.equal(retainedState.survivors.filters, 1);
      sample.retained = null;
      const released = await waitForMemoryQuiescence({ label: `traversal-${cycle}`, sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
      report.cycles.push({ retainedState, released }); assert.equal(released.reached, true);
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-tree-traversal.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
