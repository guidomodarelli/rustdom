/** @file Measures addon initialization in fresh workers and records finite Env teardown memory samples. */
'use strict';
const assert = require('node:assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { performance } = require('node:perf_hooks');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const os = require('node:os');

/** @param {string} path - Exact addon artifact. @param {boolean} harden - Remove both host keys before loading. @returns {Promise<object>} Timed initialization and verified native work. */
function sampleInitialization(path, harden = false) {
  return new Promise((resolveSample, reject) => {
    const worker = new Worker(__filename, { workerData: { addonPath: path, harden } });
    let result;
    worker.once('message', (message) => { result = message; });
    worker.once('error', reject);
    worker.once('exit', (code) => code === 0 ? resolveSample(result) : reject(new Error(`XML initialization worker exited with ${code}`)));
  });
}

/** @returns {Promise<object>} Collect worker exits and finalizers before taking process memory samples. */
async function settledMemory() {
  for (let cycle = 0; cycle < 4; cycle++) {
    await new Promise((resolveImmediate) => setImmediate(resolveImmediate));
    global.gc();
  }
  return process.memoryUsage();
}

/** @returns {Promise<void>} Save reproducible initialization timings and the accompanying limited memory observations. */
async function main() {
  assert.equal(typeof global.gc, 'function', 'Run with --expose-gc');
  const [baselinePath, candidatePath] = process.argv.slice(2, 4).map((path) => resolve(path));
  assert.ok(baselinePath && candidatePath, 'Provide baseline and candidate addon paths');
  /** Local sampling plan: warm each artifact before collecting an even-sized median sample. */
  const warmupRounds = 3;
  const measuredRounds = 12;
  const includeHardened = process.argv.includes('--include-hardened');
  const artifacts = { baseline: baselinePath, candidate: candidatePath };
  if (includeHardened) artifacts.candidateHardened = candidatePath;
  const report = {
    capturedAt: new Date().toISOString(), node: process.version, v8: process.versions.v8,
    platform: process.platform, arch: process.arch, osRelease: os.release(), cpu: os.cpus()[0].model,
    cpuCount: os.cpus().length, totalMemory: os.totalmem(),
    cargoLockSha256: createHash('sha256').update(readFileSync('Cargo.lock')).digest('hex'),
    packageLockSha256: createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),
    command: 'node --expose-gc tests/helpers/xml-intrinsics-initialization.cjs BASELINE.node CANDIDATE.node' + (includeHardened ? ' --include-hardened' : ''),
    warmupRounds, measuredRounds, includeHardened,
    methodology: 'Fresh Worker for every sample; time require(addon) only. Rotate artifact order each round. Optional candidateHardened removes both host iterator keys before timing, restores them afterward and measures the clean-realm fallback separately; baseline cannot load in that scenario. Validate XML success and Symbol errors outside timing, then await Worker exit. Excludes Worker startup, validation, teardown and GC; not full package import or DOM construction. Warm file cache; no cold-start claim.',
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([name, path]) => [name, {
      path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
    }])),
    samples: [],
  };
  const artifactNames = Object.keys(artifacts);
  for (let round = 0; round < warmupRounds + measuredRounds; round++) {
    const start = round % artifactNames.length;
    const order = artifactNames.slice(start).concat(artifactNames.slice(0, start));
    for (const name of order) {
      const result = await sampleInitialization(artifacts[name], name === 'candidateHardened');
      report.samples.push({ round, warmup: round < warmupRounds, name, ...result, memoryAfterExitAndGc: await settledMemory() });
    }
  }
  report.summary = Object.fromEntries(Object.keys(artifacts).map((name) => {
    const times = report.samples.filter((sample) => sample.name === name && !sample.warmup).map((sample) => sample.initializationMs).sort((left, right) => left - right);
    return [name, { medianMs: (times[times.length / 2 - 1] + times[times.length / 2]) / 2, minMs: times[0], maxMs: times.at(-1) }];
  }));
  const timestamp = report.capturedAt.replaceAll(':', '-');
  mkdirSync('reports/benchmarks', { recursive: true });
  mkdirSync('reports/memory', { recursive: true });
  const benchmarkPath = `reports/benchmarks/${timestamp}-xml-intrinsics-init.json`;
  writeFileSync(benchmarkPath, `${JSON.stringify(report, null, 2)}\n`);
  const memoryPath = `reports/memory/${timestamp}-xml-intrinsics-envs.json`;
  writeFileSync(memoryPath, `${JSON.stringify({
    capturedAt: report.capturedAt, node: report.node, workers: report.samples.length,
    methodology: 'Process memory sampled after each verified worker exit and four GC turns. Tracks heapUsed, external and RSS; not peak memory. No DOM is created here; Window/Document weak reachability is checked separately by xml-serialization-memory.cjs. Finite samples cannot prove absence of all Env leaks or separate allocator retention from leaks.',
    artifacts: report.artifacts, samples: report.samples.map(({ initializationMs, ...sample }) => sample),
  }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ benchmarkPath, memoryPath, summary: report.summary })}\n`);
}

if (isMainThread) {
  main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
} else {
  let restore = () => {};
  if (workerData.harden) {
    const key = Symbol.iterator;
    const arrayPrototype = Array.prototype;
    const iteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf((function* () {})())));
    const arrayDescriptor = Object.getOwnPropertyDescriptor(arrayPrototype, key);
    const iteratorDescriptor = Object.getOwnPropertyDescriptor(iteratorPrototype, key);
    delete arrayPrototype[key]; delete iteratorPrototype[key];
    restore = () => {
      Object.defineProperty(arrayPrototype, key, arrayDescriptor);
      Object.defineProperty(iteratorPrototype, key, iteratorDescriptor);
    };
  }
  let native, initializationMs;
  const started = performance.now();
  try {
    native = require(workerData.addonPath);
    initializationMs = performance.now() - started;
  } finally { restore(); }
  const root = { nodeType: 11, childNodes: [{ nodeType: 3, data: '<ready>' }] };
  const invalid = { nodeType: 11, childNodes: { [Symbol.iterator]() { return { next() { return Symbol('worker'); } }; } } };
  for (let iteration = 0; iteration < 100; iteration++) {
    assert.equal(native.serializeXml(root, false), '&lt;ready&gt;');
    assert.throws(() => native.serializeXml(invalid, false), { name: 'TypeError', message: 'Iterator result Symbol(worker) is not an object' });
  }
  const statistics = native.xmlSerializationStatistics();
  assert.equal(statistics.live, 0); assert.equal(statistics.references, 0); assert.equal(statistics.cleanupErrors, 0);
  parentPort.postMessage({ initializationMs, statistics });
}