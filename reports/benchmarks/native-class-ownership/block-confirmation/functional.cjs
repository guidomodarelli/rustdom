/** @module confirmation-functional-qualification Runs one fixed SDK's real control matrix; never exposes scientific capture. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const policy = require('./constants/worker.json');
const { authenticatePackage } = require('./authentication.cjs');
const repository = path.resolve(__dirname, '../../../..');

/**
 * Authenticate the numeric package before importing the reused sampler graph, then exercise every declared functional row.
 * @param {string} prepared - Existing sealed package directory; never rebuilt by this qualifier.
 * @param {string} destination - New disjoint evidence directory outside source and package.
 * @returns {Promise<object>} Every command, partial and resource endpoint, with functional-only eligibility.
 */
async function run(prepared, destination) {
  assert.equal(process.platform, 'linux'); assert.equal(typeof global.gc, 'function');
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
  prepared = fs.realpathSync(prepared);
  destination = path.join(fs.realpathSync(path.dirname(path.resolve(destination))), path.basename(destination));
  assert.equal(fs.existsSync(destination), false, 'Confirmation qualifier: preserve existing evidence');
  for (const root of [repository, prepared]) assert.ok(destination !== root && !destination.startsWith(root + path.sep) && !root.startsWith(destination + path.sep));
  fs.mkdirSync(destination);
  const authentication = authenticatePackage(prepared, destination, 'package-verification');
  // All transitive historical inputs have now been authenticated by the current assembler, before these imports.
  const { criteria, schedule } = require('./calendar.cjs');
  const { createFunctionalManifest } = require('../control-precision/pilot-v2/packages.cjs');
  const { workerArguments } = require('./worker.cjs');
  const { replayEnvelope } = require('./envelope.cjs');
  const { execute } = require('../owner-batch-study/process.cjs');
  const { readJSON, writeJSON, hashFile } = require('../owner-batch-study/io.cjs');
  const { collectGarbage } = require('../../../../scripts/memory-endpoint.cjs');
  const sampling = require('../owner-batch-study/constants/sampler.json');
  const historical = authentication.historicalSource.files;
  const ownNames = ['calendar.cjs', 'compare.cjs', 'worker.cjs', 'worker-engine.cjs', 'raw-reader.cjs',
    'functional.cjs', 'finalize.cjs', 'envelope.cjs', 'authentication.cjs', 'constants/authentication.json',
    'constants/design.json', 'constants/worker.json', 'fixtures/progress-failure.cjs'];
  const ownFiles = () => Object.fromEntries(ownNames.map((name) => [name, hashFile(path.join(__dirname, name))]));
  const manifest = createFunctionalManifest(prepared, authentication);
  const manifestPath = path.join(destination, 'manifest.json'); writeJSON(manifestPath, manifest);
  const inputs = criteria().filter((entry) => entry.node === process.version)
    .flatMap((entry) => schedule(entry.criterionId).processes.filter((input) => input.block === policy.functionalBlock && input.factor === policy.functionalFactor));
  assert.equal(inputs.length, policy.functionalWorkersPerSdk);
  const index = { revision: policy.revision, complete: false, functionalOnly: true, scientificCaptureExecuted: false,
    sourceContextRole: 'current-file-profile-functional-qualification-not-scientific-method',
    historicalSourceFiles: historical, ownSourceFiles: ownFiles(), node: process.version,
    executableSha256: hashFile(process.execPath, policy.maximumExecutableBytes, false),
    packageVerification: authentication, authenticatorBindings: policy.authenticator,
    manifest, parentPid: process.pid, processes: [], adverse: [], parentMemory: [],
    plannedProcesses: inputs.length, analysisObservation: null, performanceAccepted: null, gateReevaluated: false };
  const indexPath = path.join(destination, 'index.json'); const save = () => writeJSON(indexPath, index);
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort(new Error('Confirmation functional qualifier: parent termination requested'));
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  const started = performance.now();
  fs.mkdirSync(path.join(destination, 'inputs')); fs.mkdirSync(path.join(destination, 'workers')); fs.mkdirSync(path.join(destination, 'adverse'));
  const snapshot = async (stage) => {
    await collectGarbage(); index.parentMemory.push({ stage, completedWorkers: index.processes.filter((entry) => entry.complete).length,
      monotonicMs: performance.now(), observedAt: new Date().toISOString(), memory: process.memoryUsage(), cpu: process.cpuUsage() });
  };
  async function launch(argv, directory) {
    const remaining = Math.floor(policy.functionalTimeoutMs - (performance.now() - started));
    assert.ok(remaining > 0, 'Confirmation functional qualifier: deadline reached; preserve partials');
    const startMonotonicMs = performance.now();
    const command = await execute(argv, directory, { timeoutMs: Math.min(policy.workerTimeoutMs, remaining), signal: cancellation.signal, cwd: repository });
    assert.equal(command.timedOut, false); assert.equal(command.cancelled, false);
    assert.notEqual(command.leftoverProcessGroupDetected, true);
    return { command, startMonotonicMs, endMonotonicMs: performance.now() };
  }
  save();
  try {
    await snapshot(policy.parentStages[0]); save();
    for (const [position, input] of inputs.entries()) {
      const name = String(position).padStart(2, '0'); const directory = path.join(destination, 'workers', name);
      const inputPath = path.join(destination, 'inputs', name + '.json'); writeJSON(inputPath, input);
      const reportPath = path.join(directory, 'report.json');
      const argv = [process.execPath, ...workerArguments(input.factor), path.join(__dirname, 'worker.cjs'), policy.functionalOption, manifestPath, inputPath, reportPath];
      const entry = { input, directory: 'workers/' + name, complete: false }; index.processes.push(entry); save();
      const observed = await launch(argv, directory); entry.invocation = observed; save();
      assert.equal(observed.command.exitCode, 0, 'Confirmation functional qualifier: worker failed without retry');
      const report = readJSON(reportPath); const context = readJSON(reportPath + '.context.json');
      const replay = replayEnvelope(report, context, manifest, input, { mode: 'functional', node: process.version, pid: observed.command.pid,
        hostId: 'functional-parent-' + process.pid, startMonotonicMs: observed.startMonotonicMs, endMonotonicMs: observed.endMonotonicMs },
      { parentPid: process.pid, workerSourceSha256: index.ownSourceFiles['worker.cjs'],
        workerEngineSourceSha256: index.ownSourceFiles['worker-engine.cjs'] });
      if (index.randomProbePrefix === undefined) index.randomProbePrefix = [...report.randomProbe];
      else assert.deepEqual(report.randomProbe, index.randomProbePrefix, 'Confirmation functional qualifier: matched factor has a different startup RNG prefix');
      assert.equal(replay.analysisObservation, null);
      entry.observed = { measured: replay.replay.samplesMs.length, warmup: replay.replay.warmupSamplesMs.length,
        windows: replay.trackedOwners.window, documents: replay.trackedOwners.document, cleanupTrace: replay.cleanupTrace };
      entry.complete = true; save();
      process.stdout.write(JSON.stringify({ node: process.version, completedWorkers: position + 1, plannedWorkers: inputs.length, row: input.row, label: input.label }) + '\n');
      if (position + 1 === inputs.length / 2) { await snapshot(policy.parentStages[1]); save(); }
    }
    const input = inputs[0]; const inputPath = path.join(destination, 'inputs/00.json');
    const firstReport = path.join(destination, 'workers/00/report.json'); const firstContext = firstReport + '.context.json';
    const originalFiles = [hashFile(firstReport), hashFile(firstContext)];
    const alteredInput = { ...input, ordinal: input.ordinal + 1 };
    const alteredInputPath = path.join(destination, 'inputs/invalid.json'); writeJSON(alteredInputPath, alteredInput);
    const alteredManifest = structuredClone(manifest); alteredManifest.distributions.J0.sha256 = '0'.repeat(64);
    const alteredManifestPath = path.join(destination, 'invalid-manifest.json'); writeJSON(alteredManifestPath, alteredManifest);
    const nativeFailureInput = inputs.find((entry) => entry.phase === 'AB' && entry.engine === 'rustdom' && entry.label === 'B' && entry.rowIndex === 0);
    assert.ok(nativeFailureInput);
    const nativeFailureInputPath = path.join(destination, 'inputs/native-failure.json'); writeJSON(nativeFailureInputPath, nativeFailureInput);
    const worker = path.join(__dirname, 'worker.cjs');
    const cases = [
      { name: 'capture-guard', args: [worker, '--capture', manifestPath, inputPath] },
      { name: 'invalid-tuple', args: [worker, policy.functionalOption, manifestPath, alteredInputPath] },
      { name: 'invalid-manifest', args: [worker, policy.functionalOption, alteredManifestPath, inputPath] },
      { name: 'preserve-existing', args: [worker, policy.functionalOption, manifestPath, inputPath], output: firstReport },
      { name: 'protected-package-output', args: [worker, policy.functionalOption, manifestPath, inputPath], output: path.join(prepared, 'protected-functional-report.json') },
      { name: 'progress-failure', args: [path.join(__dirname, 'fixtures/progress-failure.cjs'), manifestPath, nativeFailureInputPath] }
    ];
    for (const adverse of cases) {
      const directory = path.join(destination, 'adverse', adverse.name);
      const output = adverse.output ?? path.join(directory, 'report.json');
      const observed = await launch([process.execPath, ...workerArguments(input.factor), ...adverse.args, output], directory);
      assert.equal(observed.command.exitCode, policy.failureExitCode, 'Confirmation functional qualifier: adverse contract unexpectedly passed');
      const outcome = { name: adverse.name, ...observed }; index.adverse.push(outcome);
      if (adverse.name === 'progress-failure') {
        const partial = readJSON(output); const context = readJSON(output + '.context.json');
        assert.equal(partial.complete, false); assert.equal(context.complete, false);
        assert.equal(partial.engine, 'rustdom'); assert.equal(partial.schedule.physical, 'B');
        assert.equal(partial.failure.message, policy.progressFailureMessage); assert.equal(partial.blocks.length, 1);
        assert.equal(partial.blocks[0].tasks.length, sampling.logicalTasksPerBlock); assert.equal(partial.trackedOwners.window, 1); assert.equal(partial.trackedOwners.document, 1);
        assert.ok(partial.cleanupTrace.slice(-2).every((endpoint) => endpoint.clear));
        outcome.cleanupTrace = partial.cleanupTrace; outcome.window = partial.trackedOwners.window; outcome.document = partial.trackedOwners.document;
      } else if (adverse.name === 'invalid-manifest') {
        const partial = readJSON(output); assert.equal(partial.complete, false); assert.equal(partial.blocks.length, 0);
        assert.deepEqual(partial.trackedOwners, { window: 0, document: 0 });
      } else if (adverse.name !== 'preserve-existing') assert.equal(fs.existsSync(output), false);
      save();
    }
    assert.deepEqual([hashFile(firstReport), hashFile(firstContext)], originalFiles, 'Confirmation functional qualifier: prior evidence was overwritten');
    const { finalizeQualification } = require('./finalize.cjs');
    const finalization = await finalizeQualification({ signal: cancellation.signal, startedMonotonicMs: started,
      timeoutMs: policy.functionalTimeoutMs, snapshot: () => snapshot(policy.parentStages[2]), recheck: () => {
        index.packageVerificationAfter = authenticatePackage(prepared, destination, 'package-verification-after');
        assert.deepEqual(index.packageVerificationAfter, authentication, 'Confirmation functional qualifier: sealed package identity changed during qualification');
        assert.deepEqual(index.packageVerificationAfter.historicalSource.files, historical);
        assert.deepEqual(ownFiles(), index.ownSourceFiles);
      } });
    index.complete = true; index.elapsedMs = finalization.elapsedMs; save();
    return index;
  } catch (error) {
    index.failure = { name: error.name, message: String(error.message).slice(0, policy.maximumFailureCharacters) }; save(); throw error;
  } finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
}

if (require.main === module) {
  Promise.resolve().then(() => {
    assert.equal(process.argv.length, 5, 'Confirmation functional qualifier: provide --functional prepared-package new-output');
    assert.equal(process.argv[2], policy.functionalOption, 'Confirmation qualifier: only functional mode is implemented');
    return run(process.argv[3], process.argv[4]);
  }).catch((error) => { process.stderr.write(JSON.stringify({ operation: 'Confirmation functional qualification', name: error.name, message: String(error.message).slice(0, policy.maximumFailureCharacters) }) + '\n'); process.exitCode = policy.failureExitCode; });
}
module.exports = { run };
