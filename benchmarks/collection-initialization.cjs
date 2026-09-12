/** @file Measures real native constructor cycles with a populated arena and isolated addon processes. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const os = require('node:os');

/** Keep the data table populated, as it is when a DOM constructor enters the native arena. */
const SEED_ELEMENTS = 512;
/** Each measured cycle reserves a handle, initializes a collection, writes metadata and releases it. */
const CYCLES_PER_SAMPLE = 10000;
const WARMUP_SAMPLES = 3;
const MEASURED_SAMPLES = 9;

/** @param {string} path - Artifact path. @returns {string} SHA-256 identity. */
function digest(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }

/** @param {number[]} samples - Millisecond durations. @returns {object} Unfiltered timing summary. */
function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return { samplesMs: samples, medianMs: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    minMs: sorted[0], maxMs: sorted.at(-1), p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] };
}

/** @param {string} addon - Actual native binary. @returns {number[]} Constructor-cycle timings. */
function measure(addon) {
  const { NativeTree } = require(addon);
  const tree = new NativeTree();
  const seeds = [];
  for (let index = 0; index < SEED_ELEMENTS; index += 1) {
    const element = tree.allocate(); tree.initializeAttributeCollection(element); tree.setHtmlElementMetadata(element, 'main');
    seeds.push(element);
  }
  const batchSize = tree.handleBatchSize;
  /** @returns {void} Performs successful constructor/release operations without leaving unused reservations. */
  function cycle() {
    let first = 0;
    for (let iteration = 0; iteration < CYCLES_PER_SAMPLE; iteration += 1) {
      const offset = iteration % batchSize;
      if (offset === 0) first = tree.reserveHandles();
      const element = first + offset;
      tree.initializeAttributeCollection(element); tree.setHtmlElementMetadata(element, 'div'); tree.release(element);
    }
    const remainder = CYCLES_PER_SAMPLE % batchSize;
    if (remainder) for (let offset = remainder; offset < batchSize; offset += 1) tree.release(first + offset);
    const state = tree.statistics();
    assert.equal(state.liveNodes, SEED_ELEMENTS);
    assert.equal(state.dataNodes, SEED_ELEMENTS);
    assert.equal(state.attributeCollections, SEED_ELEMENTS);
    assert.equal(state.reservedHandles, 0);
  }
  for (let warmup = 0; warmup < WARMUP_SAMPLES; warmup += 1) cycle();
  const samples = [];
  for (let sample = 0; sample < MEASURED_SAMPLES; sample += 1) {
    global.gc();
    const started = performance.now(); cycle(); samples.push(performance.now() - started);
    assert.equal(tree.serializeHtml(seeds[0], true, false), '<main></main>');
  }
  for (const seed of seeds) tree.release(seed);
  assert.equal(tree.statistics().liveNodes, 0);
  return samples;
}

if (process.argv[2] === '--worker') {
  process.stdout.write(JSON.stringify(measure(resolve(process.argv[3]))));
} else {
  if (!process.argv[2] || !process.argv[3]) throw new Error('collection-initialization benchmark: supply baseline and candidate addon paths');
  const paths = { baseline: resolve(process.argv[2]), candidate: resolve(process.argv[3]) };
  const orders = [['baseline', 'candidate'], ['candidate', 'baseline']];
  const report = { capturedAt: new Date().toISOString(), node: process.version,
    machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model },
    benchmarkSha256: digest(__filename), cargoLockSha256: digest('Cargo.lock'),
    artifacts: Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, { path, sha256: digest(path) }])),
    methodology: { seedElements: SEED_ELEMENTS, cyclesPerSample: CYCLES_PER_SAMPLE,
      warmupSamples: WARMUP_SAMPLES, measuredSamplesPerProcess: MEASURED_SAMPLES, orders,
      description: 'Fresh process per artifact/order; populated native arena; constructor cycle includes reservation, collection initialization, metadata, release, and state checks. Module load, seed setup and explicit GC are excluded. All samples retained.' },
    limitations: 'One-machine native API measurement, not a complete DOM/runner benchmark or a peak-memory measurement.', runs: [] };
  for (const order of orders) for (const name of order) {
    const worker = spawnSync(process.execPath, ['--expose-gc', __filename, '--worker', paths[name]], { encoding: 'utf8' });
    if (worker.error) throw worker.error;
    if (worker.status !== 0) throw new Error(`collection-initialization benchmark ${name}: ${worker.stderr || worker.status}`);
    report.runs.push({ artifact: name, samplesMs: JSON.parse(worker.stdout) });
  }
  report.baseline = summarize(report.runs.filter((run) => run.artifact === 'baseline').flatMap((run) => run.samplesMs));
  report.candidate = summarize(report.runs.filter((run) => run.artifact === 'candidate').flatMap((run) => run.samplesMs));
  report.baselineOverCandidate = report.baseline.medianMs / report.candidate.medianMs;
  mkdirSync('reports/benchmarks', { recursive: true });
  const output = `reports/benchmarks/${report.capturedAt.replaceAll(':', '-')}-collection-initialization.json`;
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ baseline: report.baseline, candidate: report.candidate,
    baselineOverCandidate: report.baselineOverCandidate })}\nGuardado: ${output}\n`);
}
