/** @file Compares real native API workloads across two addon artifacts in isolated processes. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const { performance } = require('node:perf_hooks');
const os = require('node:os');

/** Match the repository's warmup and sample policy while retaining every observation. */
const WARMUP_SAMPLES = 3;
const MEASURED_SAMPLES = 9;
/** Each sample exercises this many actual Node-API operations or mutation pairs. */
const OPERATIONS_PER_SAMPLE = 10000;

/** @param {string} path - Built addon path. @returns {string} Artifact identity. */
function digest(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }

/** @param {number[]} samples - Durations in milliseconds. @returns {object} Unfiltered distribution summary. */
function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return { samplesMs: samples, medianMs: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    minMs: sorted[0], maxMs: sorted.at(-1), p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] };
}

/** @param {string} addonPath - Real addon artifact. @returns {object} Measured workloads with correctness checks. */
function measure(addonPath) {
  const { NativeTree, QueryMode } = require(addonPath);
  const tree = new NativeTree();
  const document = tree.allocate(); const parent = tree.allocate(); const child = tree.allocate();
  tree.setSimpleData(document, 9, '');
  tree.setHtmlElement(parent, 'ul', []); tree.setHtmlElement(child, 'li', ['class', 'item']);
  tree.append(document, parent); tree.append(parent, child);
  const expectedHtml = '<ul><li class="item"></li></ul>';
  assert.equal(tree.serializeHtml(parent, true, false), expectedHtml);
  assert.deepEqual(Array.from(tree.query('.item', document, document, QueryMode.All, false)), [child]);
  const workloads = {
    /** @returns {void} Measures a detach/append pair while preserving the same tree. */
    mutation() {
      let count = 0;
      for (let iteration = 0; iteration < OPERATIONS_PER_SAMPLE; iteration += 1) {
        tree.remove(child); count += tree.append(parent, child);
      }
      assert.equal(count, OPERATIONS_PER_SAMPLE);
    },
    /** @returns {void} Measures warm native matching and result allocation. */
    query() {
      let count = 0;
      for (let iteration = 0; iteration < OPERATIONS_PER_SAMPLE; iteration += 1) {
        count += tree.query('.item', document, document, QueryMode.All, false).length;
      }
      assert.equal(count, OPERATIONS_PER_SAMPLE);
    },
    /** @returns {void} Measures HTML serialization and UTF-16 transfer. */
    serialization() {
      let length = 0;
      for (let iteration = 0; iteration < OPERATIONS_PER_SAMPLE; iteration += 1) {
        length += tree.serializeHtml(parent, true, false).length;
      }
      assert.equal(length, expectedHtml.length * OPERATIONS_PER_SAMPLE);
    },
  };
  const results = {};
  for (const [name, workload] of Object.entries(workloads)) {
    for (let warmup = 0; warmup < WARMUP_SAMPLES; warmup += 1) workload();
    results[name] = [];
    for (let sample = 0; sample < MEASURED_SAMPLES; sample += 1) {
      global.gc();
      const started = performance.now(); workload(); results[name].push(performance.now() - started);
      assert.equal(tree.getLinks(child).parent, parent);
      assert.equal(tree.serializeHtml(parent, true, false), expectedHtml);
    }
  }
  tree.release(document); tree.release(parent); tree.release(child);
  assert.equal(tree.statistics().liveNodes, 0);
  return results;
}

if (process.argv[2] === '--worker') {
  process.stdout.write(JSON.stringify(measure(resolve(process.argv[3]))));
} else {
  if (!process.argv[2] || !process.argv[3]) throw new Error('native-activation benchmark: supply baseline and candidate addon paths');
  const paths = { baseline: resolve(process.argv[2]), candidate: resolve(process.argv[3]) };
  const orders = [['baseline', 'candidate'], ['candidate', 'baseline']];
  /** Record the available compiler for locally built artifacts without assuming supplied binaries used it. */
  const rustc = spawnSync('rustc', ['--version'], { encoding: 'utf8' });
  const report = { capturedAt: new Date().toISOString(), node: process.version,
    rustcAvailableAtMeasurement: rustc.status === 0 ? rustc.stdout.trim() : null,
    machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model },
    benchmarkSourceSha256: digest(__filename), cargoLockSha256: digest('Cargo.lock'),
    artifacts: Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, { path, sha256: digest(path) }])),
    methodology: { warmupSamples: WARMUP_SAMPLES, measuredSamplesPerProcess: MEASURED_SAMPLES,
      operationsPerSample: OPERATIONS_PER_SAMPLE, orders,
      description: 'Fresh process per artifact/order; real addon; setup and module load excluded; explicit GC before samples; raw samples retained; output assertions included. Mutation measures remove+append pairs, queries use a warm selector cache.' },
    limitations: 'Native API microbenchmark on one machine; does not measure whole DOM suites, cold startup or memory peaks. Timing differences may be noise.',
    runs: [], comparisons: {} };
  for (const order of orders) {
    for (const name of order) {
      const worker = spawnSync(process.execPath, ['--expose-gc', __filename, '--worker', paths[name]], { encoding: 'utf8' });
      if (worker.error) throw worker.error;
      if (worker.status !== 0) throw new Error(`native-activation benchmark ${name}: ${worker.stderr || worker.status}`);
      report.runs.push({ artifact: name, results: JSON.parse(worker.stdout) });
    }
  }
  for (const workload of ['mutation', 'query', 'serialization']) {
    const baseline = summarize(report.runs.filter((run) => run.artifact === 'baseline').flatMap((run) => run.results[workload]));
    const candidate = summarize(report.runs.filter((run) => run.artifact === 'candidate').flatMap((run) => run.results[workload]));
    report.comparisons[workload] = { baseline, candidate, baselineOverCandidate: baseline.medianMs / candidate.medianMs };
  }
  mkdirSync('reports/benchmarks', { recursive: true });
  const output = `reports/benchmarks/${report.capturedAt.replaceAll(':', '-')}-native-activation.json`;
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report.comparisons, null, 2)}\nGuardado: ${output}\n`);
}
