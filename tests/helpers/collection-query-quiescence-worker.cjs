/** @file Exercises delayed and persistent ownership using real live collections in default and VM realms. */
'use strict';
const assert = require('node:assert/strict');
const { captureMemoryState, collectGarbage, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const { waitForCollectionQuiescence } = require('./collection-query-quiescence.cjs');

/** @param {object} runtime - Real DOM engine. @param {string} mode - Default or VM realm. @returns {object} A sole strong collection owner and independent weak observations. */
function fixture(runtime, mode) {
  const { window } = new runtime.JSDOM('<!doctype html><head></head><body></body>',
    mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const root = window.document.createElement('section');
  window.document.head.append(root);
  root.innerHTML = '<span>one</span><span>two</span>';
  const held = root.getElementsByTagName('span');
  assert.equal(held.length, 2);
  const groups = { windows: [new WeakRef(window)], documents: [new WeakRef(window.document)],
    collections: [new WeakRef(held)], roots: [new WeakRef(root)] };
  window.close();
  return { held, groups };
}

/** @returns {Promise<void>} Reject persistent retention and require two genuine clear endpoints after late release. */
async function main() {
  const engine = process.argv[2];
  assert.ok(engine === 'jsdom' || engine === 'rustdom');
  const runtime = require(process.argv[3] || (engine === 'jsdom' ? 'jsdom' : '../../dist/index.cjs'));
  const cases = [];
  for (const mode of ['default', 'vm']) {
    await collectGarbage();
    const baseline = runtime.getNativeTreeStatistics?.();
    let sample = fixture(runtime, mode);
    const references = sample.groups;
    let held = sample.held;
    sample = null;
    let observations = 0;
    const delayedSampler = () => {
      observations++;
      if (observations <= 12) assert.equal(held.length, 2);
      const state = captureMemoryState(references, runtime);
      if (observations === 12) held = null;
      return state;
    };
    const released = await waitForCollectionQuiescence({ label: `${engine}-${mode}-late-release`,
      sample: delayedSampler, expectedNative: baseline });
    assert.equal(released.reached, true, JSON.stringify(released));
    assert.ok(released.trace.length >= 14);
    assert.ok(released.trace.slice(0, 12).every((state) => !state.clear && state.survivors.collections === 1));
    assert.ok(released.trace.slice(-2).every((state) => state.clear));

    sample = fixture(runtime, mode);
    const persistentReferences = sample.groups;
    held = sample.held;
    sample = null;
    const persistentSampler = () => {
      assert.equal(held.length, 2);
      return captureMemoryState(persistentReferences, runtime);
    };
    const original = await waitForMemoryQuiescence({ label: `${engine}-${mode}-original-cap`,
      sample: persistentSampler, expectedNative: baseline });
    assert.equal(original.reached, false);
    const retained = await waitForCollectionQuiescence({ label: `${engine}-${mode}-persistent-retention`,
      sample: persistentSampler, expectedNative: baseline });
    assert.equal(retained.reached, false);
    assert.equal(retained.state.survivors.collections, 1);
    assert.equal(retained.state.survivors.documents, 1);
    held = null;
    const cleanup = await waitForCollectionQuiescence({ label: `${engine}-${mode}-finally-released`,
      sample: () => captureMemoryState(persistentReferences, runtime), expectedNative: baseline });
    assert.equal(cleanup.reached, true, JSON.stringify(cleanup));
    cases.push({ mode, released, original, retained, cleanup });
  }
  process.stdout.write(`${JSON.stringify({ pass: true, engine, node: process.version, cases })}\n`);
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
