/** @file Checks prepared packages through real public DOM behavior and separate weak Window/Document endpoints. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { verify, verifyFunctionalReport } = require('./prepare-hosted-build.cjs');
const { loadRuntime } = require('./paired-worker.cjs');
const { captureMemoryState, waitForMemoryQuiescence } = require('../../../scripts/memory-endpoint.cjs');
const settings = require('./constants/hosted-build.cjs');

/** @param {object} runtime - Actual independently loaded package. @returns {object} Public results and weak realm observations only. */
function exercise(runtime) {
  const { window } = new runtime.api.JSDOM('<!doctype html><main><p>snow 🦀</p></main>');
  try {
    const root = window.document.querySelector('main');
    const element = window.document.createElement('span');
    element.setAttribute('data-value', '🦀\uD800'); element.textContent = 'changed'; root.append(element);
    const range = window.document.createRange(); range.selectNodeContents(root);
    const fragment = range.cloneContents();
    assert.equal(fragment.textContent, 'snow 🦀changed');
    assert.equal(root.cloneNode(true).outerHTML, root.outerHTML);
    let calls = 0;
    root.addEventListener('prepared', () => calls++);
    element.dispatchEvent(new window.Event('prepared', { bubbles: true }));
    assert.equal(calls, 1);
    return { html: root.outerHTML, text: range.toString(), calls,
      window: new WeakRef(window), document: new WeakRef(window.document) };
  } finally { window.close(); }
}

/** @param {string} directory - Real preparation. @param {object} [preparation] - Actual versioned preparation API. @returns {Promise<void>} Checks packages and native activation without timing samples. */
async function main(directory = process.argv[2], preparation = { verify, verifyFunctionalReport }) {
  const output = path.resolve(directory); const integrity = preparation.verify(output);
  assert.equal(typeof global.gc, 'function');
  const labels = Object.keys(settings.packageSources);
  const runtimes = Object.fromEntries(labels.map((label) => [label,
    loadRuntime(path.join(output, 'packages', label), label.startsWith('J') ? 'jsdom' : 'rustdom')]));
  assert.equal(new Set(labels.map((label) => runtimes[label].api.JSDOM)).size, labels.length);
  const nativeLabels = labels.filter((label) => !label.startsWith('J'));
  const baselines = Object.fromEntries(nativeLabels.map((label) => [label, runtimes[label].api.getNativeTreeStatistics()]));
  const groups = Object.fromEntries(labels.map((label) => [label, { window: [], document: [] }]));
  const results = [];
  for (const label of labels) for (let cycle = 0; cycle < settings.validationCycles; cycle++) {
    const before = Object.fromEntries(nativeLabels.map((name) => [name, runtimes[name].native.NativeRange.statistics().created]));
    const { window, document, ...result } = exercise(runtimes[label]);
    groups[label].window.push(window); groups[label].document.push(document);
    const allocationDelta = Object.fromEntries(nativeLabels.map((name) => [name,
      runtimes[name].native.NativeRange.statistics().created - before[name]]));
    for (const name of nativeLabels) {
      if (name === label) assert.ok(allocationDelta[name] > 0);
      else assert.equal(allocationDelta[name], 0);
    }
    results.push({ label, cycle, result, allocationDelta });
  }
  const expected = results.find((entry) => entry.label === 'J0').result;
  assert.ok(results.every((entry) => JSON.stringify(entry.result) === JSON.stringify(expected)));
  const endpoints = {};
  for (const label of labels) {
    endpoints[label] = await waitForMemoryQuiescence({ label: `prepared-${label}`,
      maxRounds: settings.releaseMaxRounds, timeoutMs: settings.releaseTimeoutMs, expectedNative: baselines[label],
      sample: () => captureMemoryState(groups[label], runtimes[label].api) });
    assert.equal(endpoints[label].reached, true, JSON.stringify(endpoints[label]));
  }
  const report = { pass: true, node: process.version, integrity, baselines,
    measurementExecuted: false, results, observedWindows: results.length, observedDocuments: results.length, endpoints };
  preparation.verifyFunctionalReport(report, integrity);
  process.stdout.write(`${JSON.stringify(report)}\n`);
}
if (require.main === module) main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
module.exports = { main };
