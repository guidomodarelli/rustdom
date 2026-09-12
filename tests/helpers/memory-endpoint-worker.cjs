/** @file Checks the real GC endpoint, including a deliberately retained closed Document. */
'use strict';
const assert = require('node:assert/strict');
const { captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {object} runtime - Real DOM engine. @returns {object} A closed fixture and weak observations. */
function createClosedFixture(runtime) {
  const dom = new runtime.JSDOM('<!doctype html><main><span>value</span></main>');
  const document = dom.window.document;
  document.querySelector('span').setAttribute('data-test', 'changed');
  const references = { documents: [new WeakRef(document)], windows: [new WeakRef(dom.window)],
    elements: [new WeakRef(document.querySelector('main')), new WeakRef(document.querySelector('span'))] };
  dom.window.close();
  return { document, references };
}

/** @returns {Promise<void>} Rejects retained fixtures and accepts them only after real collection. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const mode = process.argv[2];
  const runtime = require(mode === 'rustdom' ? '../../dist/index.cjs' : 'jsdom');
  const baseline = runtime.getNativeTreeStatistics?.();
  const cycles = [];
  for (let cycle = 0; cycle < 6; cycle++) {
    let fixture = createClosedFixture(runtime);
    const references = fixture.references;
    let retainedDocument = fixture.document;
    fixture = null;
    const sample = () => captureMemoryState(references, runtime);
    const retained = await waitForMemoryQuiescence({ label: `retained-${cycle}`, sample,
      expectedNative: baseline, maxRounds: 2 });
    assert.equal(retainedDocument.nodeType, 9);
    assert.equal(retained.reached, false, 'a strongly retained Document must fail the bounded endpoint');
    assert.equal(retained.state.survivors.documents, 1);
    if (baseline) assert.ok(retained.state.nativeTree.liveNodes > baseline.liveNodes);
    retainedDocument = null;
    const released = await waitForMemoryQuiescence({ label: `released-${cycle}`, sample, expectedNative: baseline });
    assert.equal(released.reached, true, JSON.stringify(released.trace));
    assert.deepEqual(released.state.survivors, { documents: 0, windows: 0, elements: 0 });
    if (baseline) {
      assert.equal(released.state.nativeTree.liveNodes, baseline.liveNodes);
      assert.equal(released.state.nativeTree.dataNodes, baseline.dataNodes);
      assert.equal(released.state.nativeTree.attributeCollections, baseline.attributeCollections);
    }
    // The reported terminal memory must be the same observation as the accepted liveness counts.
    assert.deepEqual(released.state.memory, released.trace.at(-1).memory);
    cycles.push({ cycle, retained, released });
  }
  process.stdout.write(JSON.stringify({ mode, node: process.version, pass: true, cycles }));
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
