/** @file Describes explicitly identified native/JS telemetry; adapts the frozen clock reader without changing it. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('./constants/protocol.json');
const { readLog, pointMembership, gcIntersects } = require('../jsdom-telemetry/analyze.cjs');
const { isReleased } = require('../../../../scripts/memory-endpoint.cjs');
const settings = require('../constants/current-ownership.cjs');

/** Describe all twelve original spans, complete CPU samples and native log records of one process. */
function analyzeProcess(directory, identity) {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
  const report = read('report.json');
  const telemetry = read('report.json.telemetry.json');
  const mode = telemetry.mode;
  assert.ok(Object.hasOwn(policy.nodeFlagsByMode, mode));
  const profile = mode === 'cpu' ? read('cpu.cpuprofile') : null;
  assert.equal(report.complete, true); assert.ok(policy.engines.includes(report.engine));
  assert.equal(report.engine, identity.engine); assert.equal(report.revision, identity.reportRevision);
  assert.equal(telemetry.revision, identity.telemetryRevision);
  for (const name of ['cleanupRounds', 'requiredClearRounds', 'warmupSamples', 'measuredSamples']) {
    assert.equal(report.settings[name], settings[name], `Native telemetry: non-canonical ${name}`);
  }
  if (report.engine === 'rustdom') {
    assert.ok(Number.isSafeInteger(report.nativeBaseline?.napiClasses?.live) && report.nativeBaseline.napiClasses.live >= 0,
      'Native telemetry: missing or invalid native class baseline');
  } else assert.equal(report.nativeBaseline, undefined, 'Native telemetry: jsdom cannot declare a native baseline');
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
  assert.equal(batch.complete, true, 'Native telemetry: incomplete batch');
  const owners = settings.warmupSamples + settings.measuredSamples;
  assert.deepEqual(batch.trackedOwners, { window: owners, document: owners }, 'Native telemetry: incomplete owner observations');
  assert.equal(batch.sampleTimings.length, settings.warmupSamples + settings.measuredSamples);
  assert.equal(batch.samplesMs.length, settings.measuredSamples);
  assert.ok(Array.isArray(batch.cleanupTrace), 'Native telemetry: missing release trace');
  assert.equal(batch.cleanupTrace.length, settings.cleanupRounds, 'Native telemetry: incomplete release trace');
  assert.deepEqual(batch.sampleTimings.slice(settings.warmupSamples).map((span) => span.durationMs), batch.samplesMs);
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
  assert.ok(batch.cleanupTrace.slice(-settings.requiredClearRounds).every((entry) => entry.clear
    && entry.survivors.window === 0 && entry.survivors.document === 0 && isReleased(entry, report.nativeBaseline)));
  return { revision: policy.revision, diagnosticOnly: true, accepted: null, gateReevaluated: false,
    sourceReportRevision: report.revision, sourceTelemetryRevision: telemetry.revision, engine: report.engine,
    mode, node: report.node, position: report.position, seed: report.v8Seed, label: report.label,
    physical: report.schedule.physical, key: `${batch.name}/${batch.size}`, pid: report.pid,
    trackedOwners: batch.trackedOwners, cleanupTrace: batch.cleanupTrace,
    cpuProfileTicks: ticks?.length ?? null, totalGcEvents: telemetry.gcEvents.length, jitRecordCounts: jit?.counts ?? null,
    outOfOrderCpuSamples: ticks ? ticks.filter((entry) => entry.deltaUs < 0) : null,
    jitBrackets, jitOffsets, cpuOffsets, spans };
}
module.exports = { analyzeProcess };
