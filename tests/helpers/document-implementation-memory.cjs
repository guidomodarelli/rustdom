/** @file Measures document-factory ownership and temporary native handles across repeated real creation cycles. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
const native = require('../../dist/native.cjs');
/** Bound each retained batch while exercising successful and exceptional creations. */
const DOCUMENTS_PER_CYCLE = 100;

/** @param {object} runtime - Real engine. @param {string} mode - Realm mode. @returns {object} Strong owners and independent weak observations. */
function fixture(runtime, mode) {
  const { window } = new runtime.JSDOM('<!doctype html>', { url: 'https://memory.example.test/', ...(mode === 'vm' ? { runScripts: 'outside-only' } : {}) });
  const owner = window.document;
  const api = owner.implementation;
  const documents = [], doctypes = [], errors = [];
  for (let index = 0; index < DOCUMENTS_PER_CYCLE; index++) {
    const doctype = api.createDocumentType('root', 'public', 'system');
    const document = index % 2 === 0 ? api.createDocument('urn:root', 'root', doctype) : api.createHTMLDocument('title' + index);
    documents.push(document); doctypes.push(doctype);
    if (index % 10 === 0) {
      try { api.createDocumentType('invalid:name:part', '', ''); }
      catch (error) { assert.equal(error.name, 'InvalidCharacterError'); errors.push(new WeakRef(error)); }
    }
  }
  const observed = { windows: [new WeakRef(window)], ownerDocuments: [new WeakRef(owner)], implementations: [new WeakRef(api)],
    createdDocuments: documents.map((document) => new WeakRef(document)), doctypes: doctypes.map((doctype) => new WeakRef(doctype)), errors };
  window.close();
  return { documents, doctypes, api, observed };
}
/** @param {object} sample - Retained factory results. @returns {void} Verify results without extending owners into an async frame. */
function verifyHeld(sample) {
  assert.equal(sample.api.hasFeature(), true);
  for (let index = 0; index < sample.documents.length; index++) {
    const document = sample.documents[index];
    if (index % 2 === 0) { assert.equal(document.doctype, sample.doctypes[index]); assert.equal(document.documentElement.localName, 'root'); }
    else assert.equal(document.title, 'title' + index);
  }
}
/** @returns {Promise<void>} Persist finite GC observations and exact native-baseline agreement. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    for (const [engine, runtime] of Object.entries(engines)) for (const mode of ['default', 'vm']) {
      const warmup = fixture(runtime, mode); warmup.documents = null; warmup.doctypes = null; warmup.api = null;
      await collectGarbage();
      const warmed = await waitForMemoryQuiescence({ label: 'document-warmup-' + engine + '-' + mode, sample: () => captureMemoryState(warmup.observed, null) });
      assert.equal(warmed.reached, true);
      await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.();
      for (let cycle = 0; cycle < 3; cycle++) {
        const sample = fixture(runtime, mode); await collectGarbage(); verifyHeld(sample);
        const held = captureMemoryState(sample.observed, runtime);
        assert.equal(held.survivors.createdDocuments, DOCUMENTS_PER_CYCLE);
        sample.documents = null; sample.doctypes = null; sample.api = null;
        const released = await waitForMemoryQuiescence({ label: 'document-' + engine + '-' + mode + '-' + cycle,
          sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        report.cycles.push({ engine, mode, cycle, held, released });
        assert.equal(released.reached, true);
        assert.equal(native.documentImplementationStatistics().active, 0);
      }
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true });
  const path = 'reports/memory/' + report.capturedAt.replaceAll(':', '-') + '-document-implementation.json';
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ pass: report.pass, path, error: report.error }) + '\n');
}
main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
