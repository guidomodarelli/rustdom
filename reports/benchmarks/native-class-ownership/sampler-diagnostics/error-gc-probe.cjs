/** @file Proves that GC queued during a real sampler rejection survives diagnostic cleanup. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance, PerformanceObserver } = require('node:perf_hooks');

async function main() {
  const [diagnosticRoot, manifestPath, output] = process.argv.slice(2);
  const { main: runDiagnostic } = require(path.join(diagnosticRoot, 'worker.cjs'));
  const controlEvents = [];
  const capture = (entries) => {
    for (const entry of entries) controlEvents.push({ startMs: entry.startTime,
      durationMs: entry.duration, kind: entry.detail.kind, flags: entry.detail.flags });
  };
  const observer = new PerformanceObserver((list) => capture(list.getEntries()));
  observer.observe({ entryTypes: ['gc'] });
  try {
    const pending = runDiagnostic([manifestPath, 'AA', 'unsupported-engine', '0', 'A', output]);
    const gcStartMs = performance.now();
    global.gc();
    const gcEndMs = performance.now();
    await assert.rejects(pending);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    capture(observer.takeRecords());
    const telemetry = JSON.parse(fs.readFileSync(`${output}.telemetry.json`));
    const forcedEvents = controlEvents.filter((entry) => entry.startMs >= gcStartMs && entry.startMs <= gcEndMs);
    const result = { node: process.version, gcStartMs, gcEndMs, controlEvents, forcedEvents,
      diagnosticEvents: telemetry.gcEvents, retainedFailure: telemetry.failure,
      complete: telemetry.complete };
    fs.writeFileSync(`${output}.probe.json`, `${JSON.stringify(result, null, 2)}\n`);
    assert.ok(forcedEvents.length > 0, 'Sampler diagnostics: control did not observe the forced GC');
    for (const event of forcedEvents) {
      assert.ok(telemetry.gcEvents.some((captured) => captured.startMs === event.startMs &&
        captured.durationMs === event.durationMs && captured.kind === event.kind && captured.flags === event.flags),
      'Sampler diagnostics: GC queued during failure was discarded');
    }
    assert.equal(telemetry.complete, false);
    assert.equal(typeof telemetry.failure.message, 'string');
  } finally {
    observer.disconnect();
  }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
