/** @file Reads complete instrumented processes without accepting or correcting their timings. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('./constants/protocol.json');

/** Preserve every V8 record; interpret only documented numeric fields and retain unknown record counts. */
function readLog(content) {
  const counts = {};
  const scripts = new Map();
  const creations = new Map();
  const points = [];
  for (const line of content.split('\n').filter(Boolean)) {
    const fields = line.split(',');
    const kind = fields[0]; counts[kind] = (counts[kind] ?? 0) + 1;
    if (kind === 'script-details') scripts.set(fields[2], fields[1]);
    else if (kind === 'script' && fields[1] === 'create') creations.set(fields[2], Number(fields[3]));
    else if (kind === 'function') points.push({ kind, action: fields[1], timestampUs: Number(fields[6]), name: fields.slice(7).join(',') });
    else if (kind === 'code-creation') points.push({ kind, action: fields[1], timestampUs: Number(fields[3]), name: fields.slice(6).join(',') });
    else if (kind === 'code-deopt') points.push({ kind, timestampUs: Number(fields[1]), name: fields.slice(2).join(',') });
  }
  assert.ok(points.length > 0 && points.every((entry) => Number.isFinite(entry.timestampUs) && entry.timestampUs >= 0),
    'JSDOM telemetry: missing or invalid native JIT records');
  return { counts, scripts, creations, points };
}

/** A half-open operation contains a point for every/some offset in the observed endpoint envelope. */
function pointMembership(timestampUs, span, offsets) {
  const lower = timestampUs + offsets.min;
  const upper = timestampUs + offsets.max;
  const start = span.startMs * 1000;
  const end = (span.startMs + span.durationMs) * 1000;
  return { guaranteed: lower >= start && upper < end, possible: upper >= start && lower < end };
}

/** Treat a zero-duration GC observation as a point inside the same half-open operation. */
function gcIntersects(event, span) {
  return event.durationMs === 0 ? event.startMs >= span.startMs && event.startMs < span.startMs + span.durationMs
    : event.startMs < span.startMs + span.durationMs && event.startMs + event.durationMs > span.startMs;
}

/** Describe all twelve original spans, complete CPU samples and native log records of one process. */
function analyzeProcess(directory) {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
  const report = read('report.json');
  const telemetry = read('report.json.telemetry.json');
  const mode = telemetry.mode;
  assert.ok(Object.hasOwn(policy.nodeFlagsByMode, mode));
  const profile = mode === 'cpu' ? read('cpu.cpuprofile') : null;
  assert.equal(report.complete, true); assert.equal(report.engine, 'jsdom');
  assert.equal(telemetry.complete, true); assert.equal(telemetry.accepted, null);
  assert.equal(telemetry.gateReevaluated, false); assert.equal(telemetry.pid, report.pid);
  assert.equal(telemetry.profiler.stopped, mode === 'cpu'); assert.equal(telemetry.profiler.disconnected, true);
  const jit = mode === 'jit' ? readLog(fs.readFileSync(path.join(directory, 'v8.log'), 'utf8')) : null;
  const anchors = [telemetry.start, telemetry.end];
  const jitBrackets = jit ? anchors.map((anchor) => {
    const timestamp = jit.creations.get(jit.scripts.get(anchor.filename));
    assert.ok(Number.isFinite(timestamp), `JSDOM telemetry: missing V8 clock anchor ${anchor.filename}`);
    assert.ok(anchor.beforeMs <= anchor.afterMs);
    return { filename: anchor.filename, timestampUs: timestamp,
      min: anchor.beforeMs * 1000 - timestamp - policy.clockTimestampUncertaintyUs,
      max: anchor.afterMs * 1000 - timestamp + policy.clockTimestampUncertaintyUs };
  }) : null;
  const jitOffsets = jit ? { min: Math.min(...jitBrackets.map((entry) => entry.min)), max: Math.max(...jitBrackets.map((entry) => entry.max)) } : null;
  const cpuOffsets = { min: Math.min(...anchors.map((entry) => entry.afterMs * 1000 - entry.afterUs)) - policy.clockTimestampUncertaintyUs,
    max: Math.max(...anchors.map((entry) => entry.beforeMs * 1000 - entry.beforeUs)) + policy.clockTimestampUncertaintyUs };
  assert.ok(cpuOffsets.min <= cpuOffsets.max, 'JSDOM telemetry: inverted observed CPU-clock envelope');
  if (profile) assert.ok(profile.startTime <= telemetry.start.beforeUs && profile.endTime >= telemetry.end.afterUs,
    'JSDOM telemetry: CPU profile does not enclose observed monotonic anchors');
  if (profile) assert.equal(profile.samples.length, profile.timeDeltas.length);
  const frames = new Map((profile?.nodes ?? []).map((entry) => [entry.id, entry.callFrame]));
  let timestamp = profile?.startTime;
  const ticks = profile ? profile.samples.map((id, index) => {
    assert.ok(Number.isFinite(profile.timeDeltas[index]));
    timestamp += profile.timeDeltas[index];
    assert.ok(frames.has(id));
    return { id, timestampUs: timestamp, index, deltaUs: profile.timeDeltas[index] };
  }) : null;
  assert.equal(report.batches.length, 1);
  const batch = report.batches[0];
  assert.equal(batch.sampleTimings.length, report.settings.warmupSamples + report.settings.measuredSamples);
  assert.deepEqual(batch.sampleTimings.slice(report.settings.warmupSamples).map((span) => span.durationMs), batch.samplesMs);
  const describe = (span) => {
    assert.ok(Number.isFinite(span.startMs) && span.durationMs >= 0);
    const jitEvents = jit ? jit.points.filter((entry) => pointMembership(entry.timestampUs, span, jitOffsets).possible)
      .map((entry) => ({ ...entry, ...pointMembership(entry.timestampUs, span, jitOffsets) }))
      : null;
    const cpuFrames = new Map(); let cpuTicksPossible = 0; let cpuTicksGuaranteed = 0;
    for (const tick of ticks ?? []) {
      const membership = pointMembership(tick.timestampUs, span, cpuOffsets);
      if (!membership.possible) continue;
      cpuTicksPossible++; cpuTicksGuaranteed += Number(membership.guaranteed);
      const frame = frames.get(tick.id);
      const key = JSON.stringify(frame);
      const counted = cpuFrames.get(key) ?? { frame, possibleTicks: 0, guaranteedTicks: 0 };
      counted.possibleTicks++; counted.guaranteedTicks += Number(membership.guaranteed); cpuFrames.set(key, counted);
    }
    const gc = telemetry.gcEvents.filter((entry) => gcIntersects(entry, span));
    return { ...span, gcEvents: gc, cpuTicksPossible: ticks ? cpuTicksPossible : null,
      cpuTicksGuaranteed: ticks ? cpuTicksGuaranteed : null, cpuFrames: ticks ? [...cpuFrames.values()] : null, jitEvents };
  };
  const spans = batch.sampleTimings.map((span) => {
    assert.ok(span.cpuUserUs >= 0 && span.cpuSystemUs >= 0);
    const boundaries = [span.sampleStartMs, span.realmWarmupStartMs, span.realmWarmupEndMs,
      span.startMs, span.startMs + span.durationMs, span.cleanupStartMs, span.sampleEndMs];
    assert.ok(boundaries.every((value, index) => Number.isFinite(value) && (index === 0 || value >= boundaries[index - 1])),
      'JSDOM telemetry: missing or reordered setup/warmup/operation/cleanup boundary');
    const names = ['setup', 'realm-warmup', 'pre-operation', `${span.stage}-operation`, 'validation', 'cleanup'];
    const stages = names.map((name, index) => describe({ stage: name, startMs: boundaries[index],
      durationMs: boundaries[index + 1] - boundaries[index] }));
    return { ...describe(span), stages };
  });
  assert.ok(telemetry.gcEvents.length > 0);
  assert.ok(batch.cleanupTrace.slice(-report.settings.requiredClearRounds).every((entry) => entry.clear
    && entry.survivors.window === 0 && entry.survivors.document === 0));
  return { revision: policy.revision, diagnosticOnly: true, accepted: null, gateReevaluated: false,
    mode, node: report.node, position: report.position, seed: report.v8Seed, label: report.label,
    physical: report.schedule.physical, key: `${batch.name}/${batch.size}`, pid: report.pid,
    trackedOwners: batch.trackedOwners, cleanupTrace: batch.cleanupTrace,
    cpuProfileTicks: ticks?.length ?? null, totalGcEvents: telemetry.gcEvents.length, jitRecordCounts: jit?.counts ?? null,
    outOfOrderCpuSamples: ticks ? ticks.filter((entry) => entry.deltaUs < 0) : null,
    jitBrackets, jitOffsets, cpuOffsets, spans };
}
module.exports = { readLog, pointMembership, gcIntersects, analyzeProcess };
