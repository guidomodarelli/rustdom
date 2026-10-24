/** @file Measures the unchanged public Range operation on fresh realms with paired runtime labels. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { getHeapStatistics } = require('node:v8');
const { collectGarbage } = require('../../../scripts/memory-endpoint.cjs');
const settings = require('./constants/paired.cjs');
const operationCount = settings.operations;
const hash = (value) => createHash('sha256').update(value).digest('hex');

/** Construct the exact table input used by benchmarks/worker.cjs. */
function fixture(size) {
  return '<!doctype html><html><head><title>Benchmark</title></head><body><table>' +
    Array.from({ length: size }, (_, index) =>
      `<tr class="row" data-index="${index}"><td><a href="/row/${index}">Row ${index} &amp; value</a></td><td>${index}</td></tr>`).join('') +
    '</table></body></html>';
}

/** Load the real public API and its own allocation counters; no cache mutation or native stand-in. */
function loadRuntime(root, engine) {
  return { api: require(engine === 'jsdom' ? root : path.join(root, 'dist/index.cjs')),
    native: engine === 'rustdom' ? require(path.join(root, 'dist/native.cjs')) : null };
}

/** Run one fresh public fixture; return scalar results and weak observers only. */
function sample(runtime, size, record = {}) {
  const dom = new runtime.api.JSDOM(fixture(size));
  const weak = { window: new WeakRef(dom.window), document: new WeakRef(dom.window.document) };
  try {
    const document = dom.window.document;
    const nodes = [...document.querySelectorAll('tr')];
    const ranges = nodes.map((node) => { const range = document.createRange(); range.selectNodeContents(node); return range; });
    const lastRange = ranges.at(-1);
    const comparisonMode = dom.window.Range.START_TO_START;
    global.gc?.();
    const before = runtime.native?.NativeRange.statistics();
    let result = 0;
    const start = performance.now();
    for (let iteration = 0; iteration < operationCount; iteration++) {
      const copy = lastRange.cloneRange(); copy.collapse(iteration % 2 === 0);
      result += copy.compareBoundaryPoints(comparisonMode, lastRange);
    }
    const elapsedMs = performance.now() - start;
    const after = runtime.native?.NativeRange.statistics();
    Object.assign(record, { elapsedMs, result, before, after });
    assert.equal(result, settings.operations / 2);
    assert.equal(nodes.length, size);
    for (const [index, range] of ranges.entries()) {
      assert.equal(range.startContainer, nodes[index]); assert.equal(range.endContainer, nodes[index]);
      assert.equal(range.startOffset, 0); assert.equal(range.endOffset, 2); assert.equal(range.collapsed, false);
      assert.equal(nodes[index].getAttribute('data-index'), String(index));
      assert.equal(nodes[index].firstChild.firstChild.textContent, `Row ${index} & value`);
      assert.equal(nodes[index].lastChild.textContent, String(index));
    }
    if (before) assert.equal(after.created - before.created, settings.operations);
    return { elapsedMs, result, outputHash: hash(dom.serialize()), before, after, weak };
  } finally { dom.window.close(); }
}

/** Observe a fixed cleanup schedule outside every timer, including both window and document. */
async function cleanup(observation, runtime) {
  const { weak, ...scalars } = observation;
  const cleanupTrace = [];
  for (let round = 0; round < settings.cleanupRounds; round++) {
    await collectGarbage();
    cleanupTrace.push({ survivors: { window: weak.window.deref() !== undefined, document: weak.document.deref() !== undefined },
      released: runtime.native?.NativeRange.statistics(), memoryAfterCleanup: process.memoryUsage() });
  }
  return { ...scalars, ...cleanupTrace.at(-1), cleanupTrace };
}

/** Exercise separate real classes and native allocation registries before timed samples. */
async function proveIsolation(runtimes) {
  assert.notEqual(runtimes.A.api.JSDOM, runtimes.B.api.JSDOM);
  const first = new runtimes.A.api.JSDOM('<p>first</p>');
  const second = new runtimes.B.api.JSDOM('<p>second</p>');
  try {
    assert.notEqual(first.window.Range.prototype, second.window.Range.prototype);
    assert.equal(first.window.document.body.textContent, 'first');
    assert.equal(second.window.document.body.textContent, 'second');
    if (runtimes.A.native) {
      const otherBefore = runtimes.B.native.NativeRange.statistics().created;
      const ownBefore = runtimes.A.native.NativeRange.statistics().created;
      const range = first.window.document.createRange(); range.selectNodeContents(first.window.document.body);
      assert.equal(runtimes.A.native.NativeRange.statistics().created - ownBefore, 1);
      assert.equal(runtimes.B.native.NativeRange.statistics().created, otherBefore);
      assert.equal(range.toString(), 'first');
    }
  } finally { first.window.close(); second.window.close(); }
}

/** Preserve every completed sample immediately, including evidence preceding a failed assertion. */
async function main(manifestPath, phase, engine, positionText, output) {
  assert.equal(typeof global.gc, 'function', 'Run the paired worker with --expose-gc');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const position = Number(positionText);
  assert.ok(['AA', 'AB'].includes(phase)); assert.ok(['jsdom', 'rustdom'].includes(engine));
  assert.ok(Number.isSafeInteger(position) && position >= 0 && position < settings.workerCount);
  const roots = engine === 'jsdom' ? { A: manifest.copies.J0, B: manifest.copies.J1 }
    : { A: manifest.copies.A0, B: phase === 'AA' ? manifest.copies.A1 : manifest.copies.B };
  assert.equal(fs.existsSync(output), false, 'Preserve existing paired worker output');
  const report = { complete: false, phase, engine, position, node: process.version, v8: process.versions.v8,
    execArgv: process.execArgv, nodeOptionsPresent: Object.hasOwn(process.env, 'NODE_OPTIONS'),
    heapLimitBytes: getHeapStatistics().heap_size_limit, settings, roots, samples: [] };
  const save = () => fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  save();
  try {
    const runtimes = { A: loadRuntime(roots.A, engine), B: loadRuntime(roots.B, engine) };
    await proveIsolation(runtimes);
    const sizes = position % 2 ? [...settings.sizes].reverse() : settings.sizes;
    for (const size of sizes) {
      for (const [warmup, order] of [[true, settings.warmupOrder], [false, settings.measuredOrder]]) {
        for (const [round, originalPair] of order.entries()) {
          const labels = position % 2 ? [...originalPair].reverse() : [...originalPair];
          for (const label of labels) {
            const record = { size, warmup, round, label, complete: false };
            report.samples.push(record); save();
            const observation = await cleanup(sample(runtimes[label], size, record), runtimes[label]);
            Object.assign(record, observation, { complete: true }); save();
            for (const endpoint of observation.cleanupTrace.slice(-2)) {
              assert.deepEqual(endpoint.survivors, { window: false, document: false }, 'Fresh paired owners did not reach two clear endpoints');
              if (endpoint.released) assert.equal(endpoint.released.live, 0, 'Paired Range allocations remain after cleanup');
            }
          }
        }
      }
    }
    report.complete = true; save();
  } catch (error) { report.failure = { message: error.message, stack: error.stack }; save(); throw error; }
}

if (require.main === module) main(...process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
module.exports = { fixture, loadRuntime, sample, cleanup, proveIsolation };
