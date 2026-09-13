/** @file Separates native abort metadata from strongly connected signals, arbitrary reasons and host callbacks. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { NativeAbortState } = require('../../dist/native.cjs');
const utils = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {boolean} abort - Whether to propagate an arbitrary cyclic reason first. @param {boolean} retainSource - Whether to retain source algorithms rather than a composite. @returns {object} Metadata holder and weak observations. */
function retainedState(abort, retainSource) {
  const dom = new runtime.JSDOM('<button></button>'); const document = dom.window.document; const target = document.querySelector('button');
  const first = new dom.window.AbortController(); const second = new dom.window.AbortController();
  const combined = dom.window.AbortSignal.any([first.signal, second.signal]); const nested = dom.window.AbortSignal.any([combined]);
  const reason = { window: dom.window, document, signal: first.signal, nested };
  const callback = () => reason.document;
  target.addEventListener('go', callback, { signal: first.signal });
  utils.implForWrapper(first.signal)._addAlgorithm(callback);
  if (abort) first.abort(reason);
  const state = utils.implForWrapper(retainSource ? first.signal : combined)._abortState;
  const expectedAlgorithms = !abort && retainSource ? 2 : 0;
  const observed = { controllers: [new WeakRef(first), new WeakRef(second)],
    signals: [first.signal, second.signal, combined, nested].map((signal) => new WeakRef(signal)),
    reasons: [new WeakRef(reason)], callbacks: [new WeakRef(callback)],
    nodes: [new WeakRef(target)], documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)] };
  dom.window.close(); return { state, observed, expectedAlgorithms, aborted: abort };
}

/** @returns {Promise<void>} Saves five release cycles while preserving finite-test limitations. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const owner = retainedState(cycle % 2 === 1, cycle % 2 === 0);
      const ownersReleased = await waitForMemoryQuiescence({ label: `abort-owners-${cycle}`,
        sample: () => captureMemoryState(owner.observed, null) });
      assert.equal(ownersReleased.reached, true);
      const retained = NativeAbortState.statistics();
      assert.equal(retained.live, baseline.abortStates.live + 1); assert.equal(retained.links, baseline.abortStates.links);
      assert.equal(retained.algorithms, baseline.abortStates.algorithms + owner.expectedAlgorithms);
      assert.equal(owner.state.aborted, owner.aborted); owner.state.clearAlgorithms(); owner.state = null;
      const released = await waitForMemoryQuiescence({ label: `abort-native-${cycle}`,
        sample: () => captureMemoryState({}, runtime), expectedNative: baseline });
      assert.equal(released.reached, true); report.cycles.push({ ownersReleased, retained, released });
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-abort-state.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
