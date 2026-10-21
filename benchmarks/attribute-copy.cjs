/** @file Data-copy microbenchmarks include source reads/preparation, bridge and fresh Attr initialization. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { cpus, platform, arch, release, totalmem } = require('node:os');
const native = require('../dist/native.cjs');
const { writeAttribute } = require('../src/dom/data-bridge.cjs');
const { captureSourceIdentity } = require('./sources.cjs');
const { collectGarbage } = require('../scripts/memory-endpoint.cjs');
const { ATTRIBUTE_COPY_OPERATIONS, ATTRIBUTE_COPY_WARMUP, ATTRIBUTE_COPY_SAMPLES,
  ATTRIBUTE_COPY_WORKER_TIMEOUT_MS, ATTRIBUTE_COPY_ORDERS, ATTRIBUTE_COPY_FIXTURES } = require('./constants/attribute-copy.cjs');

/** @param {object} fixture - Named comparable input. @returns {object} Actual immutable input and source forest. */
function prepareFixture(fixture) {
  const tree = new native.NativeTree(), id = tree.allocate();
  const data = { localName: 'data-copy', namespace: fixture.namespace, namespacePrefix: fixture.prefix,
    value: fixture.malformed ? '\ud800\0'.repeat(fixture.valueUnits / 2) : 'v'.repeat(fixture.valueUnits) };
  writeAttribute(tree, id, 2, data);
  return { tree, id, data };
}
/**
 * Both paths start with an existing canonical source and finish with identical fresh native Attrs.
 * Setup, validation, release and GC stay outside timing. Preparation is included for every native copy.
 * @param {'bridge'|'native'} mode - Existing adapter or owned Rust copy.
 * @param {object} source - Prepared real source.
 * @param {number} [operations] - Number of initialized copies.
 * @returns {object} Scalars only; no native owners escape.
 */
function runTrial(mode, source, operations = ATTRIBUTE_COPY_OPERATIONS) {
  assert.ok(mode === 'bridge' || mode === 'native');
  const destination = new native.NativeTree(), ids = Array.from({ length: operations }, () => destination.allocate());
  const baseline = native.attributeCopyStatistics();
  const started = performance.now();
  for (const id of ids) {
    if (mode === 'native') {
      const copy = native.NativeAttributeCopy.prepare(source.tree, source.id);
      copy.initialize(destination, id);
    } else {
      const data = { namespace: source.tree.attributeField(source.id, native.AttributeField.Namespace),
        namespacePrefix: source.tree.attributeField(source.id, native.AttributeField.Prefix),
        localName: source.tree.attributeField(source.id, native.AttributeField.Name),
        value: source.tree.attributeField(source.id, native.AttributeField.Value) };
      writeAttribute(destination, id, 2, data);
    }
  }
  const elapsedMs = performance.now() - started;
  const createdCopies = native.attributeCopyStatistics().created - baseline.created;
  assert.equal(createdCopies, mode === 'native' ? operations : 0);
  const digest = createHash('sha256');
  for (const id of ids) {
    const actual = { localName: destination.attributeField(id, native.AttributeField.Name),
      namespace: destination.attributeField(id, native.AttributeField.Namespace),
      namespacePrefix: destination.attributeField(id, native.AttributeField.Prefix),
      value: destination.attributeField(id, native.AttributeField.Value) };
    assert.deepEqual(actual, source.data);
    assert.equal(destination.attributeOwner(id), 0);
    digest.update(JSON.stringify(actual));
    destination.release(id);
  }
  assert.equal(source.tree.attributeField(source.id, native.AttributeField.Value), source.data.value);
  const state = destination.statistics();
  assert.equal(state.liveNodes, 0); assert.equal(state.dataNodes, 0);
  return { elapsedMs, outputHash: digest.digest('hex'), operations, createdCopies,
    releasedNodes: state.releases, liveNodes: state.liveNodes };
}
/** @param {number[]} values - Raw timings. @returns {number} Median without dropping samples. */
function median(values) {
  const sorted = values.toSorted((left, right) => left - right), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
/** @returns {Promise<void>} Fresh worker with warmup and explicit GC outside timed operations. */
async function worker() {
  const [mode, name] = process.argv.slice(3), fixture = ATTRIBUTE_COPY_FIXTURES.find((entry) => entry.name === name);
  assert.ok(fixture); assert.equal(typeof global.gc, 'function');
  const source = prepareFixture(fixture), baseline = native.attributeCopyStatistics(), warmup = [], samples = [];
  for (let index = 0; index < ATTRIBUTE_COPY_WARMUP + ATTRIBUTE_COPY_SAMPLES; index += 1) {
    const result = runTrial(mode, source);
    await collectGarbage();
    assert.equal(native.attributeCopyStatistics().live, baseline.live);
    assert.equal(native.attributeCopyStatistics().liveBytes, baseline.liveBytes);
    assert.equal(native.attributeCopyStatistics().accountedBytes, baseline.accountedBytes);
    assert.equal(native.attributeCopyStatistics().accountingErrors, baseline.accountingErrors);
    (index < ATTRIBUTE_COPY_WARMUP ? warmup : samples).push({ ...result,
      memoryAfterGc: process.memoryUsage(), snapshotsAfterGc: native.attributeCopyStatistics() });
  }
  source.tree.release(source.id);
  process.stdout.write(JSON.stringify({ mode, fixture, node: process.version, warmup, samples,
    nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex') }) + '\n');
}
/** @returns {Promise<void>} Preserve all workers, raw samples, versions and limits of this microbenchmark. */
async function main() {
  const report = { schemaVersion: 1, capturedAt: new Date().toISOString(), node: process.version,
    sourceIdentity: captureSourceIdentity(),
    nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
    machine: { platform: platform(), arch: arch(), release: release(), cpu: cpus()[0].model,
      logicalCpus: cpus().length, totalMemoryBytes: totalmem() },
    methodology: { operationsPerSample: ATTRIBUTE_COPY_OPERATIONS, warmupSamplesPerWorker: ATTRIBUTE_COPY_WARMUP,
      measuredSamplesPerWorker: ATTRIBUTE_COPY_SAMPLES, orders: ATTRIBUTE_COPY_ORDERS,
      timed: 'For every fresh copy: canonical source reads and original writeAttribute bridge, versus native snapshot preparation plus native initialization. No snapshot reuse outside timing. Source/destination allocation, complete output verification, release and asynchronous major GC excluded.' },
    limitations: 'Data-copy microbenchmark on one machine using the same addon for both paths. Does not include DOM wrappers/factories/hooks, parsing, Jest/Vitest or public cloneNode/importNode. Cannot resolve the clone controller checkpoint budget or establish full DOM speed.',
    runs: [], rows: [], pass: false };
  mkdirSync('reports/benchmarks', { recursive: true });
  const file = `reports/benchmarks/${report.capturedAt.replaceAll(':', '-')}-attribute-copy.json`;
  const save = () => writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  try {
    for (const [orderIndex, order] of ATTRIBUTE_COPY_ORDERS.entries()) for (const fixture of ATTRIBUTE_COPY_FIXTURES) for (const mode of order) {
      process.stderr.write(`Copia ${process.version} ${orderIndex}/${fixture.name}/${mode}\n`);
      const child = spawnSync(process.execPath, ['--expose-gc', __filename, '--worker', mode, fixture.name], {
        encoding: 'utf8', timeout: ATTRIBUTE_COPY_WORKER_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
      assert.equal(child.error, undefined, child.error?.message); assert.equal(child.signal, null, child.stderr);
      assert.equal(child.status, 0, child.stderr || child.stdout);
      const run = JSON.parse(child.stdout);
      assert.equal(run.nativeBinarySha256, report.nativeBinarySha256);
      report.runs.push({ orderIndex, ...run }); save();
    }
    for (const fixture of ATTRIBUTE_COPY_FIXTURES) {
      const runs = report.runs.filter((run) => run.fixture.name === fixture.name);
      const hashes = runs.flatMap((run) => run.samples.map((sample) => sample.outputHash));
      assert.equal(new Set(hashes).size, 1);
      const samples = (mode) => runs.filter((run) => run.mode === mode).flatMap((run) => run.samples.map((sample) => sample.elapsedMs));
      const bridge = samples('bridge'), nativeCopies = samples('native');
      assert.equal(bridge.length, ATTRIBUTE_COPY_SAMPLES * ATTRIBUTE_COPY_ORDERS.length);
      assert.equal(nativeCopies.length, bridge.length);
      const bridgeMs = median(bridge), nativeMs = median(nativeCopies);
      report.rows.push({ fixture: fixture.name, valueUnits: fixture.valueUnits, samplesPerMode: bridge.length,
        bridgeMs, nativeMs, nativeVsBridgePercent: (nativeMs / bridgeMs - 1) * 100, outputHash: hashes[0] });
    }
    assert.equal(createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'), report.nativeBinarySha256);
    assert.equal(captureSourceIdentity().sourceHash, report.sourceIdentity.sourceHash);
    report.pass = true; save(); process.stdout.write(`Guardado: ${file}\n`);
  } catch (error) { report.failure = { name: error.name, message: error.message }; save(); throw error; }
}
module.exports = { prepareFixture, runTrial };
if (require.main === module) (process.argv[2] === '--worker' ? worker() : main())
  .catch((error) => { console.error(error); process.exitCode = 1; });
