/** @module confirmation-bound-replay-contracts Uses original real worker output and altered scalar copies; never imports captured code or measures DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { replayBoundProcess } = require('./bound-replay.cjs');
const { validateBinding } = require('./binding.cjs');
const { workerArguments } = require('./worker-engine.cjs');
const policy = require('./constants/capture.json');
const root = process.env.RUSTDOM_CONFIRMATION_BOUND_FIXTURE;
assert.ok(root, 'Bound replay contracts: provide a complete real functional criterion directory');

/** @returns {object} Independent parent journal and original raw data; no capture module is executed. */
function fixture() {
  const index = JSON.parse(fs.readFileSync(path.join(root, policy.files.index), 'utf8'));
  assert.equal(index.complete, true); assert.equal(index.functionalOnly, true); assert.equal(index.processes.length, 32);
  const producer = { parentPid: index.parentPid, workerSourceSha256: index.sourceProfile.currentFiles[policy.workerPath],
    workerEngineSourceSha256: index.sourceProfile.currentFiles[policy.enginePath] };
  const expectedBinding = { mode: policy.functionalMode, parentPid: index.parentPid, node: index.node,
    nodeExecutable: index.nodeExecutable ?? index.processes[0].invocation.command.argv[0],
    sourceDirectory: index.sourceProfile.profiledSourceDirectory, sourceCommit: index.sourceProfile.sourceCommit,
    sourceChangesRaw: index.sourceProfile.sourceChangesRaw, files: index.sourceProfile.currentFiles,
    manifestPath: index.methodBinding.manifestPath, manifestSha256: index.manifestSha256, criterionId: index.criterionId,
    hostId: index.hostId, publicationSha256: null, consumptionSha256: null, hosted: null, bindingSha256: index.methodBindingSha256 };
  const records = index.processes.map((entry) => {
    const filename = path.join(root, entry.directory, policy.files.workerReport);
    return { report: JSON.parse(fs.readFileSync(filename, 'utf8')),
      context: JSON.parse(fs.readFileSync(filename + policy.files.workerContextSuffix, 'utf8')), input: entry.input,
      invocation: { mode: policy.functionalMode, node: index.node, parentPid: index.parentPid, pid: entry.invocation.command.pid,
        hostId: index.hostId, methodBindingSha256: index.methodBindingSha256,
        startMonotonicMs: entry.invocation.startMonotonicMs, endMonotonicMs: entry.invocation.endMonotonicMs } };
  });
  return { index, producer, expectedBinding, records };
}

/** @param {object} source - Independently recorded parent metadata. @param {object} record - Original or explicitly altered scalar record. @returns {object} Current bounded reader's view only. */
function replay(source, record) {
  return replayBoundProcess(record.report, record.context, source.index.manifest, record.input, record.invocation,
    source.producer, source.index.methodBinding, source.expectedBinding);
}

test('all 32 real factors/labels preserve 4608 tasks, 1536 warmup, separate owners and null analysis', () => {
  const source = fixture(); const totals = { measured: 0, warmup: 0, windows: 0, documents: 0 };
  for (const record of source.records) {
    const result = replay(source, record);
    totals.measured += result.replay.samplesMs.length; totals.warmup += result.replay.warmupSamplesMs.length;
    totals.windows += result.trackedOwners.window; totals.documents += result.trackedOwners.document;
    assert.equal(result.bindingChecked, true); assert.equal(result.analysisObservation, null);
    assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
    assert.equal(result.cleanupTrace.length, 3); assert.ok(result.cleanupTrace.slice(-2).every((entry) => entry.clear));
  }
  assert.deepEqual(totals, { measured: 4608, warmup: 1536, windows: 384, documents: 384 });
});

test('parent/SDK/source/manifest/calendar identity cannot be substituted in a real binding', () => {
  const source = fixture();
  for (const mutate of [
    (value) => { value.parentPid += 1; }, (value) => { value.node = 'v0.0.0'; },
    (value) => { value.nodeExecutableSha256 = '0'.repeat(64); }, (value) => { value.sourceDirectory += '-other'; },
    (value) => { value.sourceCommit = '0'.repeat(40); }, (value) => { value.sourceChangesRaw = 'different'; },
    (value) => { value.sourceFilesDigest = '0'.repeat(64); }, (value) => { value.manifestSha256 = '0'.repeat(64); },
    (value) => { value.manifestPath += '-other'; }, (value) => { value.criterionId = 'foreign'; },
    (value) => { value.hostId += '-other'; }, (value) => { value.plannedProcesses -= 1; },
    (value) => { value.mode = policy.captureMode; }, (value) => { value.publicationSha256 = '0'.repeat(64); },
  ]) {
    const binding = structuredClone(source.index.methodBinding); mutate(binding);
    assert.throws(() => validateBinding(binding, source.expectedBinding));
  }
});

test('raw sidecars cannot hide changed PID, binding digest, inspector revision, manifest, flags or clocks', () => {
  const source = fixture(); const record = source.records[0];
  for (const mutate of [
    (value) => { value.context.methodBindingSha256 = '0'.repeat(64); }, (value) => { value.context.methodParentPid += 1; },
    (value) => { value.context.workerRevision = 'foreign'; }, (value) => { value.context.workerSourceSha256 = '0'.repeat(64); },
    (value) => { value.context.manifestSha256 = '0'.repeat(64); }, (value) => { value.context.pid += 1; },
    (value) => { value.invocation.parentPid += 1; }, (value) => { value.invocation.methodBindingSha256 = '0'.repeat(64); },
    (value) => { value.invocation.endMonotonicMs = value.invocation.startMonotonicMs; },
    (value) => { value.report.execArgv.push('--no-warnings'); },
    (value) => { delete value.report.methodBindingSha256; },
    (value) => { value.invocation.mode = policy.captureMode; },
  ]) {
    const changed = structuredClone(record); mutate(changed); assert.throws(() => replay(source, changed));
  }
});

test('retained Window/Document, missing warmup and changed public results cannot pass bound replay', () => {
  const source = fixture(); const record = source.records[0];
  for (const mutate of [
    (value) => { value.report.cleanupTrace[2].survivors.window = 1; },
    (value) => { value.report.cleanupTrace[2].survivors.document = 1; },
    (value) => { value.report.blocks[0].tasks.pop(); },
    (value) => { value.report.blocks[3].tasks[0].outputHash = '0'.repeat(64); },
    (value) => { value.report.measurement.measuredSamplesMs.pop(); },
  ]) {
    const changed = structuredClone(record); mutate(changed); assert.throws(() => replay(source, changed));
  }
});

test('a bound worker without an actual parent binding fails before producing a report', (context) => {
  const source = fixture(); assert.equal(source.index.node, process.version);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-missing-binding-'));
  context.after(() => fs.rmSync(directory, { recursive: true }));
  const environment = { ...process.env }; delete environment[policy.bindingEnvironment]; delete environment[policy.bindingDigestEnvironment];
  const output = path.join(directory, 'report.json');
  const child = spawnSync(process.execPath, [...workerArguments(source.records[0].input.factor),
    path.join(source.index.sourceProfile.profiledSourceDirectory, policy.workerPath), policy.functionalOption,
    source.expectedBinding.manifestPath, path.join(root, policy.files.inputsDirectory, '0000.json'), output],
  { encoding: 'utf8', env: environment, timeout: 20000 });
  assert.ifError(child.error); assert.equal(child.status, 2); assert.match(child.stderr, /requires a parent binding/);
  assert.equal(fs.existsSync(output), false); assert.equal(fs.existsSync(output + policy.files.workerContextSuffix), false);
});

test('the actual scientific entry refuses capture while publication remains disabled', () => {
  const source = fixture();
  const child = spawnSync(process.execPath, [path.join(source.index.sourceProfile.profiledSourceDirectory, policy.workerPath),
    policy.captureOption, 'nonexistent-manifest', 'nonexistent-input', 'nonexistent-output'], { encoding: 'utf8', timeout: 20000 });
  assert.ifError(child.error); assert.equal(child.status, 2); assert.match(child.stderr, /scientific method is not published/);
});
