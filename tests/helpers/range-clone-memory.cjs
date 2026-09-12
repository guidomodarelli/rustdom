/** @file Checks numeric controller ownership and actual DOM cleanup across successful and rejected clones. */
'use strict';
const assert = require('node:assert/strict');
const runtime = require('../../dist/index.cjs');
const { NativeTree, NativeRange, NativeRangeClone } = require('../../dist/native.cjs');
const { captureMemoryState, collectGarbage, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @returns {object} Retained controller with only weak observations of its source state and tree. */
function retainedController() {
  const tree = new NativeTree(); const source = tree.allocate(); tree.setCharacterData(source, 3, 'source');
  const state = new NativeRange(); state.setStart(source, 1); state.setEnd(source, 3);
  const operation = new NativeRangeClone(state); tree.rangeCloneStep(operation, 0);
  return { operation, references: { trees: [new WeakRef(tree)], states: [new WeakRef(state)], operations: [new WeakRef(operation)] } };
}
/** @returns {object} Weak references to public DOM results after success and failure. */
function cloneBatch() {
  const dom = new runtime.JSDOM('<!doctype html><main><b>left</b><i>right</i></main>');
  const document = dom.window.document; const root = document.querySelector('main');
  const range = document.createRange(); range.setStart(root.firstChild.firstChild, 1); range.setEnd(root.lastChild.firstChild, 2);
  const fragments = [];
  for (let index = 0; index < 100; index++) {
    const fragment = range.cloneContents(); assert.equal(fragment.textContent, 'eftri'); fragments.push(new WeakRef(fragment));
  }
  range.selectNodeContents(document);
  for (let index = 0; index < 20; index++) assert.throws(() => range.cloneContents(), { name: 'HierarchyRequestError' });
  const references = { documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)], ranges: [new WeakRef(range)], fragments };
  dom.window.close(); return references;
}

/** @returns {Promise<void>} Emits finite GC evidence including a deliberately retained negative control. */
async function main() {
  assert.equal(typeof global.gc, 'function'); await collectGarbage();
  const baseline = runtime.getNativeTreeStatistics();
  let retained = retainedController(); const references = retained.references;
  const held = await waitForMemoryQuiescence({ label: 'held-clone-controller',
    sample: () => captureMemoryState(references, runtime), expectedNative: baseline, maxRounds: 2 });
  assert.equal(held.reached, false); assert.equal(held.state.survivors.operations, 1);
  assert.equal(held.state.survivors.trees, 0); assert.equal(held.state.survivors.states, 0);
  assert.equal(held.state.nativeTree.rangeClones.live, baseline.rangeClones.live + 1);
  retained.operation.cancel(); retained = null;
  const released = await waitForMemoryQuiescence({ label: 'released-clone-controller',
    sample: () => captureMemoryState(references, runtime), expectedNative: baseline });
  assert.equal(released.reached, true);
  const cycles = [];
  for (let index = 0; index < 5; index++) {
    const weak = cloneBatch();
    const endpoint = await waitForMemoryQuiescence({ label: `clone-dom-${index}`,
      sample: () => captureMemoryState(weak, runtime), expectedNative: baseline });
    assert.equal(endpoint.reached, true, JSON.stringify(endpoint.trace)); cycles.push(endpoint);
  }
  const final = runtime.getNativeTreeStatistics();
  process.stdout.write(JSON.stringify({ capturedAt: new Date().toISOString(), node: process.version, pass: true,
    methodology: 'Hold a numeric clone controller while its source tree/state must collect, then release it. Five batches each run 100 public partial clones and 20 doctype rejections; require two clear major-GC samples and exact native lifetime baseline.',
    limitations: 'Finite retention test, not peak-memory analysis or a universal leak guarantee.', baseline, held, released, cycles, final }));
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
