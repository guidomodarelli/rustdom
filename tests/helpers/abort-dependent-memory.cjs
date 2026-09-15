/** @file Verifies weak dependent ownership, required callback retention and independent realm teardown. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { cpus, platform, arch, release, totalmem } = require('node:os');
const runtime = require('../../dist/index.cjs');
const { NativeAbortState } = require('../../dist/native.cjs');
const utils = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** Bounds repeated live-source churn independently of GC retries. */
const SIGNALS_PER_CYCLE = 1000;
/** Exercises repeated release rather than a single successful collection. */
const RELEASE_CYCLES = 5;

/** @param {Window} window - Fixture realm. @param {AbortSignal} source - Retained root. @returns {object} Weak observations only. */
function discardedDependents(window, source) {
  const signals = [];
  for (let index = 0; index < SIGNALS_PER_CYCLE; index++) signals.push(new WeakRef(window.AbortSignal.any([source])));
  return { signals };
}

/** @param {Window} window - Fixture realm. @param {AbortSignal} source - Retained root. @param {string[]} trace - Scalar callback observations. @returns {object} Weak observations after removing all observable work. */
function inactiveDependents(window, source, trace) {
  const signals = [];
  for (const mode of ['removed-listener', 'removed-algorithm', 'null-handler', 'consumed-once', 'other-event', 'empty-sources']) {
    const signal = window.AbortSignal.any(mode === 'empty-sources' ? [] : [source]);
    const callback = () => trace.push(mode);
    if (mode === 'removed-algorithm') {
      const implementation = utils.implForWrapper(signal);
      implementation._addAlgorithm(callback); implementation._removeAlgorithm(callback);
    } else if (mode === 'null-handler') {
      signal.onabort = callback; signal.onabort = null;
    } else if (mode === 'consumed-once') {
      signal.addEventListener('abort', callback, { once: true });
      signal.dispatchEvent(new window.Event('abort'));
      assert.equal(signal.aborted, false);
    } else if (mode === 'other-event') signal.addEventListener('other', callback);
    else {
      signal.addEventListener('abort', callback);
      if (mode === 'removed-listener') signal.removeEventListener('abort', callback);
    }
    signals.push(new WeakRef(signal));
  }
  return { signals };
}

/** @param {Window} window - Fixture realm. @param {AbortSignal} source - Retained root. @param {string[]} trace - Scalar callback observations. @returns {object} Weak observations whose public wrappers must remain alive. */
function activeDependents(window, source, trace) {
  const signals = [];
  for (const mode of ['listener', 'handler', 'once', 'object-listener', 'algorithm', 'nested']) {
    const signal = window.AbortSignal.any([source]);
    const callback = (event) => { trace.push(mode); if (event) assert.equal(event.target.reason, 'winner'); };
    if (mode === 'algorithm') utils.implForWrapper(signal)._addAlgorithm(callback);
    else if (mode === 'handler') signal.onabort = callback;
    else if (mode === 'object-listener') signal.addEventListener('abort', { handleEvent: callback });
    else if (mode === 'nested') {
      const nested = window.AbortSignal.any([signal]);
      nested.addEventListener('abort', callback);
      signals.push(new WeakRef(nested));
      continue;
    } else signal.addEventListener('abort', callback, { once: mode === 'once' });
    signals.push(new WeakRef(signal));
  }
  return { signals };
}

/** @param {AbortSignal} source - Root in another realm. @param {string[]|null} trace - Optional observer requiring retention. @returns {object} Distinct weak document/window/signal observations. */
function foreignDependent(source, trace = null) {
  const foreign = new runtime.JSDOM('<button></button>', { runScripts: 'outside-only' });
  const document = foreign.window.document;
  const signal = foreign.window.AbortSignal.any([source]);
  if (trace) signal.onabort = () => trace.push('foreign');
  const observed = { signals: [new WeakRef(signal)], documents: [new WeakRef(document)], windows: [new WeakRef(foreign.window)] };
  foreign.window.close();
  return observed;
}

/** @param {Window} window - Fixture realm. @returns {object} A retained composite and native root handle, with a collectible source owner. */
function detachedSource(window) {
  const controller = new window.AbortController();
  const combined = window.AbortSignal.any([controller.signal]);
  return { combined, state: utils.implForWrapper(controller.signal)._abortState,
    observed: { signals: [new WeakRef(controller.signal)], controllers: [new WeakRef(controller)] } };
}

/** @param {Window} window - Fixture realm. @param {AbortSignal} source - Live root. @returns {object} Retains metadata independently of its collectible V8 owner. */
function discardedOwnerWithNativeHandle(window, source) {
  const signal = window.AbortSignal.any([source]);
  return { state: utils.implForWrapper(signal)._abortState, observed: { signals: [new WeakRef(signal)] } };
}

/** @param {Window} window - Fixture realm. @returns {object} Keeps an aborted source alive after an algorithm interrupts delivery. */
function failedAbort(window) {
  const controller = new window.AbortController();
  const dependent = window.AbortSignal.any([controller.signal]);
  const failure = new Error('abort-retention intentional algorithm failure');
  const trace = [];
  dependent.onabort = () => trace.push('unexpected');
  utils.implForWrapper(controller.signal)._addAlgorithm(() => { throw failure; });
  assert.throws(() => controller.abort('failure'), (error) => error === failure);
  assert.equal(dependent.reason, 'failure'); assert.deepEqual(trace, []);
  return { controller, observed: { signals: [new WeakRef(dependent)] } };
}

/** @param {object} report - Durable scalar report. @param {string} label - Scenario name. @param {object} observed - Weak observations. @param {object|undefined} baseline - Optional exact native endpoint. @returns {Promise<void>} Asserts two consecutive clear samples with finite retries. */
async function released(report, label, observed, baseline) {
  const endpoint = await waitForMemoryQuiescence({ label, sample: () => captureMemoryState(observed, baseline ? runtime : null), expectedNative: baseline });
  report.scenarios.push(endpoint);
  assert.equal(endpoint.reached, true, `${label}: ${JSON.stringify(endpoint.state)}`);
}

/** @returns {Promise<void>} Runs observable retention and release scenarios through the real addon. */
async function main() {
  assert.equal(typeof global.gc, 'function');
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, signalsPerCycle: SIGNALS_PER_CYCLE, cycles: RELEASE_CYCLES, scenarios: [],
    host: { platform: platform(), arch: arch(), release: release(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem() },
    nativeBuild: require('../../dist/native-build.json') };
  let dom;
  try {
    await collectGarbage(); const initial = runtime.getNativeTreeStatistics();
    dom = new runtime.JSDOM('<button></button>');
    let controller = new dom.window.AbortController();
    await released(report, 'warmup', discardedDependents(dom.window, controller.signal));
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    report.baseline = captureMemoryState({}, runtime);
    for (let cycle = 0; cycle < RELEASE_CYCLES; cycle++) {
      await released(report, `discarded-${cycle}`, discardedDependents(dom.window, controller.signal), baseline);
      await released(report, `foreign-${cycle}`, foreignDependent(controller.signal), baseline);
    }
    const failed = failedAbort(dom.window);
    await released(report, 'interrupted-abort', failed.observed);
    failed.controller = null;
    await released(report, 'interrupted-abort-teardown', {}, baseline);
    const discarded = discardedOwnerWithNativeHandle(dom.window, controller.signal);
    await released(report, 'discarded-owner-with-native-handle', discarded.observed);
    const trace = [];
    await released(report, 'inactive-work', inactiveDependents(dom.window, controller.signal, trace));
    assert.deepEqual(trace, ['consumed-once']); trace.length = 0;
    const active = activeDependents(dom.window, controller.signal, trace);
    const foreign = foreignDependent(controller.signal, trace);
    await collectGarbage();
    report.active = captureMemoryState({ ...active, foreignSignals: foreign.signals, documents: foreign.documents, windows: foreign.windows }, runtime);
    assert.deepEqual(report.active.survivors, { signals: 6, foreignSignals: 1, documents: 1, windows: 1 });
    controller.abort('winner');
    assert.deepEqual(trace, ['listener', 'handler', 'once', 'object-listener', 'algorithm', 'nested', 'foreign']);
    assert.equal(discarded.state.aborted, true);
    discarded.state = null;
    await released(report, 'after-abort', { signals: [...active.signals, ...foreign.signals], documents: foreign.documents, windows: foreign.windows }, baseline);

    const detached = detachedSource(dom.window);
    await released(report, 'collected-source-with-native-handle', detached.observed);
    let nested = dom.window.AbortSignal.any([detached.combined]);
    assert.equal(nested.aborted, false);
    detached.state = null; detached.combined = null;
    const closing = { documents: [new WeakRef(dom.window.document)], windows: [new WeakRef(dom.window)] };
    nested = null; controller = null;
    dom.window.close(); dom = null;
    await released(report, 'complete-teardown', closing, initial);
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  finally { dom?.window.close(); }
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-abort-dependent-retention.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
