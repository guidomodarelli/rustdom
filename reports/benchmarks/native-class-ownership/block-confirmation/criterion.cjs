/** @module confirmation-criterion Runs a whole fixed criterion on one host, retaining every process and partial without retries. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { schedule } = require('./calendar.cjs');
const { inspectCurrentSource, ownedFile } = require('./source.cjs');
const { authenticatePackage } = require('./authentication.cjs');
const { requireMode, createBinding } = require('./binding.cjs');
const { requirePublishedSource, hostedContext } = require('./capture-source.cjs');
const { requireConsumption } = require('./consumption.cjs');
const { replayBoundProcess } = require('./bound-replay.cjs');
const { finalizeQualification } = require('./finalize.cjs');
const { compareCriterion } = require('./compare.cjs');
const { createManifest } = require('../control-precision/pilot-v2/packages.cjs');
const { execute } = require('../owner-batch-study/process.cjs');
const { readJSON, writeJSON, writeNewJSON, hashFile } = require('../owner-batch-study/io.cjs');
const { collectGarbage } = require('../../../../scripts/memory-endpoint.cjs');
const { workerArguments } = require('./worker-engine.cjs');
const policy = require('./constants/capture.json');
const worker = require('./constants/worker.json');
const design = require('./constants/design.json');
const sourcePolicy = require('./constants/source.json');
const historicalPolicy = require('./constants/authentication.json');
const processPolicy = require('../owner-batch-study/constants/process.json');
const repository = path.resolve(__dirname, '../../../..');

/** @param {string} directory - Parent-owned output. @param {object} profile - Actual source bytes and Git identity. @returns {object} Every current source member as data or an explicitly hashed published binary reference. */
function snapshotSource(directory, profile) {
  const members = {};
  for (const [relative, expected] of Object.entries(profile.currentFiles)) {
    const filename = ownedFile(repository, relative);
    assert.equal(hashFile(filename), expected);
    const publishedReference = policy.publishedReferenceExtensions.includes(path.posix.extname(relative));
    const location = publishedReference && relative !== sourcePolicy.selectedPackageArchive ? null :
      relative === sourcePolicy.selectedPackageArchive ? policy.files.selectedPackageSnapshot : policy.files.sourceDirectory + '/' + relative;
    if (location !== null) {
      const destination = path.join(directory, location); fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(filename, destination, fs.constants.COPYFILE_EXCL); assert.equal(hashFile(destination), expected);
    }
    members[relative] = { sha256: expected, bytes: fs.statSync(filename).size, location,
      role: location === null ? policy.snapshotRoles.reference : relative === sourcePolicy.selectedPackageArchive ? policy.snapshotRoles.package : policy.snapshotRoles.source };
  }
  return members;
}

/**
 * Execute one declared criterion with all factors and labels in their fixed order.
 * Functional mode exercises one complete factor block and can never produce statistical observations.
 * @param {string} mode - Independently selected functional or fully published scientific role.
 * @param {string} prepared - Authenticated sealed package root; never reconstructed.
 * @param {string} destination - New disjoint evidence directory.
 * @param {string} criterionId - Exact criterion including the pinned SDK.
 * @returns {Promise<object>} Original commands, file identities, counts, source, three parent snapshots and complete/partial state.
 */
async function runCriterion(mode, prepared, destination, criterionId) {
  requireMode(mode);
  if (mode === policy.captureMode) assert.equal(Number(process.env[policy.supervisorPidEnvironment]), process.ppid,
    'Confirmation criterion: scientific capture requires its actual owning supervisor');
  assert.equal(process.platform, 'linux'); assert.equal(typeof global.gc, 'function');
  assert.deepEqual(process.execArgv, policy.parentExecArgv); assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
  const planned = schedule(criterionId); assert.equal(planned.node, process.version);
  assert.equal(hashFile(process.execPath, worker.maximumExecutableBytes, false), design.nodeExecutableSha256[process.version]);
  prepared = fs.realpathSync(prepared);
  destination = path.join(fs.realpathSync(path.dirname(path.resolve(destination))), path.basename(destination));
  for (const root of [repository, prepared]) assert.ok(destination !== root && !destination.startsWith(root + path.sep) && !root.startsWith(destination + path.sep));
  assert.equal(fs.existsSync(destination), false, 'Confirmation criterion: preserve prior output'); fs.mkdirSync(destination);
  const started = performance.now();
  const timeoutMs = mode === policy.captureMode ? design.captureTimeoutMinutes * 60_000 : policy.functionalTimeoutMs;
  const inputs = planned.processes.filter((input) => mode === policy.captureMode || input.block < policy.functionalBlocks);
  const index = { revision: policy.revision, mode, complete: false, functionalOnly: mode === policy.functionalMode,
    criterionId, node: process.version, nodeExecutable: fs.realpathSync(process.execPath),
    nodeExecutableSha256: hashFile(process.execPath, worker.maximumExecutableBytes, false), parentExecArgv: [...process.execArgv],
    parentPid: process.pid, hostId: randomUUID(), plannedProcesses: inputs.length,
    startedMonotonicMs: started, startedAt: new Date().toISOString(), timeoutMs, processes: [], parentMemory: [],
    machine: { platform: process.platform, arch: process.arch, release: os.release(), cpus: os.cpus(), totalMemory: os.totalmem() },
    scientificCaptureExecuted: mode === policy.captureMode, performanceAccepted: null, gateReevaluated: false };
  const indexPath = path.join(destination, policy.files.index); const save = () => writeJSON(indexPath, index);
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort(new Error('Confirmation criterion: parent termination requested'));
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  let timer;
  const snapshot = async (stage) => {
    await collectGarbage(); index.parentMemory.push({ stage, completedWorkers: index.processes.filter((entry) => entry.complete).length,
      monotonicMs: performance.now(), observedAt: new Date().toISOString(), memory: process.memoryUsage(), cpu: process.cpuUsage() });
  };
  const observations = []; const randomPrefixes = new Map();
  const uptimeSeconds = Number(fs.readFileSync('/proc/uptime', 'ascii').split(' ', 1)[0]);
  assert.ok(Number.isFinite(uptimeSeconds) && uptimeSeconds > 0);
  writeNewJSON(path.join(destination, policy.files.captureStart), { revision: policy.revision, mode, parentPid: process.pid,
    node: process.version, criterionId, uptimeSeconds, uptimeResolutionSeconds: policy.uptimeResolutionSeconds,
    captureBudgetMs: timeoutMs, clock: policy.uptimeClock });
  index.captureStartMarkerSha256 = hashFile(path.join(destination, policy.files.captureStart));
  save();
  try {
    timer = setTimeout(() => cancellation.abort(new Error('Confirmation criterion: declared deadline reached')), timeoutMs); timer.unref();
    index.packageVerification = authenticatePackage(prepared, destination, 'package-before'); save();
    const original = process.env[historicalPolicy.authenticationSourceEnvironment];
    const source = mode === policy.captureMode ? requirePublishedSource() : {
      profile: inspectCurrentSource(repository, original), publicationSha256: null };
    source.files ??= source.profile.currentFiles;
    source.hosted = mode === policy.captureMode ? hostedContext(source.profile.sourceCommit) : null;
    const consumption = mode === policy.captureMode ? requireConsumption(source, source.hosted) : null;
    source.consumptionSha256 = consumption?.sha256 ?? null;
    index.sourceProfile = source.profile; index.publicationSha256 = source.publicationSha256; index.hosted = source.hosted;
    index.consumptionSha256 = source.consumptionSha256;
    index.consumption = consumption?.receipt ?? null;
    index.sourceSnapshot = snapshotSource(destination, source.profile);
    if (mode === policy.captureMode) {
      for (const [relative, location] of [[sourcePolicy.catalog, policy.files.catalogSnapshot], [sourcePolicy.publication, policy.files.publicationSnapshot]]) {
        const filename = ownedFile(repository, relative); const target = path.join(destination, location);
        fs.copyFileSync(filename, target, fs.constants.COPYFILE_EXCL); assert.equal(hashFile(target), hashFile(filename));
      }
      const receiptSource = process.env[policy.consumptionEnvironment];
      const receiptTarget = path.join(destination, policy.files.consumptionSnapshot);
      fs.copyFileSync(receiptSource, receiptTarget, fs.constants.COPYFILE_EXCL);
      assert.equal(hashFile(receiptTarget), source.consumptionSha256);
    }
    const manifest = createManifest(prepared, index.packageVerification, mode);
    const manifestPath = path.join(destination, policy.files.manifest); writeNewJSON(manifestPath, manifest);
    index.manifest = manifest; index.manifestSha256 = hashFile(manifestPath);
    const binding = createBinding(source, criterionId, manifestPath, index.hostId, mode);
    const bindingPath = path.join(destination, policy.files.binding); writeNewJSON(bindingPath, binding);
    index.methodBindingSha256 = hashFile(bindingPath); index.methodBinding = binding; save();
    const expectedBinding = { ...binding, files: source.files, bindingSha256: index.methodBindingSha256 };
    const producer = { parentPid: process.pid, workerSourceSha256: source.files[policy.workerPath], workerEngineSourceSha256: source.files[policy.enginePath] };
    fs.mkdirSync(path.join(destination, policy.files.inputsDirectory)); fs.mkdirSync(path.join(destination, policy.files.workersDirectory));
    await snapshot(worker.parentStages[0]); save();
    for (const input of inputs) {
      const remaining = Math.floor(timeoutMs - (performance.now() - started));
      assert.ok(remaining > 0 && !cancellation.signal.aborted, 'Confirmation criterion: stopped before next worker; preserve partials');
      const name = String(input.ordinal).padStart(policy.ordinalDigits, '0');
      const directory = path.join(destination, policy.files.workersDirectory, name); const inputPath = path.join(destination, policy.files.inputsDirectory, name + '.json');
      writeNewJSON(inputPath, input); const reportPath = path.join(directory, policy.files.workerReport);
      const option = mode === policy.captureMode ? policy.captureOption : policy.functionalOption;
      const argv = [process.execPath, ...workerArguments(input.factor), path.join(repository, policy.workerPath), option, manifestPath, inputPath, reportPath];
      const entry = { input, directory: policy.files.workersDirectory + '/' + name, complete: false }; index.processes.push(entry); save();
      const startMonotonicMs = performance.now();
      const command = await execute(argv, directory, { timeoutMs: Math.min(worker.workerTimeoutMs, remaining), signal: cancellation.signal,
        cwd: repository, environment: { ...process.env, [policy.bindingEnvironment]: bindingPath, [policy.bindingDigestEnvironment]: index.methodBindingSha256 } });
      const endMonotonicMs = performance.now(); entry.invocation = { command, startMonotonicMs, endMonotonicMs }; save();
      assert.equal(command.exitCode, 0, 'Confirmation criterion: worker failed; never retry or replace a process');
      assert.equal(command.timedOut, false); assert.equal(command.cancelled, false); assert.notEqual(command.leftoverProcessGroupDetected, true);
      const report = readJSON(reportPath); const context = readJSON(reportPath + policy.files.workerContextSuffix);
      const invocation = { mode, node: process.version, pid: command.pid, parentPid: process.pid, hostId: index.hostId,
        startMonotonicMs, endMonotonicMs, methodBindingSha256: index.methodBindingSha256 };
      const replay = replayBoundProcess(report, context, manifest, input, invocation, producer, binding, expectedBinding);
      const prefix = randomPrefixes.get(input.factor);
      if (prefix === undefined) randomPrefixes.set(input.factor, [...report.randomProbe]);
      else assert.deepEqual(report.randomProbe, prefix, 'Confirmation criterion: same fixed factor changed its RNG startup prefix');
      entry.observed = { measured: replay.replay.samplesMs.length, warmup: replay.replay.warmupSamplesMs.length,
        windows: replay.trackedOwners.window, documents: replay.trackedOwners.document,
        firstClear: replay.cleanupTrace[0].clear, finalClearStates: replay.cleanupTrace.slice(-2).filter((state) => state.clear).length };
      entry.files = Object.fromEntries([policy.files.workerReport, policy.files.workerReport + policy.files.workerContextSuffix, processPolicy.commandFile, processPolicy.stdoutFile, processPolicy.stderrFile]
        .map((filename) => [filename, { sha256: hashFile(path.join(directory, filename)), bytes: fs.statSync(path.join(directory, filename)).size }]));
      if (mode === policy.captureMode) observations.push(replay.analysisObservation);
      else assert.equal(replay.analysisObservation, null);
      entry.complete = true; save();
      process.stdout.write(JSON.stringify({ criterionId, completedWorkers: index.processes.length, plannedWorkers: inputs.length, factor: input.factor, label: input.label }) + '\n');
      if (index.processes.length === inputs.length / 2) { await snapshot(worker.parentStages[1]); save(); }
    }
    const finalization = await finalizeQualification({ signal: cancellation.signal, startedMonotonicMs: started, timeoutMs,
      snapshot: () => snapshot(worker.parentStages[2]), recheck: () => {
        index.packageVerificationAfter = authenticatePackage(prepared, destination, 'package-after');
        assert.deepEqual(index.packageVerificationAfter, index.packageVerification);
        const after = mode === policy.captureMode ? requirePublishedSource().profile : inspectCurrentSource(repository, original);
        assert.deepEqual(after, source.profile);
        assert.equal(hashFile(bindingPath), index.methodBindingSha256); assert.equal(hashFile(manifestPath), index.manifestSha256);
        assert.equal(hashFile(process.execPath, worker.maximumExecutableBytes, false), binding.nodeExecutableSha256);
        index.analysis = mode === policy.captureMode ? compareCriterion(criterionId, observations) : null;
      } });
    index.elapsedMs = finalization.elapsedMs; index.complete = true; save(); return index;
  } catch (error) {
    index.failure = { name: error.name, message: String(error.message).slice(0, worker.maximumFailureCharacters) };
    try { await snapshot(policy.failureParentStage); } catch (snapshotError) { index.parentSnapshotFailure = { name: snapshotError.name, message: String(snapshotError.message).slice(0, worker.maximumFailureCharacters) }; }
    save(); throw error;
  } finally { if (timer !== undefined) clearTimeout(timer); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
}

if (require.main === module) {
  Promise.resolve().then(() => {
    assert.equal(process.argv.length, 6, 'Confirmation criterion: provide --functional|--capture sealed-package new-output criterion-ID');
    const [option, prepared, destination, criterionId] = process.argv.slice(2);
    assert.ok([policy.functionalOption, policy.captureOption].includes(option));
    return runCriterion(option === policy.functionalOption ? policy.functionalMode : policy.captureMode, prepared, destination, criterionId);
  }).catch((error) => { process.stderr.write(JSON.stringify({ operation: 'Confirmation criterion', name: error.name,
    message: String(error.message).slice(0, worker.maximumFailureCharacters) }) + '\n'); process.exitCode = worker.failureExitCode; });
}
module.exports = { runCriterion, snapshotSource };
