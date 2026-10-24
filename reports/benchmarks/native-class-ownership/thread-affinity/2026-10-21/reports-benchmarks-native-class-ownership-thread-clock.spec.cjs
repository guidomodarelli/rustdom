/** @file Validates the real CPU clock, Node workers, affinity modes and public DOM sampler without stand-ins. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { Worker } = require('node:worker_threads');
const { performance } = require('node:perf_hooks');
const { sample } = require('./thread-worker.cjs');
const { loadRuntime, cleanup } = require('./paired-worker.cjs');
const settings = require('./constants/paired.cjs');
const method = require('./constants/thread.cjs');
const clockPath = path.resolve(__dirname, '../../../benchmarks/native-thread-clock/thread-clock.node');
const clock = require(clockPath);
const manifestPath = process.env.RUSTDOM_PAIRED_MANIFEST;
assert.ok(manifestPath, 'Set RUSTDOM_PAIRED_MANIFEST to real prepared distributions');
const manifest = JSON.parse(fs.readFileSync(manifestPath));
const original = JSON.parse(fs.readFileSync(path.join(__dirname, 'hosted/39643090437/AA-01-A.json')));

test('the actual addon measures the caller thread and excludes a busy Node worker', async () => {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  const worker = new Worker(`
    const { parentPort, workerData } = require('node:worker_threads');
    const { performance } = require('node:perf_hooks');
    const clock = require(workerData.clockPath);
    const signal = new Int32Array(workerData.signal);
    parentPort.postMessage('ready');
    Atomics.wait(signal, 0, 0);
    const wall = performance.now(); const start = clock.threadCpuTimeMs();
    while (clock.threadCpuTimeMs() - start < 20) {
      if (performance.now() - wall > 5000) throw new Error('Thread CPU clock did not advance during real work');
    }
    parentPort.postMessage({ cpuMs: clock.threadCpuTimeMs() - start });
  `, { eval: true, workerData: { clockPath, signal: signal.buffer } });
  const exit = new Promise((resolve, reject) => { worker.once('exit', resolve); worker.once('error', reject); });
  try {
    await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
    const completed = new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
    const start = clock.threadCpuTimeMs();
    Atomics.store(signal, 0, 1); Atomics.notify(signal, 0);
    const result = await completed;
    const cpuMs = clock.threadCpuTimeMs() - start;
    assert.ok(cpuMs >= 0); assert.ok(result.cpuMs >= 20);
    assert.ok(cpuMs < result.cpuMs, `Main thread ${cpuMs}ms incorrectly includes worker ${result.cpuMs}ms`);
    assert.equal(await exit, 0);
  } finally { await worker.terminate(); }
});

test('agrees with the enclosing native Node thread CPU interval when that API is available',
  { skip: typeof process.threadCpuUsage !== 'function' ? 'Node 22.12 has no process.threadCpuUsage; actual Rust and Worker tests cover that runtime' : false }, () => {
    const before = process.threadCpuUsage();
    const start = clock.threadCpuTimeMs();
    const wall = performance.now();
    let result = 0;
    while (performance.now() - wall < 10) result += Math.sqrt(result % 100 + 1);
    const cpuMs = clock.threadCpuTimeMs() - start;
    const native = process.threadCpuUsage(before);
    assert.ok(result > 0); assert.ok(cpuMs > 0);
    assert.ok((native.user + native.system) / 1000 + 0.05 >= cpuMs);
  });

test('the instrumented sampler retains public results, original output and released owners in both engines', async () => {
  for (const engine of ['rustdom', 'jsdom']) {
    const runtime = loadRuntime(manifest.copies[engine === 'rustdom' ? 'A0' : 'J0'], engine);
    const observation = await cleanup(sample(runtime, settings.sizes[0], clock), runtime);
    assert.equal(observation.result, settings.operations / 2);
    assert.equal(observation.outputHash, original.runs[0].workloads.find((row) => row.rows === settings.sizes[0]).outputHash);
    assert.equal(observation.elapsedMs, observation.timing.endMs - observation.timing.startMs);
    assert.ok(observation.timing.threadCpuEndMs >= observation.timing.threadCpuStartMs);
    assert.ok(observation.timing.outerWallStartMs <= observation.timing.startMs);
    assert.ok(observation.timing.outerWallEndMs >= observation.timing.endMs);
    for (const endpoint of observation.cleanupTrace.slice(-2)) {
      assert.deepEqual(endpoint.survivors, { window: false, document: false });
      if (endpoint.released) assert.equal(endpoint.released.live, 0);
    }
  }
});

for (const engine of ['rustdom', 'jsdom']) for (const [mode, block] of [['process', 0], ['main', 1]]) {
  test(`runs a full real ${engine} worker with ${mode} affinity and a cleared lifetime endpoint`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-thread-contract-'));
    const output = path.join(directory, 'worker.json');
    const argumentsForWorker = [process.execPath, '--expose-gc', path.join(__dirname, 'thread-worker.cjs'), manifestPath,
      engine, mode, String(block), clockPath, output];
    try {
      const result = mode === 'process'
        ? spawnSync('taskset', ['-c', String(method.cpu), ...argumentsForWorker], { encoding: 'utf8', timeout: settings.workerTimeoutMs })
        : spawnSync(argumentsForWorker[0], argumentsForWorker.slice(1), { encoding: 'utf8', timeout: settings.workerTimeoutMs });
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(fs.readFileSync(output));
      assert.equal(report.complete, true); assert.equal(report.node, process.version);
      assert.equal(report.pid, result.pid);
      assert.equal(report.samples.length, settings.sizes.length * (settings.warmupRounds + settings.measuredRounds));
      for (const snapshot of [report.affinity.configured, report.affinity.final]) {
        const main = snapshot.find((entry) => entry.tid === report.pid);
        assert.equal(main.mask, String(method.cpu));
        if (mode === 'process') assert.ok(snapshot.every((entry) => entry.disappeared || entry.mask === String(method.cpu)));
        else assert.ok(snapshot.some((entry) => !entry.disappeared && entry.mask !== String(method.cpu)));
      }
      for (const size of settings.sizes) {
        assert.equal(report.samples.filter((record) => record.size === size && record.warmup).length, settings.warmupRounds);
        assert.equal(report.samples.filter((record) => record.size === size && !record.warmup).length, settings.measuredRounds);
      }
      for (const record of report.samples) {
        assert.equal(record.result, settings.operations / 2);
        assert.equal(record.outputHash, original.runs[0].workloads.find((row) => row.rows === record.size).outputHash);
        assert.ok(record.timing.threadCpuEndMs >= record.timing.threadCpuStartMs);
        assert.equal(record.elapsedMs, record.timing.endMs - record.timing.startMs);
        for (const endpoint of record.cleanupTrace.slice(-2)) {
          assert.deepEqual(endpoint.survivors, { window: false, document: false });
          if (endpoint.released) assert.equal(endpoint.released.live, 0);
        }
        if (engine === 'rustdom') assert.equal(record.after.created - record.before.created, settings.operations);
      }
    } finally {
      for (const filename of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, filename));
      fs.rmdirSync(directory);
    }
  });
}
