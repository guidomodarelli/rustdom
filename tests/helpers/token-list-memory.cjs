/** @file Exercises retained DOMTokenLists and native set snapshots with separate owner GC observations. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const native = require('../../dist/native.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @returns {object} Live lists plus weak owner observations. */
function retainedLists() {
  const { window } = new runtime.JSDOM('<div></div><link><output></output>');
  const nodes = [window.document.querySelector('div'), window.document.querySelector('link'), window.document.querySelector('output')];
  const lists = [nodes[0].classList, nodes[1].relList, nodes[2].htmlFor];
  for (const list of lists) { list.value = Array.from({ length: 1000 }, (_, index) => `t${index}`).join(' '); list.remove(...[...list].slice(1)); assert.equal(list.length, 1); }
  const observed = { windows: [new WeakRef(window)], documents: [new WeakRef(window.document)], nodes: nodes.map((node) => new WeakRef(node)), lists: lists.map((list) => new WeakRef(list)) };
  window.close(); return { lists, observed };
}

/** @returns {object} Shared native token data that must not keep its old owner/forest alive. */
function retainedSet() {
  const tree = new native.NativeTree(); const owner = tree.allocate(); const attribute = tree.allocate();
  tree.setData(owner, JSON.stringify({ kind: 1, name: 'div' })); tree.initializeAttributeCollection(owner);
  tree.initializeAttribute(attribute, JSON.stringify({ kind: 2, name: 'class', value: 'kept old' })); tree.appendAttribute(owner, attribute);
  const list = tree.createTokenList(owner, 'class'); const set = tree.tokenListSet(list);
  tree.setAttributeValue(attribute, 'new'); list.invalidate(); assert.equal(tree.tokenListLength(list), 1);
  return { set, observed: { trees: [new WeakRef(tree)], nativeLists: [new WeakRef(list)] } };
}

/** @param {object[]} lists - Strongly held public lists. @returns {void} End all loop bindings before the async GC boundary. */
function verifyHeldLists(lists) { for (const list of lists) assert.equal(list.contains('t0'), true); }

/** @returns {Promise<void>} Retain usable views, then require complete native/JS release. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 6; cycle++) {
      const sample = retainedLists(); await collectGarbage();
      verifyHeldLists(sample.lists);
      sample.lists = null;
      const released = await waitForMemoryQuiescence({ label: `token-list-${cycle}`, sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
      report.cycles.push(released); assert.equal(released.reached, true);
    }
    const retained = retainedSet(); await collectGarbage();
    const held = captureMemoryState(retained.observed, runtime);
    assert.equal(held.survivors.trees, 0); assert.equal(held.survivors.nativeLists, 0);
    assert.equal(retained.set.get(0), 'kept'); assert.equal(retained.set.get(1), 'old'); report.heldSet = held;
    retained.set = null;
    report.final = await waitForMemoryQuiescence({ label: 'token-set-release', sample: () => captureMemoryState(retained.observed, runtime), expectedNative: baseline });
    assert.equal(report.final.reached, true); report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-dom-token-list.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`); process.stdout.write(`${JSON.stringify({ pass: report.pass, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
