/** @file Checks numeric content-controller ownership and actual DOM cleanup after success and rejection. */
'use strict';
const assert = require('node:assert/strict');
const runtime = require('../../dist/index.cjs');
const { NativeTree, NativeRange, NativeRangeClone, NativeRangeExtract } = require('../../dist/native.cjs');
const { captureMemoryState, collectGarbage, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** Real operation vocabulary; extraction resets its source before each destructive call. */
const MODES = {
  clone: { Constructor: NativeRangeClone, step: 'rangeCloneStep', method: 'cloneContents', counter: 'rangeClones' },
  extract: { Constructor: NativeRangeExtract, step: 'rangeExtractStep', method: 'extractContents', counter: 'rangeExtracts' },
};
/** @param {object} mode - Native operation configuration. @returns {object} Retained controller with weak source observations. */
function retainedController(mode) {
  const tree = new NativeTree(); const source = tree.allocate(); tree.setCharacterData(source, 3, 'source');
  const state = new NativeRange(); state.setStart(source, 1); state.setEnd(source, 3);
  const operation = new mode.Constructor(state); tree[mode.step](operation, 0);
  return { operation, references: { trees: [new WeakRef(tree)], states: [new WeakRef(state)], operations: [new WeakRef(operation)] } };
}
/** @param {object} mode - Native operation configuration. @returns {object} Weak references after success and failure. */
function contentBatch(mode) {
  const dom = new runtime.JSDOM('<!doctype html><main><b>left</b><i>right</i></main>');
  const document = dom.window.document; const root = document.querySelector('main');
  const range = document.createRange(); range.setStart(root.firstChild.firstChild, 1); range.setEnd(root.lastChild.firstChild, 2);
  const fragments = [];
  for (let index = 0; index < 100; index++) {
    if (mode.method === 'extractContents') {
      root.innerHTML = '<b>left</b><i>right</i>';
      range.setStart(root.firstChild.firstChild, 1); range.setEnd(root.lastChild.firstChild, 2);
    }
    const fragment = range[mode.method](); assert.equal(fragment.textContent, 'eftri'); fragments.push(new WeakRef(fragment));
  }
  range.selectNodeContents(document);
  for (let index = 0; index < 20; index++) assert.throws(() => range[mode.method](), { name: 'HierarchyRequestError' });
  const references = { documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)], ranges: [new WeakRef(range)], fragments };
  dom.window.close(); return references;
}

/** @returns {Promise<void>} Emits finite GC evidence including a deliberately retained negative control. */
async function main() {
  const name = process.argv[2] || 'clone'; const mode = MODES[name]; assert.ok(mode, 'Unknown content memory mode');
  assert.equal(typeof global.gc, 'function'); await collectGarbage();
  const baseline = runtime.getNativeTreeStatistics();
  let retained = retainedController(mode); const references = retained.references;
  const held = await waitForMemoryQuiescence({ label: `held-${name}-controller`,
    sample: () => captureMemoryState(references, runtime), expectedNative: baseline, maxRounds: 2 });
  assert.equal(held.reached, false); assert.equal(held.state.survivors.operations, 1);
  assert.equal(held.state.survivors.trees, 0); assert.equal(held.state.survivors.states, 0);
  assert.equal(held.state.nativeTree[mode.counter].live, baseline[mode.counter].live + 1);
  retained.operation.cancel(); retained = null;
  const released = await waitForMemoryQuiescence({ label: `released-${name}-controller`,
    sample: () => captureMemoryState(references, runtime), expectedNative: baseline });
  assert.equal(released.reached, true);
  const cycles = [];
  for (let index = 0; index < 5; index++) {
    const weak = contentBatch(mode);
    const endpoint = await waitForMemoryQuiescence({ label: `${name}-dom-${index}`,
      sample: () => captureMemoryState(weak, runtime), expectedNative: baseline });
    assert.equal(endpoint.reached, true, JSON.stringify(endpoint.trace)); cycles.push(endpoint);
  }
  const final = runtime.getNativeTreeStatistics();
  process.stdout.write(JSON.stringify({ capturedAt: new Date().toISOString(), node: process.version, mode: name, pass: true,
    methodology: 'Hold a numeric content controller while its source tree/state must collect, then release it. Five batches each run 100 public partial content operations and 20 doctype rejections; require two clear major-GC samples and exact native lifetime baseline.',
    limitations: 'Finite retention test, not peak-memory analysis or a universal leak guarantee.', baseline, held, released, cycles, final }));
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
