/** @file Verifies that persistent ESM addon exports do not retain NativeRange or NativeTree instances. */
import assert from 'node:assert/strict';
import runtime from '../../dist/index.mjs';
import nativeRuntime, { NativeRange, NativeTree, RangeSurroundStatus } from '../../dist/native.mjs';
import { captureMemoryState, collectGarbage, waitForMemoryQuiescence } from '../../scripts/memory-endpoint.cjs';

/** Retain only weak observations after a completed synchronous allocation frame.
 * @param {number} count - Number of original/copied native state pairs.
 * @returns {{ trees: WeakRef<object>[], states: WeakRef<object>[] }} Weak handles to every created instance.
 */
function createTransientStates(count) {
  const tree = new NativeTree();
  const parent = tree.allocate(); tree.setHtmlElement(parent, 'section', []);
  const text = tree.allocate(); tree.setCharacterData(text, 3, 'native ESM');
  tree.append(parent, text);
  const states = [];
  for (let index = 0; index < count; index++) {
    const state = new NativeRange();
    state.setStart(text, 0); state.setEnd(text, 6);
    assert.equal(tree.rangeSurroundStatus(state, parent), RangeSurroundStatus.Ready);
    assert.equal(tree.rangeTextFromState(state), 'native');
    const copied = state.copy(); copied.setStart(text, 1);
    assert.equal(state.startOffset, 0);
    states.push(new WeakRef(state), new WeakRef(copied));
  }
  tree.release(text); tree.release(parent);
  assert.equal(tree.statistics().liveNodes, 0);
  return { trees: [new WeakRef(tree)], states };
}

/** @returns {Promise<void>} Checks a retained negative control and repeated finalization without unloading ESM exports. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  assert.equal(nativeRuntime.NativeRange, NativeRange);
  await collectGarbage();
  const baseline = runtime.getNativeTreeStatistics();
  const baselineMemory = process.memoryUsage();
  let retained = new NativeRange();
  const retainedReferences = { states: [new WeakRef(retained)] };
  const retainedSample = () => captureMemoryState(retainedReferences, runtime);
  const held = await waitForMemoryQuiescence({ label: 'held-esm-state', sample: retainedSample,
    expectedNative: baseline, maxRounds: 2 });
  assert.equal(retained.start, null);
  assert.equal(held.reached, false); assert.equal(held.state.survivors.states, 1);
  retained = null;
  const released = await waitForMemoryQuiescence({ label: 'released-esm-state', sample: retainedSample,
    expectedNative: baseline });
  assert.equal(released.reached, true);

  const cycles = [];
  for (let batch = 0; batch < 5; batch++) {
    const references = createTransientStates(200);
    const endpoint = await waitForMemoryQuiescence({ label: 'esm-state-batch-' + batch,
      sample: () => captureMemoryState(references, runtime), expectedNative: baseline });
    assert.equal(endpoint.reached, true, JSON.stringify(endpoint.trace));
    assert.deepEqual(endpoint.state.survivors, { trees: 0, states: 0 });
    cycles.push(endpoint);
  }
  const finalMemory = process.memoryUsage();
  const ranges = NativeRange.statistics();
  assert.equal(ranges.live, baseline.rangeStates.live);
  assert.equal(ranges.created - baseline.rangeStates.created, 2001);
  assert.equal(ranges.released - baseline.rangeStates.released, 2001);
  process.stdout.write(JSON.stringify({ capturedAt: new Date().toISOString(), node: process.version, pass: true,
    methodology: 'Named/default ESM exports stay imported. Negative control retains one state; five batches allocate 200 state/copy pairs and one tree each, explicitly release tree handles, then require two clear major-GC samples with no weak survivors and exact native lifetime baseline.',
    limitations: 'Finite retained-memory test; no peak-memory or universal leak guarantee. Heap and RSS include runtime/allocator retention.',
    held, released, cycles, ranges, baseline: { native: baseline, memory: baselineMemory }, finalMemory }));
}
main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
