/** @file Stresses real lifecycle paths and measures retained references and post-GC memory. */
'use strict';
const assert = require('node:assert/strict');
const { collectGarbage: settle, captureMemoryState, waitForMemoryQuiescence } = require('./memory-endpoint.cjs');

/** Retain small result records, never the DOM objects whose collection is measured. */
const snapshots = [];
/** Deliberately retain teardown callbacks to catch accidental closure ownership. */
const retainedTeardowns = [];
/** Observe targets without keeping them alive. */
const references = [];
/** Observe Window proxies too: close() can release a Document while a Window remains retained. */
const windowReferences = [];
/** Observe attached and detached CharacterData wrappers owning native buffers. */
const characterReferences = [];
/** Track attached, removed and never-attached native-backed Attr values. */
const attributeReferences = [];
/** Observe compared subtrees and native immutable node metadata without retaining them. */
const comparisonReferences = [];
/** Every explicit fixture participates in the same final liveness observation. */
const observedReferences = { documents: references, windows: windowReferences,
  characterData: characterReferences, attributes: attributeReferences, comparedNodes: comparisonReferences };
/** Preserve collection progress as numbers and memory samples without retaining DOM fixtures. */
const quiescenceChecks = [];
/** Keep foreign signals alive to expose missed cross-realm listener cleanup. */
const retainedControllers = [];
/** Warm module caches and native allocators before judging bounded retained growth. */
const WARMUP_BATCHES = 3;
/** Sample enough lifecycle batches to expose a per-window leak. */
const MEASURED_BATCHES = 8;
/** Use several documents per batch while allowing pending readiness callbacks to settle. */
const OPERATIONS_PER_BATCH = 40;

/**
 * Create and release a document, its observers, listeners, and outstanding timer.
 * @param {object} runtime - Real jsdom-compatible implementation.
 * @param {string} identity - Unique attribute identity to stress atom-table churn.
 * @returns {void} Keeps only a weak document reference.
 */
function exerciseWindow(runtime, identity) {
  const dom = new runtime.JSDOM('<!doctype html><body><div>start</div>');
  const document = dom.window.document;
  windowReferences.push(new WeakRef(dom.window));
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(document.body, { childList: true, characterData: true, characterDataOldValue: true, subtree: true });
  dom.window.addEventListener('custom-event', () => document.body);
  dom.window.setInterval(() => document.body, 60_000);
  document.body.innerHTML = `<section data-${identity}="value"><p>updated</p></section>`.repeat(20) + '<iframe></iframe>';
  const text = document.createTextNode('\ud800' + 'x'.repeat(8192));
  const comment = document.createComment('comment-' + identity);
  const detached = document.createTextNode('detached-' + identity);
  document.body.append(text, comment);
  text.replaceData(1, 4096, '🦀');
  comment.appendData('\udc00');
  characterReferences.push(new WeakRef(text), new WeakRef(comment), new WeakRef(detached));
  const removedAttribute = document.createAttributeNS(`urn:${identity}`, 'p:value');
  removedAttribute.value = 'x'.repeat(8192) + '\udfff';
  document.body.setAttributeNodeNS(removedAttribute);
  document.body.removeAttributeNode(removedAttribute);
  removedAttribute.value = 'removed';
  const detachedAttribute = document.createAttribute('detached');
  detachedAttribute.value = '\ud800';
  document.body.setAttribute('data-attached', identity);
  attributeReferences.push(new WeakRef(removedAttribute), new WeakRef(detachedAttribute),
    new WeakRef(document.body.getAttributeNode('data-attached')));
  references.push(new WeakRef(document.querySelector('iframe').contentDocument));
  windowReferences.push(new WeakRef(document.querySelector('iframe').contentWindow));
  // Leave the observer connected: closing the window must release the entire cycle.
  references.push(new WeakRef(document));
  dom.window.close();
}

/**
 * Keep an element alive while removing many attributes, so delayed cleanup cannot hide behind window.close().
 * @param {object} runtime - Real jsdom-compatible engine.
 * @returns {Promise<void>} Verifies collection before releasing the owning document.
 */
async function exerciseAttributeChurn(runtime) {
  let dom = new runtime.JSDOM('<!doctype html><div></div>');
  let element = dom.window.document.querySelector('div');
  references.push(new WeakRef(dom.window.document));
  windowReferences.push(new WeakRef(dom.window));
  /** Fixed stress size, independent of production allocation policy. */
  const batches = 5;
  const attributesPerBatch = 200;
  try {
    await settle();
    const initial = runtime.getNativeTreeStatistics?.();
    /** @param {number} identity - Unique payload. @returns {WeakRef<Attr>} A removed attribute without a strong test reference. */
    function replace(identity) {
      const attribute = dom.window.document.createAttribute('data-churn');
      attribute.value = `value-${identity}`;
      element.setAttributeNode(attribute);
      return new WeakRef(attribute);
    }
    for (let batch = 0; batch < batches; batch++) {
      const removed = [];
      for (let index = 0; index < attributesPerBatch; index++) removed.push(replace(batch * attributesPerBatch + index));
      element.removeAttribute('data-churn');
      const endpoint = await waitForMemoryQuiescence({ label: `attribute-churn-${batch}`,
        sample: () => captureMemoryState({ attributes: removed }, runtime), expectedNative: initial });
      quiescenceChecks.push(endpoint);
      assert.equal(removed.filter((reference) => reference.deref()).length, 0, 'removed Attr retained by a live element');
      assert.ok(dom.window.document.body.contains(element));
      const current = runtime.getNativeTreeStatistics?.();
      if (current) {
        assert.equal(current.attributeOwners, initial.attributeOwners);
        assert.equal(current.attributeHolders, initial.attributeHolders);
      }
      attributeReferences.push(...removed);
    }
  } finally {
    dom.window.close();
    // Completed async scopes may outlive their last await; release the test's own strong roots.
    element = null;
    dom = null;
  }
}

/**
 * Compare transient nodes against a live tree and verify that no comparison cache retains them.
 * @param {object} runtime - Real jsdom-compatible engine.
 * @returns {Promise<void>} Completes weak-reference and native-allocation checks before window teardown.
 */
async function exerciseNodeComparisons(runtime) {
  let dom = new runtime.JSDOM('<!doctype html><section>' + '<p a="value">text</p>'.repeat(20) + '</section>');
  let document = dom.window.document;
  let root = document.querySelector('section');
  references.push(new WeakRef(document));
  windowReferences.push(new WeakRef(dom.window));
  const batches = 5;
  const comparisonsPerBatch = 100;
  try {
    await settle();
    const initial = runtime.getNativeTreeStatistics?.();
    /** @returns {WeakRef<Node>[]} Compared nodes whose last strong test references end on return. */
    function compareTransientNodes() {
      const clone = root.cloneNode(true);
      const doctype = document.implementation.createDocumentType('root', 'x'.repeat(8192), '\ud800');
      const instruction = document.createProcessingInstruction('target', 'y'.repeat(8192));
      assert.ok(root.isEqualNode(clone));
      const namespace = 'urn:' + 'n'.repeat(8192);
      clone.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:transient', namespace);
      assert.equal(clone.firstChild.lookupNamespaceURI('transient'), namespace);
      assert.equal(clone.firstChild.lookupPrefix(namespace), 'transient');
      assert.ok(clone.firstChild.isDefaultNamespace('http://www.w3.org/1999/xhtml'));
      // Populate sibling-index caches in a subtree that must disappear while root stays alive.
      assert.ok(clone.firstChild.compareDocumentPosition(clone.lastChild) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
      assert.equal(root.contains(clone), false);
      assert.ok(root.compareDocumentPosition(clone) & dom.window.Node.DOCUMENT_POSITION_DISCONNECTED);
      assert.ok(doctype.isEqualNode(doctype.cloneNode()));
      instruction.data = 'changed';
      assert.equal(instruction.target, 'target');
      return [new WeakRef(clone), new WeakRef(doctype), new WeakRef(instruction)];
    }
    for (let batch = 0; batch < batches; batch++) {
      const compared = [];
      for (let index = 0; index < comparisonsPerBatch; index++) compared.push(...compareTransientNodes());
      const endpoint = await waitForMemoryQuiescence({ label: `node-comparison-${batch}`,
        sample: () => captureMemoryState({ comparedNodes: compared }, runtime), expectedNative: initial });
      quiescenceChecks.push(endpoint);
      assert.equal(compared.filter((reference) => reference.deref()).length, 0, 'comparison retained transient nodes');
      const current = runtime.getNativeTreeStatistics?.();
      if (current) {
        assert.equal(current.liveNodes, initial.liveNodes, 'comparison retained native nodes');
        assert.equal(current.dataNodes, initial.dataNodes, 'comparison retained native metadata');
      }
      comparisonReferences.push(...compared);
    }
  } finally {
    dom.window.close();
    root = null;
    document = null;
    dom = null;
  }
}

/**
 * Run one isolated stress target and enforce conservative retained-growth budgets.
 * @returns {Promise<void>} Emits a machine-readable report and fails observed leaks.
 */
async function main() {
  assert.equal(typeof global.gc, 'function', 'memory checks require --expose-gc');
  const mode = process.argv[2];
  const runtime = mode === 'jsdom' ? require('jsdom') : mode === 'rustdom' ? require('../dist/index.cjs') : null;
  const native = mode === 'native' ? require('../dist/native.cjs') : null;
  const environment = mode.startsWith('vitest') ? (await import('../src/environments/vitest.mjs')).default : null;
  const nativeRuntime = runtime?.getNativeTreeStatistics ? runtime
    : environment ? require('../dist/index.cjs') : null;
  const initialNativeNodes = nativeRuntime?.getNativeTreeStatistics().liveNodes;
  const initialNativeData = nativeRuntime?.getNativeTreeStatistics().dataNodes;
  const initialAttributeState = nativeRuntime?.getNativeTreeStatistics();
  assert.ok(['jsdom', 'rustdom', 'native', 'vitest', 'vitest-vm'].includes(mode));
  const markup = '<!doctype html><body>' + '<article data-index="1"><h2>Heading</h2><p>content &amp; text</p></article>'.repeat(100);
  for (let batch = 0; batch < WARMUP_BATCHES + MEASURED_BATCHES; batch++) {
    for (let operation = 0; operation < OPERATIONS_PER_BATCH; operation++) {
      if (native) {
        const tape = native.parseDocumentTape(markup + `<unique-${batch}-${operation} data-${batch}-${operation}="value"></unique-${batch}-${operation}>`);
        assert.ok(tape.length > markup.length);
      } else if (environment) {
        let target = { setTimeout, clearTimeout, setInterval, clearInterval };
        const session = mode === 'vitest-vm'
          ? environment.setupVM({ jsdom: { runScripts: 'outside-only' } })
          : environment.setup(target, { jsdom: { runScripts: 'outside-only' } });
        if (mode === 'vitest-vm') target = session.getVmContext();
        references.push(new WeakRef(target.document));
        windowReferences.push(new WeakRef(target.jsdom.window));
        target.document.body.innerHTML = '<p>created and released</p>';
        const controller = new AbortController();
        target.document.querySelector('p').addEventListener('click', () => {}, { signal: controller.signal });
        retainedControllers.push(controller);
        target.URL.createObjectURL(new target.Blob(['x'.repeat(32 * 1024)]));
        session.teardown();
        retainedTeardowns.push(session);
        target = null;
      } else exerciseWindow(runtime, `${batch}-${operation}`);
    }
    await settle();
    if (batch >= WARMUP_BATCHES) snapshots.push({ batch, ...process.memoryUsage() });
  }
  if (runtime) {
    const preceding = await waitForMemoryQuiescence({ label: 'before-attribute-churn', expectedNative: initialAttributeState,
      sample: () => captureMemoryState(observedReferences, nativeRuntime) });
    quiescenceChecks.push(preceding);
    await exerciseAttributeChurn(runtime);
    const beforeComparison = await waitForMemoryQuiescence({ label: 'before-node-comparison', expectedNative: initialAttributeState,
      sample: () => captureMemoryState(observedReferences, nativeRuntime) });
    quiescenceChecks.push(beforeComparison);
    await exerciseNodeComparisons(runtime);
  }
  const endpoint = await waitForMemoryQuiescence({ label: 'terminal', expectedNative: initialAttributeState,
    sample: () => captureMemoryState(observedReferences, nativeRuntime) });
  quiescenceChecks.push(endpoint);
  const terminalMemory = endpoint.state.memory;
  const { documents: survivingDocuments, windows: survivingWindows,
    characterData: survivingCharacterData, attributes: survivingAttributes,
    comparedNodes: survivingComparedNodes } = endpoint.state.survivors;
  const nativeTree = endpoint.state.nativeTree;
  const first = snapshots[0];
  const last = terminalMemory;
  const growth = { heapUsed: last.heapUsed - first.heapUsed, external: last.external - first.external,
    arrayBuffers: last.arrayBuffers - first.arrayBuffers, rss: last.rss - first.rss };
  // These catch substantial retained growth, not every possible leak or peak allocation.
  const budgets = { heapGrowthBytes: 8 * 1024 * 1024, externalGrowthBytes: 4 * 1024 * 1024,
    nativeRssGrowthBytes: 24 * 1024 * 1024 };
  const report = { mode, node: process.version, warmupBatches: WARMUP_BATCHES,
    measuredBatches: MEASURED_BATCHES, operationsPerBatch: OPERATIONS_PER_BATCH,
    totalOperations: (WARMUP_BATCHES + MEASURED_BATCHES) * OPERATIONS_PER_BATCH,
    observedDocuments: references.length, survivingDocuments,
    observedWindows: windowReferences.length, survivingWindows,
    observedCharacterData: characterReferences.length, survivingCharacterData,
    observedAttributes: attributeReferences.length, survivingAttributes,
    observedComparedNodes: comparisonReferences.length, survivingComparedNodes,
    retainedTeardownCallbacks: retainedTeardowns.length,
    retainedForeignSignals: retainedControllers.length,
    nativeTree, initialNativeNodes, initialNativeData,
    initialAttributeState,
    snapshots, terminalMemory, growth, budgets, quiescenceChecks,
    pass: quiescenceChecks.every((check) => check.reached) &&
      survivingDocuments === 0 && survivingWindows === 0 && survivingCharacterData === 0 && survivingAttributes === 0 && survivingComparedNodes === 0 &&
      (!nativeTree || (nativeTree.liveNodes === initialNativeNodes &&
        nativeTree.dataNodes === initialNativeData &&
        nativeTree.attributeCollections === initialAttributeState.attributeCollections &&
        nativeTree.attributeOwners === initialAttributeState.attributeOwners &&
        nativeTree.attributeHolders === initialAttributeState.attributeHolders &&
        nativeTree.indexedNodes === nativeTree.liveNodes &&
        nativeTree.reservedHandles <= nativeTree.handleBatchSize)) && growth.heapUsed < budgets.heapGrowthBytes &&
      growth.external < budgets.externalGrowthBytes && (mode !== 'native' || growth.rss < budgets.nativeRssGrowthBytes) };
  process.stdout.write(JSON.stringify(report));
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
