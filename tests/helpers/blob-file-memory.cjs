/** @file Checks shared Buffer views and visible JS cycles without retaining Blob/Window through native metadata. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const engines = { jsdom: { runtime: require('jsdom'), utils: require('jsdom/lib/jsdom/living/generated/utils.js') },
  rustdom: { runtime: require('../../dist/index.cjs'), utils: require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils.js') } };
/** Large enough to exercise dedicated backing storage rather than only pooled tiny buffers. */
const PAYLOAD_BYTES = 128 * 1024;

/** @param {object} engine - Actual runtime and matching implementation bridge. @param {string} mode - Realm mode. @returns {object} Retained views, bytes and independent weak observations. */
function fixture(engine, mode) {
  const { window } = new engine.runtime.JSDOM('', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const blob = new window.Blob([Buffer.alloc(PAYLOAD_BYTES, 65)], { type: 'TEXT/PLAIN' });
  const file = new window.File([blob], 'original', { lastModified: 42 }); const slice = file.slice(10, 20, 'TEXT/PLAIN');
  const form = new window.FormData(); form.append('value', file, 'renamed'); const renamed = form.get('value');
  const buffer = engine.utils.implForWrapper(slice)._buffer;
  const observed = { documents: [new WeakRef(window.document)], windows: [new WeakRef(window)],
    sourceBlobs: [new WeakRef(blob), new WeakRef(file)], retainedViews: [new WeakRef(slice), new WeakRef(renamed)] };
  window.close(); return { views: [slice, renamed], buffer, observed };
}
/** @param {object} sample - Intentionally retained public views. @returns {void} Verify in a synchronous frame that ends before GC. */
function verifyViews(sample) { assert.equal(sample.views[0].size, 10); assert.equal(sample.views[1].name, 'renamed'); assert.equal(sample.views[1].lastModified, 42); assert.equal(sample.buffer.toString(), 'A'.repeat(10)); }
/** @param {object} engine - Actual runtime and matching bridge. @returns {object} A real JS cycle; no strong reference leaves this function. */
function cycleFixture(engine) {
  const { window } = new engine.runtime.JSDOM(); const blob = new window.Blob(['cycle'], { type: 'TEXT/PLAIN' });
  const buffer = engine.utils.implForWrapper(blob)._buffer; buffer.owner = blob;
  const observed = { documents: [new WeakRef(window.document)], windows: [new WeakRef(window)], blobs: [new WeakRef(blob)], buffers: [new WeakRef(buffer)] };
  window.close(); return observed;
}
/** @returns {Promise<void>} Preserve every finite GC endpoint and memory sample. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, views: [], cycles: [] };
  try {
    for (const [name, engine] of Object.entries(engines)) {
      await collectGarbage(); const baseline = engine.runtime.getNativeTreeStatistics?.();
      for (const mode of ['default', 'vm']) for (let cycle = 0; cycle < 3; cycle++) {
        const sample = fixture(engine, mode); await collectGarbage(); verifyViews(sample);
        const held = captureMemoryState(sample.observed, engine.runtime); assert.equal(held.survivors.sourceBlobs, 0); assert.equal(held.survivors.retainedViews, 2);
        sample.views = null;
        const released = await waitForMemoryQuiescence({ label: `blob-buffer-${name}-${mode}-${cycle}`, sample: () => captureMemoryState(sample.observed, engine.runtime), expectedNative: baseline });
        report.views.push({ name, mode, held, released }); assert.equal(released.reached, true);
        assert.equal(sample.buffer.toString(), 'A'.repeat(10));
      }
      for (let cycle = 0; cycle < 3; cycle++) {
        const observed = cycleFixture(engine);
        const released = await waitForMemoryQuiescence({ label: `blob-cycle-${name}-${cycle}`, sample: () => captureMemoryState(observed, engine.runtime), expectedNative: baseline });
        report.cycles.push({ name, released }); assert.equal(released.reached, true);
      }
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-blob-file.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`); process.stdout.write(`${JSON.stringify({ pass: report.pass, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
