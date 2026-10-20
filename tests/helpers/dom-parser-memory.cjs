/** @file Measures recovered CharacterData, thrown owners and intrinsic errors with separate Window/Document observations. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const { DOCUMENTS_PER_CYCLE, MEASURED_CYCLES } = require('../../scripts/constants/dom-parser-memory.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };

/**
 * Release every strong local owner after exercising XML recovery and failing text operations.
 * @param {object} runtime - Real engine.
 * @param {string} mode - Default or VM realm.
 * @returns {object} Weak observations, never strong DOM or error references.
 */
function batch(runtime, mode) {
  const observed = { windows: [], documents: [], recoveredDocuments: [], parsers: [], texts: [], ranges: [], normalizationGroups: [], thrownOwners: [], errors: [] };
  for (let index = 0; index < DOCUMENTS_PER_CYCLE; index++) {
    const dom = new runtime.JSDOM('', mode === 'vm' ? { runScripts: 'outside-only' } : {});
    try {
      const parser = new dom.window.DOMParser();
      const owner = parser[Object.getOwnPropertySymbols(parser).find((symbol) => symbol.description === 'impl')];
      const original = owner.createScriptingDisabledDocument;
      const thrownOwner = { document: dom.window.document };
      let calls = 0;
      owner.createScriptingDisabledDocument = function (...args) {
        if (++calls === 1) throw (index % 2 === 0 ? 42 : thrownOwner);
        return Reflect.apply(original, this, args);
      };
      const document = parser.parseFromString('<root/>', 'text/xml');
      const text = document.documentElement.firstChild;
      assert.equal(text.data, undefined);
      assert.equal(text.cloneNode().data, undefined);
      const range = document.createRange();
      range.selectNode(text);
      observed.ranges.push(new WeakRef(range));
      for (const operation of [() => text.length, () => text.substringData(0, 0), () => text.appendData('x'),
        () => range.toString(), () => range.cloneContents(), () => range.extractContents(), () => range.deleteContents(),
        () => {
          const group = document.createElement('group');
          const clone = text.cloneNode();
          group.append(document.createTextNode('a'), clone);
          observed.normalizationGroups.push(new WeakRef(group));
          observed.texts.push(new WeakRef(clone));
          group.normalize();
        }]) {
        let caught = false;
        try { operation(); } catch (error) {
          assert.equal(error.name, 'TypeError');
          observed.errors.push(new WeakRef(error));
          caught = true;
        }
        assert.equal(caught, true);
      }
      observed.windows.push(new WeakRef(dom.window));
      observed.documents.push(new WeakRef(dom.window.document));
      observed.recoveredDocuments.push(new WeakRef(document));
      observed.parsers.push(new WeakRef(parser));
      observed.texts.push(new WeakRef(text));
      observed.thrownOwners.push(new WeakRef(thrownOwner));
    } finally {
      dom.window.close();
    }
  }
  return observed;
}

/** @returns {Promise<void>} Save raw GC endpoints and bounded lifetime assertions for both real engines. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version,
    oracle: require('jsdom/package.json').version, documentsPerCycle: DOCUMENTS_PER_CYCLE,
    measuredCycles: MEASURED_CYCLES, pass: false, cases: [],
    methodology: 'One warmup and four measured cycles per engine and realm. Each cycle creates twenty Windows, owner Documents, XML recovery Documents, parsers, undefined Texts and Ranges; throws primitives and objects owning a Document, clones Text and creates CharacterData/Range intrinsic length errors. Close Windows, drop all strong owners, drain event-loop turns and require separate weak observations plus native counters to return to baseline. Record heap/external/RSS after GC. Finite scenarios cannot prove absolute absence of memory leaks; allocator retention is not classified as a leak.' };
  try {
    for (const [engine, runtime] of Object.entries(engines)) for (const mode of ['default', 'vm']) {
      for (let cycle = -1; cycle < MEASURED_CYCLES; cycle++) {
        await collectGarbage();
        const expectedNative = runtime.getNativeTreeStatistics?.();
        const observed = batch(runtime, mode);
        const endpoint = await waitForMemoryQuiescence({ label: `${engine}-${mode}-${cycle}`,
          sample: () => captureMemoryState(observed, runtime), expectedNative });
        report.cases.push({ engine, mode, cycle, endpoint });
        assert.equal(endpoint.reached, true, JSON.stringify(endpoint.state));
      }
    }
    report.pass = true;
  } catch (error) {
    report.error = error.stack;
    process.exitCode = 1;
  }
  mkdirSync('reports/memory/dom-parser', { recursive: true });
  const path = `reports/memory/dom-parser/${report.capturedAt.replaceAll(':', '-')}-${process.version}.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ path, pass: report.pass, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
