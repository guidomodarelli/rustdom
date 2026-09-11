/** @file Stresses real lifecycle paths and measures retained references and post-GC memory. */
'use strict';
const assert = require('node:assert/strict');

/** Retain small result records, never the DOM objects whose collection is measured. */
const snapshots = [];
/** Deliberately retain teardown callbacks to catch accidental closure ownership. */
const retainedTeardowns = [];
/** Observe targets without keeping them alive. */
const references = [];
/** Warm module caches and native allocators before judging bounded retained growth. */
const WARMUP_BATCHES = 3;
/** Sample enough lifecycle batches to expose a per-window leak. */
const MEASURED_BATCHES = 8;
/** Use several documents per batch while allowing pending readiness callbacks to settle. */
const OPERATIONS_PER_BATCH = 40;

/**
 * Yield past readiness callbacks and request full collections in separate JS jobs.
 * @returns {Promise<void>} Completes two event-loop turns and full GC requests.
 */
async function settle() {
  for (let turn = 0; turn < 2; turn++) {
    await new Promise((resolve) => setImmediate(resolve));
    global.gc();
  }
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
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(document.body, { childList: true, subtree: true });
  dom.window.addEventListener('custom-event', () => document.body);
  dom.window.setInterval(() => document.body, 60_000);
  document.body.innerHTML = `<section data-${identity}="value"><p>updated</p></section>`.repeat(20) + '<iframe></iframe>';
  references.push(new WeakRef(document.querySelector('iframe').contentDocument));
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
  const environment = mode === 'vitest' ? (await import('../src/environments/vitest.mjs')).default : null;
  assert.ok(['jsdom', 'rustdom', 'native', 'vitest'].includes(mode));
  const markup = '<!doctype html><body>' + '<article data-index="1"><h2>Heading</h2><p>content &amp; text</p></article>'.repeat(100);
  for (let batch = 0; batch < WARMUP_BATCHES + MEASURED_BATCHES; batch++) {
    for (let operation = 0; operation < OPERATIONS_PER_BATCH; operation++) {
      if (native) {
        const tape = native.parseDocumentTape(markup + `<unique-${batch}-${operation} data-${batch}-${operation}="value"></unique-${batch}-${operation}>`);
        assert.ok(tape.length > markup.length);
      } else if (environment) {
        const target = { setTimeout, clearTimeout, setInterval, clearInterval };
        const session = environment.setup(target, { jsdom: { runScripts: 'outside-only' } });
        references.push(new WeakRef(target.document));
        target.document.body.innerHTML = '<p>created and released</p>';
        session.teardown();
        retainedTeardowns.push(session);
      } else exerciseWindow(runtime, `${batch}-${operation}`);
    }
    await settle();
    if (batch >= WARMUP_BATCHES) snapshots.push({ batch, ...process.memoryUsage() });
  }
  await settle();
  const survivingDocuments = references.filter((reference) => reference.deref() !== undefined).length;
  const first = snapshots[0];
  const last = snapshots.at(-1);
  const growth = { heapUsed: last.heapUsed - first.heapUsed, external: last.external - first.external,
    arrayBuffers: last.arrayBuffers - first.arrayBuffers, rss: last.rss - first.rss };
  // These catch substantial retained growth, not every possible leak or peak allocation.
  const budgets = { heapGrowthBytes: 8 * 1024 * 1024, externalGrowthBytes: 4 * 1024 * 1024,
    nativeRssGrowthBytes: 24 * 1024 * 1024 };
  const report = { mode, node: process.version, warmupBatches: WARMUP_BATCHES,
    measuredBatches: MEASURED_BATCHES, operationsPerBatch: OPERATIONS_PER_BATCH,
    totalOperations: (WARMUP_BATCHES + MEASURED_BATCHES) * OPERATIONS_PER_BATCH,
    observedDocuments: references.length, survivingDocuments, retainedTeardownCallbacks: retainedTeardowns.length,
    snapshots, growth, budgets,
    pass: survivingDocuments === 0 && growth.heapUsed < budgets.heapGrowthBytes &&
      growth.external < budgets.externalGrowthBytes && (mode !== 'native' || growth.rss < budgets.nativeRssGrowthBytes) };
  process.stdout.write(JSON.stringify(report));
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
