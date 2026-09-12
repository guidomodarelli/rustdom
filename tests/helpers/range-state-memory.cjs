/** @file Observes actual Range boxes and DOM ownership, including an unobserved retained native state. */
'use strict';
const assert = require('node:assert/strict');
const runtime = require('../../dist/index.cjs');
const { NativeRange } = require('../../dist/native.cjs');
const { implForWrapper } = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils');
const { captureMemoryState, waitForMemoryQuiescence, collectGarbage } = require('../../scripts/memory-endpoint.cjs');

/** @returns {Promise<object[]>} Verifies expired slots disappear while a document and a live Range remain owned. */
async function auditLiveDocumentSlots() {
  const dom = new runtime.JSDOM('<main>text</main><aside>other</aside>');
  try {
    const document = dom.window.document;
    const root = document.querySelector('main'); const other = document.querySelector('aside');
    const retained = document.createRange(); retained.selectNodeContents(root);
    const nodes = [document, root, root.firstChild, other].map(implForWrapper);
    await collectGarbage(); await collectGarbage();
    const baseline = runtime.getNativeTreeStatistics();
    const baselineSlots = nodes.map((node) => node._referencedRanges.size);
    const samples = [];
    /** @returns {void} End this frame before GC so no final loop-local Range remains live. */
    function createTransientRanges() {
      for (let index = 0; index < 1000; index++) {
        const transient = document.createRange();
        if (index % 4 === 1) transient.selectNodeContents(root);
        if (index % 4 === 2) { transient.setStart(root.firstChild, 0); transient.setEnd(root, 1); }
        if (index % 4 === 3) { transient.selectNodeContents(root); transient.selectNodeContents(other); }
      }
    }
    for (let batch = 0; batch < 4; batch++) {
      createTransientRanges();
      const sample = () => {
        const state = captureMemoryState({}, runtime);
        state.survivors.extraSlots = nodes.reduce((total, node, index) =>
          total + node._referencedRanges.size - baselineSlots[index], 0);
        return state;
      };
      const endpoint = await waitForMemoryQuiescence({ label: `live-document-${batch}`, sample, expectedNative: baseline });
      assert.equal(endpoint.reached, true, JSON.stringify(endpoint.trace));
      assert.deepEqual(nodes.map((node) => node._referencedRanges.size), baselineSlots);
      assert.equal(retained.startContainer, root); assert.equal(retained.endOffset, 1);
      assert.ok(implForWrapper(root)._referencedRanges.has(implForWrapper(retained)._weakRef));
      samples.push({ batch, slots: nodes.map((node) => node._referencedRanges.size), endpoint });
    }
    return samples;
  } finally { dom.window.close(); }
}

/** @returns {object} Closed window retained only through the returned live/static ranges. */
function fixture() {
  const dom = new runtime.JSDOM('<main>' + '<p>text</p>'.repeat(80) + '</main>');
  const document = dom.window.document;
  const text = document.querySelector('p').firstChild;
  const live = document.createRange(); live.selectNodeContents(text);
  const frozen = new dom.window.StaticRange({ startContainer: text, startOffset: 1, endContainer: text, endOffset: 3 });
  const references = { documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)],
    ranges: [new WeakRef(live), new WeakRef(frozen)],
    states: [new WeakRef(implForWrapper(live)._nativeRange), new WeakRef(implForWrapper(frozen)._nativeRange)] };
  const snapshots = [implForWrapper(live)._nativeRange.start, implForWrapper(frozen)._nativeRange.end];
  dom.window.close();
  return { live, frozen, references, snapshots };
}

/** @returns {Promise<void>} Prints only scalar observations and never retains nodes in reports. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const baseline = runtime.getNativeTreeStatistics();
  let heldNative = new NativeRange();
  // Empty WeakRef groups deliberately require the native lifetime counter to reject this sample.
  const nativeSample = () => captureMemoryState({}, runtime);
  const retainedNativeState = await waitForMemoryQuiescence({ label: 'held-native-range-state', sample: nativeSample,
    expectedNative: baseline, maxRounds: 2 });
  assert.equal(heldNative.start, null);
  assert.equal(retainedNativeState.reached, false);
  assert.equal(retainedNativeState.state.nativeTree.rangeStates.live, baseline.rangeStates.live + 1);
  heldNative = null;
  const releasedNativeState = await waitForMemoryQuiescence({ label: 'released-native-range-state', sample: nativeSample, expectedNative: baseline });
  assert.equal(releasedNativeState.reached, true);
  const liveDocumentSlots = await auditLiveDocumentSlots();
  const afterLiveDocument = await waitForMemoryQuiescence({ label: 'after-live-document', sample: nativeSample, expectedNative: baseline });
  assert.equal(afterLiveDocument.reached, true);
  const cycles = []; const retainedSnapshots = [];
  for (let cycle = 0; cycle < 6; cycle++) {
    let current = fixture();
    let heldLive = current.live; let heldStatic = current.frozen;
    const references = current.references;
    retainedSnapshots.push(...current.snapshots); current = null;
    const sample = () => captureMemoryState(references, runtime);
    const retained = await waitForMemoryQuiescence({ label: `held-ranges-${cycle}`, sample, expectedNative: baseline, maxRounds: 2 });
    assert.equal(retained.reached, false); assert.equal(retained.state.survivors.ranges, 2);
    assert.equal(typeof heldLive.startOffset, 'number');
    heldLive = null;
    const staticOnly = await waitForMemoryQuiescence({ label: `held-static-${cycle}`, sample, expectedNative: baseline, maxRounds: 3 });
    assert.equal(heldStatic.startOffset, 1); assert.equal(staticOnly.reached, false);
    assert.equal(staticOnly.state.survivors.ranges, 1);
    assert.equal(staticOnly.state.nativeTree.rangeStates.live, baseline.rangeStates.live + 1);
    heldStatic = null;
    const released = await waitForMemoryQuiescence({ label: `released-ranges-${cycle}`, sample, expectedNative: baseline });
    assert.equal(released.reached, true, JSON.stringify(released.trace));
    assert.deepEqual(released.state.survivors, { documents: 0, windows: 0, ranges: 0, states: 0 });
    assert.equal(released.state.nativeTree.rangeStates.live, baseline.rangeStates.live);
    cycles.push({ cycle, retained, staticOnly, released });
  }
  assert.equal(retainedSnapshots.length, 12);
  process.stdout.write(JSON.stringify({ node: process.version, pass: true, retainedNativeState, releasedNativeState,
    cycles, liveDocumentSlots, afterLiveDocument, retainedSnapshots: retainedSnapshots.length, nativeRanges: NativeRange.statistics() }));
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
