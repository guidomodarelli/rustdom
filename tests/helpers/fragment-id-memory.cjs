/** @file Finite real fragment-ID lifetime scenarios with independent Document and Window observations. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const { WINDOWS_PER_BATCH, ELEMENTS_PER_WINDOW, MUTATIONS_PER_WINDOW, MEASURED_CYCLES, RETAINED_QUERY_CYCLES } = require('../../scripts/constants/collection-query-memory.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };

/** @param {object} runtime - Actual engine. @param {string} mode - Default/VM realm. @param {string} kind - Fragment/template/shadow scope. @returns {object} Synchronous strong fixture, always detached from body. */
function fixture(runtime, mode, kind) {
  const { window } = new runtime.JSDOM('<!doctype html><body>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const document = window.document;
  const host = kind === 'fragment' ? null : document.createElement(kind === 'template' ? 'template' : 'div');
  const scope = kind === 'fragment' ? document.createDocumentFragment()
    : kind === 'template' ? host.content : host.attachShadow({ mode: 'open' });
  for (let index = 0; index < ELEMENTS_PER_WINDOW; index++) {
    const element = document.createElementNS(index % 2 === 0 ? 'http://www.w3.org/1999/xhtml' : 'urn:memory-fragment-id', 'entry');
    element.setAttributeNS(null, 'id', index === 0 ? 'selected' : `entry-${index}`);
    scope.append(element);
  }
  return { window, document, host, scope };
}
/** @param {object} context - Strong fixture, used only synchronously. @returns {object} Separate weak observations, including the possibly inert template owner. */
function observations(context) {
  return { windows: [new WeakRef(context.window)], documents: [new WeakRef(context.document)],
    ownerDocuments: [new WeakRef(context.scope.ownerDocument)], roots: [new WeakRef(context.scope)],
    hosts: context.host ? [new WeakRef(context.host)] : [],
    elements: Array.from(context.scope.children, (element) => new WeakRef(element)) };
}
/** @param {object} runtime - Actual engine. @param {string} mode - Realm. @param {string} kind - Scope. @returns {object} Weak observations after close and dropping every strong fixture. */
function batch(runtime, mode, kind) {
  const observed = { windows: [], documents: [], ownerDocuments: [], roots: [], hosts: [], elements: [] };
  for (let index = 0; index < WINDOWS_PER_BATCH; index++) {
    const context = fixture(runtime, mode, kind);
    try {
      for (let mutation = 0; mutation < MUTATIONS_PER_WINDOW; mutation++) {
        const element = context.scope.firstElementChild;
        const id = `mutation-${mutation}`; element.setAttributeNS(null, 'id', id);
        assert.equal(context.scope.getElementById(id), element);
        assert.equal(context.scope.getElementById('missing'), null);
        assert.equal(context.scope.getElementById(''), null);
        context.scope.append(element);
      }
      for (const [group, references] of Object.entries(observations(context))) observed[group].push(...references);
    } finally { context.window.close(); }
  }
  return observed;
}
/** @param {object} runtime - Actual engine. @param {string} mode - Realm. @param {string} kind - Scope. @param {string} retention - Retain result, scope after removal, or only a raw numeric result. @returns {object} Explicit retained value and weak DOM groups only. */
function retainedFixture(runtime, mode, kind, retention) {
  const context = fixture(runtime, mode, kind);
  try {
    const selected = context.scope.getElementById('selected');
    assert.ok(selected);
    for (let cycle = 0; cycle < RETAINED_QUERY_CYCLES; cycle++) assert.equal(context.scope.getElementById(`missing-${cycle}`), null);
    if (retention === 'removed') {
      const removedObservation = { elements: [new WeakRef(selected)] };
      selected.remove();
      assert.equal(context.scope.getElementById('selected'), null);
      return { held: context.scope, observed: observations(context), removedObservation };
    }
    if (retention === 'numeric') {
      const { domSymbolTree } = require('../../dist/vendor-jsdom/lib/jsdom/living/helpers/internal-constants.js');
      const implementation = context.scope[Object.getOwnPropertySymbols(context.scope).find((symbol) => symbol.description === 'impl')];
      const id = domSymbolTree._arena.queryElementById(domSymbolTree._ensure(implementation), 'selected');
      assert.ok(Number.isSafeInteger(id) && id > 0);
      return { id, observed: observations(context) };
    }
    return { held: selected, observed: observations(context) };
  } finally { context.window.close(); }
}
/** @param {object} sample - Explicit retained DOM owner. @param {string} retention - Result or scope. @returns {void} Validate required ownership without keeping dereferenced targets across an await. */
function verifyHeld(sample, retention) {
  if (retention === 'result') {
    assert.equal(sample.held.getAttributeNS(null, 'id'), 'selected');
    assert.equal(sample.held.ownerDocument, sample.observed.ownerDocuments[0].deref());
  } else assert.equal(sample.held.getElementById('selected'), null);
}
/** @returns {Promise<void>} Record held/released and numeric-only endpoints, including every bounded failed trace. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version,
    pass: false, cases: [], windowsPerBatch: WINDOWS_PER_BATCH, elementsPerWindow: ELEMENTS_PER_WINDOW,
    mutationsPerWindow: MUTATIONS_PER_WINDOW, measuredCycles: MEASURED_CYCLES, retainedQueryCycles: RETAINED_QUERY_CYCLES,
    methodology: 'Real jsdom/rustdom in default/VM for detached DocumentFragment, template.content and ShadowRoot. One warmup plus three measured batches per combination: twelve Windows, twenty-four mixed-namespace Elements, forty attribute/move/query cycles. Separate scenarios retain a returned Element, or remove it while keeping the scope, then drop the owner. Native-only scenarios retain a raw numeric ID from the actual DOM arena. Observe original Document, template owner Document, Window, scope, host and all Elements separately; require every weak group and native lifetime field to return to baseline across two clear GC samples. Retained results must preserve their owner Document and scope; original Window survival is recorded separately. Heap/external/RSS are post-GC, not peak. Finite scenarios cannot prove absence of every leak.' };
  try {
    for (const [engine, runtime] of Object.entries(engines)) for (const mode of ['default', 'vm']) for (const kind of ['fragment', 'template', 'shadow']) {
      for (let cycle = -1; cycle < MEASURED_CYCLES; cycle++) {
        await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.();
        const observed = batch(runtime, mode, kind);
        const endpoint = await waitForMemoryQuiescence({ label: `fragment-id-${engine}-${mode}-${kind}-${cycle}`,
          sample: () => captureMemoryState(observed, runtime), expectedNative: baseline });
        report.cases.push({ engine, mode, kind, cycle, endpoint });
        assert.equal(endpoint.reached, true, JSON.stringify(endpoint.state));
      }
      for (const retention of ['result', 'removed']) {
        await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.();
        const sample = retainedFixture(runtime, mode, kind, retention);
        let removed;
        if (retention === 'removed') {
          removed = await waitForMemoryQuiescence({ label: `fragment-id-${engine}-${mode}-${kind}-removed-with-scope`,
            sample: () => captureMemoryState(sample.removedObservation) });
          assert.equal(removed.reached, true, JSON.stringify(removed.state));
        }
        await collectGarbage(); verifyHeld(sample, retention);
        const held = captureMemoryState(sample.observed, runtime);
        assert.equal(held.survivors.roots, 1); assert.equal(held.survivors.ownerDocuments, 1);
        sample.held = null;
        const released = await waitForMemoryQuiescence({ label: `fragment-id-${engine}-${mode}-${kind}-${retention}-released`,
          sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        report.cases.push({ engine, mode, kind, retention, held, ...(removed ? { removed } : {}), released });
        assert.equal(released.reached, true, JSON.stringify(released.state));
      }
      if (engine === 'rustdom') {
        await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
        const sample = retainedFixture(runtime, mode, kind, 'numeric');
        const released = await waitForMemoryQuiescence({ label: `fragment-id-${engine}-${mode}-${kind}-numeric-only`,
          sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        report.cases.push({ engine, mode, kind, retention: 'numeric', id: sample.id, released });
        assert.equal(released.reached, true, JSON.stringify(released.state));
        assert.ok(Number.isSafeInteger(sample.id) && sample.id > 0);
      }
    }
    report.pass = true;
  } finally {
    mkdirSync('reports/memory/fragment-id', { recursive: true });
    const path = `reports/memory/fragment-id/${report.capturedAt.replaceAll(':', '-')}-${process.version}.json`;
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
    console.log(`Guardado: ${path}`);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
