/** @file Measures actual Selection, Range, realm and native-state ownership across separate GC turns. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };

/** @param {object} wrapper - Actual platform wrapper. @returns {object} Implementation observed solely for native-state ownership. */
function implementation(wrapper) { return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')]; }

/** @param {object} runtime - Actual engine. @param {string} mode - Realm mode. @param {string} action - Owner retained across GC. @returns {object} Explicit strong owner and weak observations. */
function fixture(runtime, mode, action) {
  const { window } = new runtime.JSDOM('<p>abcdef</p>', mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const document = window.document; const text = document.querySelector('p').firstChild; const selection = window.getSelection();
  const ranges = []; const errors = [];
  for (let cycle = 0; cycle < 100; cycle++) {
    selection.setBaseAndExtent(text, 5, text, 1); const range = selection.getRangeAt(0);
    ranges.push(new WeakRef(range)); range.setEnd(text, 6); assert.equal(String(selection), 'bcdef');
    const rangeImplementation = implementation(range);
    for (const method of ['toString', 'deleteContents']) {
      const descriptor = Object.getOwnPropertyDescriptor(rangeImplementation, method);
      Object.defineProperty(rangeImplementation, method, { configurable: true, value: null });
      let caught = false;
      try { if (method === 'toString') String(selection); else selection.deleteFromDocument(); }
      catch (error) { assert.equal(error.name, 'TypeError'); errors.push(new WeakRef(error)); caught = true; }
      finally { if (descriptor) Object.defineProperty(rangeImplementation, method, descriptor); else delete rangeImplementation[method]; }
      assert.equal(caught, true);
    }
    selection.collapseToStart(); selection.extend(text, 4);
    assert.throws(() => selection.getRangeAt(1), { name: 'IndexSizeError' });
    if (cycle % 2 === 0) selection.removeAllRanges();
  }
  const observed = { selections: [new WeakRef(selection)], ranges, errors, documents: [new WeakRef(document)], windows: [new WeakRef(window)] };
  const held = action === 'selection' ? selection : action === 'range' ? selection.getRangeAt(0)
    : action === 'native-state' ? implementation(selection)._state : null;
  window.close(); return { held, observed };
}

/** @returns {Promise<void>} Record held and released phases, including native allocation baselines and post-GC process memory. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version,
    methodology: '100 Selection mutation cycles and 200 intrinsic non-callable Range errors per realm; keep Selection, Range or native scalar state separately, close Window, drain timers and perform GC on separate turns. Finally release the owner and require all weak observations and native counters to reach baseline. Finite scenarios do not prove absolute absence of leaks; held realm ownership is recorded, not treated as a leak.',
    pass: false, cases: [] };
  try {
    for (const [engine, runtime] of Object.entries(engines)) for (const mode of ['default', 'vm']) {
      for (const action of ['none', 'selection', 'range', ...(engine === 'rustdom' ? ['native-state'] : [])]) {
        await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.(); const sample = fixture(runtime, mode, action);
        await collectGarbage(); const held = captureMemoryState(sample.observed, runtime);
        const observation = { engine, mode, action, cycles: 100, held };
        report.cases.push(observation);
        if (action === 'selection') assert.equal(held.survivors.selections, 1);
        if (action === 'native-state') {
          assert.equal(sample.held.direction, 1);
          // Keep the Rust state strongly owned while requiring all DOM/error observations to clear.
          // Reuse the same bounded endpoint and two-clear-sample rule as the release phase.
          const expectedHeld = { ...baseline, selectionStates: { ...baseline.selectionStates, live: baseline.selectionStates.live + 1 } };
          observation.heldQuiescence = await waitForMemoryQuiescence({ label: `selection-${engine}-${mode}-native-state-held`,
            sample: () => captureMemoryState(sample.observed, runtime), expectedNative: expectedHeld });
          assert.equal(observation.heldQuiescence.reached, true);
          assert.equal(sample.held.direction, 1);
        }
        sample.held = null;
        observation.released = await waitForMemoryQuiescence({ label: `selection-${engine}-${mode}-${action}`,
          sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        assert.equal(observation.released.reached, true);
      }
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-selection.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`); process.stdout.write(`${JSON.stringify({ pass: report.pass, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
