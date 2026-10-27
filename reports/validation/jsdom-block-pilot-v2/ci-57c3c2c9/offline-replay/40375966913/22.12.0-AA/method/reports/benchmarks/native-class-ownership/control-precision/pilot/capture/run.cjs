/** @module pilot-criterion Executes exactly one declared criterion on one host, retaining every child and partial without retries. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const policy = require('../constants/capture.json');
const workerPolicy = require('../constants/worker.json');
const design = require('../constants/design.json');
const { authenticatePackage } = require('../preflight.cjs');
const repository = path.resolve(__dirname, '../../../../../..');

/** @param {string} sourceCommit - Actual clean source checkout. @returns {object} Hosted role from the authorized workflow event; never synthesized for local qualification. */
function hostedContext(sourceCommit) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Pilot criterion: capture requires GitHub Actions');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1');
  assert.equal(process.env.GITHUB_REPOSITORY, policy.repository);
  assert.equal(process.env.GITHUB_WORKFLOW, policy.workflowName, 'Pilot criterion: capture requires its declared workflow');
  assert.equal(process.env.GITHUB_JOB, policy.jobKey);
  assert.equal(typeof sourceCommit, 'string'); assert.equal(sourceCommit.length, policy.gitCommitHexLength);
  assert.match(sourceCommit, new RegExp(policy.gitCommitPattern));
  assert.equal(process.env[policy.expectedHeadEnvironment], sourceCommit);
  assert.equal(process.env[policy.pullRequestEnvironment], String(policy.pullRequestNumber));
  assert.equal(process.env[policy.labelEnvironment], policy.label);
  assert.match(process.env.GITHUB_RUN_ID ?? '', new RegExp(policy.positiveDecimalPattern));
  assert.equal(process.env.GITHUB_EVENT_NAME, 'pull_request');
  const { readJSON } = require('../../../owner-batch-study/io.cjs');
  const event = readJSON(process.env.GITHUB_EVENT_PATH);
  assert.equal(event.action, 'labeled'); assert.equal(event.label.name, policy.label);
  assert.equal(event.pull_request.number, policy.pullRequestNumber);
  assert.equal(event.pull_request.head.repo.full_name, policy.repository); assert.equal(event.pull_request.head.sha, sourceCommit);
  return { repository: policy.repository, workflow: policy.workflowName, jobKey: policy.jobKey,
    attempt: 1, eventHead: sourceCommit, pullRequest: policy.pullRequestNumber, label: policy.label,
    runId: process.env.GITHUB_RUN_ID };
}

/**
 * Functional qualification runs one complete factor block. Scientific capture, once published, runs all sixteen blocks.
 * @param {'functional'|'capture'} mode - Actual role; capture cannot bypass publication/readiness guards.
 * @param {string} prepared - Existing sealed numeric package.
 * @param {string} destination - New disjoint output directory.
 * @param {string} criterionId - Exact SDK/phase/jsdom/row from the original calendar.
 * @returns {Promise<object>} Complete or preserved partial criterion; acceptance is always null.
 */
async function runCriterion(mode, prepared, destination, criterionId) {
  assert.ok(policy.modes.includes(mode));
  if (mode === policy.captureMode) {
    assert.equal(policy.executionReady, true, 'Pilot criterion: scientific method is not published');
    assert.equal(design.executionReady, true);
    hostedContext(process.env[policy.expectedHeadEnvironment]);
  }
  assert.equal(process.platform, 'linux'); assert.equal(typeof global.gc, 'function');
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
  assert.equal(Object.hasOwn(process.env, policy.bindingEnvironment), false, 'Pilot criterion: parent cannot inherit a foreign child binding');
  assert.ok(fs.lstatSync(path.join(repository, '.git')).isDirectory(), 'Pilot criterion: use a native Git checkout');
  prepared = fs.realpathSync(prepared);
  destination = path.join(fs.realpathSync(path.dirname(path.resolve(destination))), path.basename(destination));
  assert.equal(fs.existsSync(destination), false, 'Pilot criterion: preserve existing evidence');
  for (const root of [repository, prepared]) assert.ok(destination !== root && !destination.startsWith(root + path.sep) && !root.startsWith(destination + path.sep));
  fs.mkdirSync(destination);
  const authentication = authenticatePackage(prepared, destination, 'package-verification');
  // The current Python authenticator checked the complete historical graph before importing these reused modules.
  const { calendar } = require('../blocks.cjs');
  const { analyze } = require('../variance.cjs');
  const { createManifest } = require('../packages.cjs');
  const source = require('./source.cjs');
  const { validate } = require('./binding.cjs');
  const { replayBoundProcess } = require('./replay.cjs');
  const { workerArguments } = require('../worker-engine.cjs');
  const { execute } = require('../../../owner-batch-study/process.cjs');
  const { readJSON, writeJSON, writeNewJSON, hashFile } = require('../../../owner-batch-study/io.cjs');
  const { gitIdentity } = require('../../../owner-batch-study/source.cjs');
  const { collectGarbage } = require('../../../../../../scripts/memory-endpoint.cjs');
  const shard = calendar().find((entry) => entry.criterionId === criterionId);
  assert.ok(shard && shard.node === process.version, 'Pilot criterion: undeclared criterion or wrong SDK');
  const inputs = mode === policy.captureMode ? shard.processes : shard.processes.filter((input) => input.block < policy.functionalBlocks);
  assert.ok(inputs.length > 0 && inputs.length % 2 === 0);
  const executable = fs.realpathSync(process.execPath);
  const executableSha256 = hashFile(executable, policy.maximumExecutableBytes, false);
  assert.equal(executableSha256, policy.nodeExecutables[process.version]);
  const origin = source.producer(mode);
  const consumption = mode === policy.captureMode ? require('./once.cjs').readConsumption(origin.sourceCommit) : null;
  const manifest = createManifest(prepared, authentication, mode);
  const binding = { revision: policy.revision, mode, parentPid: process.pid, node: process.version,
    nodeExecutable: executable, nodeExecutableSha256: executableSha256,
    sourceDirectory: repository, sourceCommit: origin.sourceCommit, sourceFilesDigest: source.filesDigest(origin.files),
    consumptionSha256: consumption?.sha256,
    sourceFiles: mode === policy.functionalMode ? origin.files : undefined,
    criterionId, plannedProcesses: inputs.length,
    publicationSha256: mode === policy.captureMode ? hashFile(source.ownedPath(repository, policy.publication)) : null,
    hosted: mode === policy.captureMode ? hostedContext(origin.sourceCommit) : null,
    performanceAccepted: null, gateReevaluated: false };
  validate(binding, { ...binding, files: origin.files });
  const bindingPath = path.join(destination, policy.bindingFile); writeNewJSON(bindingPath, binding);
  const bindingSha256 = hashFile(bindingPath);
  const manifestPath = path.join(destination, policy.manifestFile); writeNewJSON(manifestPath, manifest);
  if (mode === policy.captureMode) {
    writeNewJSON(path.join(destination, policy.consumptionFile), consumption.receipt);
    const storage = fs.statfsSync(destination);
    assert.ok(storage.bavail * storage.bsize >= policy.minimumCaptureFreeBytes, 'Pilot criterion: insufficient space to preserve the complete capture');
    writeNewJSON(path.join(destination, policy.methodSnapshotIndex), source.snapshot(origin, destination));
  }
  const hostId = randomUUID();
  const index = { revision: policy.revision, complete: false, mode, functionalOnly: mode === policy.functionalMode,
    criterionId, plannedProcesses: inputs.length, captureDirectory: destination, parentPid: process.pid, sourceIdentity: {
      sourceCommit: origin.sourceCommit, sourceChangesRaw: origin.sourceChangesRaw, sourceGitErrors: origin.sourceGitErrors },
    sourceFiles: origin.files, publication: origin.publication, bindingSha256, manifestSha256: hashFile(manifestPath),
    consumptionSha256: consumption?.sha256,
    node: process.version, executable, executableSha256, hostId,
    machine: { platform: process.platform, arch: process.arch, release: os.release(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length },
    packageVerification: authentication, processes: [], parentMemory: [],
    scientificCaptureExecuted: mode === policy.captureMode, performanceAccepted: null, gateReevaluated: false };
  const indexPath = path.join(destination, policy.indexFile); const save = () => writeJSON(indexPath, index);
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort(new Error(policy.parentCancellationMessage));
  const snapshot = async (stage) => {
    await collectGarbage(); index.parentMemory.push({ stage, completedWorkers: index.processes.filter((entry) => entry.complete).length,
      monotonicMs: performance.now(), observedAt: new Date().toISOString(), memory: process.memoryUsage(), cpu: process.cpuUsage() });
  };
  fs.mkdirSync(path.join(destination, 'inputs')); fs.mkdirSync(path.join(destination, 'workers'));
  const started = performance.now();
  const budget = (mode === policy.captureMode ? policy.captureTimeoutMinutes : policy.functionalTimeoutMinutes) * 60_000;
  const uptimeSeconds = Number(fs.readFileSync('/proc/uptime', 'ascii').split(' ', 1)[0]);
  assert.ok(Number.isFinite(uptimeSeconds) && uptimeSeconds > 0);
  const startMarker = { revision: policy.revision, mode, parentPid: process.pid, node: process.version, criterionId,
    sourceCommit: origin.sourceCommit, uptimeSeconds, uptimeResolutionSeconds: policy.uptimeResolutionSeconds,
    captureBudgetMs: budget, clock: policy.uptimeClock };
  writeNewJSON(path.join(destination, policy.captureStartFile), startMarker);
  index.captureStartMarkerSha256 = hashFile(path.join(destination, policy.captureStartFile));
  let deadlineTimer;
  const observations = []; const randomPrefixes = new Map();
  const workerRelative = 'reports/benchmarks/native-class-ownership/control-precision/pilot/' +
    (mode === policy.captureMode ? 'capture/worker.cjs' : 'worker.cjs');
  const engineRelative = 'reports/benchmarks/native-class-ownership/control-precision/pilot/worker-engine.cjs';
  try {
    process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
    deadlineTimer = setTimeout(() => cancellation.abort(new Error(policy.parentDeadlineMessage)), budget);
    deadlineTimer.unref();
    index.captureBudgetMs = budget; index.startedMonotonicMs = started;
    save();
    await snapshot(policy.parentStages[0]); save();
    for (const input of inputs) {
      const remaining = Math.floor(budget - (performance.now() - started));
      assert.ok(remaining > 0, 'Pilot criterion: capture deadline reached; preserve partials without completing samples');
      const name = String(input.ordinal).padStart(policy.ordinalPaddingWidth, '0');
      const directory = path.join(destination, 'workers', name);
      const inputPath = path.join(destination, 'inputs', name + '.json'); writeNewJSON(inputPath, input);
      const reportPath = path.join(directory, policy.workerReportFile);
      const option = mode === policy.captureMode ? policy.captureOption : policy.functionalOption;
      const argv = [executable, ...workerArguments(input.factor), path.join(repository, workerRelative), option, manifestPath, inputPath, reportPath];
      const entry = { input, directory: 'workers/' + name, complete: false }; index.processes.push(entry); save();
      const startMonotonicMs = performance.now();
      const command = await execute(argv, directory, { timeoutMs: Math.min(policy.workerTimeoutMs, remaining), signal: cancellation.signal,
        cwd: repository, environment: { ...process.env, [policy.bindingEnvironment]: bindingPath } });
      const endMonotonicMs = performance.now();
      entry.invocation = { command, startMonotonicMs, endMonotonicMs }; save();
      assert.equal(command.exitCode, 0, 'Pilot criterion: worker failed; no retry or replacement is permitted');
      assert.equal(command.timedOut, false); assert.equal(command.cancelled, false); assert.notEqual(command.leftoverProcessGroupDetected, true);
      const report = readJSON(reportPath); const context = readJSON(reportPath + policy.workerContextSuffix);
      const invocation = { mode, node: process.version, pid: command.pid, parentPid: process.pid, hostId,
        startMonotonicMs, endMonotonicMs, methodBindingSha256: bindingSha256 };
      const replay = replayBoundProcess(report, context, manifest, input, invocation,
        { parentPid: process.pid, workerSourceSha256: origin.files[workerRelative], workerEngineSourceSha256: origin.files[engineRelative] });
      const prefix = randomPrefixes.get(input.factor);
      if (prefix === undefined) randomPrefixes.set(input.factor, [...report.randomProbe]);
      else assert.deepEqual(report.randomProbe, prefix, 'Pilot criterion: repeated fixed factor changed its RNG prefix');
      entry.observed = { measured: replay.replay.samplesMs.length, warmup: replay.replay.warmupSamplesMs.length,
        windows: replay.trackedOwners.window, documents: replay.trackedOwners.document,
        cleanupTrace: replay.cleanupTrace, producerBindingsChecked: replay.producerBindingsChecked,
        analysisObservation: replay.analysisObservation };
      if (mode === policy.captureMode) observations.push(replay.analysisObservation);
      else assert.equal(replay.analysisObservation, null);
      entry.complete = true; save();
      process.stdout.write(JSON.stringify({ criterionId, completedWorkers: index.processes.length, plannedWorkers: inputs.length, factor: input.factor, label: input.label }) + '\n');
      if (index.processes.length === inputs.length / 2) { await snapshot(policy.parentStages[1]); save(); }
    }
    await snapshot(policy.parentStages[2]);
    index.packageVerificationAfter = authenticatePackage(prepared, destination, 'package-verification-after');
    assert.deepEqual(index.packageVerificationAfter, authentication);
    assert.deepEqual(gitIdentity(repository), { sourceCommit: origin.sourceCommit, sourceChangesRaw: origin.sourceChangesRaw, sourceGitErrors: origin.sourceGitErrors });
    const rechecked = source.producer(mode); assert.deepEqual(rechecked, origin);
    assert.equal(hashFile(executable, policy.maximumExecutableBytes, false), executableSha256);
    assert.equal(hashFile(bindingPath), bindingSha256); assert.equal(hashFile(manifestPath), index.manifestSha256);
    index.analysis = mode === policy.captureMode ? analyze(criterionId, observations) : null;
    index.elapsedMs = performance.now() - started;
    assert.equal(cancellation.signal.aborted, false, 'Pilot criterion: cancelled capture cannot become complete');
    assert.ok(index.elapsedMs <= budget, 'Pilot criterion: postflight exceeded the declared deadline');
    index.complete = true; save();
    return index;
  } catch (error) {
    index.failure = { name: error.name, message: String(error.message).slice(0, workerPolicy.maximumFailureCharacters) };
    try { await snapshot('after-failure'); } catch (snapshotError) { index.parentSnapshotFailure = { name: snapshotError.name, message: String(snapshotError.message).slice(0, workerPolicy.maximumFailureCharacters) }; }
    save(); throw error;
  } finally { if (deadlineTimer !== undefined) clearTimeout(deadlineTimer); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
}

if (require.main === module) {
  Promise.resolve().then(() => {
    assert.equal(process.argv.length, 6, 'Pilot criterion: provide mode, prepared package, new output and criterion ID');
    const [option, prepared, destination, criterionId] = process.argv.slice(2);
    assert.ok([policy.functionalOption, policy.captureOption].includes(option));
    return runCriterion(option === policy.captureOption ? policy.captureMode : policy.functionalMode, prepared, destination, criterionId);
  }).catch((error) => {
    process.stderr.write(JSON.stringify({ operation: 'Pilot criterion', name: error.name,
      message: String(error.message).slice(0, workerPolicy.maximumFailureCharacters) }) + '\n');
    process.exitCode = workerPolicy.failureExitCode;
  });
}
module.exports = { hostedContext, runCriterion };
