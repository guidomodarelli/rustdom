/** @file Measures live collection/Element-relative ownership and ephemeral native state with separate Document/Window observations. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const { WINDOWS_PER_BATCH, ELEMENTS_PER_WINDOW, MUTATIONS_PER_WINDOW, MEASURED_CYCLES, RETAINED_QUERY_CYCLES } = require('../../scripts/constants/collection-query-memory.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const TEST_NAMESPACE = 'urn:memory-collection';

/** @param {object} runtime - Actual engine. @param {string} mode - Default/VM realm. @param {boolean} [formControls] - Prepare real input controls instead of mixed-namespace descendants. @returns {object} Strong fixture used only synchronously by its caller. */
function createFixture(runtime, mode, formControls = false) {
  const { window } = new runtime.JSDOM('<!doctype html><body>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const root = window.document.createElement(formControls ? 'form' : 'main'); window.document.body.append(root);
  for (let index = 0; index < ELEMENTS_PER_WINDOW; index++) {
    const element = formControls ? window.document.createElement('input')
      : window.document.createElementNS(index % 2 === 0 ? HTML_NAMESPACE : TEST_NAMESPACE, index % 2 === 0 ? 'div' : 'p:entry');
    element.setAttribute('class', index % 2 === 0 ? 'selected' : 'other'); root.append(element);
  }
  return { window, root };
}

/** @param {object} runtime - Actual engine. @param {object} before - Optional native baseline. @returns {void} Assert each temporary class filter has already released its token allocations. */
function verifyTemporaryTokens(runtime, before) {
  if (!before) return;
  const current = runtime.getNativeTreeStatistics().tokenLists;
  assert.equal(current.sets, before.sets);
  assert.equal(current.tokenUnits, before.tokenUnits);
}

/** @param {object} runtime - Actual engine. @param {string} mode - Default/VM realm. @returns {object} Weak observations with all strong owners out of scope. */
function batch(runtime, mode) {
  const observed = { windows: [], documents: [], roots: [], elements: [], collections: [] };
  for (let index = 0; index < WINDOWS_PER_BATCH; index++) {
    const { window, root } = createFixture(runtime, mode);
    try {
      const beforeTokens = runtime.getNativeTreeStatistics?.().tokenLists;
      const collections = [root.getElementsByClassName('selected'), root.getElementsByTagName('DIV'), root.getElementsByTagNameNS(TEST_NAMESPACE, 'entry')];
      for (let mutation = 0; mutation < MUTATIONS_PER_WINDOW; mutation++) {
        root.firstElementChild.setAttribute('class', mutation % 3 === 0 ? 'other' : 'selected');
        root.append(root.firstChild);
        assert.ok(collections[0].length > 0);
        assert.equal(collections[1].length, ELEMENTS_PER_WINDOW / 2);
        assert.equal(collections[2].length, ELEMENTS_PER_WINDOW / 2);
      }
      verifyTemporaryTokens(runtime, beforeTokens);
      observed.windows.push(new WeakRef(window)); observed.documents.push(new WeakRef(window.document));
      observed.roots.push(new WeakRef(root));
      for (const collection of collections) observed.collections.push(new WeakRef(collection));
      for (const element of root.children) observed.elements.push(new WeakRef(element));
    } finally { window.close(); }
  }
  return observed;
}

/** @param {object} runtime - Actual engine. @param {string} mode - Default/VM realm. @param {string} kind - Sole collection retained across GC. @returns {object} Explicit strong collection and separate weak observations. */
function retainedFixture(runtime, mode, kind) {
  const { window, root } = createFixture(runtime, mode);
  try {
    const beforeTokens = runtime.getNativeTreeStatistics?.().tokenLists;
    for (let cycle = 0; cycle < RETAINED_QUERY_CYCLES; cycle++) {
      root.setAttribute('data-query-cycle', String(cycle));
      assert.equal(root.getElementsByClassName(`missing-${cycle}`).length, 0);
    }
    const held = kind === 'class' ? root.getElementsByClassName('selected')
      : kind === 'tag' ? root.getElementsByTagName('DIV')
        : kind === 'children' ? root.children : root.getElementsByTagNameNS(TEST_NAMESPACE, 'entry');
    const expectedCount = kind === 'children' ? ELEMENTS_PER_WINDOW : ELEMENTS_PER_WINDOW / 2;
    assert.equal(held.length, expectedCount);
    verifyTemporaryTokens(runtime, beforeTokens);
    const observed = { windows: [new WeakRef(window)], documents: [new WeakRef(window.document)],
      roots: [new WeakRef(root)], collections: [new WeakRef(held)], elements: Array.from(root.children, (element) => new WeakRef(element)) };
    return { held, observed, expectedCount };
  } finally { window.close(); }
}

/** @param {object} sample - Explicit live collection owner. @returns {void} Read held state without leaving strong loop bindings across an async GC. */
function verifyHeld(sample) { assert.equal(sample.held.length, sample.expectedCount); assert.equal(sample.held.item(0).ownerDocument, sample.observed.documents[0].deref()); }

/** @param {object} runtime - Actual engine. @param {string} mode - Default/VM realm. @returns {object} A live children owner and only weak references to the removed member. */
function removedChildFixture(runtime, mode) {
  const { window, root } = createFixture(runtime, mode);
  try {
    const held = root.children;
    const removed = root.firstElementChild;
    const removedObservation = { elements: [new WeakRef(removed)] };
    removed.remove();
    assert.equal(root.childElementCount, ELEMENTS_PER_WINDOW - 1);
    assert.equal(held.length, ELEMENTS_PER_WINDOW - 1);
    const observed = { windows: [new WeakRef(window)], documents: [new WeakRef(window.document)],
      roots: [new WeakRef(root)], collections: [new WeakRef(held)], elements: Array.from(held, (element) => new WeakRef(element)) };
    return { held, observed, removedObservation, expectedCount: ELEMENTS_PER_WINDOW - 1 };
  } finally { window.close(); }
}

/** @param {object} runtime - Real native-backed engine. @param {string} mode - Default/VM realm. @param {string} transport - Descendant/children query or poisoned children/form-controls snapshot. @returns {object} Retained numeric/string transport values and weak DOM observations only. */
function transportFixture(runtime, mode, transport) {
  const { window, root } = createFixture(runtime, mode, transport === 'generic-controls');
  const FloatConstructor = Float64Array;
  const originalFrom = Object.getOwnPropertyDescriptor(FloatConstructor, 'from');
  const generic = transport.startsWith('generic-');
  const expectedLength = transport === 'native-query' ? ELEMENTS_PER_WINDOW / 2 : ELEMENTS_PER_WINDOW;
  try {
    if (generic) Object.defineProperty(FloatConstructor, 'from', { configurable: true,
      get() { throw new Error('Collection transport must not read the mutable host factory'); } });
    const collection = transport === 'generic-controls' ? root.elements
      : transport === 'native-query' ? root.getElementsByClassName('selected') : root.children;
    const implementation = collection[Object.getOwnPropertySymbols(collection).find((symbol) => symbol.description === 'impl')];
    const ids = implementation._nativeIds;
    const names = Object.getOwnPropertyNames(collection);
    assert.equal(ArrayBuffer.isView(ids), true); assert.equal(ids.length, expectedLength);
    return { ids, names, expectedLength, observed: { windows: [new WeakRef(window)], documents: [new WeakRef(window.document)],
      roots: [new WeakRef(root)], collections: [new WeakRef(collection)], elements: Array.from(root.children, (element) => new WeakRef(element)) } };
  } finally {
    if (generic) {
      if (originalFrom) Object.defineProperty(FloatConstructor, 'from', originalFrom);
      else Reflect.deleteProperty(FloatConstructor, 'from');
    }
    window.close();
  }
}

/** @returns {Promise<void>} Preserve finite held/released scenarios and post-GC heap/external/RSS evidence. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version,
    windowsPerBatch: WINDOWS_PER_BATCH, measuredCycles: MEASURED_CYCLES, mutationsPerWindow: MUTATIONS_PER_WINDOW,
    retainedQueryCycles: RETAINED_QUERY_CYCLES, pass: false, cases: [],
    methodology: 'Both engines and default/VM realms. One warmup and three measured batches of twelve Windows with twenty-four Elements, three live descendant collections and repeated physical Element-relative reads, forty mutation/requery cycles per Window, then close and drop owners. Separately churn two hundred class queries and hold one class/tag/namespace/children collection after close; require owner retention then release every weak group and native liveness counter across two clear GC samples. A removed child must collect while children and its parent/document remain held; childElementCount and the live list must already reflect removal. Native-only default/VM cases retain numeric transport and property-name strings from descendant queries, ordinary children, and children/form.elements snapshots created with a throwing host Float64Array.from getter restored in finally; every DOM owner must clear. Class tokens release synchronously. Heap/external/RSS are post-GC, not peak. Finite scenarios cannot prove absence of all leaks.' };
  try {
    for (const [engine, runtime] of Object.entries(engines)) for (const mode of ['default', 'vm']) {
      for (let cycle = -1; cycle < MEASURED_CYCLES; cycle++) {
        await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.();
        const observed = batch(runtime, mode);
        const endpoint = await waitForMemoryQuiescence({ label: `collections-${engine}-${mode}-${cycle}`,
          sample: () => captureMemoryState(observed, runtime), expectedNative: baseline });
        report.cases.push({ engine, mode, cycle, endpoint });
        assert.equal(endpoint.reached, true, JSON.stringify(endpoint.state));
      }
      for (const kind of ['class', 'tag', 'namespace', 'children']) {
        await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.(); const sample = retainedFixture(runtime, mode, kind);
        await collectGarbage(); verifyHeld(sample);
        const held = captureMemoryState(sample.observed, runtime);
        assert.equal(held.survivors.collections, 1); assert.equal(held.survivors.documents, 1); assert.equal(held.survivors.roots, 1);
        sample.held = null;
        const released = await waitForMemoryQuiescence({ label: `collection-${engine}-${mode}-${kind}-released`,
          sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        report.cases.push({ engine, mode, kind, held, released });
        assert.equal(released.reached, true, JSON.stringify(released.state));
      }
      {
        await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.(); const sample = removedChildFixture(runtime, mode);
        const removed = await waitForMemoryQuiescence({ label: `children-${engine}-${mode}-removed-with-live-owner`,
          sample: () => captureMemoryState(sample.removedObservation) });
        assert.equal(removed.reached, true, JSON.stringify(removed.state));
        verifyHeld(sample);
        const held = captureMemoryState(sample.observed, runtime);
        assert.equal(held.survivors.collections, 1); assert.equal(held.survivors.documents, 1); assert.equal(held.survivors.roots, 1);
        sample.held = null;
        const released = await waitForMemoryQuiescence({ label: `children-${engine}-${mode}-owner-released`,
          sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        report.cases.push({ engine, mode, kind: 'removed-child-with-live-collection', removed, held, released });
        assert.equal(released.reached, true, JSON.stringify(released.state));
      }
      if (engine === 'rustdom') {
        for (const transport of ['native-query', 'native-children', 'generic-children', 'generic-controls']) {
          await collectGarbage(); const baseline = runtime.getNativeTreeStatistics(); const sample = transportFixture(runtime, mode, transport);
          const released = await waitForMemoryQuiescence({ label: `collection-${engine}-${mode}-${transport}-numeric-transport-held`,
            sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
          assert.equal(released.reached, true, JSON.stringify(released.state));
          assert.equal(sample.ids.length, sample.expectedLength); assert.ok(sample.ids[0] > 0);
          assert.equal(sample.names.length, sample.expectedLength);
          report.cases.push({ engine, mode, kind: 'numeric-transport-held', transport, released,
            retainedIdBytes: sample.ids.byteLength, retainedNames: sample.names.length });
        }
      }
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory/collection-queries', { recursive: true });
  const path = `reports/memory/collection-queries/${report.capturedAt.replaceAll(':', '-')}-${process.version}.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ path, pass: report.pass, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
