/** @file Checks File removal, iterator/view ownership and native-list independence through real GC. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };

/** @param {object} wrapper - Actual platform object. @returns {object} Real implementation for observing serializer/native ownership. */
function implementation(wrapper) { return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')]; }
/** @param {object} runtime - Engine. @param {string} mode - Realm mode. @param {string} action - Ownership case. @returns {object} Explicit strong owners and independent WeakRefs. */
function fixture(runtime, mode, action) {
  const { window } = new runtime.JSDOM('', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const document = window.document; const data = new window.FormData();
  const old = new window.File([new Uint8Array([0, 128, 255])], 'old', { lastModified: 42 });
  data.append('field', old); data.append('field', old); data.append('text', 'kept');
  let held = null;
  if (action === 'iterator') { held = data.entries(); held.next(); }
  if (action === 'view') held = implementation(data)._entries;
  if (action === 'native-list') held = implementation(data)._nativeEntries;
  if (action === 'native-ids') held = implementation(data)._nativeEntries.allIds();
  if (action === 'set-string') data.set('field', 'replaced');
  else if (action === 'set-file') data.set('field', new window.File(['new'], 'new', { lastModified: 99 }));
  else if (action !== 'native-list' && action !== 'native-ids') data.delete('field');
  window.close();
  return { data, held, observed: { forms: [new WeakRef(data)], files: [new WeakRef(old)],
    documents: [new WeakRef(document)], windows: [new WeakRef(window)] } };
}

/** @param {object} runtime - Actual engine. @param {string} mode - Realm mode. @returns {object} Weak owners after repeatedly failing a partially populated constructor. */
function failedConstructors(runtime, mode) {
  const { window } = new runtime.JSDOM('<form><input name="first" value="kept"><input name="failure"></form>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const document = window.document; const form = document.querySelector('form'); const marker = { document };
  implementation(form.elements[1])._getValue = () => { throw marker; };
  for (let cycle = 0; cycle < 100; cycle++) assert.throws(() => new window.FormData(form), (error) => error === marker);
  window.close(); return { documents: [new WeakRef(document)], windows: [new WeakRef(window)], errors: [new WeakRef(marker)] };
}

/** @returns {Promise<void>} Validate finite retention stages and preserve every observation. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cases: [] };
  try {
    for (const [engine, runtime] of Object.entries(engines)) for (const mode of ['default', 'vm']) {
      const actions = ['delete', 'set-string', 'set-file', 'iterator', 'view', ...(engine === 'rustdom' ? ['native-list', 'native-ids'] : [])];
      for (const action of actions) {
        await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.();
        const sample = fixture(runtime, mode, action); await collectGarbage();
        const heldForm = captureMemoryState(sample.observed, runtime);
        assert.equal(heldForm.survivors.forms, 1);
        assert.equal(heldForm.survivors.files, ['view', 'native-list', 'native-ids'].includes(action) ? 1 : 0);
        sample.data = null; await collectGarbage(); const heldExternal = captureMemoryState(sample.observed, runtime);
        assert.equal(heldExternal.survivors.forms, action === 'iterator' ? 1 : 0);
        assert.equal(heldExternal.survivors.files, action === 'view' ? 1 : 0);
        if (action === 'native-list') { assert.equal(sample.held.get('text'), 'kept'); assert.equal(heldExternal.survivors.documents, 0); assert.equal(heldExternal.survivors.windows, 0); }
        if (action === 'native-ids') { assert.equal(sample.held.length, 3); assert.equal(heldExternal.survivors.documents, 0); assert.equal(heldExternal.survivors.windows, 0); }
        sample.held = null;
        const released = await waitForMemoryQuiescence({ label: `form-data-${engine}-${mode}-${action}`, sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        report.cases.push({ engine, mode, action, heldForm, heldExternal, released }); assert.equal(released.reached, true);
      }
      await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.(); const observed = failedConstructors(runtime, mode);
      const released = await waitForMemoryQuiescence({ label: `form-data-errors-${engine}-${mode}`, sample: () => captureMemoryState(observed, runtime), expectedNative: baseline });
      report.cases.push({ engine, mode, action: 'failed-constructor', cycles: 100, released }); assert.equal(released.reached, true);
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-form-data.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`); process.stdout.write(`${JSON.stringify({ pass: report.pass, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
