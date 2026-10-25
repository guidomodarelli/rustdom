/** @file Exports every authenticated native diagnostic span and describes CPU/GC/JIT without reevaluating budgets. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { fileURLToPath } = require('node:url');
const policy = require('./constants/analysis.json');
const repository = path.resolve(__dirname, policy.repositoryRelativePath);
/** Load only the current repository helpers whose exact bytes are declared independently. */
function sourceModule(name) {
  const declared = policy.sourceModules[name]; const filename = path.join(repository, declared.path);
  assert.equal(createHash('sha256').update(fs.readFileSync(filename)).digest('hex'), declared.sha256);
  return require(filename);
}
const { readFunctionRecords } = sourceModule('functionOrigins');
const { pointMembership } = sourceModule('telemetry');
const { median } = sourceModule('statistics');

const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const sum = (values) => values.reduce((total, value) => total + value, 0);
const compare = (left, right) => left < right ? -1 : Number(left > right);

/** Classify recorded URLs while preserving the original URL in all frame/event exports. */
function originFor(source, roots) {
  const categories = policy.sourceCategories;
  if (source === null || source === '') return categories.unknown;
  if (source.startsWith('node:')) return categories.node;
  const filename = source.startsWith('file:') ? fileURLToPath(source) : source;
  if (roots.reference.some((root) => filename.startsWith(root + '/'))) return categories.referenceJsdom;
  for (const root of roots.native) {
    if (filename.startsWith(root + '/' + policy.vendorPath + '/')) return categories.compatibilityJsdom;
    if (filename.startsWith(root + '/dist/')) return categories.rustdomJavascript;
    if (filename.startsWith(root + '/')) return categories.rustdomPackageOther;
  }
  if (filename.startsWith(roots.dependencies + '/')) return categories.dependencies;
  if (filename.startsWith(roots.instrumentation + '/harness/')) return categories.harness;
  if (filename.startsWith(roots.instrumentation + '/')) return categories.instrumentation;
  return categories.other;
}

/** Write standards-compatible CSV, preserving every row and escaping names/URLs without normalization. */
function csv(filename, rows, headers) {
  const escape = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  fs.writeFileSync(filename, [headers, ...rows.map((row) => headers.map((name) => row[name]))]
    .map((row) => row.map(escape).join(',')).join('\n') + '\n', { flag: 'wx' });
}

/** Bound pending text independently of the number and backing strings of logged events. */
function csvWriter(filename, headers) {
  const descriptor = fs.openSync(filename, 'wx');
  let pending = '';
  const flush = () => { if (pending) fs.writeFileSync(descriptor, pending); pending = ''; };
  const write = (row) => {
    pending += headers.map((name) => '"' + String(row[name] ?? '').replaceAll('"', '""') + '"').join(',') + '\n';
    if (pending.length >= policy.csvBufferCodeUnits) flush();
  };
  pending = headers.map((name) => '"' + name + '"').join(',') + '\n';
  return { write, close: () => { try { flush(); } finally { fs.closeSync(descriptor); } } };
}

/**
 * Preserve the complete recorded native/resource observations without selecting counter families.
 * @param {object} identity - Original process identity attached by the authenticated caller.
 * @param {object} report - The original report with its single measured workload batch.
 * @returns {object} Original baselines, owners, measured endpoints and every cleanup round.
 */
function resourceObservation(identity, report) {
  assert.equal(report.batches.length, 1, 'Range AA resource export: expected one recorded workload batch');
  const batch = report.batches[0];
  assert.ok(Array.isArray(batch.cleanupTrace), 'Range AA resource export: missing recorded cleanup trace');
  assert.ok(Array.isArray(batch.memoryAfterCleanup), 'Range AA resource export: missing measured memory endpoints');
  return { ...identity, nativeBaseline: report.nativeBaseline, trackedOwners: batch.trackedOwners,
    memoryAfterCleanup: batch.memoryAfterCleanup, cleanupTrace: batch.cleanupTrace };
}

/** Read only the recorded, hash-bound reports and profiles from this specific completed run. */
function analyze(capture, output, replayFile) {
  assert.ok(policy.runId && policy.indexSha256 && policy.replaySha256, 'Range AA result analysis: bind actual run, index and strict replay before exporting');
  capture = fs.realpathSync(capture);
  output = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
  assert.ok(output !== capture && !output.startsWith(capture + path.sep) && !capture.startsWith(output + path.sep),
    'Native result analysis: output overlaps authenticated capture');
  assert.equal(hash(path.join(capture, 'index.json')), policy.indexSha256);
  assert.equal(hash(replayFile), policy.replaySha256);
  const replay = read(replayFile);
  assert.equal(replay.verified, true); assert.equal(replay.complete, true);
  assert.equal(replay.performanceAccepted, null); assert.equal(replay.gateReevaluated, false);
  const index = read(path.join(capture, 'index.json'));
  assert.equal(index.revision, policy.captureRevision); assert.equal(index.sourceCommit, policy.sourceCommit);
  assert.equal(index.hostedRunId, policy.runId); assert.equal(index.complete, true);
  assert.equal(index.processes.length, policy.processes);
  fs.mkdirSync(output);
  const spans = []; const processes = []; const resources = []; const anomalies = [];
  const groups = new Map(); const recordCounts = {};
  const identityHeaders = ['ordinal', 'node', 'mode', 'phase', 'engine', 'label', 'physical', 'position', 'seed', 'pid'];
  let frameWriter; let functionWriter; let resourceDescriptor;
  let cpuFrameRows = 0; let attributedOperationFunctionRecords = 0;
  try {
    frameWriter = csvWriter(path.join(output, 'cpu-frames.csv'), [...identityHeaders, 'index', 'stage', 'origin', 'functionName', 'scriptId', 'url', 'lineNumber', 'columnNumber', 'possibleTicks', 'guaranteedTicks']);
    functionWriter = csvWriter(path.join(output, 'jit-operation-functions.csv'), [...identityHeaders, 'index', 'stage', 'lineNumber', 'action', 'scriptId', 'startPosition', 'endPosition', 'loggedTimeDelta', 'timestampUs', 'name', 'source', 'origin', 'guaranteed']);
    resourceDescriptor = fs.openSync(path.join(output, 'resources-native.jsonl'), 'wx');
    for (const [ordinal, entry] of index.processes.entries()) {
    const directory = path.join(capture, String(ordinal).padStart(4, '0'));
    for (const name of ['analysis.json', 'report.json', ...(entry.input.mode === 'jit' ? ['v8.log'] : [])]) {
      assert.equal(hash(path.join(directory, name)), entry.files[name]);
    }
    const analysis = read(path.join(directory, 'analysis.json')); const report = read(path.join(directory, 'report.json'));
    assert.equal(analysis.pid, entry.pid); assert.equal(analysis.node, entry.node);
    assert.equal(analysis.engine, entry.input.engine); assert.equal(analysis.mode, entry.input.mode);
    assert.equal(analysis.spans.length, policy.spansPerProcess);
    const identity = { ordinal, node: analysis.node, mode: analysis.mode, phase: entry.input.phase,
      engine: analysis.engine, label: analysis.label, physical: analysis.physical, position: analysis.position,
      seed: analysis.seed, pid: analysis.pid };
    const worker = entry.argv.find((argument) => argument.endsWith('/worker.cjs'));
    assert.ok(worker);
    const roots = { reference: policy.referenceCopies.map((name) => index.manifest.copies[name]),
      native: policy.nativeCopies.map((name) => index.manifest.copies[name]),
      dependencies: path.posix.dirname(path.posix.dirname(index.manifest.copies.J0)) + '/node_modules',
      instrumentation: path.posix.dirname(worker) };
    const functionRecords = analysis.mode === 'jit' ? readFunctionRecords(fs.readFileSync(path.join(directory, 'v8.log'), 'utf8')) : [];
    if (analysis.mode === 'jit') assert.equal(functionRecords.length, analysis.jitRecordCounts.function);
    for (const [kind, count] of Object.entries(analysis.jitRecordCounts ?? {})) recordCounts[kind] = (recordCounts[kind] ?? 0) + count;
    for (const anomaly of analysis.outOfOrderCpuSamples ?? []) anomalies.push({ ...identity, ...anomaly });
    for (const span of analysis.spans) {
      const key = JSON.stringify([identity.node, identity.mode, identity.phase, identity.engine, identity.label, span.stage]);
      const group = groups.get(key) ?? { node: identity.node, mode: identity.mode, phase: identity.phase,
        engine: identity.engine, label: identity.label, stage: span.stage, durationsMs: [],
        spansWithGc: 0, gcIntersections: 0, cpuTicksPossible: identity.mode === 'cpu' ? 0 : null,
        cpuTicksGuaranteed: identity.mode === 'cpu' ? 0 : null, cpuOrigins: identity.mode === 'cpu' ? {} : null,
        jitEvents: identity.mode === 'jit' ? {} : null, jitFunctionOrigins: identity.mode === 'jit' ? {} : null };
      group.durationsMs.push(span.durationMs); group.spansWithGc += Number(span.gcEvents.length > 0);
      group.gcIntersections += span.gcEvents.length;
      if (identity.mode === 'cpu') {
        group.cpuTicksPossible += span.cpuTicksPossible; group.cpuTicksGuaranteed += span.cpuTicksGuaranteed;
      }
      groups.set(key, group);
      spans.push({ ...identity, index: span.index, stage: span.stage, startMs: span.startMs, durationMs: span.durationMs,
        cpuUserUs: span.cpuUserUs, cpuSystemUs: span.cpuSystemUs, gcIntersections: span.gcEvents.length,
        cpuTicksPossible: span.cpuTicksPossible, cpuTicksGuaranteed: span.cpuTicksGuaranteed,
        jitEventsPossible: span.jitEvents?.length ?? null,
        jitEventsGuaranteed: span.jitEvents ? span.jitEvents.filter((event) => event.guaranteed).length : null,
        outputHash: report.batches[0].outputHash });
      for (const counted of span.cpuFrames ?? []) {
        const origin = originFor(counted.frame.url, roots);
        const category = group.cpuOrigins[origin] ?? { possible: 0, guaranteed: 0 };
        category.possible += counted.possibleTicks; category.guaranteed += counted.guaranteedTicks;
        group.cpuOrigins[origin] = category;
        frameWriter.write({ ...identity, index: span.index, stage: span.stage, origin, ...counted.frame,
          possibleTicks: counted.possibleTicks, guaranteedTicks: counted.guaranteedTicks });
        cpuFrameRows++;
      }
      for (const event of span.jitEvents ?? []) {
        const eventKey = `${event.kind}/${event.action ?? ''}`;
        const total = group.jitEvents[eventKey] ?? { possible: 0, guaranteed: 0 };
        total.possible++; total.guaranteed += Number(event.guaranteed); group.jitEvents[eventKey] = total;
      }
      for (const event of functionRecords) {
        const membership = pointMembership(event.timestampUs, span, analysis.jitOffsets);
        if (!membership.possible) continue;
        const origin = originFor(event.source, roots); const eventKey = `${origin}/${event.action}`;
        const total = group.jitFunctionOrigins[eventKey] ?? { possible: 0, guaranteed: 0 };
        total.possible++; total.guaranteed += Number(membership.guaranteed); group.jitFunctionOrigins[eventKey] = total;
        functionWriter.write({ ...identity, index: span.index, stage: span.stage, ...event, origin, guaranteed: membership.guaranteed });
        attributedOperationFunctionRecords++;
      }
    }
    assert.deepEqual(analysis.cleanupTrace, report.batches[0].cleanupTrace);
    assert.deepEqual(analysis.trackedOwners, report.batches[0].trackedOwners);
    fs.writeFileSync(resourceDescriptor, JSON.stringify(resourceObservation(identity, report)) + '\n');
    const baseline = report.nativeBaseline?.napiClasses;
    for (const [round, trace] of analysis.cleanupTrace.entries()) resources.push({ ...identity, round,
      clear: trace.clear, windowSurvivors: trace.survivors.window, documentSurvivors: trace.survivors.document,
      ...trace.memory, constructorReferencesLive: trace.nativeTree?.napiClasses?.live,
      constructorReferencesCreated: trace.nativeTree?.napiClasses?.created, constructorReferencesReleased: trace.nativeTree?.napiClasses?.released,
      baselineConstructorReferencesLive: baseline?.live, baselineConstructorReferencesCreated: baseline?.created, baselineConstructorReferencesReleased: baseline?.released,
      mutationRecordsLive: trace.nativeTree?.mutationRecords?.live,
      mutationRecordsCreated: trace.nativeTree?.mutationRecords?.created, mutationRecordsReleased: trace.nativeTree?.mutationRecords?.released });
    const final = analysis.cleanupTrace.at(-1);
    const measured = analysis.spans.filter((span) => span.stage === 'measured').map((span) => span.durationMs);
    assert.equal(measured.length, policy.measuredSpansPerProcess);
    processes.push({ ...identity, medianMeasuredMs: median(measured), minMeasuredMs: Math.min(...measured), maxMeasuredMs: Math.max(...measured),
      cpuProfileTicks: analysis.cpuProfileTicks, negativeCpuDeltas: analysis.mode === 'cpu' ? analysis.outOfOrderCpuSamples.length : null,
      totalGcEvents: analysis.totalGcEvents, firstClear: analysis.cleanupTrace[0].clear,
      trackedWindow: analysis.trackedOwners.window, trackedDocument: analysis.trackedOwners.document,
      constructorReferencesCreatedAfterBaseline: baseline ? final.nativeTree.napiClasses.created - baseline.created : null,
      constructorReferencesReleasedAfterBaseline: baseline ? final.nativeTree.napiClasses.released - baseline.released : null,
      finalConstructorReferencesLive: final.nativeTree?.napiClasses?.live ?? null,
      mutationRecordsCreatedAfterBaseline: report.nativeBaseline ? final.nativeTree.mutationRecords.created - report.nativeBaseline.mutationRecords.created : null,
      mutationRecordsReleasedAfterBaseline: report.nativeBaseline ? final.nativeTree.mutationRecords.released - report.nativeBaseline.mutationRecords.released : null });
  } } finally {
    try { frameWriter?.close(); } finally {
      try { functionWriter?.close(); } finally { if (resourceDescriptor !== undefined) fs.closeSync(resourceDescriptor); }
    }
  }
  const cells = [...groups.entries()].sort(([left], [right]) => compare(left, right)).map(([, group]) => {
    const { durationsMs, ...counts } = group;
    return { ...counts, spans: durationsMs.length, medianDurationMs: median(durationsMs), minDurationMs: Math.min(...durationsMs), maxDurationMs: Math.max(...durationsMs) };
  });
  assert.equal(spans.length, replay.warmupSpans + replay.measuredSpans);
  assert.equal(sum(processes.map((entry) => entry.trackedWindow)), replay.windows);
  assert.equal(sum(processes.map((entry) => entry.trackedDocument)), replay.documents);
  const summary = { revision: policy.revision, diagnosticOnly: true, performanceAccepted: null, gateReevaluated: false,
    newMeasurements: 0, runId: policy.runId, sourceCommit: policy.sourceCommit, counts: replay,
    negativeCpuDeltas: anomalies.length, constructorReferencesCreatedAfterBaseline: sum(processes.map((entry) => entry.constructorReferencesCreatedAfterBaseline ?? 0)),
    constructorReferencesReleasedAfterBaseline: sum(processes.map((entry) => entry.constructorReferencesReleasedAfterBaseline ?? 0)),
    mutationRecordsCreatedAfterBaseline: sum(processes.map((entry) => entry.mutationRecordsCreatedAfterBaseline ?? 0)),
    mutationRecordsReleasedAfterBaseline: sum(processes.map((entry) => entry.mutationRecordsReleasedAfterBaseline ?? 0)),
    constructorReferencesLiveValues: [...new Set(processes.map((entry) => entry.finalConstructorReferencesLive).filter((value) => value !== null))].sort((left, right) => left - right),
    jitRecordCounts: recordCounts, cpuFrameRows, attributedOperationFunctionRecords, parentMemory: index.parentMemory, cells };
  csv(path.join(output, 'spans.csv'), spans, [...identityHeaders, 'index', 'stage', 'startMs', 'durationMs', 'cpuUserUs', 'cpuSystemUs', 'gcIntersections', 'cpuTicksPossible', 'cpuTicksGuaranteed', 'jitEventsPossible', 'jitEventsGuaranteed', 'outputHash']);
  csv(path.join(output, 'processes.csv'), processes, Object.keys(processes[0]));
  csv(path.join(output, 'resources.csv'), resources, [...identityHeaders, 'round', 'clear', 'windowSurvivors', 'documentSurvivors', 'rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers', 'constructorReferencesLive', 'constructorReferencesCreated', 'constructorReferencesReleased', 'baselineConstructorReferencesLive', 'baselineConstructorReferencesCreated', 'baselineConstructorReferencesReleased', 'mutationRecordsLive', 'mutationRecordsCreated', 'mutationRecordsReleased']);
  csv(path.join(output, 'cpu-clock-anomalies.csv'), anomalies, [...identityHeaders, 'id', 'timestampUs', 'index', 'deltaUs']);
  fs.writeFileSync(path.join(output, 'analysis.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
  return summary;
}

if (require.main === module) {
  assert.equal(process.argv.length, 5, 'Provide authenticated capture, fresh output directory and strict replay JSON');
  const result = analyze(...process.argv.slice(2).map((filename) => path.resolve(filename)));
  console.log(JSON.stringify({ processes: result.counts.processes, measured: result.counts.measuredSpans, warmup: result.counts.warmupSpans,
    negativeCpuDeltas: result.negativeCpuDeltas, constructorReferencesCreatedAfterBaseline: result.constructorReferencesCreatedAfterBaseline,
    attributedOperationFunctionRecords: result.attributedOperationFunctionRecords, performanceAccepted: null }));
}
module.exports = { originFor, csv, csvWriter, resourceObservation, analyze };
