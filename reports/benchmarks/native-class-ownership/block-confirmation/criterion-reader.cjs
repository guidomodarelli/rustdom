/** @module confirmation-criterion-reader Replays every source member, command, task and resource as data; never loads an archived implementation or accepts a study. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readJSON, hashFile } = require('../owner-batch-study/io.cjs');
const { ownedFile, filesDigest } = require('./source.cjs');
const { schedule } = require('./calendar.cjs');
const { validateBinding, requireMode } = require('./binding.cjs');
const { replayBoundProcess } = require('./bound-replay.cjs');
const { compareCriterion } = require('./compare.cjs');
const { validateReceipt } = require('./consumption.cjs');
const { workerArguments } = require('./worker-engine.cjs');
const policy = require('./constants/capture.json');
const sourcePolicy = require('./constants/source.json');
const worker = require('./constants/worker.json');
const design = require('./constants/design.json');
const processPolicy = require('../owner-batch-study/constants/process.json');
const resourcePolicy = require('../owner-batch-study/constants/resources.json');

/** @param {string} root - Actual extraction root. @param {string} relative - Canonical data member. @returns {string} Physical independent bounded file. */
function dataFile(root, relative) {
  const filename = ownedFile(root, relative);
  assert.equal(fs.lstatSync(filename).nlink, 1, 'Confirmation reader: independent data file required');
  return filename;
}

/** @param {object} recorded - Original path-bearing manifest. @param {object} actual - Independently authenticated package inventories at the reader location. @returns {void} Compare content identity without rewriting recorded original paths. */
function compareManifest(recorded, actual) {
  const { copies: originalCopies, packageRoot: originalRoot, ...originalContent } = recorded;
  const { copies: currentCopies, packageRoot: currentRoot, ...currentContent } = actual;
  assert.deepEqual(originalContent, currentContent, 'Confirmation reader: package identity differs');
  assert.equal(Object.keys(originalCopies).length, Object.keys(currentCopies).length);
  assert.ok(path.posix.isAbsolute(originalRoot) && path.posix.isAbsolute(currentRoot));
  for (const [physical, filename] of Object.entries(originalCopies)) {
    const relative = physical === 'B' ? 'candidate' : 'controls/packages/' + physical;
    assert.equal(filename, path.posix.join(originalRoot, relative));
    assert.equal(currentCopies[physical], path.posix.join(currentRoot, relative));
  }
}

/** @param {string} root - Existing data root. @param {object} index - Unmodified parent journal. @param {object} expected - Independent source/profile/reference observations. @returns {void} Source snapshots are hashed only; immutable references are resolved outside captured code. */
function verifySourceSnapshot(root, index, expected) {
  assert.deepEqual(index.sourceProfile, expected.source.profile);
  assert.deepEqual(Object.keys(index.sourceSnapshot).sort(), Object.keys(expected.source.profile.currentFiles).sort());
  for (const [relative, checksum] of Object.entries(expected.source.profile.currentFiles)) {
    const entry = index.sourceSnapshot[relative];
    const reference = policy.publishedReferenceExtensions.includes(path.posix.extname(relative)) && relative !== sourcePolicy.selectedPackageArchive;
    const location = reference ? null : relative === sourcePolicy.selectedPackageArchive ?
      policy.files.selectedPackageSnapshot : policy.files.sourceDirectory + '/' + relative;
    assert.equal(entry.location, location); assert.equal(entry.sha256, checksum);
    assert.equal(entry.role, reference ? policy.snapshotRoles.reference : relative === sourcePolicy.selectedPackageArchive ? policy.snapshotRoles.package : policy.snapshotRoles.source);
    const filename = reference ? ownedFile(expected.referenceRoot, relative) : dataFile(root, location);
    assert.equal(fs.statSync(filename).size, entry.bytes);
    assert.equal(hashFile(filename), checksum, 'Confirmation reader: changed source snapshot/reference ' + relative);
  }
}

/** @param {object[]} snapshots - Original parent endpoint observations. @param {object} index - Actual parent clocks/counts. @returns {void} Validate three finite endpoints, never memory peak or universal leak freedom. */
function verifyParent(snapshots, index) {
  assert.equal(snapshots.length, worker.parentStages.length);
  let previous = index.startedMonotonicMs;
  for (const [ordinal, snapshot] of snapshots.entries()) {
    assert.equal(snapshot.stage, worker.parentStages[ordinal]);
    assert.equal(snapshot.completedWorkers, [0, index.processes.length / 2, index.processes.length][ordinal]);
    assert.ok(Number.isFinite(snapshot.monotonicMs) && snapshot.monotonicMs >= previous);
    assert.ok(snapshot.monotonicMs <= index.startedMonotonicMs + index.elapsedMs);
    previous = snapshot.monotonicMs;
    for (const field of resourcePolicy.memoryFields) assert.ok(Number.isSafeInteger(snapshot.memory[field]) && snapshot.memory[field] >= 0);
    assert.ok(snapshot.memory.rss > 0 && snapshot.memory.heapUsed <= snapshot.memory.heapTotal);
    for (const field of ['user', 'system']) assert.ok(Number.isSafeInteger(snapshot.cpu[field]) && snapshot.cpu[field] >= 0);
  }
}

/** @param {string} root - Physical data root. @param {object} index - Original parent journal. @param {object} expected - Independently authenticated publication and consumption, never inferred from this index. @returns {void} Metadata consistency only; does not authorize execution or authenticate transport. */
function verifyPublicationData(root, index, expected) {
  if (expected.mode === policy.functionalMode) {
    assert.equal(index.publicationSha256, null); assert.equal(index.hosted, null);
    assert.equal(index.consumptionSha256, null);
    // The initial functional prototypes predate this scalar field; absent never grants scientific eligibility.
    assert.ok(index.consumption === null || index.consumption === undefined);
    for (const relative of [policy.files.catalogSnapshot, policy.files.publicationSnapshot, policy.files.consumptionSnapshot]) {
      assert.equal(fs.existsSync(path.join(root, relative)), false);
    }
    return;
  }
  assert.equal(expected.mode, policy.captureMode);
  const catalogPath = dataFile(root, policy.files.catalogSnapshot);
  const publicationPath = dataFile(root, policy.files.publicationSnapshot);
  const consumptionPath = dataFile(root, policy.files.consumptionSnapshot);
  assert.deepEqual(readJSON(catalogPath), expected.source.catalog);
  assert.deepEqual(readJSON(publicationPath), expected.source.publication);
  assert.deepEqual(expected.source.catalog.files, expected.source.profile.currentFiles);
  assert.equal(hashFile(catalogPath), expected.source.files[sourcePolicy.catalog]);
  assert.deepEqual(expected.source.files, { ...expected.source.profile.currentFiles, [sourcePolicy.catalog]: hashFile(catalogPath) });
  assert.equal(hashFile(publicationPath), expected.source.publicationSha256);
  assert.equal(index.publicationSha256, expected.source.publicationSha256);
  assert.deepEqual(index.hosted, expected.source.hosted);
  assert.deepEqual(readJSON(consumptionPath), expected.source.consumption);
  assert.deepEqual(index.consumption, expected.source.consumption);
  assert.equal(hashFile(consumptionPath), expected.source.consumptionSha256);
  assert.equal(index.consumptionSha256, expected.source.consumptionSha256);
  validateReceipt(index.consumption, expected.source.hosted);
  assert.equal(index.consumption.publicationSha256, expected.source.publicationSha256);
  assert.equal(index.consumption.methodFilesDigest, filesDigest(expected.source.files));
}

/** @param {string} root - Original physical data. @param {object} index - Parent journal. @param {object} expected - Independent caller mode and optional real supervisor journal. @returns {object} Explicit clock/supervisor scope; old functional development fixtures never gain scientific eligibility. */
function verifyClock(root, index, expected) {
  if (index.captureStartMarkerSha256 === undefined) {
    assert.equal(expected.mode, policy.functionalMode, 'Confirmation reader: scientific criterion requires its start marker');
    assert.equal(expected.supervisor, undefined);
    return { captureStartVerified: false, supervisorVerified: false, scope: 'initial-functional-prototype-without-supervision' };
  }
  const markerPath = dataFile(root, policy.files.captureStart); const marker = readJSON(markerPath);
  assert.equal(hashFile(markerPath), index.captureStartMarkerSha256);
  assert.equal(marker.revision, policy.revision); assert.equal(marker.mode, expected.mode);
  assert.equal(marker.node, index.node); assert.equal(marker.parentPid, index.parentPid); assert.equal(marker.criterionId, expected.criterionId);
  assert.equal(marker.captureBudgetMs, index.timeoutMs); assert.equal(marker.clock, policy.uptimeClock);
  assert.equal(marker.uptimeResolutionSeconds, policy.uptimeResolutionSeconds);
  assert.ok(Number.isFinite(marker.uptimeSeconds) && marker.uptimeSeconds > 0);
  if (expected.supervisor === undefined) {
    assert.equal(expected.mode, policy.functionalMode, 'Confirmation reader: scientific criterion requires its owning supervisor');
    return { captureStartVerified: true, supervisorVerified: false, scope: 'functional-start-marker-only' };
  }
  const supervisor = expected.supervisor;
  assert.equal(supervisor.revision, policy.revision); assert.equal(supervisor.mode, expected.mode);
  assert.equal(supervisor.complete, true); assert.equal(supervisor.parentExitCode, 0); assert.equal(supervisor.exitCode, 0);
  assert.equal(supervisor.parentPid, index.parentPid); assert.ok(Number.isSafeInteger(supervisor.supervisorPid) && supervisor.supervisorPid > 0);
  assert.notEqual(supervisor.supervisorPid, supervisor.parentPid);
  assert.equal(supervisor.deadlineReached, false); assert.equal(supervisor.interrupted, false); assert.equal(supervisor.unexpectedDescendants, false);
  assert.equal(supervisor.failure, undefined); assert.deepEqual(supervisor.ownedDescendantsRemaining, []);
  assert.equal(supervisor.cleanupFailure, undefined); assert.equal(supervisor.cleanupObserverFailure, undefined);
  assert.equal(supervisor.nodeExecutableSha256, design.nodeExecutableSha256[index.node]);
  assert.equal(supervisor.captureStartMarkerSha256, index.captureStartMarkerSha256);
  assert.equal(supervisor.captureStartedUptimeSeconds, marker.uptimeSeconds);
  assert.equal(supervisor.deadlineSeconds * 1000, index.timeoutMs);
  assert.ok(Number.isFinite(supervisor.startedUptimeSeconds) && supervisor.startedUptimeSeconds <= marker.uptimeSeconds + policy.uptimeResolutionSeconds);
  assert.ok(Number.isFinite(supervisor.finishedUptimeSeconds) && supervisor.finishedUptimeSeconds >= supervisor.startedUptimeSeconds);
  assert.ok(Number.isFinite(supervisor.elapsedSeconds) && supervisor.elapsedSeconds > 0);
  const fullDeadline = marker.uptimeSeconds + policy.uptimeResolutionSeconds + index.timeoutMs / 1000;
  const expectedDeadline = expected.mode === policy.captureMode ? Math.min(fullDeadline,
    supervisor.jobStartedUptimeSeconds + (design.jobTimeoutMinutes - design.archiveBudgetMinutes - design.uploadBudgetMinutes - design.jobMarginMinutes) * 60) : fullDeadline;
  assert.equal(supervisor.captureDeadlineUptimeSeconds, expectedDeadline);
  assert.ok(supervisor.finishedUptimeSeconds <= expectedDeadline);
  assert.equal(supervisor.performanceAccepted, null); assert.equal(supervisor.gateReevaluated, false);
  assert.deepEqual(supervisor.argv, [index.nodeExecutable, ...policy.parentExecArgv,
    path.posix.join(index.sourceProfile.profiledSourceDirectory, policy.criterionPath),
    expected.mode === policy.captureMode ? policy.captureOption : policy.functionalOption,
    index.manifest.packageRoot, expected.originalDirectory, expected.criterionId]);
  return { captureStartVerified: true, supervisorVerified: true, scope: 'whole-owned-criterion-subtree' };
}

/**
 * Replay one whole criterion after the caller separately authenticates its transport, original source and sealed package.
 * The original paths and Git errors remain data; readers never normalize them to their own checkout or import a snapshot.
 * @param {string} directory - Actual physical extraction root.
 * @param {object} expected - Independent mode, criterionId, originalDirectory, source, manifest and referenceRoot.
 * @returns {object} Complete observations/resources and a numerical criterion result only; transport and study acceptance stay false/null.
 */
function verifyCriterion(directory, expected) {
  requireMode(expected.mode);
  const root = fs.realpathSync(directory); const index = readJSON(dataFile(root, policy.files.index));
  const planned = schedule(expected.criterionId);
  const inputs = planned.processes.filter((input) => expected.mode === policy.captureMode || input.block < policy.functionalBlocks);
  assert.equal(index.revision, policy.revision); assert.equal(index.mode, expected.mode); assert.equal(index.criterionId, expected.criterionId);
  assert.equal(index.node, planned.node); assert.equal(index.complete, true); assert.equal(index.failure, undefined);
  if (index.nodeExecutableSha256 !== undefined || expected.mode === policy.captureMode) {
    assert.equal(index.nodeExecutableSha256, design.nodeExecutableSha256[index.node]);
    assert.deepEqual(index.parentExecArgv, policy.parentExecArgv);
    assert.equal(typeof index.nodeExecutable, 'string'); assert.ok(path.posix.isAbsolute(index.nodeExecutable));
  }
  assert.equal(index.functionalOnly, expected.mode === policy.functionalMode);
  assert.equal(index.scientificCaptureExecuted, expected.mode === policy.captureMode);
  assert.equal(index.performanceAccepted, null); assert.equal(index.gateReevaluated, false);
  assert.equal(index.plannedProcesses, inputs.length); assert.equal(index.processes.length, inputs.length);
  assert.ok(Number.isSafeInteger(index.parentPid) && index.parentPid > 0);
  assert.ok(Number.isFinite(index.startedMonotonicMs) && index.startedMonotonicMs >= 0);
  assert.ok(Number.isFinite(index.elapsedMs) && index.elapsedMs > 0 && index.elapsedMs <= index.timeoutMs);
  assert.equal(index.timeoutMs, expected.mode === policy.captureMode ? design.captureTimeoutMinutes * 60_000 : policy.functionalTimeoutMs);
  verifySourceSnapshot(root, index, expected);
  verifyPublicationData(root, index, expected);
  const manifestFile = dataFile(root, policy.files.manifest); const manifest = readJSON(manifestFile);
  assert.deepEqual(manifest, index.manifest); assert.equal(hashFile(manifestFile), index.manifestSha256);
  compareManifest(manifest, expected.manifest);
  const bindingFile = dataFile(root, policy.files.binding); const binding = readJSON(bindingFile);
  assert.equal(hashFile(bindingFile), index.methodBindingSha256); assert.deepEqual(binding, index.methodBinding);
  const expectedBinding = { mode: expected.mode, parentPid: index.parentPid, node: index.node,
    nodeExecutable: index.nodeExecutable ?? index.processes[0].invocation.command.argv[0],
    sourceDirectory: expected.source.profile.profiledSourceDirectory, sourceCommit: expected.source.profile.sourceCommit,
    sourceChangesRaw: expected.source.profile.sourceChangesRaw, files: expected.source.files,
    manifestPath: path.posix.join(expected.originalDirectory, policy.files.manifest), manifestSha256: index.manifestSha256,
    criterionId: expected.criterionId, hostId: index.hostId, publicationSha256: expected.source.publicationSha256,
    consumptionSha256: expected.source.consumptionSha256, hosted: expected.source.hosted, bindingSha256: index.methodBindingSha256 };
  validateBinding(binding, expectedBinding);
  const producer = { parentPid: index.parentPid, workerSourceSha256: expected.source.files[policy.workerPath],
    workerEngineSourceSha256: expected.source.files[policy.enginePath] };
  const observations = []; const totals = { processes: 0, measuredDurations: 0, warmupDurations: 0, windows: 0, documents: 0, firstUnclearStates: 0, finalClearStates: 0 };
  let previousEnd = index.startedMonotonicMs;
  const prefixes = new Map();
  for (const [ordinal, entry] of index.processes.entries()) {
    const input = inputs[ordinal]; const name = String(input.ordinal).padStart(policy.ordinalDigits, '0');
    assert.deepEqual(entry.input, input); assert.equal(entry.complete, true);
    assert.equal(entry.directory, policy.files.workersDirectory + '/' + name);
    const inputRelative = policy.files.inputsDirectory + '/' + name + '.json';
    assert.deepEqual(readJSON(dataFile(root, inputRelative)), input);
    const requiredFiles = [policy.files.workerReport, policy.files.workerReport + policy.files.workerContextSuffix,
      processPolicy.commandFile, processPolicy.stdoutFile, processPolicy.stderrFile];
    assert.deepEqual(Object.keys(entry.files).sort(), [...requiredFiles].sort());
    for (const filename of requiredFiles) {
      const physical = dataFile(root, entry.directory + '/' + filename);
      assert.equal(fs.statSync(physical).size, entry.files[filename].bytes);
      assert.equal(hashFile(physical), entry.files[filename].sha256, 'Confirmation reader: changed worker file ' + entry.directory + '/' + filename);
    }
    const command = readJSON(dataFile(root, entry.directory + '/' + processPolicy.commandFile));
    assert.deepEqual(command, entry.invocation.command);
    assert.equal(command.complete, true); assert.equal(command.exitCode, 0); assert.equal(command.signal, null);
    assert.equal(command.timedOut, false); assert.equal(command.cancelled, false); assert.equal(command.failure, undefined);
    assert.notEqual(command.leftoverProcessGroupDetected, true);
    assert.equal(command.cwd, binding.sourceDirectory);
    assert.deepEqual(command.argv, [binding.nodeExecutable, ...workerArguments(input.factor),
      path.posix.join(binding.sourceDirectory, policy.workerPath),
      expected.mode === policy.captureMode ? policy.captureOption : policy.functionalOption,
      binding.manifestPath, path.posix.join(expected.originalDirectory, inputRelative),
      path.posix.join(expected.originalDirectory, entry.directory, policy.files.workerReport)]);
    const { startMonotonicMs, endMonotonicMs } = entry.invocation;
    assert.ok(Number.isFinite(startMonotonicMs) && startMonotonicMs >= previousEnd);
    assert.ok(Number.isFinite(endMonotonicMs) && endMonotonicMs > startMonotonicMs);
    assert.ok(endMonotonicMs <= index.startedMonotonicMs + index.elapsedMs);
    assert.ok(Number.isFinite(command.elapsedMs) && command.elapsedMs > 0 && command.elapsedMs <= endMonotonicMs - startMonotonicMs);
    previousEnd = endMonotonicMs;
    const report = readJSON(dataFile(root, entry.directory + '/' + policy.files.workerReport));
    const context = readJSON(dataFile(root, entry.directory + '/' + policy.files.workerReport + policy.files.workerContextSuffix));
    const invocation = { mode: expected.mode, node: index.node, parentPid: index.parentPid, pid: command.pid,
      hostId: index.hostId, methodBindingSha256: index.methodBindingSha256, startMonotonicMs, endMonotonicMs };
    const result = replayBoundProcess(report, context, manifest, input, invocation, producer, binding, expectedBinding);
    const prefix = prefixes.get(input.factor);
    if (prefix === undefined) prefixes.set(input.factor, report.randomProbe);
    else assert.deepEqual(report.randomProbe, prefix, 'Confirmation reader: changed seed group');
    totals.processes += 1; totals.measuredDurations += result.replay.samplesMs.length; totals.warmupDurations += result.replay.warmupSamplesMs.length;
    totals.windows += result.trackedOwners.window; totals.documents += result.trackedOwners.document;
    totals.firstUnclearStates += Number(!result.cleanupTrace[0].clear);
    totals.finalClearStates += result.cleanupTrace.slice(-2).filter((state) => state.clear).length;
    if (expected.mode === policy.captureMode) observations.push(result.analysisObservation);
    else assert.equal(result.analysisObservation, null);
    assert.deepEqual(entry.observed, { measured: result.replay.samplesMs.length, warmup: result.replay.warmupSamplesMs.length,
      windows: result.trackedOwners.window, documents: result.trackedOwners.document,
      firstClear: result.cleanupTrace[0].clear, finalClearStates: result.cleanupTrace.slice(-2).filter((state) => state.clear).length });
  }
  verifyParent(index.parentMemory, index);
  const clock = verifyClock(root, index, expected);
  assert.deepEqual(index.packageVerificationAfter, index.packageVerification);
  const analysis = expected.mode === policy.captureMode ? compareCriterion(expected.criterionId, observations) : null;
  assert.deepEqual(index.analysis, analysis);
  return { verified: true, mode: expected.mode, criterionId: expected.criterionId, totals, observations, analysis,
    sourceSnapshotVerifiedAsData: true, clock, originalPathsRewritten: false, transportAuthenticationPerformed: false,
    performanceAccepted: null, gateReevaluated: false };
}

module.exports = { dataFile, compareManifest, verifySourceSnapshot, verifyParent, verifyPublicationData, verifyClock, verifyCriterion };
