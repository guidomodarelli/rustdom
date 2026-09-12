/** @file Compares native attribute bursts against two actual release addons. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

/** @param {number[]} values - Raw durations. @returns {number} Median duration in milliseconds. */
function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** @param {string} binary - Actual release addon. @returns {object[]} Measured native API operations. */
function measure(binary) {
  const { NativeTree } = require(path.resolve(binary));
  return [32, 1024].map((count) => {
    const tree = new NativeTree();
    const element = tree.allocate();
    tree.initializeAttributeCollection(element);
    tree.setHtmlElementMetadata(element, 'div');
    const attributes = Array.from({ length: count }, (_, index) => {
      const attribute = tree.allocate();
      tree.initializePlainAttribute(attribute, `data-${index}`, `value-${index}`);
      return attribute;
    });
    const samplesMs = [];
    const insertionSamplesMs = [];
    const burstSamplesMs = [];
    for (let iteration = 0; iteration < 12; iteration++) {
      const insertionStarted = performance.now();
      for (const attribute of attributes) tree.appendAttribute(element, attribute);
      const insertionDuration = performance.now() - insertionStarted;
      assert.equal(tree.attributeCount(element), count);
      const started = performance.now();
      for (let index = attributes.length - 1; index >= 0; index--) tree.removeAttribute(element, attributes[index]);
      const duration = performance.now() - started;
      assert.deepEqual(tree.attributeIds(element), []);
      assert.equal(tree.serializeHtml(element, true, false), '<div></div>');
      assert.equal(tree.statistics().attributeOwners, 0);
      assert.equal(tree.statistics().attributeHolders, 0);
      if (iteration >= 3) {
        samplesMs.push(duration);
        insertionSamplesMs.push(insertionDuration);
        burstSamplesMs.push(insertionDuration + duration);
      }
    }
    for (const attribute of attributes) tree.release(attribute);
    tree.release(element);
    assert.equal(tree.statistics().liveNodes, 0);
    return { count, samplesMs, insertionSamplesMs, burstSamplesMs };
  });
}

if (process.argv[2] === '--worker') {
  process.stdout.write(JSON.stringify(measure(process.argv[3])));
} else {
  const binaries = { baseline: path.resolve(process.argv[2] || '.cache/baseline-rustdom.node'),
    candidate: path.resolve(process.argv[3] || 'dist/rustdom.node') };
  const report = {
    capturedAt: new Date().toISOString(), node: process.version,
    machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model,
      logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem() },
    binaries: Object.fromEntries(Object.entries(binaries).map(([label, binary]) => [label, {
      sha256: createHash('sha256').update(readFileSync(binary)).digest('hex'),
    }])),
    methodology: 'Two fresh processes per addon in alternating order; three warmups and nine raw samples per size per process. One live native element and preinitialized Attr handles persist across each burst. Insertion and removal phases are timed separately; their sum reports the full burst and includes table regrowth after compaction. Timing includes indexes, cache refresh and Node-API transfer; excludes setup, assertions between phases, handle release and module startup. Both addons use cargo release with thin LTO.',
    limitations: 'Native API microbenchmark on one host, not full DOM/Jest/Vitest suite timing. Retained capacity is validated separately by Rust tests. No memory-peak measurement. Ratios greater than one favor the candidate.',
    runs: [], comparisons: [],
  };
  for (const label of ['baseline', 'candidate', 'candidate', 'baseline']) {
    const child = spawnSync(process.execPath, [__filename, '--worker', binaries[label]], {
      encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 300_000,
    });
    if (child.error) throw child.error;
    if (child.status !== 0) throw new Error(`Attribute capacity benchmark ${label} failed: ${child.stderr}`);
    report.runs.push({ label, workloads: JSON.parse(child.stdout) });
  }
  for (const count of [32, 1024]) {
    for (const [operation, sampleField] of [['insertion', 'insertionSamplesMs'], ['removal', 'samplesMs'], ['burst', 'burstSamplesMs']]) {
      const durations = Object.fromEntries(['baseline', 'candidate'].map((label) => [label,
        report.runs.filter((run) => run.label === label).flatMap((run) =>
          run.workloads.find((workload) => workload.count === count)[sampleField])]));
      report.comparisons.push({ count, operation, baselineMedianMs: median(durations.baseline),
        candidateMedianMs: median(durations.candidate), ratio: median(durations.baseline) / median(durations.candidate) });
    }
  }
  mkdirSync('reports/benchmarks', { recursive: true });
  const output = `reports/benchmarks/${report.capturedAt.replaceAll(':', '-')}-attribute-capacity.json`;
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report.comparisons, null, 2)}\nGuardado: ${output}\n`);
}
