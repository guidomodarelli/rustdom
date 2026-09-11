/** @file Stresses real lifecycle paths and measures retained references and post-GC memory. */
'use strict';
const assert = require('node:assert/strict');

/** Retain small result records, never the DOM objects whose collection is measured. */
const snapshots = [];
/** Deliberately retain teardown callbacks to catch accidental closure ownership. */
const retainedTeardowns = [];
/** Observe targets without keeping them alive. */
const references = [];
/** Observe Window proxies too: close() can release a Document while a Window remains retained. */
const windowReferences = [];
/** Keep foreign signals alive to expose missed cross-realm listener cleanup. */
const retainedControllers = [];
/** Warm module caches and native allocators before judging bounded retained growth. */
const WARMUP_BATCHES = 3;
/** Sample enough lifecycle batches to expose a per-window leak. */
const MEASURED_BATCHES = 8;
/** Use several documents per batch while allowing pending readiness callbacks to settle. */
const OPERATIONS_PER_BATCH = 40;

/**
 * Drain readiness/finalization callbacks and request explicit asynchronous major collections.
 * @returns {Promise<void>} Completes collections after the current JavaScript stack has unwound.
 */
async function settle() {
  for (let turn = 0; turn < 2; turn++) {
    await new Promise((resolve) => setImmediate(resolve));
    await global.gc({ type: 'major', execution: 'async' });
  }
  await new Promise((resolve) => setImmediate(resolve));
}

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
  observer.observe(document.body, { childList: true, subtree: true });
  dom.window.addEventListener('custom-event', () => document.body);
  dom.window.setInterval(() => document.body, 60_000);
  document.body.innerHTML = `<section data-${identity}="value"><p>updated</p></section>`.repeat(20) + '<iframe></iframe>';
  references.push(new WeakRef(document.querySelector('iframe').contentDocument));
  windowReferences.push(new WeakRef(document.querySelector('iframe').contentWindow));
  // Leave the observer connected: closing the window must release the entire cycle.
  references.push(new WeakRef(document));
  dom.window.close();
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
  await settle();
  const terminalMemory = process.memoryUsage();
  const survivingDocuments = references.filter((reference) => reference.deref() !== undefined).length;
  const survivingWindows = windowReferences.filter((reference) => reference.deref() !== undefined).length;
  const nativeTree = nativeRuntime?.getNativeTreeStatistics();
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
    retainedTeardownCallbacks: retainedTeardowns.length,
    retainedForeignSignals: retainedControllers.length,
    nativeTree, initialNativeNodes, initialNativeData,
    snapshots, terminalMemory, growth, budgets,
    pass: survivingDocuments === 0 && survivingWindows === 0 &&
      (!nativeTree || (nativeTree.liveNodes === initialNativeNodes &&
        nativeTree.dataNodes === initialNativeData &&
        nativeTree.indexedNodes === nativeTree.liveNodes &&
        nativeTree.reservedHandles <= nativeTree.handleBatchSize)) && growth.heapUsed < budgets.heapGrowthBytes &&
      growth.external < budgets.externalGrowthBytes && (mode !== 'native' || growth.rss < budgets.nativeRssGrowthBytes) };
  process.stdout.write(JSON.stringify(report));
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
