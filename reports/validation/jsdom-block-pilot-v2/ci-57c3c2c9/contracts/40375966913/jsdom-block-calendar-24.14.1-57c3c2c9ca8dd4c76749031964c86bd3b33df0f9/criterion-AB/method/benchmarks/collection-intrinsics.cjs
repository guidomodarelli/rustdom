/** @file Compares real generic collection refresh/read costs before and after intrinsic capture. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { arch, cpus, platform, release, totalmem } = require('node:os');
const { join, resolve } = require('node:path');
const { performance } = require('node:perf_hooks');
const { captureSourceIdentity } = require('./sources.cjs');
const { COLLECTION_QUERY_ITERATIONS } = require('./constants/collection-queries.cjs');
const { COLLECTION_SIZES, COLLECTION_KINDS, CACHE_MODES, WARMUP_SAMPLES, MEASURED_SAMPLES,
  PROCESS_ORDERS, WORKER_TIMEOUT_MS } = require('./constants/collection-intrinsics.cjs');

/** @param {string} filePath - Actual measured artifact. @returns {string} SHA-256 of exact bytes. */
function sha256(filePath) { return createHash('sha256').update(readFileSync(filePath)).digest('hex'); }
/** @param {number[]} samples - Nonempty raw durations. @returns {number} Conventional median. */
function median(samples) {
  const sorted = [...samples].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Prepare one stable owner and consume public results after each complete invalidation/read.
 * @param {object} runtime - Actual independent engine.
 * @param {string} kind - children/form.elements generic path, or document.forms native-query control.
 * @param {string} cacheMode - Live refresh or cached access.
 * @param {number} size - Exact public collection length.
 * @returns {object} Timed public operation, untimed contract checks and explicit cleanup.
 */
function fixture(runtime, kind, cacheMode, size) {
  let { window } = new runtime.JSDOM('<!doctype html><body>');
  let root = window.document.createElement(kind === 'controls' ? 'form' : 'main');
  window.document.body.append(root);
  let expected = [];
  for (let index = 0; index < size; index++) {
    const element = window.document.createElement(kind === 'forms' ? 'form' : kind === 'controls' ? 'input' : 'i');
    element.id = `entry-${index}`; element.setAttribute('name', `alias-${index}`);
    root.append(element); expected.push(element);
  }
  let collection = kind === 'forms' ? window.document.forms : kind === 'controls' ? root.elements : root.children;
  const key = `entry-${size - 1}`;
  return {
    /** @returns {number} Public length and stable last-element identity checksum. */
    run() {
      let checksum = 0;
      for (let iteration = 0; iteration < COLLECTION_QUERY_ITERATIONS; iteration++) {
        if (cacheMode === 'live') root.setAttribute('data-collection-version', String(iteration));
        checksum += collection.length + Number(collection.item(size - 1) === expected[size - 1]) +
          Number(collection.namedItem(key) === expected[size - 1]);
      }
      return checksum;
    },
    /** @param {number} checksum - Public results. @param {object|undefined} before - Native counter baseline. @returns {string} Canonical complete fixture digest. */
    validate(checksum, before) {
      assert.equal(checksum, COLLECTION_QUERY_ITERATIONS * (size + 2));
      assert.deepEqual(Array.from(collection), expected);
      const names = Object.getOwnPropertyNames(collection);
      assert.ok(names.includes(key)); assert.ok(names.includes(`alias-${size - 1}`));
      if (before) {
        const current = runtime.getNativeTreeStatistics();
        if (kind !== 'controls') assert.ok(current.nativeCollectionNamedReads > before.nativeCollectionNamedReads);
        assert.ok(current.nativeCollectionNameEnumerations > before.nativeCollectionNameEnumerations);
        assert.equal(current.nativeCollectionQueries - before.nativeCollectionQueries,
          kind === 'forms' && cacheMode === 'live' ? COLLECTION_QUERY_ITERATIONS : 0);
      }
      return createHash('sha256').update(root.outerHTML).update(String(checksum)).digest('hex');
    },
    /** @returns {void} Close the real realm and release every strong fixture reference. */
    dispose() { window.close(); collection = null; expected = null; root = null; window = null; },
  };
}

/** @param {string} stage - Independent baseline/current/reference process. @param {string} baselineRoot - Frozen before package directory. @returns {object} Raw validated samples. */
function measure(stage, baselineRoot) {
  const distRoot = stage === 'before' ? join(baselineRoot, 'dist') : resolve(__dirname, '../dist');
  const runtime = stage === 'jsdom' ? require('jsdom') : require(join(distRoot, 'index.cjs'));
  const rows = [];
  for (const kind of COLLECTION_KINDS) for (const cacheMode of CACHE_MODES) for (const size of COLLECTION_SIZES) {
    const prepared = fixture(runtime, kind, cacheMode, size);
    const samplesMs = []; let outputHash;
    try {
      for (let sample = -WARMUP_SAMPLES; sample < MEASURED_SAMPLES; sample++) {
        global.gc();
        const before = runtime.getNativeTreeStatistics?.();
        const startedAt = performance.now();
        const checksum = prepared.run();
        const elapsedMs = performance.now() - startedAt;
        const currentHash = prepared.validate(checksum, before);
        if (outputHash !== undefined) assert.equal(currentHash, outputHash);
        outputHash = currentHash;
        if (sample >= 0) samplesMs.push(elapsedMs);
      }
    } finally { prepared.dispose(); }
    rows.push({ kind, cacheMode, size, samplesMs, outputHash });
  }
  return { stage, node: process.version, reference: require('jsdom/package.json').version,
    artifacts: stage === 'jsdom' ? null : { entrySha256: sha256(join(distRoot, 'index.cjs')),
      bridgeSha256: sha256(join(distRoot, 'native-tree.cjs')), addonSha256: sha256(join(distRoot, 'rustdom.node')) }, rows };
}

if (process.argv[2] === '--worker') {
  process.stdout.write(JSON.stringify(measure(process.argv[3], resolve(process.argv[4]))));
} else {
  const baselineRoot = resolve(process.argv[2] || '.cache/collection-intrinsics-baseline');
  const outputDirectory = resolve('reports/benchmarks/collection-intrinsics');
  mkdirSync(outputDirectory, { recursive: true });
  const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version,
    system: { platform: platform(), arch: arch(), release: release(), cpu: cpus()[0]?.model,
      logicalCpus: cpus().length, totalMemoryBytes: totalmem() }, source: captureSourceIdentity(),
    methodology: { iterations: COLLECTION_QUERY_ITERATIONS, warmup: WARMUP_SAMPLES, measuredSamplesPerWorker: MEASURED_SAMPLES,
      processOrders: PROCESS_ORDERS, baselineCommit: 'b7b1cf226c41c9c29bc17778d61084650c4eea19',
      timing: '100 real length/item/namedItem operations on prepared public collections. Live includes one attribute invalidation per operation. Module startup, fixture creation, validation, close and explicit GC are excluded. Each row retains one unchanged owner across warmup and measured samples.',
      paths: 'children and form.elements exercise generic JS query snapshots and typed transport construction on each live refresh. document.forms is the native getElementsByTagName transport control.',
      correctness: 'Assert exact checksum, every element identity, ordered named-property presence, native enumeration activity, native named reads for base HTMLCollection, and exact native query refresh count after every sample. Full fixture hashes must match all processes/stages.',
      limits: 'Finite synthetic measurements on one machine; no peak memory, cold import or full-suite speed claim. The fix captures one intrinsic realm per loaded module, independent of DOM owners.' },
    runs: [], comparisons: [], pass: false };
  const reportPath = join(outputDirectory, `${report.capturedAt.replaceAll(':', '-')}-node${process.versions.node.split('.')[0]}.json`);
  for (const order of PROCESS_ORDERS) for (const stage of order) {
    process.stderr.write(`Benchmark ${process.version} ${stage}, worker ${report.runs.length + 1}/${PROCESS_ORDERS.length * order.length}\n`);
    const child = spawnSync(process.execPath, ['--expose-gc', __filename, '--worker', stage, baselineRoot], {
      encoding: 'utf8', timeout: WORKER_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024,
    });
    if (child.error || child.status !== 0 || child.signal) {
      report.failure = { stage, exitCode: child.status, signal: child.signal, error: child.error?.message, stderr: child.stderr };
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      throw new Error(`collection intrinsic benchmark ${stage} failed; evidence: ${reportPath}`);
    }
    report.runs.push(JSON.parse(child.stdout));
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  for (const kind of COLLECTION_KINDS) for (const cacheMode of CACHE_MODES) for (const size of COLLECTION_SIZES) {
    const matches = report.runs.map((run) => ({ stage: run.stage, row: run.rows.find((row) => row.kind === kind && row.cacheMode === cacheMode && row.size === size) }));
    assert.equal(new Set(matches.map((match) => match.row.outputHash)).size, 1);
    const medians = {};
    for (const stage of ['before', 'after', 'jsdom']) medians[stage] = median(matches.filter((match) => match.stage === stage).flatMap((match) => match.row.samplesMs));
    report.comparisons.push({ kind, cacheMode, size, samplesPerStage: MEASURED_SAMPLES * PROCESS_ORDERS.length,
      medianMs: medians, changePercent: (medians.after / medians.before - 1) * 100,
      referenceRatio: medians.jsdom / medians.after });
  }
  report.pass = true;
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ reportPath, pass: report.pass, comparisons: report.comparisons }, null, 2)}\n`);
}
