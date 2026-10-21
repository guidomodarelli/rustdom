/** @file Real ID-index ownership, alias retention and bounded native storage scenarios. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const { WINDOWS_PER_BATCH, ELEMENTS_PER_WINDOW, MUTATIONS_PER_WINDOW, MEASURED_CYCLES, RETAINED_QUERY_CYCLES } = require('../../scripts/constants/collection-query-memory.cjs');
const { ID_ALIAS_CHURN_CYCLES, MAX_RETAINED_NAME_CAPACITY } = require('../../scripts/constants/id-lookups-memory.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };

/** @param {object} runtime - Actual engine. @param {string} mode - Default/VM. @param {string} kind - Document/SVG. @returns {object} Strong synchronous fixture in head, which close does not clear. */
function fixture(runtime, mode, kind) {
  const { window } = new runtime.JSDOM('<!doctype html><body>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const document = window.document;
  const root = kind === 'svg' ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : document.createElement('section');
  document.head.append(root);
  for (let index = 0; index < ELEMENTS_PER_WINDOW; index++) {
    const element = document.createElementNS(index % 2 === 0 ? 'http://www.w3.org/1999/xhtml' : 'urn:memory-id-lookup', 'entry');
    element.setAttributeNS(null, 'id', index === 0 ? 'selected' : `entry-${index}`); root.append(element);
  }
  return { window, document, root, scope: kind === 'svg' ? root : document };
}
/** @param {object} context - Strong fixture. @returns {object} Weak observations only. */
function observations(context) {
  return { windows: [new WeakRef(context.window)], documents: [new WeakRef(context.document)],
    roots: [new WeakRef(context.root)], scopes: [new WeakRef(context.scope)],
    elements: Array.from(context.root.children, (element) => new WeakRef(element)) };
}
/** @param {object} runtime - Actual engine. @param {string} mode - Realm. @param {string} kind - Scope. @returns {object} All strong owners have left synchronous scope. */
function batch(runtime, mode, kind) {
  const observed = { windows: [], documents: [], roots: [], scopes: [], elements: [] };
  for (let index = 0; index < WINDOWS_PER_BATCH; index++) {
    const context = fixture(runtime, mode, kind);
    try {
      for (let mutation = 0; mutation < MUTATIONS_PER_WINDOW; mutation++) {
        const element = context.root.firstElementChild; const value = `mutation-${mutation}`;
        element.id = value; assert.equal(context.scope.getElementById(value), element);
        assert.equal(context.scope.getElementById('missing'), null); context.root.append(element);
      }
      for (const [group, references] of Object.entries(observations(context))) observed[group].push(...references);
    } finally { context.window.close(); }
  }
  return observed;
}
/** @param {object} runtime - Actual engine. @param {string} mode - Realm. @param {string} kind - Scope. @param {string} retention - Result/removed/numeric. @returns {object} Explicit retained value plus weak groups. */
function retainedFixture(runtime, mode, kind, retention) {
  const context = fixture(runtime, mode, kind);
  try {
    const selected = context.scope.getElementById('selected'); assert.ok(selected);
    for (let cycle = 0; cycle < RETAINED_QUERY_CYCLES; cycle++) assert.equal(context.scope.getElementById(`missing-${cycle}`), null);
    if (retention === 'removed') {
      const removedObservation = { elements: [new WeakRef(selected)] }; selected.remove();
      assert.equal(context.scope.getElementById('selected'), null);
      return { held: context.scope, observed: observations(context), removedObservation };
    }
    if (retention === 'numeric') {
      const { domSymbolTree } = require('../../dist/vendor-jsdom/lib/jsdom/living/helpers/internal-constants.js');
      const implementation = context.scope[Object.getOwnPropertySymbols(context.scope).find((symbol) => symbol.description === 'impl')];
      const root = domSymbolTree._ensure(implementation);
      const id = kind === 'svg' ? domSymbolTree._arena.querySvgElementById(root, 'selected')
        : domSymbolTree._arena.queryDocumentElementById(root, 'selected');
      assert.ok(Number.isSafeInteger(id) && id > 0);
      return { id, observed: observations(context) };
    }
    return { held: selected, observed: observations(context) };
  } finally { context.window.close(); }
}
/** @param {object} sample - Retained result/scope. @param {string} retention - Retained kind. @returns {void} Assert ownership without retaining a dereferenced target across GC. */
function verifyHeld(sample, retention) {
  if (retention === 'result') {
    assert.equal(sample.held.getAttributeNS(null, 'id'), 'selected');
    assert.equal(sample.held.ownerDocument, sample.observed.documents[0].deref());
  } else assert.equal(sample.held.getElementById('selected'), null);
}
/** @param {object} runtime - Engine. @param {string} mode - Realm. @param {boolean} publicWindow - HTML node remains exposed by a Window named property. @returns {object} Retained Document/Window with only weak references to a removed alias target. */
function aliasFixture(runtime, mode, publicWindow) {
  const { window } = new runtime.JSDOM('<!doctype html><body>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const document = window.document; const root = document.createElement('section'); document.head.append(root);
  const target = document.createElementNS(publicWindow ? 'http://www.w3.org/1999/xhtml' : 'urn:memory-id-lookup', 'entry');
  root.append(target); target.setAttributeNS('urn:memory-id-attribute', 'id', 'alias');
  assert.equal(document.getElementById('alias'), target);
  target.remove(); assert.equal(document.getElementById('alias'), null);
  const observed = { windows: [new WeakRef(window)], documents: [new WeakRef(document)],
    roots: [new WeakRef(root)], elements: [new WeakRef(target)] };
  window.close(); assert.equal(window.alias === target, publicWindow);
  return { held: publicWindow ? window : document, observed };
}
/** @param {object} runtime - Rust-backed engine. @param {string} mode - Realm. @returns {object} An active DOM owner and index storage reclaimed independently of its nodes. */
function churnFixture(runtime, mode) {
  const { window } = new runtime.JSDOM('<!doctype html><body>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const document = window.document; const root = document.createElement('section'); document.head.append(root);
  const target = document.createElementNS('urn:memory-id-lookup', 'entry'); root.append(target);
  const before = runtime.getNativeTreeStatistics().documentIds;
  try {
    for (let cycle = 0; cycle < ID_ALIAS_CHURN_CYCLES; cycle++) {
      const value = `alias-${cycle}`; target.setAttributeNS('urn:memory-id-attribute', 'id', value);
      assert.equal(document.getElementById(value), target);
    }
    const occupied = runtime.getNativeTreeStatistics().documentIds;
    assert.equal(occupied.names - before.names, 1); assert.equal(occupied.entries - before.entries, 1);
    assert.ok(occupied.nameCapacity <= MAX_RETAINED_NAME_CAPACITY);
    target.removeAttributeNS('urn:memory-id-attribute', 'id');
    const cleared = runtime.getNativeTreeStatistics().documentIds;
    for (const field of ['documents', 'names', 'entries', 'elements', 'memberships', 'keyUnits', 'documentCapacity', 'elementCapacity']) assert.equal(cleared[field], before[field]);
    return { held: document, observed: { windows: [new WeakRef(window)], documents: [new WeakRef(document)],
      roots: [new WeakRef(root)], elements: [new WeakRef(target)] }, occupied, cleared };
  } finally { window.close(); }
}
/** @returns {Promise<void>} Preserve every finite endpoint and the reference's private/public alias retention separately. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version,
    pass: false, cases: [], windowsPerBatch: WINDOWS_PER_BATCH, elementsPerWindow: ELEMENTS_PER_WINDOW,
    mutationsPerWindow: MUTATIONS_PER_WINDOW, measuredCycles: MEASURED_CYCLES, aliasChurnCycles: ID_ALIAS_CHURN_CYCLES,
    methodology: 'Real jsdom/rustdom default/VM with Document and SVG scopes in head so Window.close body clearing does not erase held fixtures. One warmup plus three measured batches: twelve Windows, twenty-four mixed-namespace Elements and forty ID mutation/move/query cycles. Retain a result, remove a member while keeping its scope, or retain only a raw numeric ID from the real arena. Separately remove a foreign-namespace Element registered through an unprefixed namespaced id: jsdom keeps the private cached node with Document held; Rust numeric state permits collection while preserving public null lookup. HTML aliases that remain publicly exposed as window.alias must retain the node on both engines. Native-only alias churn requires one live key then full storage reclamation while the DOM owner remains alive. Observe Document/Window/scope/nodes separately and require all released groups plus native lifetime fields to return to baseline across two clear GC samples. Memory is post-GC, not peak; finite scenarios cannot prove absence of every leak.' };
  try {
    for (const [engine, runtime] of Object.entries(engines)) for (const mode of ['default', 'vm']) {
      for (const kind of ['document', 'svg']) {
        for (let cycle = -1; cycle < MEASURED_CYCLES; cycle++) {
          await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.(); const observed = batch(runtime, mode, kind);
          const endpoint = await waitForMemoryQuiescence({ label: `id-${engine}-${mode}-${kind}-${cycle}`,
            sample: () => captureMemoryState(observed, runtime), expectedNative: baseline });
          report.cases.push({ engine, mode, kind, cycle, endpoint }); assert.equal(endpoint.reached, true, JSON.stringify(endpoint.state));
        }
        for (const retention of ['result', 'removed']) {
          await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.(); const sample = retainedFixture(runtime, mode, kind, retention);
          let removed;
          if (retention === 'removed') {
            removed = await waitForMemoryQuiescence({ label: `id-${engine}-${mode}-${kind}-removed-with-owner`, sample: () => captureMemoryState(sample.removedObservation) });
            assert.equal(removed.reached, true, JSON.stringify(removed.state));
          }
          await collectGarbage(); verifyHeld(sample, retention); const held = captureMemoryState(sample.observed, runtime);
          assert.equal(held.survivors.documents, 1); assert.equal(held.survivors.roots, 1); sample.held = null;
          const released = await waitForMemoryQuiescence({ label: `id-${engine}-${mode}-${kind}-${retention}-released`,
            sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
          report.cases.push({ engine, mode, kind, retention, held, ...(removed ? { removed } : {}), released });
          assert.equal(released.reached, true, JSON.stringify(released.state));
        }
        if (engine === 'rustdom') {
          await collectGarbage(); const baseline = runtime.getNativeTreeStatistics(); const sample = retainedFixture(runtime, mode, kind, 'numeric');
          const released = await waitForMemoryQuiescence({ label: `id-${engine}-${mode}-${kind}-numeric-only`,
            sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
          report.cases.push({ engine, mode, kind, retention: 'numeric', id: sample.id, released }); assert.equal(released.reached, true, JSON.stringify(released.state));
        }
      }
      for (const publicWindow of [false, true]) {
        await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.(); const sample = aliasFixture(runtime, mode, publicWindow);
        await collectGarbage(); await collectGarbage(); const held = captureMemoryState(sample.observed, runtime);
        const expectedRetained = publicWindow || engine === 'jsdom' ? 1 : 0;
        assert.equal(held.survivors.elements, expectedRetained);
        if (publicWindow) assert.equal(sample.held.alias, sample.observed.elements[0].deref());
        else assert.equal(sample.held.getElementById('alias'), null);
        sample.held = null;
        const released = await waitForMemoryQuiescence({ label: `id-${engine}-${mode}-alias-${publicWindow}-released`,
          sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        report.cases.push({ engine, mode, kind: publicWindow ? 'public-window-alias' : 'private-document-alias', expectedRetained, held, released });
        assert.equal(released.reached, true, JSON.stringify(released.state));
      }
      if (engine === 'rustdom') {
        await collectGarbage(); const baseline = runtime.getNativeTreeStatistics(); const sample = churnFixture(runtime, mode);
        const { occupied, cleared } = sample; sample.held = null;
        const released = await waitForMemoryQuiescence({ label: `id-${engine}-${mode}-alias-churn-released`,
          sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        report.cases.push({ engine, mode, kind: 'alias-churn', occupied, cleared, released }); assert.equal(released.reached, true, JSON.stringify(released.state));
      }
    }
    report.pass = true;
  } finally {
    mkdirSync('reports/memory/id-lookups', { recursive: true });
    const path = `reports/memory/id-lookups/${report.capturedAt.replaceAll(':', '-')}-${process.version}.json`;
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n'); console.log(`Guardado: ${path}`);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
