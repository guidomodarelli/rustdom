/** @file Finite owner and native-state observations for repeated collapse/clone/mutation/close cycles. */
'use strict';
const assert = require('node:assert/strict');
const runtime = require('../../dist/index.cjs');
const { implForWrapper } = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const settings = require('./constants/range-collapse.cjs');

/** @returns {object} One held range plus weak observations; reports never retain heap objects. */
function fixture() {
  const dom = new runtime.JSDOM('<main>abcdefgh<span>ijklmnop</span></main>');
  const document = dom.window.document;
  const first = document.querySelector('main').firstChild;
  const second = document.querySelector('span').firstChild;
  const references = { window: [new WeakRef(dom.window)], document: [new WeakRef(document)], ranges: [], native: [] };
  let held;
  for (let index = 0; index < settings.rangesPerCycle; index++) {
    const range = document.createRange(); range.setStart(first, 1); range.setEnd(index % 2 ? second : first, 6);
    const clone = range.cloneRange(); range.collapse(Boolean(index % 2));
    clone.collapse(!Boolean(index % 2));
    first.insertData(0, '!'); first.deleteData(0, 1);
    for (const current of [range, clone]) {
      references.ranges.push(new WeakRef(current)); references.native.push(new WeakRef(implForWrapper(current)._nativeRange));
    }
    if (index === 0) held = range;
  }
  dom.window.close();
  return { held, references };
}

/** @returns {Promise<void>} Emits every retained/released scalar endpoint without accepting performance. */
async function main() {
  await collectGarbage(); const baseline = runtime.getNativeTreeStatistics(); const cycles = [];
  for (let cycle = 0; cycle < settings.cycles; cycle++) {
    let current = fixture(); let held = current.held;
    const references = current.references; current = null;
    const sample = () => captureMemoryState(references, runtime);
    const retained = await waitForMemoryQuiescence({ label: `collapse-held-${cycle}`, sample,
      expectedNative: baseline, maxRounds: settings.retainedMaxRounds });
    assert.equal(retained.reached, false); assert.ok(retained.state.survivors.ranges >= 1);
    assert.equal(held.collapsed, true); held = null;
    const released = await waitForMemoryQuiescence({ label: `collapse-released-${cycle}`, sample,
      expectedNative: baseline, maxRounds: settings.releaseMaxRounds, timeoutMs: settings.releaseTimeoutMs });
    assert.equal(released.reached, true, JSON.stringify(released.trace));
    assert.deepEqual(released.state.survivors, { window: 0, document: 0, ranges: 0, native: 0 });
    cycles.push({ cycle, retained, released });
  }
  process.stdout.write(JSON.stringify({ node: process.version, pass: true, baseline, cycles,
    limits: ['Observaciones finitas; no memoria pico ni garantía universal de ausencia de fugas'],
    benchmarkExecuted: false, performanceAccepted: null }) + '\n');
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
