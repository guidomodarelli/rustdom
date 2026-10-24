/** @file Profiles the declared native/JS worker once; host/attempt/capability guards precede all observation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { performance, PerformanceObserver } = require('node:perf_hooks');
const { Script } = require('node:vm');

/** Record a monotonic clock envelope and a uniquely named V8 script outside the operation. */
function anchor(filename) {
  const beforeUs = Number(process.hrtime.bigint()) / 1000; const beforeMs = performance.now();
  new Script('0;', { filename }).runInThisContext();
  const afterMs = performance.now(); const afterUs = Number(process.hrtime.bigint()) / 1000;
  return { filename, beforeUs, afterUs, beforeMs, afterMs };
}

/** Preserve raw sampler bytes and add distinct diagnostic provenance only after its clocks stop. */
function annotate(report, policy, sourceReportSha256, integration) {
  assert.equal(report.revision, policy.sourceSamplerRevision, 'Native telemetry: unexpected source sampler revision');
  return { ...report, sourceSamplerRevision: report.revision, revision: policy.revision,
    purpose: policy.purpose, diagnosticOnly: true, performanceAccepted: null, gateReevaluated: false,
    sourceReportSha256, integration };
}

/** Execute only on the unique declared hosted attempt, always attempting independent resource teardown. */
async function main(args) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Native telemetry: worker requires the declared hosted runner');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'Native telemetry: repeated attempts are forbidden');
  assert.equal(args.length, 7, 'Native telemetry: provide manifest phase engine position label output row');
  const policy = JSON.parse(fs.readFileSync(path.join(__dirname, 'protocol.json'), 'utf8'));
  assert.equal(policy.captureImplemented, true, 'Native telemetry: capture capability is not implemented');
  assert.ok(policy.modes.includes(policy.mode), 'Native telemetry: undeclared observation mode');
  assert.match(process.env.GITHUB_RUN_ID ?? '', /^\d+$/, 'Native telemetry: missing hosted run identity');
  assert.match(process.env.NATIVE_TELEMETRY_SOURCE_COMMIT ?? '', /^[a-f0-9]{40}$/, 'Native telemetry: missing source commit');
  assert.ok(policy.engines.includes(args[2])); assert.equal(Number(args[6]), policy.rowIndex);
  const output = args[5]; const sidecar = `${output}.telemetry.json`; const sourceOutput = `${output}.source.json`;
  assert.ok(!fs.existsSync(output) && !fs.existsSync(sidecar) && !fs.existsSync(sourceOutput), 'Native telemetry: preserve existing evidence');
  const state = { revision: policy.revision, purpose: policy.purpose, diagnosticOnly: true, accepted: null,
    gateReevaluated: false, complete: false, mode: policy.mode, engine: args[2], node: process.version,
    pid: process.pid, hostedRunId: process.env.GITHUB_RUN_ID, runAttempt: 1, sourceCommit: process.env.NATIVE_TELEMETRY_SOURCE_COMMIT,
    gcEvents: [], derivationSha256: createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'preparation.json'))).digest('hex'),
    profiler: { connected: false, started: false, stopped: false, disabled: false, disconnected: false }, observerDisconnected: false };
  fs.writeFileSync(sidecar, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' });
  const capture = (entries) => {
    for (const entry of entries) state.gcEvents.push({ startMs: entry.startTime, durationMs: entry.duration,
      kind: entry.detail.kind, flags: entry.detail.flags });
  };
  const observer = new PerformanceObserver((entries) => capture(entries.getEntries()));
  let session; let failure; let hasFailure = false;
  const failed = (operation, error) => {
    if (!hasFailure) failure = error;
    hasFailure = true;
    (state.failures ??= []).push({ operation, message: error?.message ?? String(error), stack: error?.stack });
  };
  try {
    observer.observe({ entryTypes: ['gc'] });
    if (policy.mode === 'cpu') {
      const { Session } = require('node:inspector/promises'); session = new Session();
      session.connect(); state.profiler.connected = true;
      await session.post('Profiler.enable');
      await session.post('Profiler.setSamplingInterval', { interval: policy.cpuSamplingIntervalUs });
      await session.post('Profiler.start'); state.profiler.started = true;
    }
    state.start = anchor(policy.clockNames[0]);
    await require('./harness/reports/benchmarks/native-class-ownership/current-ownership-worker.cjs').main(...args);
  } catch (error) { failed('sample', error); }
  finally {
    try { state.end = anchor(policy.clockNames[1]); } catch (error) { failed('clock-end', error); }
    if (state.profiler.started) {
      try {
        const { profile } = await session.post('Profiler.stop'); state.profiler.stopped = true;
        fs.writeFileSync(path.join(path.dirname(output), 'cpu.cpuprofile'), JSON.stringify(profile) + '\n', { flag: 'wx' });
      } catch (error) { failed('profiler-stop', error); }
    }
    if (state.profiler.connected) {
      try { await session.post('Profiler.disable'); state.profiler.disabled = true; } catch (error) { failed('profiler-disable', error); }
    }
    try {
      await new Promise((resolve) => setImmediate(resolve)); await new Promise((resolve) => setImmediate(resolve));
      capture(observer.takeRecords());
    } catch (error) { failed('gc-drain', error); }
    try { observer.disconnect(); state.observerDisconnected = true; } catch (error) { failed('observer-disconnect', error); }
    if (session) {
      try { session.disconnect(); state.profiler.disconnected = true; } catch (error) { failed('profiler-disconnect', error); }
    } else state.profiler.disconnected = true;
    try {
      if (fs.existsSync(output)) {
        const bytes = fs.readFileSync(output); const report = JSON.parse(bytes);
        fs.writeFileSync(sourceOutput, bytes, { flag: 'wx' });
        assert.equal(report.pid, state.pid); assert.equal(report.node, state.node);
        state.integration = require('./harness/benchmarks/shared-ownership-fixtures/adapter.cjs').statistics();
        fs.writeFileSync(output, JSON.stringify(annotate(report, policy, createHash('sha256').update(bytes).digest('hex'), state.integration), null, 2) + '\n');
        state.sourceSamplerRevision = report.revision; state.sourceReportSha256 = createHash('sha256').update(bytes).digest('hex');
        if (!report.complete) failed('sampler-report', new Error('Native telemetry: incomplete sampler report'));
      } else failed('sampler-report', new Error('Native telemetry: sampler did not produce a report'));
    } catch (error) { failed('report-preservation', error); }
    state.complete = !hasFailure;
    fs.writeFileSync(sidecar, JSON.stringify(state, null, 2) + '\n');
  }
  if (hasFailure) throw failure;
}
if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error?.stack ?? String(error)}\n`); process.exitCode = 2;
});
module.exports = { main, annotate };
