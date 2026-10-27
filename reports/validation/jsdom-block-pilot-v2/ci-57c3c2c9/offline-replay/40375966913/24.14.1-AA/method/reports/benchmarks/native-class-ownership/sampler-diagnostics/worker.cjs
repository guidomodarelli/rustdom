/** @file Records scalar GC events around the derived real sampler; never decides acceptance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { performance, PerformanceObserver } = require('node:perf_hooks');

/** Capture two clocks to align an optional native CPU profile with performance.now spans. */
function clockAnchor() {
  const beforeUs = Number(process.hrtime.bigint() / 1000n);
  const performanceMs = performance.now();
  const afterUs = Number(process.hrtime.bigint() / 1000n);
  return { beforeUs, performanceMs, afterUs };
}

/** Run all original assertions, package checks, weak ownership observations and cleanup rounds. */
async function main(args) {
  const output = args[5];
  assert.equal(typeof output, 'string', 'Sampler diagnostics: missing report output');
  const telemetryPath = `${output}.telemetry.json`;
  const telemetry = { diagnosticOnly: true, gateReevaluated: false, accepted: null,
    complete: false, node: process.version, v8: process.versions.v8, pid: process.pid,
    timeOrigin: performance.timeOrigin, start: clockAnchor(), gcEvents: [] };
  fs.writeFileSync(telemetryPath, `${JSON.stringify(telemetry)}\n`, { flag: 'wx' });
  const capture = (entries) => {
    for (const entry of entries) telemetry.gcEvents.push({ startMs: entry.startTime,
      durationMs: entry.duration, kind: entry.detail.kind, flags: entry.detail.flags });
  };
  const observer = new PerformanceObserver((list) => capture(list.getEntries()));
  observer.observe({ entryTypes: ['gc'] });
  let failure;
  try {
    await require('./harness/reports/benchmarks/native-class-ownership/independent-order-worker.cjs').main(...args);
  } catch (error) {
    telemetry.failure = { message: error.message, stack: error.stack };
    failure = error;
  } finally {
    try {
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      capture(observer.takeRecords());
    } catch (error) {
      telemetry.observerFailure = { message: error.message, stack: error.stack };
      failure ??= error;
    } finally {
      observer.disconnect();
      telemetry.complete = failure === undefined;
      telemetry.end = clockAnchor();
      fs.writeFileSync(telemetryPath, `${JSON.stringify(telemetry, null, 2)}\n`);
    }
  }
  if (failure) throw failure;
}

if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 2;
});
module.exports = { main, clockAnchor };
