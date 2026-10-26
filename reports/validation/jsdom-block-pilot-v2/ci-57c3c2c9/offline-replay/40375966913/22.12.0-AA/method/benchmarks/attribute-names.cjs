/** @file Measures ordered attribute-name enumeration through real DOM and Node-API calls. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { performance } = require('node:perf_hooks');
const { cpus, platform, arch, release, totalmem } = require('node:os');

/** Keep smaller collections and a large adversarial shape, with bounded per-sample work. */
const WORKLOADS = [{ attributes: 128, iterations: 40 }, { attributes: 1024, iterations: 10 },
  { attributes: 4096, iterations: 3 }];
/** Warm JIT paths before preserving every measured sample. */
const WARMUP_SAMPLES = 3;
/** Repeated samples from two fresh processes per engine remain in each report. */
const MEASURED_SAMPLES = 9;
/** Alternate engine order to reduce process-order bias. */
const ORDERS = [['jsdom', 'rustdom'], ['rustdom', 'jsdom']];

/** @param {*} value - JSON-compatible public result. @returns {string} Stable result digest. */
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

/** @param {Function} operation - Real enumeration call. @param {*} expected - Verified public output.
 * @param {number} iterations - Calls per sample. @returns {number[]} Milliseconds per call, including N-API transfers. */
function sample(operation, expected, iterations) {
  const samplesMs = [];
  assert.deepEqual(operation(), expected);
  for (let sampleIndex = 0; sampleIndex < WARMUP_SAMPLES + MEASURED_SAMPLES; sampleIndex++) {
    global.gc();
    let result;
    const start = performance.now();
    for (let iteration = 0; iteration < iterations; iteration++) result = operation();
    const elapsed = performance.now() - start;
    assert.deepEqual(result, expected);
    if (sampleIndex >= WARMUP_SAMPLES) samplesMs.push(elapsed / iterations);
  }
  return samplesMs;
}

/** @param {string} engine - Real implementation name. @returns {Promise<void>} Writes raw worker observations. */
async function worker(engine) {
  const runtime = engine === 'jsdom' ? require('jsdom') : require('../dist/index.cjs');
  const workloads = [];
  for (const { attributes, iterations } of WORKLOADS) {
    let dom = new runtime.JSDOM('<!doctype html><div></div>');
    let element = dom.window.document.querySelector('div');
    const names = Array.from({ length: attributes }, (_, index) => `data-${String(index).padStart(6, '0')}`);
    for (const name of names) element.setAttribute(name, 'value');
    const expected = [...names.map((_, index) => String(index)), ...names];
    const keyOperation = () => Reflect.ownKeys(element.attributes).filter((name) => typeof name === 'string');
    const samplesMs = sample(keyOperation, expected, iterations);
    dom.window.close();
    element = null;
    dom = null;
    await new Promise((resolve) => setImmediate(resolve));
    global.gc();
    workloads.push({ operation: 'Reflect.ownKeys', attributes, iterations, samplesMs,
      outputHash: digest(expected), memoryAfterCleanup: process.memoryUsage() });

    if (engine === 'rustdom') {
      const { NativeTree } = require('../dist/native.cjs');
      const tree = new NativeTree();
      tree.setUnicodeVersion(process.versions.unicode);
      const elementHandle = tree.allocate();
      const handles = [];
      tree.initializeAttributeCollection(elementHandle);
      tree.setHtmlElementMetadata(elementHandle, 'div');
      for (const name of names) {
        const handle = tree.allocate();
        handles.push(handle);
        tree.initializePlainAttribute(handle, name, 'value');
        tree.appendAttribute(elementHandle, handle);
      }
      const nativeSamplesMs = sample(() => tree.attributeNames(elementHandle, true, true), names, iterations);
      tree.release(elementHandle);
      for (const handle of handles) tree.release(handle);
      const statistics = tree.statistics();
      assert.equal(statistics.liveNodes, 0);
      assert.equal(statistics.attributeCollections, 0);
      assert.equal(statistics.attributeHolders, 0);
      workloads.push({ operation: 'NativeTree.attributeNames', attributes, iterations, samplesMs: nativeSamplesMs,
        outputHash: digest(names), statisticsAfterRelease: statistics });
    }
  }
  process.stdout.write(JSON.stringify({ engine, workloads }));
}

/** @param {number[]} values - Per-call durations. @returns {object} Untrimmed distribution summary. */
function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return { count: values.length, medianMs: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], minMs: sorted[0], maxMs: sorted.at(-1) };
}

/** @returns {void} Runs isolated workers and saves baseline or candidate measurements without overwriting history. */
function compare() {
  const label = process.argv[2] || 'current';
  assert.match(label, /^[a-z0-9-]+$/);
  const measuredSources = ['src/dom/attribute_operations.rs', 'src/dom/attribute_index.rs', 'src/dom/unicode_case.rs',
    'benchmarks/attribute-names.cjs', 'Cargo.lock', 'package-lock.json'];
  const report = { schemaVersion: 1, capturedAt: new Date().toISOString(), label, node: process.version,
    unicode: process.versions.unicode, jsdom: require('jsdom/package.json').version,
    nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
    sourceHashes: Object.fromEntries(measuredSources.map((path) => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
    machine: { platform: platform(), arch: arch(), release: release(), cpu: cpus()[0].model,
      logicalCpus: cpus().length, totalMemoryBytes: totalmem() },
    methodology: { build: 'Cargo release, thin LTO', workloads: WORKLOADS, warmupSamples: WARMUP_SAMPLES,
      measuredSamplesPerProcess: MEASURED_SAMPLES, processOrders: ORDERS,
      timing: 'Milliseconds per call. Includes DOM proxy enumeration and filtering symbol keys, or native call plus UTF-16 transfer. Excludes setup, module loading, GC, correctness checks and teardown.',
      correctness: 'Every sample result matches all expected ordered names. Native release counters return to zero. Cross-engine Reflect.ownKeys digests match.',
      memory: 'Public worker snapshots after close, event-loop turn and GC; not peak usage or proof of absence of leaks.',
      limitations: 'Unique short names on one host, not general DOM throughput. Public DOM uses JS wrappers and native collections. NativeTree row is only the native boundary.' },
    runs: [], summaries: [] };
  for (const order of ORDERS) {
    for (const engine of order) {
      process.stderr.write(`Attribute names ${label}: ${engine}, proceso ${report.runs.length + 1}/4\n`);
      const child = spawnSync(process.execPath, ['--expose-gc', __filename, '--worker', engine],
        { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 300_000 });
      if (child.error) throw child.error;
      if (child.status !== 0) throw new Error(`attribute names ${engine} failed (${child.status}): ${child.stderr}`);
      report.runs.push(JSON.parse(child.stdout));
    }
  }
  for (const { attributes } of WORKLOADS) {
    const hashes = report.runs.map((run) => run.workloads.find((workload) =>
      workload.operation === 'Reflect.ownKeys' && workload.attributes === attributes).outputHash);
    assert.ok(hashes.every((hash) => hash === hashes[0]));
    for (const [operation, engines] of [['Reflect.ownKeys', ['jsdom', 'rustdom']], ['NativeTree.attributeNames', ['rustdom']]]) {
      for (const engine of engines) {
        const values = report.runs.filter((run) => run.engine === engine).flatMap((run) => run.workloads.find((workload) =>
          workload.operation === operation && workload.attributes === attributes).samplesMs);
        report.summaries.push({ operation, engine, attributes, ...summarize(values) });
      }
    }
  }
  mkdirSync('reports/benchmarks', { recursive: true });
  const path = `reports/benchmarks/${report.capturedAt.replaceAll(':', '-')}-attribute-names-${label}.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report.summaries, null, 2)}\nGuardado: ${path}\n`);
}

if (process.argv[2] === '--worker') {
  worker(process.argv[3]).catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
} else compare();
