/** @file Finite owner/result lifecycle checks for complete, aborted and pending FileReader operations. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };

/** @returns {Promise<void>} Drain the fixed two-stage read and any abort notification callbacks. */
async function settle() { for (let turn = 0; turn < 6; turn++) await new Promise((resolve) => setImmediate(resolve)); }
/** @param {object} runtime - Actual engine. @param {string} mode - Realm mode. @param {string} action - Lifecycle case. @returns {object} Strong owners and independent weak observations. */
function fixture(runtime, mode, action) {
  const { window } = new runtime.JSDOM('', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const documentReference = new WeakRef(window.document);
  const reader = new window.FileReader(); const blob = new window.Blob([new Uint8Array([65, 0, 66, 0])]);
  if (action === 'abort-progress') reader.onprogress = () => reader.abort();
  if (action === 'text') reader.readAsText(blob, 'utf-16le'); else reader.readAsArrayBuffer(blob);
  if (action === 'abort-before') reader.abort(); if (action === 'close-pending') window.close();
  return { window, reader, result: null, observed: { documents: [documentReference],
    windows: [new WeakRef(window)], readers: [new WeakRef(reader)], blobs: [new WeakRef(blob)] } };
}
/** @param {object} sample - Completed fixture. @returns {void} Copy only the public result before releasing direct Window ownership. */
function retainResult(sample) { sample.result = sample.reader.result; sample.observed.results = sample.result && typeof sample.result === 'object' ? [new WeakRef(sample.result)] : []; sample.window.close(); sample.window = null; }
/** @returns {Promise<void>} Save owner and result stages without claiming a retained foreign ArrayBuffer cannot retain its realm. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    for (const [engine, runtime] of Object.entries(engines)) for (const mode of ['default', 'vm']) {
      await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.();
      for (const action of ['buffer', 'text', 'abort-before', 'abort-progress', 'close-pending']) {
        const sample = fixture(runtime, mode, action); await settle(); retainResult(sample); await collectGarbage();
        const heldReader = captureMemoryState(sample.observed, runtime); assert.equal(heldReader.survivors.readers, 1);
        sample.reader = null; await collectGarbage(); const heldResult = captureMemoryState(sample.observed, runtime);
        assert.equal(heldResult.survivors.readers, 0);
        if (sample.result && typeof sample.result === 'object') assert.deepEqual([...new Uint8Array(sample.result)], [65, 0, 66, 0]);
        if (action === 'text') assert.equal(sample.result, 'AB');
        sample.result = null;
        const released = await waitForMemoryQuiescence({ label: `reader-${engine}-${mode}-${action}`, sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        report.cycles.push({ engine, mode, action, heldReader, heldResult, released }); assert.equal(released.reached, true);
      }
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-file-reader.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`); process.stdout.write(`${JSON.stringify({ pass: report.pass, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
