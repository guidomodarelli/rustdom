/** @file Calibrates unchanged public operations with adjacent ABBA samples in separate real processes. */
'use strict';
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { mkdirSync, writeFileSync, realpathSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseArgs } = require('node:util');
const { cpus, platform, arch, release } = require('node:os');
const { getBenchmarkPlan } = require('./workload-plan.cjs');
const { captureSourceIdentity } = require('./sources.cjs');
const { NODE_CLONE_WORKLOADS, NESTED_TEMPLATE_CLONE_WORKLOAD } = require('./constants/node-clone.cjs');
const { PAIRED_WARMUP_SAMPLES, PAIRED_MEASURED_SAMPLES, PAIRED_WORKER_PAIRS,
  PAIRED_REQUEST_TIMEOUT_MS, PAIRED_SHUTDOWN_TIMEOUT_MS, PAIRED_STDERR_LIMIT_CHARACTERS, PAIRED_BLOCK_ORDERS,
  PAIRED_CONTROL_WORKLOADS } = require('./constants/paired-sampling.cjs');

/** @param {number[]} values - All observations. @returns {number} Median without trimming. */
function median(values) {
  const sorted = values.toSorted((left, right) => left - right), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** @param {object} selection - Actual engine and package. @param {string} executable - Real Node executable. @returns {object} One serialized child request stream. */
function startWorker(selection, executable) {
  const child = fork(resolve(__dirname, 'paired-worker.cjs'), [], { execArgv: ['--expose-gc'],
    execPath: executable,
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: { ...process.env, RUSTDOM_PAIRED_RUNTIME: JSON.stringify(selection) } });
  const pending = new Map(); let nextId = 0, stderr = '', readyResolve, readyReject;
  const ready = new Promise((resolveReady, rejectReady) => { readyResolve = resolveReady; readyReject = rejectReady; });
  const readyTimer = setTimeout(() => readyReject(new Error('Paired worker startup timed out')), PAIRED_REQUEST_TIMEOUT_MS);
  let closeResolve, closed = false, spawnError;
  const closure = new Promise((resolveClose) => { closeResolve = resolveClose; });
  child.stderr.on('data', (data) => { stderr = (stderr + data.toString()).slice(-PAIRED_STDERR_LIMIT_CHARACTERS); });
  const fail = (error) => { clearTimeout(readyTimer); readyReject(error); for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); } pending.clear(); };
  child.on('error', (error) => { spawnError ??= { name: error.name, code: error.code, message: error.message }; fail(error); });
  child.on('close', (code, signal) => {
    closed = true;
    fail(new Error(`Paired worker exited with code=${code}, signal=${signal}: ${stderr}`));
    closeResolve({ code, signal, ...(spawnError ? { spawnError } : {}) });
  });
  child.on('message', (message) => {
    if (message.ready) { clearTimeout(readyTimer); readyResolve(message); return; }
    const request = pending.get(message.id); if (!request) return;
    clearTimeout(request.timer); pending.delete(message.id);
    if (message.error) request.reject(new Error(`Paired sample failed: ${message.error.message}`, { cause: message.error }));
    else request.resolve(message.sample);
  });
  return { ready,
    request(row) {
      assert.equal(pending.size, 0, 'Only one measured worker may run at a time');
      const id = nextId++;
      return new Promise((resolveSample, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Paired sample timed out: ${row.name}/${row.size}`)); }, PAIRED_REQUEST_TIMEOUT_MS);
        pending.set(id, { resolve: resolveSample, reject, timer });
        child.send({ id, operation: 'sample', row }, (error) => { if (error) { clearTimeout(timer); pending.delete(id); reject(error); } });
      });
    },
    async stop() {
      clearTimeout(readyTimer);
      if (closed) return closure;
      const timer = setTimeout(() => child.kill('SIGKILL'), PAIRED_SHUTDOWN_TIMEOUT_MS);
      try {
        if (!spawnError && child.connected) child.send({ operation: 'stop' }, (error) => { if (error) child.kill(); });
        else child.kill();
        return await closure;
      }
      finally { clearTimeout(timer); }
    },
  };
}

/**
 * Keep all original inputs, consume one operation per sample and preserve every warmup.
 * This diagnostic must pass A/A calibration before its measurements can support acceptance.
 * @param {object} options - Engines, selected original rows and explicit sampling plan.
 * @returns {Promise<object>} Complete or failed durable report.
 */
async function runPairedComparison(options) {
  const { first, second } = options;
  const warmupSamples = options.warmupSamples ?? PAIRED_WARMUP_SAMPLES;
  const measuredSamples = options.measuredSamples ?? PAIRED_MEASURED_SAMPLES;
  const workerPairs = options.workerPairs ?? PAIRED_WORKER_PAIRS;
  const workerExecutable = options.workerExecutable ?? process.execPath;
  for (const count of [warmupSamples, measuredSamples]) assert.ok(Number.isSafeInteger(count) && count > 0 && count % 2 === 0, 'Paired phase sample counts must be positive even integers');
  assert.ok(Number.isSafeInteger(workerPairs) && workerPairs > 0);
  for (const selection of [first, second]) {
    assert.ok(selection.kind === 'jsdom' || selection.kind === 'rustdom');
    if (selection.kind === 'rustdom') selection.root = realpathSync(selection.root);
  }
  if (options.aa) assert.deepEqual(first, second, 'A/A requires the same immutable engine and package');
  const supported = [...NODE_CLONE_WORKLOADS, NESTED_TEMPLATE_CLONE_WORKLOAD, ...PAIRED_CONTROL_WORKLOADS];
  const rows = options.rows ?? getBenchmarkPlan().filter((row) => supported.includes(row.name)).map(({ name, size }) => ({ name, size }));
  assert.ok(rows.length > 0 && rows.every((row) => supported.includes(row.name) && Number.isSafeInteger(row.size) && row.size > 0));
  const directory = options.outputDirectory ?? 'reports/benchmarks/paired'; mkdirSync(directory, { recursive: true });
  const report = { capturedAt: new Date().toISOString(), node: process.version, aa: Boolean(options.aa),
    sourceIdentity: captureSourceIdentity(), selections: { first, second },
    machine: { cpu: cpus()[0].model, logicalCpus: cpus().length, platform: platform(), arch: arch(), release: release() },
    plan: { warmupSamples, measuredSamples, workerPairs, workerExecutable, orders: PAIRED_BLOCK_ORDERS, rows },
    methodology: 'One fresh historical input per timed public operation. Preserve loading readyState and synchronous pre-operation GC. Drain asynchronous major GC, Window/Document weak references and native liveness after teardown before replying. Interleave first/second/second/first, reverse the starting order by block and pair. Setup, validation, hashing, teardown, IPC and collection stay outside timing. Preserve warmup and measured observations plus approximate process CPU time.',
    limitations: 'Diagnostic calibration on one virtualized machine. Process CPU includes any background compiler threads; it is not exact operation thread CPU. No new acceptance budget, case or reference. Pairing and longer warmup alone do not guarantee repeatability.',
    pairs: [], rows: [], complete: false };
  const file = resolve(directory, `${report.capturedAt.replaceAll(':', '-')}-${report.aa ? 'aa' : 'ab'}-paired.json`);
  const save = () => writeFileSync(file, JSON.stringify(report, null, 2) + '\n'); save();
  try {
    for (let pairIndex = 0; pairIndex < workerPairs; pairIndex++) {
      const workers = {};
      const pair = { pairIndex, workers: {}, observations: [], exits: [] }; report.pairs.push(pair);
      try {
        for (const [label, selection] of Object.entries({ first, second })) { workers[label] = startWorker(selection, workerExecutable); pair.workers[label] = await workers[label].ready; }
        if (report.aa) assert.equal(pair.workers.first.nativeBinarySha256, pair.workers.second.nativeBinarySha256);
        for (const row of rows) {
          process.stderr.write(`Paired ${pairIndex + 1}/${workerPairs}: ${row.name}/${row.size}\n`);
          for (const [phase, sampleCount] of [['warmup', warmupSamples], ['measured', measuredSamples]]) {
            for (let block = 0; block < sampleCount / 2; block++) {
              const order = PAIRED_BLOCK_ORDERS[(block + pairIndex) % PAIRED_BLOCK_ORDERS.length];
              for (const label of order) {
                const observation = await workers[label].request(row);
                pair.observations.push({ ...row, phase, block, label, ...observation });
              }
            }
          }
          const outputs = pair.observations.filter((sample) => sample.name === row.name && sample.size === row.size).map((sample) => sample.outputHash);
          assert.equal(new Set(outputs).size, 1, `Paired output mismatch: ${row.name}/${row.size}`); save();
        }
      } finally { pair.exits = await Promise.all(Object.values(workers).map((worker) => worker.stop())); save(); }
      assert.ok(pair.exits.every((exit) => exit.code === 0 && exit.signal === null), 'Paired workers must exit cleanly');
    }
    for (const row of rows) {
      const samples = (label) => report.pairs.flatMap((pair) => pair.observations.filter((sample) =>
        sample.name === row.name && sample.size === row.size && sample.label === label && sample.phase === 'measured').map((sample) => sample.elapsedMs));
      const firstSamples = samples('first'), secondSamples = samples('second');
      assert.equal(firstSamples.length, workerPairs * measuredSamples); assert.equal(secondSamples.length, firstSamples.length);
      report.rows.push({ ...row, samplesPerStage: firstSamples.length, firstMedianMs: median(firstSamples), secondMedianMs: median(secondSamples),
        differencePercent: (median(secondSamples) / median(firstSamples) - 1) * 100,
        pairDifferencesPercent: report.pairs.map((pair) => {
          const selected = pair.observations.filter((sample) => sample.name === row.name && sample.size === row.size && sample.phase === 'measured');
          return (median(selected.filter((sample) => sample.label === 'second').map((sample) => sample.elapsedMs)) /
            median(selected.filter((sample) => sample.label === 'first').map((sample) => sample.elapsedMs)) - 1) * 100;
        }) });
    }
    report.complete = true; save(); process.stdout.write(`Guardado: ${file}\n`); return report;
  } catch (error) { report.failure = { name: error.name, message: error.message, stack: error.stack }; save(); throw error; }
}

module.exports = { runPairedComparison };
if (require.main === module) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    first: { type: 'string' }, second: { type: 'string' }, aa: { type: 'boolean', default: false },
    output: { type: 'string' }, warmup: { type: 'string' }, samples: { type: 'string' }, pairs: { type: 'string' },
  } });
  assert.ok(values.first && values.second, 'Paired CLI requires --first and --second engine roots, or jsdom');
  const supported = new Set(positionals);
  const rows = getBenchmarkPlan().filter((row) => [...NODE_CLONE_WORKLOADS, NESTED_TEMPLATE_CLONE_WORKLOAD, ...PAIRED_CONTROL_WORKLOADS].includes(row.name) &&
    (supported.size === 0 || supported.has(row.name))).map(({ name, size }) => ({ name, size }));
  for (const name of supported) assert.ok(rows.some((row) => row.name === name), `Unknown paired workload: ${name}`);
  const selection = (root) => root === 'jsdom' ? { kind: 'jsdom' } : { kind: 'rustdom', root: resolve(root) };
  runPairedComparison({ first: selection(values.first), second: selection(values.second), aa: values.aa, rows,
    outputDirectory: values.output, warmupSamples: values.warmup === undefined ? undefined : Number(values.warmup),
    measuredSamples: values.samples === undefined ? undefined : Number(values.samples), workerPairs: values.pairs === undefined ? undefined : Number(values.pairs) })
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
