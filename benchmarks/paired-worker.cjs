/** @file Measures one unchanged public operation per IPC request and releases its owners before replying. */
'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { nodeCloneFixture } = require('./node-clone.cjs');
const { attributeReadFixture } = require('./attribute-reads.cjs');
const { formDataFixture } = require('./form-data.cjs');
const { tableHtml } = require('./input-html.cjs');
const { NODE_CLONE_WORKLOADS, NESTED_TEMPLATE_CLONE_WORKLOAD, NODE_CLONE_DOCUMENT_HTML } = require('./constants/node-clone.cjs');
const { ATTRIBUTE_READ_DOCUMENT_HTML } = require('./constants/attribute-reads.cjs');
const { collectGarbage, waitForMemoryQuiescence, captureMemoryState } = require('../scripts/memory-endpoint.cjs');

const selection = JSON.parse(process.env.RUSTDOM_PAIRED_RUNTIME);
const runtime = selection.kind === 'jsdom' ? require('jsdom') : require(resolve(selection.root, 'dist/index.cjs'));
const nativeBinarySha256 = selection.kind === 'jsdom' ? null : createHash('sha256')
  .update(readFileSync(resolve(selection.root, 'dist/rustdom.node'))).digest('hex');
let busy = false;
let stopping = false;

/** @param {{name:string,size:number}} row - One original workload and input size. @returns {Promise<object>} Scalar sample and bounded release evidence. */
async function sample(row) {
  assert.equal(typeof global.gc, 'function', 'Paired sampling requires --expose-gc');
  await collectGarbage();
  const baseline = runtime.getNativeTreeStatistics?.();
  const cloning = NODE_CLONE_WORKLOADS.includes(row.name) || row.name === NESTED_TEMPLATE_CLONE_WORKLOAD;
  assert.ok(cloning || row.name === 'attribute-get' || row.name === 'form-data-construct');
  assert.ok(Number.isSafeInteger(row.size) && row.size >= 0);
  const html = cloning ? NODE_CLONE_DOCUMENT_HTML : row.name === 'attribute-get' ? ATTRIBUTE_READ_DOCUMENT_HTML : tableHtml(row.size);
  let dom = new runtime.JSDOM(html), work;
  const owners = { windows: [new WeakRef(dom.window)], documents: [new WeakRef(dom.window.document)] };
  let measured;
  try {
    work = cloning ? nodeCloneFixture(runtime, dom.window, row.size, row.name)
      : row.name === 'attribute-get' ? attributeReadFixture(runtime, dom.window, row.size, row.name)
        : formDataFixture(runtime, dom.window, row.size, row.name);
    // Preserve the historical case: no event-loop turn between fresh setup and the timed operation.
    global.gc();
    const readyState = dom.window.document.readyState;
    assert.equal(readyState, 'loading');
    const cpuStart = process.cpuUsage();
    const startedAtMs = performance.now();
    const result = work.run();
    const finishedAtMs = performance.now();
    const cpu = process.cpuUsage(cpuStart);
    await work.validate(result);
    if (row.name === 'form-data-construct') assert.equal(dom.window.document.querySelector('a').textContent, 'Row 0 & value');
    measured = { elapsedMs: finishedAtMs - startedAtMs, startedAtMs, finishedAtMs, cpu,
      documentReadyState: readyState, inputBytes: Buffer.byteLength(html),
      outputHash: createHash('sha256').update(dom.serialize()).update(work.serialize?.() ?? '').digest('hex') };
  } finally {
    work?.dispose(); work = null;
    dom.window.close(); dom = null;
  }
  const endpoint = await waitForMemoryQuiescence({ label: `${row.name}/${row.size}/paired-sample-released`,
    sample: () => captureMemoryState(owners, runtime), expectedNative: baseline });
  assert.equal(endpoint.reached, true, `Paired sample retained owners for ${row.name}/${row.size}`);
  return { ...measured, release: { reached: endpoint.reached, rounds: endpoint.trace.length,
    survivors: endpoint.state.survivors, memory: endpoint.state.memory } };
}

process.on('message', async (request) => {
  if (request.operation === 'stop') { stopping = true; if (!busy && process.connected) process.disconnect(); return; }
  if (busy) { process.send({ id: request.id, error: { message: 'Paired worker received overlapping sample requests' } }); return; }
  busy = true;
  try { process.send({ id: request.id, sample: await sample(request.row) }); }
  catch (error) { process.send({ id: request.id, error: { name: error.name, message: error.message, stack: error.stack } }); }
  finally { busy = false; if (stopping && process.connected) process.disconnect(); }
});
collectGarbage().then(() => process.send({ ready: true, node: process.version, nativeBinarySha256,
  reference: require('jsdom/package.json').version, selection })).catch((error) => { console.error(error); process.exitCode = 1; process.disconnect(); });
