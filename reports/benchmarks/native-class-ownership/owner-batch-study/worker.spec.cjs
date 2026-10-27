/** @file Real subprocess integration of every functional tuple and controlled startup failures, without mocks. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { test, after } = require('node:test');
const { workerArguments } = require('./worker.cjs');
const sampler = require('./constants/sampler.json');
const policy = require('./constants/worker.json');
const original = require('../combined-process-study/model.cjs');
const { isReleased } = require('../../../../scripts/memory-endpoint.cjs');
const manifestPath = process.env[policy.functionalManifestEnvironment];
const output = process.env[policy.functionalOutputEnvironment];
assert.ok(manifestPath && output, 'Provide actual qualified package manifest and a new evidence directory');
assert.equal(fs.existsSync(output), false, 'Preserve previous worker evidence');
fs.mkdirSync(output);
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const write = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
const originalOutput = read(path.resolve(__dirname, '../../../..', policy.historicalOutputFile));
const expectedHashes = Object.fromEntries(sampler.rows.map((key) => {
  const hashes = new Set(originalOutput.processes.filter((entry) => entry.row === key).map((entry) => entry.outputHash));
  assert.equal(hashes.size, 1); return [key, [...hashes][0]];
}));
const inputs = original.plan().filter((input) => input.phase === policy.qualificationPhase && input.position === policy.qualificationPosition);
assert.equal(inputs.length, sampler.rows.length * sampler.engines.length * original.settings.labels.length);
const observations = [];
const summary = { complete: false, node: process.version, pid: process.pid,
  functionalOnly: true, performanceStudyExecuted: false, performanceAccepted: null, gateReevaluated: false,
  cases: [] };

/** Invoke the real worker once with raw logs and command metadata, preserving all partial files. */
function invoke(name, input = inputs[0], options = {}) {
  const directory = path.join(output, name); fs.mkdirSync(directory);
  const reportPath = path.join(directory, 'report.json');
  const entrypoint = options.progressError ? path.join(__dirname, 'fixtures/throwing-progress.cjs') : path.join(__dirname, 'worker.cjs');
  const args = [...(options.flags ?? workerArguments(input.position)), entrypoint,
    ...(options.progressError ? [options.progressError] : options.capture ? [] : [policy.functionalOption]), options.manifest ?? manifestPath,
    input.phase, input.engine, String(input.position), input.label, reportPath, String(input.rowIndex)];
  if (options.existing) fs.writeFileSync(reportPath, options.existing);
  write(path.join(directory, 'command.json'), { argv: [process.execPath, ...args], functionalOnly: !options.capture });
  const stdout = fs.openSync(path.join(directory, 'stdout.log'), 'wx');
  const stderr = fs.openSync(path.join(directory, 'stderr.log'), 'wx');
  let child;
  try { child = spawnSync(process.execPath, args, { stdio: ['ignore', stdout, stderr], timeout: policy.workerTimeoutMs }); }
  finally { fs.closeSync(stdout); fs.closeSync(stderr); }
  const entry = { name, input, pid: child.pid, exitCode: child.status, signal: child.signal, error: child.error?.message ?? null };
  summary.cases.push(entry); write(path.join(output, 'summary.json'), summary);
  return { entry, reportPath, directory, report: child.status === 0 ? read(reportPath) : null };
}

for (const [index, input] of inputs.entries()) test('fresh ' + input.engine + '/' + input.label + '/' + sampler.rows[input.rowIndex], () => {
  const { entry, report, directory } = invoke(String(index).padStart(2, '0'), input);
  assert.equal(entry.exitCode, 0, fs.readFileSync(path.join(directory, 'stderr.log'), 'utf8'));
  assert.equal(report.complete, true); assert.equal(report.failure, undefined); assert.equal(report.cleanupFailure, undefined);
  for (const field of ['phase', 'engine', 'position', 'label', 'rowIndex']) assert.equal(report[field], input[field]);
  assert.equal(report.pid, entry.pid); assert.equal(report.node, process.version);
  assert.deepEqual(report.execArgv, workerArguments(input.position));
  assert.equal(report.v8Seed, original.settings.v8Seeds[input.position]);
  assert.equal(report.functionalOnly, true); assert.equal(report.performanceStudyExecuted, false);
  assert.equal(report.performanceAccepted, null); assert.equal(report.gateReevaluated, false);
  const blockCount = sampler.warmupBlocksPerProcess + sampler.measuredBlocksPerProcess;
  assert.equal(report.blocks.length, blockCount); assert.deepEqual(report.measurement.blocks, report.blocks);
  assert.deepEqual(report.trackedOwners, { window: blockCount, document: blockCount });
  const measured = []; const warmup = [];
  for (const [blockIndex, block] of report.blocks.entries()) {
    assert.equal(block.complete, true); assert.equal(block.blockIndex, blockIndex);
    assert.equal(block.key, sampler.rows[input.rowIndex]); assert.equal(block.functionalOnly, true);
    assert.equal(block.withinRealmWarmupRounds, sampler.withinRealmWarmupRounds);
    const stage = blockIndex < sampler.warmupBlocksPerProcess ? sampler.stages.warmup : sampler.stages.measured;
    assert.equal(block.stage, stage); assert.equal(block.tasks.length, sampler.logicalTasksPerBlock);
    if (input.engine === 'rustdom') assert.ok(block.nativeCreatedAfter > block.nativeCreatedBefore);
    else assert.equal(block.nativeCreatedAfter, null);
    for (const [taskIndex, task] of block.tasks.entries()) {
      assert.equal(task.complete, true); assert.equal(task.index, taskIndex);
      assert.equal(task.outputHash, expectedHashes[block.key]);
      assert.ok(Number.isFinite(task.durationMs) && task.durationMs > 0);
      (stage === sampler.stages.warmup ? warmup : measured).push(task.durationMs);
    }
  }
  assert.equal(measured.length, sampler.measuredBlocksPerProcess * sampler.logicalTasksPerBlock);
  assert.equal(warmup.length, sampler.warmupBlocksPerProcess * sampler.logicalTasksPerBlock);
  assert.deepEqual(report.measurement.measuredSamplesMs, measured);
  assert.deepEqual(report.measurement.warmupSamplesMs, warmup);
  assert.equal(report.cleanupTrace.length, sampler.cleanupRounds);
  for (const endpoint of report.cleanupTrace) {
    assert.equal(endpoint.clear, isReleased(endpoint, report.nativeBaseline ?? undefined));
    assert.deepEqual(Object.keys(endpoint.survivors).sort(), ['document', 'window']);
  }
  for (const endpoint of report.cleanupTrace.slice(-sampler.requiredFinalClearStates)) assert.equal(endpoint.clear, true);
  assert.deepEqual(report.distributionsBefore, report.distributionsAfter);
  assert.deepEqual(report.loadedBefore, report.loadedAfter);
  assert.equal(report.affinitiesAfter.find((entry) => entry.tid === report.pid).mask, String(original.settings.cpu));
  observations.push({ ...input, observation: report });
});

test('a scientific worker without its reviewed parent binding is rejected before creating evidence or a realm', () => {
  const { entry, reportPath } = invoke('capture-disabled', inputs[0], { capture: true });
  assert.equal(entry.exitCode, policy.failureExitCode); assert.equal(fs.existsSync(reportPath), false);
});
test('changed startup seeds are rejected before creating evidence or a realm', () => {
  const { entry, reportPath } = invoke('wrong-seed', inputs[0], { flags: ['--expose-gc', '--random-seed=99', '--hash-seed=99'] });
  assert.equal(entry.exitCode, policy.failureExitCode); assert.equal(fs.existsSync(reportPath), false);
});
test('existing raw evidence is preserved byte for byte', () => {
  const raw = '{"partial":true}\n';
  const { entry, reportPath } = invoke('existing-output', inputs[0], { existing: raw });
  assert.equal(entry.exitCode, policy.failureExitCode); assert.equal(fs.readFileSync(reportPath, 'utf8'), raw);
});
test('a changed candidate manifest is rejected with a preserved partial report before loading DOM', () => {
  const manifest = read(manifestPath); manifest.distributions.B.sha256 = '0'.repeat(64);
  const changed = path.join(output, 'changed-manifest.json'); write(changed, manifest);
  const input = inputs.find((entry) => entry.engine === 'rustdom' && entry.label === 'B');
  const { entry, reportPath } = invoke('changed-package', input, { manifest: changed });
  assert.equal(entry.exitCode, policy.failureExitCode);
  const report = read(reportPath); assert.equal(report.complete, false);
  assert.deepEqual(report.trackedOwners, { window: 0, document: 0 });
  assert.equal(report.loadedBefore, undefined); assert.match(report.failure.message, /manifest/);
});

for (const kind of ['undefined', 'null', 'symbol']) test('original ' + kind + ' progress rejection survives worker serialization and real teardown', () => {
  const input = inputs.find((entry) => entry.engine === 'rustdom' && entry.label === 'B');
  const { entry, reportPath } = invoke('progress-' + kind, input, { progressError: kind });
  assert.equal(entry.exitCode, 0);
  assert.equal(read(reportPath + '.caught.json').originalPreserved, true);
  const report = read(reportPath); assert.equal(report.complete, false);
  assert.deepEqual(report.trackedOwners, { window: 1, document: 1 });
  assert.equal(report.blocks.length, 1); assert.equal(report.blocks[0].tasks.length, 0);
  assert.equal(report.cleanupTrace.length, sampler.cleanupRounds);
  assert.equal(report.failure.message, kind === 'symbol' ? 'Symbol(progress-failure)' : kind);
  assert.equal(report.cleanupFailure, undefined);
  for (const endpoint of report.cleanupTrace.slice(-sampler.requiredFinalClearStates)) {
    assert.equal(endpoint.clear, true); assert.equal(isReleased(endpoint, report.nativeBaseline), true);
  }
});

after(() => {
  original.validateSeedProbes(observations);
  summary.complete = true; summary.successfulWorkers = observations.length;
  summary.measuredDurations = observations.reduce((total, entry) => total + entry.observation.measurement.measuredSamplesMs.length, 0);
  summary.warmupDurations = observations.reduce((total, entry) => total + entry.observation.measurement.warmupSamplesMs.length, 0);
  summary.windows = observations.reduce((total, entry) => total + entry.observation.trackedOwners.window, 0);
  summary.documents = observations.reduce((total, entry) => total + entry.observation.trackedOwners.document, 0);
  summary.files = {};
  for (const entry of fs.readdirSync(output, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const filename = path.join(entry.parentPath, entry.name);
    if (filename === path.join(output, 'summary.json')) continue;
    summary.files[path.relative(output, filename)] = createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  }
  write(path.join(output, 'summary.json'), summary);
});
