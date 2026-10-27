/** @file Summarizes authenticated complete evidence without DOM execution or changes to the registered estimator. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('./constants/analysis.json');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));

/** Quote CSV fields using the standard doubled-quote representation. */
function csvLine(values) { return values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',') + '\n'; }

/** Bind the current checked-out verifier and resource predicate; archived scripts are never imported. */
function createAnalyzer(repository) {
  const settings = require(path.join(repository, 'reports/benchmarks/native-class-ownership/constants/current-ownership.cjs'));
  const { isReleased } = require(path.join(repository, 'scripts/memory-endpoint.cjs'));

  /** Verify and retain scalar resource observations from one real complete worker. */
  function summarizeWorker(report) {
    assert.equal(report.complete, true, 'Shared study analysis: incomplete worker cannot claim released resources');
    assert.equal(report.batches.length, 1);
    const batch = report.batches[0];
    assert.equal(batch.complete, true);
    const owners = settings.warmupSamples + settings.measuredSamples;
    assert.deepEqual(batch.trackedOwners, { window: owners, document: owners });
    assert.equal(batch.cleanupTrace.length, settings.cleanupRounds);
    assert.equal(batch.samplesMs.length, settings.measuredSamples);
    assert.equal(batch.sampleTimings.length, owners);
    assert.deepEqual(batch.samplesMs, batch.sampleTimings.slice(settings.warmupSamples).map((entry) => entry.durationMs));
    const ranges = {};
    for (const [index, endpoint] of batch.cleanupTrace.entries()) {
      assert.deepEqual(Object.keys(endpoint.survivors).sort(), ['document', 'window']);
      assert.equal(endpoint.clear, isReleased(endpoint, report.nativeBaseline));
      if (index >= settings.cleanupRounds - settings.requiredClearRounds) {
        assert.equal(endpoint.clear, true, 'Shared study analysis: resources survived a required final round');
        assert.deepEqual(endpoint.survivors, { window: 0, document: 0 });
      }
      for (const name of policy.memoryFields) {
        const value = endpoint.memory[name]; assert.ok(Number.isFinite(value) && value >= 0);
        const range = ranges[name] ?? { min: value, max: value };
        range.min = Math.min(range.min, value); range.max = Math.max(range.max, value); ranges[name] = range;
      }
    }
    return { windows: owners, documents: owners, warmupSpans: settings.warmupSamples,
      measuredSpans: settings.measuredSamples, requiredFinalClearStates: settings.requiredClearRounds,
      firstUnclearStates: Number(!batch.cleanupTrace[0].clear), memoryRangesBytes: ranges,
      nativeClassBaseline: report.nativeBaseline?.napiClasses.live ?? null,
      nativeClassFinal: batch.cleanupTrace.at(-1).nativeTree?.napiClasses.live ?? null };
  }

  /** Export every span and row while keeping full verification separate from acceptance. */
  function analyze(capture, output) {
    capture = fs.realpathSync(capture); output = path.resolve(output);
    output = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
    assert.ok(output !== capture && !output.startsWith(capture + path.sep), 'Shared study analysis: preserve the original archive tree');
    const index = read(path.join(capture, 'index.json'));
    assert.equal(index.sourceCommit, policy.sourceCommit); assert.equal(index.hostedRunId, String(policy.runId));
    assert.equal(index.revision, policy.revision); assert.equal(index.complete, true);
    const study = require(path.join(repository, 'reports/benchmarks/native-class-ownership/shared-fixture-study/study.cjs'));
    const verification = study.verify(capture);
    fs.mkdirSync(output);
    const spans = fs.openSync(path.join(output, policy.files.spans), 'wx');
    let comparisonsOutput;
    const totals = { processes: 0, windows: 0, documents: 0, warmupSpans: 0, measuredSpans: 0,
      firstUnclearStates: 0, requiredFinalClearStates: 0 };
    const groups = {};
    try {
      comparisonsOutput = fs.openSync(path.join(output, policy.files.comparisons), 'wx');
      fs.writeSync(spans, csvLine(policy.spanColumns));
      fs.writeSync(comparisonsOutput, csvLine(policy.comparisonColumns));
      const workersPerNode = study.plan().length;
      for (let ordinal = 0; ordinal < index.processes.length; ordinal++) {
        const nodeIndex = Math.floor(ordinal / workersPerNode);
        const position = ordinal % workersPerNode;
        const directory = path.join(capture, nodeIndex === 0 ? 'node22' : 'node24', String(position).padStart(4, '0'));
        const report = read(path.join(directory, 'report.json'));
        const memory = summarizeWorker(report); const batch = report.batches[0];
        const key = `${report.node}/${report.schedule.physical}`;
        const group = groups[key] ?? { processes: 0, windows: 0, documents: 0, firstUnclearStates: 0,
          requiredFinalClearStates: 0, memoryRangesBytes: {}, nativeClassBaselines: new Set(), nativeClassFinalValues: new Set(), v8Versions: new Set() };
        group.processes++; totals.processes++;
        for (const name of ['windows', 'documents', 'firstUnclearStates', 'requiredFinalClearStates']) {
          group[name] += memory[name]; totals[name] += memory[name];
        }
        totals.warmupSpans += memory.warmupSpans; totals.measuredSpans += memory.measuredSpans;
        group.v8Versions.add(report.v8);
        if (memory.nativeClassBaseline !== null) group.nativeClassBaselines.add(memory.nativeClassBaseline);
        if (memory.nativeClassFinal !== null) group.nativeClassFinalValues.add(memory.nativeClassFinal);
        for (const [name, range] of Object.entries(memory.memoryRangesBytes)) {
          const previous = group.memoryRangesBytes[name] ?? range;
          group.memoryRangesBytes[name] = { min: Math.min(previous.min, range.min), max: Math.max(previous.max, range.max) };
        }
        for (const span of batch.sampleTimings) {
          const row = { node: report.node, pid: report.pid, phase: report.phase, position: report.position, seed: report.v8Seed,
            engine: report.engine, physical: report.schedule.physical, label: report.label, rowIndex: report.rowIndex,
            name: batch.name, size: batch.size, span: span.index, stage: span.stage,
            startMs: span.startMs, durationMs: span.durationMs, outputHash: batch.outputHash };
          fs.writeSync(spans, csvLine(policy.spanColumns.map((name) => row[name])));
        }
        groups[key] = group;
      }
      const comparisons = verification.results.flatMap((profile) => settings.phases.flatMap((phase) => profile.summaries[phase].map((row) => ({ node: profile.node, phase, ...row }))));
      for (const row of comparisons) fs.writeSync(comparisonsOutput, csvLine(policy.comparisonColumns.map((name) => row[name])));
      const calibrationPhase = settings.phases[0];
      const failures = { jsdomControls: comparisons.filter((row) => Math.abs(row.jsdomControlChangePercent) > settings.controlBudgetPercent),
        rustNumeric: comparisons.filter((row) => (row.phase === calibrationPhase ? Math.abs(row.rustdomChangePercent) : row.rustdomChangePercent) > settings.rustBudgetPercent),
        aaCalibration: comparisons.filter((row) => row.phase === calibrationPhase && !row.calibrated),
        abBudget: comparisons.filter((row) => row.phase !== calibrationPhase && !row.withinBudget) };
      for (const group of Object.values(groups)) for (const name of ['nativeClassBaselines', 'nativeClassFinalValues', 'v8Versions']) group[name] = [...group[name]].sort();
      assert.equal(totals.processes, verification.processes);
      assert.equal(totals.measuredSpans, verification.measuredDurations); assert.equal(totals.warmupSpans, verification.warmupDurations);
      assert.equal(totals.windows, totals.processes * (settings.warmupSamples + settings.measuredSamples));
      assert.equal(totals.documents, totals.windows); assert.equal(totals.requiredFinalClearStates, totals.processes * settings.requiredClearRounds);
      assert.deepEqual(index.parentMemory.map((entry) => entry.stage), ['before-workers', ...settings.nodeVersions.map((node) => `after-${node}`)]);
      for (const snapshot of index.parentMemory) for (const name of policy.memoryFields) assert.ok(Number.isFinite(snapshot.state[name]) && snapshot.state[name] >= 0);
      const memory = { totals, groups, parentSnapshots: index.parentMemory, machine: index.machine, runtimes: index.runtimes, limits: policy.limits };
      const result = { runId: policy.runId, sourceCommit: policy.sourceCommit, executionComplete: true,
        verified: verification.verified, performanceAccepted: verification.accepted, collectorExecutedDOM: false,
        totals, comparisons, failures, machine: index.machine, runtimes: index.runtimes, limits: policy.limits };
      fs.writeFileSync(path.join(output, policy.files.summary), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
      fs.writeFileSync(path.join(output, policy.files.memory), JSON.stringify(memory, null, 2) + '\n', { flag: 'wx' });
      return result;
    } finally { fs.closeSync(spans); if (comparisonsOutput !== undefined) fs.closeSync(comparisonsOutput); }
  }
  return { summarizeWorker, analyze };
}
if (require.main === module) {
  assert.equal(process.argv.length, 5, 'Provide reviewed repository, capture and fresh analysis output');
  const [repository, capture, output] = process.argv.slice(2).map((value) => path.resolve(value));
  const result = createAnalyzer(repository).analyze(capture, output);
  console.log(JSON.stringify({ executionComplete: result.executionComplete, verified: result.verified,
    performanceAccepted: result.performanceAccepted, totals: result.totals,
    jsdomControlFailures: result.failures.jsdomControls.length, rustNumericFailures: result.failures.rustNumeric.length }));
}
module.exports = { createAnalyzer, csvLine };
