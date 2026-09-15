/** @file Checks collection of real FormData iterator/conversion failures, callbacks and independent Window/Document owners. */
'use strict';
const assert = require('node:assert/strict');
const { writeFileSync, mkdirSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const native = require('../../dist/native.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const HostTypeError = TypeError;
/** Each cycle exercises every new error producer and a partially constructed native list. */
const PHASES = ['iterator-method', 'factory-result', 'next-method', 'next-result', 'partial-next-result', 'string-constructor', 'string-method', 'body-close'];
const OPERATIONS_PER_PHASE = 100;
const CYCLES = 6;

/** @param {object} wrapper - Real DOM wrapper. @returns {object} Existing implementation. */
function implementation(wrapper) {
  return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')];
}

/** @param {number} cycle - Alternates actual realms. @returns {object} Only weak observations outlive the completed synchronous stack. */
function failCycle(cycle) {
  const dom = new runtime.JSDOM('<form><input name="field" value="value"></form>', cycle % 2 ? { runScripts: 'outside-only' } : {});
  const { window } = dom;
  const document = window.document;
  const form = document.querySelector('form');
  const formImpl = implementation(form);
  const field = implementation(form.elements[0]);
  const originalControls = formImpl._getSubmittableElementNodes;
  const originalValue = field._getValue;
  const stringDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'String');
  const typeDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'TypeError');
  const owners = { windows: [new WeakRef(window)], documents: [new WeakRef(document)], callbacks: [], iterators: [], values: [], errors: [] };
  const original = new Error('original body failure', { cause: document });
  const closing = new Error('closing failure', { cause: window });
  const invalid = { window, get toString() { assert.fail('diagnostic must not coerce the invalid slot'); } };
  owners.values.push(new WeakRef(invalid)); owners.errors.push(new WeakRef(original), new WeakRef(closing));
  try {
    for (const phase of PHASES) {
      let closes = 0;
      const rejectTypeLookup = () => { void document; assert.fail('iterator creation must not read global TypeError'); };
      const stringConstructor = () => ({ window, get toWellFormed() { return invalid; } });
      owners.callbacks.push(new WeakRef(rejectTypeLookup), new WeakRef(stringConstructor));
      if (phase === 'factory-result') Object.defineProperty(globalThis, 'TypeError', { configurable: true, get: rejectTypeLookup });
      if (phase === 'string-constructor') globalThis.String = invalid;
      if (phase === 'string-method') globalThis.String = stringConstructor;
      if (phase === 'body-close') field._getValue = () => { throw original; };
      const iterable = { [Symbol.iterator]() {
        if (phase === 'factory-result') return Symbol('factory memory');
        let steps = 0;
        const next = () => {
          void window.document;
          if (phase === 'next-result' || (phase === 'partial-next-result' && steps++ > 0)) return Symbol('step memory');
          return { done: false, value: field };
        };
        const iterator = { next: phase === 'next-method' ? invalid : next,
          return() { closes++; throw closing; } };
        if (owners.iterators.length < PHASES.length * 2) { owners.iterators.push(new WeakRef(iterator)); owners.callbacks.push(new WeakRef(next)); }
        return iterator;
      } };
      if (phase === 'iterator-method') iterable[Symbol.iterator] = invalid;
      formImpl._getSubmittableElementNodes = () => iterable;
      try {
        for (let iteration = 0; iteration < OPERATIONS_PER_PHASE; iteration++) {
          let failed = false;
          try { new window.FormData(form); }
          catch (error) {
            failed = true;
            assert.ok(phase === 'body-close' ? error === original && error.cause === document : error instanceof HostTypeError);
            if (iteration < 2) owners.errors.push(new WeakRef(error));
          }
          assert.equal(failed, true);
        }
        assert.equal(closes, ['string-constructor', 'string-method', 'body-close'].includes(phase) ? OPERATIONS_PER_PHASE : 0);
      } finally {
        Object.defineProperty(globalThis, 'String', stringDescriptor);
        Object.defineProperty(globalThis, 'TypeError', typeDescriptor);
        field._getValue = originalValue;
      }
    }
  } finally {
    formImpl._getSubmittableElementNodes = originalControls;
    window.close();
  }
  assert.equal(native.formDataConstructionStatistics().active, 0);
  return owners;
}

/** @returns {Promise<void>} Save raw endpoints and fail if any realm or temporary native list survives. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, cycles: [], phases: PHASES, operationsPerPhase: OPERATIONS_PER_PHASE, pass: false, nativeBuild: require('../../dist/native-build.json') };
  try {
    await collectGarbage();
    const initialTree = runtime.getNativeTreeStatistics();
    const initialEntries = native.NativeFormDataEntries.statistics();
    for (let cycle = -1; cycle < CYCLES; cycle++) {
      const owners = failCycle(cycle + 1);
      const endpoint = await waitForMemoryQuiescence({ label: cycle < 0 ? 'warmup' : `formdata-iterator-${cycle}`,
        sample: () => captureMemoryState(owners, runtime), expectedNative: initialTree });
      assert.equal(endpoint.reached, true, JSON.stringify(endpoint.state));
      const entries = native.NativeFormDataEntries.statistics();
      for (const field of ['live', 'entries', 'textUnits', 'capacity', 'nameCapacity']) assert.equal(entries[field], initialEntries[field], field);
      assert.equal(native.formDataConstructionStatistics().active, 0);
      assert.equal(native.classReferenceStatistics().cleanupErrors, 0);
      if (cycle < 0) report.warmup = endpoint; else report.cycles.push({ ...endpoint, entries });
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  const path = `reports/memory/formdata-iterator-errors/${report.capturedAt.replaceAll(':', '-')}-${process.version}.json`;
  mkdirSync('reports/memory/formdata-iterator-errors', { recursive: true });
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ path, pass: report.pass, cycles: report.cycles.length, error: report.error }) + '\n');
}
main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
