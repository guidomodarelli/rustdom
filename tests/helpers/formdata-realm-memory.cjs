/** @file Measures closed realm collection while body owners, methods and unfinished form reads remain retained. */
'use strict';
const assert = require('node:assert/strict');
const os = require('node:os');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const runtime = require('../../dist/index.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** Warm constructors and allocators before measuring retained process growth. */
const WARMUP_BATCHES = 2;
/** Repeat independent realm creation, pending consumption and teardown with intentional native roots. */
const MEASURED_BATCHES = 4;
/** Keep the test bounded while retaining every reader from earlier batches. */
const ENVIRONMENTS_PER_BATCH = 4;

/** @param {string} payload - Encoded form body. @returns {{stream: ReadableStream, finish: Function}} A transport body with no browser-realm closure. */
function deferredBody(payload) {
  let controller;
  const stream = new ReadableStream({ start(value) { controller = value; } });
  return { stream, finish() { controller.enqueue(new TextEncoder().encode(payload)); controller.close(); } };
}

/** @param {Promise<FormData>} pending - Pending public read. @returns {Promise<string>} Scalar completion without retaining the result or error. */
function completion(pending) {
  return pending.then(() => 'resolved', (error) => `${error.name}: ${error.message}`);
}

/**
 * Close a realm while preserving constructors, native body owners, methods and unsettled reads.
 * @param {object} environment - Actual Vitest environment.
 * @param {string} mode - Normal or VM setup.
 * @returns {object} Strong native roots, pending transport controls and weak DOM observations.
 */
function fixture(environment, mode) {
  let target = { setTimeout, clearTimeout, TypeError };
  const options = { jsdom: { runScripts: 'outside-only', beforeParse(window) {
    if (mode === 'normal') {
      const originalFetch = window.fetch;
      Object.defineProperty(window, 'fetch', { configurable: true,
        get() { return this === window ? originalFetch : undefined; } });
    }
    // Public constructor and close replacements must not become retained roots or prevent owned cleanup.
    delete window.EventTarget;
    delete window.TypeError;
    window.close = () => {};
  } } };
  const session = mode === 'vm' ? environment.setupVM(options) : environment.setup(target, options);
  if (mode === 'vm') target = session.getVmContext();
  const references = { documents: new WeakRef(target.document), windows: new WeakRef(target.jsdom.window) };
  const transports = [];
  const owners = [];
  const pending = [];
  for (const [contentType, payload] of [
    ['application/x-www-form-urlencoded', 'field=value'],
    ['multipart/form-data; boundary=memory', '--memory\r\nContent-Disposition: form-data; name="file"; filename="file.txt"\r\nContent-Type: text/plain\r\n\r\nvalue\r\n--memory--\r\n'],
  ]) {
    const headers = { 'content-type': contentType };
    const requestTransport = deferredBody(payload);
    const responseTransport = deferredBody(payload);
    const request = new target.Request('http://localhost/upload', { method: 'POST', body: requestTransport.stream, duplex: 'half', headers });
    const response = new target.Response(responseTransport.stream, { headers });
    transports.push(requestTransport, responseTransport);
    owners.push(request, response);
    pending.push(completion(request.formData()), completion(response.formData()));
  }
  const retained = { Request: target.Request, Response: target.Response, fetch: target.fetch,
    fetchAccessor: mode === 'normal' ? Object.getOwnPropertyDescriptor(target, 'fetch').get : null,
    requestMethod: target.Request.prototype.formData, responseMethod: target.Response.prototype.formData,
    owners, requestClone: new target.Request('http://localhost').clone(),
    responseClone: new target.Response('unused').clone(), session };
  session.teardown();
  return { references, retained, pending, finish() { for (const transport of transports) transport.finish(); } };
}

/** @returns {Promise<void>} Prints raw memory traces and fails if closed Documents or Windows remain reachable. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const mode = process.argv[2];
  assert.ok(['normal', 'vm'].includes(mode));
  const environment = (await import('../../src/environments/vitest.mjs')).default;
  await collectGarbage();
  const baseline = runtime.getNativeTreeStatistics();
  const references = { documents: [], windows: [] };
  const held = [];
  const batches = [];
  for (let batch = 0; batch < WARMUP_BATCHES + MEASURED_BATCHES; batch++) {
    const current = [];
    for (let index = 0; index < ENVIRONMENTS_PER_BATCH; index++) {
      const entry = fixture(environment, mode);
      references.documents.push(entry.references.documents);
      references.windows.push(entry.references.windows);
      current.push(entry);
      held.push(entry.retained);
    }
    const pending = await waitForMemoryQuiescence({ label: `pending-reads-${batch}`, expectedNative: baseline,
      sample: () => captureMemoryState(references, runtime) });
    for (const entry of current) entry.finish();
    const completions = await Promise.all(current.flatMap((entry) => entry.pending));
    const settled = await waitForMemoryQuiescence({ label: `settled-reads-${batch}`, expectedNative: baseline,
      sample: () => captureMemoryState(references, runtime) });
    batches.push({ batch, measured: batch >= WARMUP_BATCHES, pending, settled, completions });
    if (!pending.reached || !settled.reached) break;
  }
  const first = batches.find((batch) => batch.measured)?.settled.state.memory;
  const last = batches.at(-1).settled.state.memory;
  const growth = first ? Object.fromEntries(['heapUsed', 'external', 'rss', 'arrayBuffers'].map((field) => [field, last[field] - first[field]])) : null;
  const report = { capturedAt: new Date().toISOString(), mode, node: process.version,
    fingerprints: Object.fromEntries(['src/environments/multipart.cjs', 'src/environments/web-platform.cjs',
      'src/environments/window.cjs', 'src/environments/vitest.mjs', 'src/environments/lifecycle.cjs',
      'dist/rustdom.node'].map((file) => [file, createHash('sha256').update(readFileSync(file)).digest('hex')])),
    machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model },
    methodology: 'Real rustdom addon and public Vitest lifecycle. Two warmup batches, four measured batches, four environments each. Retain Request/Response constructors, methods, clones, instances, fetch, normal-pool accessor adapters and teardown callbacks. Hold native stream bodies open across teardown, require separate Document/Window WeakRefs and native owners to clear before completing pending reads, then require a second quiescent endpoint. Preserve every major-GC trace and heap/external/RSS sample.',
    limitations: 'Finite lifecycle coverage; retained allocator RSS is not a leak proof. Returned FormData/File values are deliberately not retained because DOM values legitimately own their realm. No peak-memory or sanitizer measurement.',
    baseline, warmupBatches: WARMUP_BATCHES, measuredBatches: MEASURED_BATCHES, environmentsPerBatch: ENVIRONMENTS_PER_BATCH,
    observedDocuments: references.documents.length, observedWindows: references.windows.length,
    retainedNativeOwners: held.length * 6, retainedReaderMethods: held.length * 2,
    retainedAccessorAdapters: mode === 'normal' ? held.length : 0,
    batches, growth, pass: batches.length === WARMUP_BATCHES + MEASURED_BATCHES && batches.every((batch) =>
      batch.pending.reached && batch.settled.reached && batch.completions.every((result) => result === 'TypeError: rustdom formData: environment has been disposed')) };
  assert.equal(held.length, references.windows.length);
  mkdirSync('reports/memory', { recursive: true });
  writeFileSync(`reports/memory/${report.capturedAt.replaceAll(':', '-')}-formdata-realm-${mode}.json`,
    `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(JSON.stringify(report));
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
