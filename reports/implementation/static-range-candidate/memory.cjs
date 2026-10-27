/** @file Observes StaticRange native and DOM lifetimes with retained controls and complete scalar traces. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { cycleCount, transientStatesPerCycle, retainedControlRounds } = require('./constants/probe.cjs');
const source = process.env.RUSTDOM_STATIC_RANGE_SOURCE;
if (!source) throw new Error('StaticRange memory probe requires RUSTDOM_STATIC_RANGE_SOURCE');
const runtime = require(path.join(source, 'dist/index.cjs'));
const native = require(path.join(source, 'dist/native.cjs'));
const { captureMemoryState, collectGarbage, waitForMemoryQuiescence } = require(path.join(source, 'scripts/memory-endpoint.cjs'));

/** @param {number} cycle - Cycle label. @returns {object} One retained owner and weak observations. */
function createCycle(cycle) {
  const dom = new runtime.JSDOM('<!doctype html><main>abcdef</main>');
  const { window } = dom;
  const text = window.document.querySelector('main').firstChild;
  const retained = new window.StaticRange({ startContainer: text, startOffset: 1, endContainer: text, endOffset: 3 });
  const references = { windows: [new WeakRef(window)], documents: [new WeakRef(window.document)],
    ranges: [new WeakRef(retained)] };
  const beforeRejected = native.NativeRange.statistics();
  for (let index = 0; index < transientStatesPerCycle; index++) {
    const transient = new window.StaticRange({ startContainer: text, startOffset: index,
      endContainer: window.document, endOffset: 0 });
    references.ranges.push(new WeakRef(transient));
    assert.throws(() => new window.StaticRange({ startContainer: window.document.doctype, startOffset: 0,
      endContainer: text, endOffset: 0 }), { name: 'InvalidNodeTypeError' });
  }
  assert.equal(native.NativeRange.statistics().created - beforeRejected.created, transientStatesPerCycle);
  window.close();
  return { cycle, retained, references };
}

async function main() {
  await collectGarbage();
  const baseline = runtime.getNativeTreeStatistics();
  const initialMemory = process.memoryUsage();
  const results = [];
  for (let cycle = 0; cycle < cycleCount; cycle++) {
    let { retained, references } = createCycle(cycle);
    const sample = () => captureMemoryState(references, runtime);
    const held = await waitForMemoryQuiescence({ label: 'held-static-' + cycle, sample,
      expectedNative: baseline, maxRounds: retainedControlRounds });
    assert.equal(held.reached, false);
    assert.equal(held.state.survivors.windows, 1);
    assert.equal(held.state.survivors.documents, 1);
    assert.equal(held.state.survivors.ranges, 1);
    assert.equal(retained.startOffset, 1);
    retained = null;
    const released = await waitForMemoryQuiescence({ label: 'released-static-' + cycle, sample, expectedNative: baseline });
    assert.equal(released.reached, true, JSON.stringify(released.trace));
    assert.deepEqual(released.state.survivors, { windows: 0, documents: 0, ranges: 0 });
    results.push({ cycle, held, released });
  }
  process.stdout.write(JSON.stringify({ node: process.version, pass: true, cycles: results,
    baseline, nativeRanges: native.NativeRange.statistics(), initialMemory, finalMemory: process.memoryUsage(),
    scope: { windows: cycleCount, documents: cycleCount, successfulStates: cycleCount * (transientStatesPerCycle + 1),
      invalidNodeRejections: cycleCount * transientStatesPerCycle },
    limitations: 'Finite retained-resource observations; snapshots do not measure peak memory or prove universal absence of leaks' }));
}

main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
