/** @file Correlates exported public-operation intervals with real V8 events using bounded clock calibration. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const root = path.resolve(process.argv[2]);
const readJson = (name) => {
  const target = path.join(root, name);
  const bytes = fs.existsSync(target) ? fs.readFileSync(target) : gunzipSync(fs.readFileSync(`${target}.gz`));
  return JSON.parse(bytes.toString('utf8'));
};
const index = readJson('index.json');
assert.equal(index.complete, true);
assert.equal(index.diagnosticVersion, 2);
const timestampRoundingUs = 1;
const nanosecondsToMicroseconds = (value) => Number(BigInt(value) / 1000n) + Number(BigInt(value) % 1000n) / 1000;
const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
/** Union overlapping intervals before computing wall-time overlap. */
function overlapMicroseconds(intervals, start, end) {
  if (end <= start) return 0;
  const clipped = intervals.map((interval) => [Math.max(start, interval.start), Math.min(end, interval.end)])
    .filter(([intervalStart, intervalEnd]) => intervalEnd > intervalStart).sort((left, right) => left[0] - right[0]);
  let total = 0; let previousEnd = start;
  for (const [intervalStart, intervalEnd] of clipped) {
    total += Math.max(0, intervalEnd - Math.max(previousEnd, intervalStart));
    previousEnd = Math.max(previousEnd, intervalEnd);
  }
  return total;
}
const summary = { schemaVersion: 1, diagnosticOnly: true, timestampRoundingUs, runs: [],
  limits: 'Instrumented four-process diagnostic. Background CPU bounds sum thread CPU time; they are not wall-time savings or evidence that a source change caused a regression.' };
for (const run of index.runs) {
  const report = readJson(run.stdout);
  const trace = readJson(run.trace).traceEvents;
  const main = trace.find((event) => event.name === 'thread_name' && event.args?.name === 'JavaScriptMainThread');
  assert.ok(main, 'Trace must identify its real JavaScript main thread');
  const lowerOffsets = report.profileClockCalibrations.map((entry) =>
    nanosecondsToMicroseconds(entry.beforeNs) - entry.performanceMs * 1000 - timestampRoundingUs);
  const upperOffsets = report.profileClockCalibrations.map((entry) =>
    nanosecondsToMicroseconds(entry.afterNs) - entry.performanceMs * 1000 + timestampRoundingUs);
  const offsetLowerUs = Math.max(...lowerOffsets);
  const offsetUpperUs = Math.min(...upperOffsets);
  assert.ok(offsetLowerUs <= offsetUpperUs, 'The shared clock needs a consistent calibration intersection');
  const gc = [];
  const openGc = new Map();
  for (const event of trace.filter((entry) => entry.pid === main.pid && entry.tid === main.tid &&
    ['MinorGC', 'MajorGC'].includes(entry.name)).sort((left, right) => left.ts - right.ts)) {
    if (event.ph === 'X') gc.push({ start: event.ts, end: event.ts + event.dur, name: event.name });
    else if (event.ph === 'B') {
      const stack = openGc.get(event.name) ?? []; stack.push(event.ts); openGc.set(event.name, stack);
    } else if (event.ph === 'E') {
      const start = openGc.get(event.name)?.pop();
      assert.notEqual(start, undefined, 'GC end must have a matching beginning');
      gc.push({ start, end: event.ts, name: event.name });
    }
  }
  assert.ok([...openGc.values()].every((stack) => stack.length === 0), 'GC intervals must be complete');
  const compiler = trace.filter((event) => event.ph === 'X' && event.pid === main.pid &&
    event.tid !== main.tid && event.name === 'V8.OptimizeBackground').map((event) =>
    ({ start: event.ts, end: event.ts + event.dur, cpuUs: event.tdur ?? null, tid: event.tid }));
  const mainCompiler = trace.filter((event) => event.ph === 'X' && event.pid === main.pid &&
    event.tid === main.tid && /^V8\.(Compile|Optimize|InstallOptimizedFunctions)/.test(event.name))
    .map((event) => ({ start: event.ts, end: event.ts + event.dur }));
  const samples = report.profileMarkers.map((marker) => {
    const match = marker.name.match(/^rustdom-ownership-sample:(\d+):(\d+)$/);
    assert.ok(match, 'Marker must identify the actual fixture size and sample');
    const rows = Number(match[1]); const sample = Number(match[2]);
    const innerStart = marker.startTime * 1000 + offsetUpperUs;
    const innerEnd = (marker.startTime + marker.duration) * 1000 + offsetLowerUs;
    const outerStart = marker.startTime * 1000 + offsetLowerUs;
    const outerEnd = (marker.startTime + marker.duration) * 1000 + offsetUpperUs;
    let backgroundCpuLowerUs = 0; let backgroundCpuUpperUs = 0;
    for (const task of compiler) {
      if (task.cpuUs === null) continue;
      const start = task.start - timestampRoundingUs; const end = task.end + timestampRoundingUs;
      const insideGuaranteed = Math.max(0, Math.min(innerEnd, end) - Math.max(innerStart, start));
      const insidePossible = Math.max(0, Math.min(outerEnd, end) - Math.max(outerStart, start));
      backgroundCpuLowerUs += Math.max(0, task.cpuUs - 2 * timestampRoundingUs - (end - start - insideGuaranteed));
      backgroundCpuUpperUs += Math.min(task.cpuUs + 2 * timestampRoundingUs, insidePossible);
    }
    const gcLowerMs = overlapMicroseconds(gc, innerStart, innerEnd) / 1000;
    const gcUpperMs = overlapMicroseconds(gc, outerStart, outerEnd) / 1000;
    assert.ok(gcLowerMs <= gcUpperMs && gcUpperMs <= marker.duration + 0.01);
    if (sample >= report.warmupSamples) assert.equal(marker.duration,
      report.workloads.find((row) => row.rows === rows).samplesMs[sample - report.warmupSamples]);
    return { rows, sample, warmup: sample < report.warmupSamples, elapsedMs: marker.duration,
      gcLowerMs, gcUpperMs, mainCompilerOverlapMs: overlapMicroseconds(mainCompiler, outerStart, outerEnd) / 1000,
      backgroundCompilerWallOverlapMs: overlapMicroseconds(compiler, outerStart, outerEnd) / 1000,
      backgroundCpuLowerMs: backgroundCpuLowerUs / 1000, backgroundCpuUpperMs: backgroundCpuUpperUs / 1000 };
  });
  const rows = report.workloads.map((workload) => {
    const measured = samples.filter((entry) => entry.rows === workload.rows && !entry.warmup);
    assert.equal(measured.length, 9);
    return { rows: workload.rows, samples: measured.length, medianMs: median(measured.map((entry) => entry.elapsedMs)),
      totalElapsedMs: measured.reduce((total, entry) => total + entry.elapsedMs, 0),
      totalGcLowerMs: measured.reduce((total, entry) => total + entry.gcLowerMs, 0),
      totalGcUpperMs: measured.reduce((total, entry) => total + entry.gcUpperMs, 0),
      samplesWithGc: measured.filter((entry) => entry.gcLowerMs > 0).length,
      totalBackgroundCpuLowerMs: measured.reduce((total, entry) => total + entry.backgroundCpuLowerMs, 0),
      totalBackgroundCpuUpperMs: measured.reduce((total, entry) => total + entry.backgroundCpuUpperMs, 0),
      totalMainCompilerOverlapMs: measured.reduce((total, entry) => total + entry.mainCompilerOverlapMs, 0),
      samplesWithBackgroundCompilation: measured.filter((entry) => entry.backgroundCompilerWallOverlapMs > 0).length };
  });
  summary.runs.push({ label: run.label, position: run.position, pid: main.pid, mainThreadId: main.tid,
    clock: { offsetLowerUs, offsetUpperUs, uncertaintyUs: offsetUpperUs - offsetLowerUs },
    gcEvents: gc.length, backgroundCompilationEvents: compiler.length, samples, rows });
}
const output = path.join(root, 'analysis.json');
if (process.argv.includes('--verify')) {
  assert.deepEqual(readJson('analysis.json'), summary, 'Archived clock and V8 event analysis must reproduce exactly');
  process.stdout.write(`${JSON.stringify({ verified: true, runs: summary.runs.length,
    measuredSamples: summary.runs.reduce((total, run) => total + run.samples.filter((sample) => !sample.warmup).length, 0) })}\n`);
} else {
  assert.ok(!fs.existsSync(output), 'Keep previous diagnostic conclusions intact');
  fs.writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary.runs.map((run) => ({ label: run.label, position: run.position,
    clockUncertaintyUs: run.clock.uncertaintyUs, rows: run.rows })), null, 2)}\n`);
}
