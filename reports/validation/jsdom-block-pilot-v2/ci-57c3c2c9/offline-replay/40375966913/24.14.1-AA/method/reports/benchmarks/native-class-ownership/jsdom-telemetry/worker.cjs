/** @file Observes one real row-isolated jsdom process, retaining CPU, GC and bounded clock anchors. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance, PerformanceObserver } = require('node:perf_hooks');
const { Script } = require('node:vm');
const policy = require('./protocol.json');

/** Observe shared clocks and a uniquely named V8 script outside every operation. */
function anchor(filename) {
  const beforeUs = Number(process.hrtime.bigint()) / 1000;
  const beforeMs = performance.now();
  new Script('0;', { filename }).runInThisContext();
  const afterMs = performance.now();
  const afterUs = Number(process.hrtime.bigint()) / 1000;
  return { filename, beforeUs, afterUs, beforeMs, afterMs };
}

/** Run the unchanged public assertions and finite release checks with scalar observers only. */
async function main(args) {
  const output = args[5];
  assert.equal(typeof output, 'string'); assert.equal(args[2], policy.engine);
  const telemetryPath = `${output}.telemetry.json`;
  const state = { revision: policy.revision, diagnosticOnly: true, accepted: null, gateReevaluated: false,
    complete: false, mode: policy.mode, node: process.version, pid: process.pid, gcEvents: [],
    profiler: { connected: false, stopped: false, disconnected: false } };
  fs.writeFileSync(telemetryPath, JSON.stringify(state), { flag: 'wx' });
  const capture = (entries) => {
    for (const entry of entries) state.gcEvents.push({ startMs: entry.startTime, durationMs: entry.duration,
      kind: entry.detail.kind, flags: entry.detail.flags });
  };
  const observer = new PerformanceObserver((entries) => capture(entries.getEntries()));
  let session;
  let failure;
  let started = false;
  try {
    observer.observe({ entryTypes: ['gc'] });
    if (policy.mode === 'cpu') {
      const { Session } = require('node:inspector/promises');
      session = new Session();
      session.connect(); state.profiler.connected = true;
      await session.post('Profiler.enable');
      await session.post('Profiler.setSamplingInterval', { interval: policy.cpuSamplingIntervalUs });
      await session.post('Profiler.start'); started = true;
    }
    state.start = anchor(policy.clockNames[0]);
    const { createSinglePackageWorker } = require('./harness/reports/benchmarks/native-class-ownership/single-package-worker.cjs');
    const settings = require('./harness/reports/benchmarks/native-class-ownership/constants/current-ownership.cjs');
    await createSinglePackageWorker(settings).main(...args);
  } catch (error) { failure = error; state.failure = { message: error.message, stack: error.stack }; }
  finally {
    try {
      state.end = anchor(policy.clockNames[1]);
      if (started) {
        const { profile } = await session.post('Profiler.stop');
        state.profiler.stopped = true;
        fs.writeFileSync(path.join(path.dirname(output), 'cpu.cpuprofile'), `${JSON.stringify(profile)}\n`, { flag: 'wx' });
      }
      if (state.profiler.connected) await session.post('Profiler.disable');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      capture(observer.takeRecords());
    } catch (error) { failure ??= error; state.observerFailure = { message: error.message, stack: error.stack }; }
    finally {
      observer.disconnect();
      if (session) session.disconnect();
      state.profiler.disconnected = true;
      state.complete = failure === undefined;
      fs.writeFileSync(telemetryPath, `${JSON.stringify(state, null, 2)}\n`);
    }
  }
  if (failure) throw failure;
}

if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 2;
});
module.exports = { main };
