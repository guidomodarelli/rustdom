/** @module pilot-criterion-replay Reads data using current reviewed code; archived implementations are never loaded. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { readJSON, hashFile, writeNewJSON } = require('./io.cjs');
const { calendar } = require('../blocks.cjs');
const { analyze } = require('../variance.cjs');
const { workerArguments } = require('../worker-engine.cjs');
const { replayBoundProcess } = require('./replay.cjs');
const { filesDigest, ownedPath } = require('./source.cjs');
const { verifyFirstCapture, validateQualifications } = require('./once.cjs');
const policy = require('../constants/capture.json');
const worker = require('../constants/worker.json');
const processPolicy = require('../../../owner-batch-study/constants/process.json');
const sha256 = (raw) => createHash('sha256').update(raw).digest('hex');

/** @param {string} root - Independent physical capture tree. @returns {string[]} Every file, including partial siblings; aliases cannot conceal output. */
function physicalFiles(root) {
  root = fs.realpathSync(root); const result = [];
  const visit = (relative) => {
    const directory = relative === '' ? root : ownedPath(root, relative);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const member = relative ? relative + '/' + entry.name : entry.name;
      const physical = ownedPath(root, member); const status = fs.lstatSync(physical);
      if (status.isDirectory()) visit(member);
      else {
        assert.ok(status.isFile() && status.nlink === 1 && status.size <= policy.maximumArchiveMemberBytes,
          'Pilot replay: physical bounded independent files required');
        result.push(member);
      }
    }
  };
  visit(''); assert.ok(result.length <= policy.maximumArchiveFiles);
  return result.sort();
}

/** @param {string} root - Physical data only. @returns {object|null} Every byte checked if the independently transported archive supplied an inventory; no self-authentication claim. */
function verifyInventory(root) {
  const names = physicalFiles(root);
  if (!names.includes(policy.inventoryFile)) return null;
  const inventory = readJSON(ownedPath(root, policy.inventoryFile));
  assert.equal(inventory.revision, policy.revision);
  assert.deepEqual(Object.keys(inventory.files).sort(), names.filter((name) => name !== policy.inventoryFile));
  let total = 0;
  for (const [relative, binding] of Object.entries(inventory.files)) {
    const filename = ownedPath(root, relative); const status = fs.statSync(filename);
    assert.equal(status.size, binding.bytes); assert.equal(hashFile(filename, policy.maximumArchiveMemberBytes, false), binding.sha256);
    total += status.size;
  }
  assert.ok(total <= policy.maximumArchiveBytes);
  return { files: names.length - 1, bytes: total, inventorySha256: hashFile(ownedPath(root, policy.inventoryFile)) };
}

/** @param {object} manifest - Bounded decoded manifest. @param {string} mode - Actual independently selected role. @returns {void} Bind every physical inventory to the previously authenticated package; no installed runtime is executed. */
function verifyManifest(manifest, mode) {
  assert.equal(manifest.functionalOnly, mode === policy.functionalMode);
  assert.equal(manifest.formalPackageAssembled, true); assert.equal(manifest.numericPackageVerifiedByParent, true);
  assert.equal(manifest.authenticationPerformedHere, false); assert.equal(manifest.selectedArtifactId, worker.selectedArtifactId);
  assert.equal(manifest.nativeBinarySha256, worker.nativeBinarySha256); assert.equal(manifest.archiveSha256, worker.archiveSha256);
  assert.equal(manifest.performanceAccepted, null); assert.equal(manifest.gateReevaluated, false);
  assert.deepEqual(Object.keys(manifest.copies).sort(), Object.keys(worker.distributions).sort());
  assert.deepEqual(Object.keys(manifest.distributions).sort(), Object.keys(worker.distributions).sort());
  for (const [label, expected] of Object.entries(worker.distributions)) {
    const distribution = manifest.distributions[label];
    assert.equal(distribution.sha256, expected); assert.equal(sha256(JSON.stringify(distribution.files)), expected);
    assert.equal(typeof manifest.copies[label], 'string'); assert.ok(path.posix.isAbsolute(manifest.copies[label]));
  }
}

/** @param {string} root - Capture data. @param {object} expected - Independently authenticated source publication, never selected from this capture. @returns {void} Verify source snapshots and original consumed-run receipt as data. */
function verifyScientificSource(root, expected) {
  assert.equal(typeof expected.publicationSha256, 'string');
  const publicationPath = ownedPath(root, policy.publicationSnapshot);
  assert.equal(hashFile(publicationPath), expected.publicationSha256);
  const publication = readJSON(publicationPath);
  assert.equal(publication.revision, policy.revision); assert.equal(publication.executionReady, true);
  assert.equal(publication.completeMethodReview, true); assert.equal(publication.actionableFindings, 0);
  assert.deepEqual(publication.files, expected.files); assert.equal(publication.filesDigest, filesDigest(expected.files));
  assert.equal(publication.performanceAccepted, null); assert.equal(publication.gateReevaluated, false);
  const snapshot = readJSON(ownedPath(root, policy.methodSnapshotIndex));
  assert.deepEqual(Object.keys(snapshot).sort(), Object.keys(expected.files).sort());
  for (const [relative, digest] of Object.entries(expected.files)) {
    const role = relative === policy.packageArchive ? 'embedded-package' :
      policy.publishedReferenceExtensions.includes(path.posix.extname(relative)) ? 'published-reference' : 'copied-source';
    const location = role === 'embedded-package' ? policy.packageSnapshot :
      role === 'copied-source' ? policy.methodSnapshotDirectory + '/' + relative : null;
    assert.equal(snapshot[relative].role, role); assert.equal(snapshot[relative].location, location);
    assert.equal(snapshot[relative].sha256, digest);
    assert.ok(Number.isSafeInteger(snapshot[relative].bytes) && snapshot[relative].bytes >= 0);
    if (location !== null) {
      const filename = ownedPath(root, location);
      assert.equal(fs.statSync(filename).size, snapshot[relative].bytes);
      assert.equal(hashFile(filename, policy.maximumArchiveMemberBytes, false), digest);
    }
  }
  const receiptPath = ownedPath(root, policy.consumptionFile);
  assert.equal(typeof expected.consumptionSha256, 'string'); assert.equal(hashFile(receiptPath), expected.consumptionSha256);
  const receipt = readJSON(receiptPath);
  const authorization = verifyFirstCapture(expected.sourceCommit, expected.runId, receipt.current, receipt.pages, receipt.firstJobs);
  validateQualifications(expected.sourceCommit, receipt.current.created_at, receipt.qualifications);
  for (const [field, value] of Object.entries(authorization)) assert.deepEqual(receipt[field], value);
  assert.equal(receipt.DOMExecuted, false); assert.equal(receipt.scientificCaptureExecuted, false);
}

/** @param {string} root - Archived data. @param {object} index - Decoded index. @param {object} binding - Authenticated parent binding. @param {object} expected - External role/source/criterion. @returns {object|null} Actual supervisor lifecycle or legacy functional absence. */
function verifySupervisor(root, index, binding, expected, manifest) {
  const markerPath = path.join(root, policy.captureStartFile);
  const supervisorPath = path.join(root, policy.supervisorFile);
  if (!fs.existsSync(markerPath) && !fs.existsSync(supervisorPath)) {
    assert.equal(expected.mode, policy.functionalMode, 'Pilot replay: scientific capture requires independent lifetime supervision');
    assert.notEqual(expected.requireSupervisor, true);
    assert.equal(index.captureStartMarkerSha256, undefined, 'Pilot replay: declared marker cannot disappear');
    return null;
  }
  assert.ok(fs.existsSync(markerPath), 'Pilot replay: supervisor cannot declare an absent capture-start marker');
  const marker = readJSON(ownedPath(root, policy.captureStartFile));
  assert.equal(hashFile(markerPath), index.captureStartMarkerSha256);
  assert.equal(marker.revision, policy.revision); assert.equal(marker.mode, expected.mode);
  assert.equal(marker.parentPid, binding.parentPid);
  assert.equal(index.parentPid, binding.parentPid);
  assert.equal(marker.node, index.node); assert.equal(marker.criterionId, expected.criterionId);
  assert.equal(marker.sourceCommit, expected.sourceCommit); assert.equal(marker.clock, policy.uptimeClock);
  assert.equal(marker.captureBudgetMs, index.captureBudgetMs); assert.equal(marker.uptimeResolutionSeconds, policy.uptimeResolutionSeconds);
  assert.ok(Number.isFinite(marker.uptimeSeconds) && marker.uptimeSeconds > 0);
  if (!fs.existsSync(supervisorPath)) {
    assert.equal(expected.mode, policy.functionalMode); assert.notEqual(expected.requireSupervisor, true);
    return { supervised: false, captureStartBound: true };
  }
  const supervisor = readJSON(ownedPath(root, policy.supervisorFile));
  assert.equal(supervisor.captureStartMarkerSha256, index.captureStartMarkerSha256);
  assert.equal(supervisor.revision, policy.revision); assert.equal(supervisor.mode, expected.mode);
  assert.equal(supervisor.parentPid, binding.parentPid);
  assert.ok(Number.isSafeInteger(supervisor.supervisorPid) && supervisor.supervisorPid > 0 && supervisor.supervisorPid !== binding.parentPid);
  assert.deepEqual(supervisor.argv, [index.executable, '--expose-gc',
    path.posix.join(binding.sourceDirectory, 'reports/benchmarks/native-class-ownership/control-precision/pilot/capture/run.cjs'),
    expected.mode === policy.captureMode ? policy.captureOption : policy.functionalOption, manifest.packageRoot, index.captureDirectory, expected.criterionId]);
  assert.equal(supervisor.nodeExecutableSha256, index.executableSha256);
  assert.equal(supervisor.deadlineSeconds * 1000, index.captureBudgetMs);
  assert.equal(supervisor.captureStartedUptimeSeconds, marker.uptimeSeconds);
  assert.equal(supervisor.captureDeadlineUptimeSeconds, marker.uptimeSeconds + policy.uptimeResolutionSeconds + supervisor.deadlineSeconds);
  assert.ok(Number.isFinite(supervisor.jobStartedUptimeSeconds) && supervisor.jobStartedUptimeSeconds >= 0);
  assert.ok(Number.isFinite(supervisor.startedUptimeSeconds) && supervisor.startedUptimeSeconds >= supervisor.jobStartedUptimeSeconds);
  assert.equal(supervisor.setupDeadlineUptimeSeconds, supervisor.jobStartedUptimeSeconds + policy.setupBudgetMinutes * 60);
  assert.ok(marker.uptimeSeconds <= supervisor.setupDeadlineUptimeSeconds);
  assert.ok(supervisor.startedUptimeSeconds <= marker.uptimeSeconds + policy.uptimeResolutionSeconds);
  assert.ok(Number.isFinite(supervisor.elapsedSeconds) && supervisor.elapsedSeconds > 0);
  assert.equal(supervisor.complete, true); assert.equal(supervisor.exitCode, 0); assert.equal(supervisor.parentExitCode, 0);
  assert.equal(supervisor.deadlineReached, false); assert.equal(supervisor.interrupted, false); assert.equal(supervisor.unexpectedDescendants, false);
  assert.deepEqual(supervisor.ownedDescendantsRemaining, []);
  assert.ok(Array.isArray(supervisor.descendantsObservedAtParentExit));
  assert.ok(supervisor.descendantsObservedAtParentExit.every((identity) => ['Z', 'X'].includes(identity.state)));
  assert.equal(supervisor.performanceAccepted, null); assert.equal(supervisor.gateReevaluated, false);
  return supervisor;
}

/**
 * Replay one complete criterion or describe an explicitly allowed partial; source/transport authority is an external responsibility.
 * @param {string} directory - Physical data tree; no module below it is imported.
 * @param {object} expected - Caller-authenticated mode, criterion, sourceCommit, files and, for capture, publication/run/preflight bindings.
 * @returns {object} Complete coverage, resources and recalculated variance; performance acceptance is always null.
 */
function verifyCriterion(directory, expected) {
  assert.ok(policy.modes.includes(expected.mode));
  assert.equal(typeof expected.sourceCommit, 'string'); assert.equal(expected.sourceCommit.length, policy.gitCommitHexLength);
  assert.match(expected.sourceCommit, new RegExp(policy.gitCommitPattern));
  filesDigest(expected.files);
  const root = fs.realpathSync(directory); const inventory = verifyInventory(root);
  if (expected.mode === policy.captureMode) assert.notEqual(inventory, null, 'Pilot replay: complete transported inventory required');
  const indexPath = path.join(root, policy.indexFile);
  if (!fs.existsSync(indexPath)) {
    assert.equal(expected.requireComplete, false, 'Pilot replay: capture has no index');
    return { complete: false, reason: 'no-index', inventory, analysis: null, sourceBindingChecked: false,
      transportAuthenticationPerformed: false, performanceAccepted: null, gateReevaluated: false };
  }
  const index = readJSON(ownedPath(root, policy.indexFile));
  assert.equal(index.revision, policy.revision); assert.equal(index.mode, expected.mode);
  assert.equal(index.functionalOnly, expected.mode === policy.functionalMode);
  assert.equal(index.scientificCaptureExecuted, expected.mode === policy.captureMode);
  assert.equal(index.performanceAccepted, null); assert.equal(index.gateReevaluated, false);
  assert.deepEqual(index.sourceIdentity, { sourceCommit: expected.sourceCommit, sourceChangesRaw: '', sourceGitErrors: [] });
  assert.deepEqual(index.sourceFiles, expected.files); assert.equal(index.criterionId, expected.criterionId);
  const shard = calendar().find((entry) => entry.criterionId === expected.criterionId);
  assert.ok(shard); assert.equal(index.node, shard.node);
  const inputs = expected.mode === policy.captureMode ? shard.processes : shard.processes.filter((input) => input.block < policy.functionalBlocks);
  assert.equal(index.plannedProcesses, inputs.length);
  assert.equal(index.executableSha256, policy.nodeExecutables[index.node]); assert.ok(path.posix.isAbsolute(index.executable));
  assert.equal(typeof index.hostId, 'string'); assert.ok(index.hostId.length > 0);
  const bindingPath = ownedPath(root, policy.bindingFile); const binding = readJSON(bindingPath);
  assert.equal(hashFile(bindingPath), index.bindingSha256);
  assert.equal(binding.revision, policy.revision); assert.equal(binding.mode, expected.mode);
  assert.equal(binding.sourceCommit, expected.sourceCommit); assert.equal(binding.sourceFilesDigest, filesDigest(expected.files));
  assert.equal(binding.node, index.node); assert.equal(binding.nodeExecutable, index.executable);
  assert.equal(binding.nodeExecutableSha256, index.executableSha256); assert.equal(binding.criterionId, expected.criterionId);
  assert.equal(binding.plannedProcesses, inputs.length); assert.ok(Number.isSafeInteger(binding.parentPid) && binding.parentPid > 0);
  assert.equal(binding.performanceAccepted, null); assert.equal(binding.gateReevaluated, false);
  if (expected.mode === policy.captureMode) {
    verifyScientificSource(root, expected);
    assert.equal(binding.publicationSha256, expected.publicationSha256);
    assert.equal(binding.consumptionSha256, expected.consumptionSha256); assert.equal(index.consumptionSha256, expected.consumptionSha256);
    assert.equal(binding.hosted.runId, String(expected.runId)); assert.equal(binding.hosted.attempt, 1);
    assert.equal(binding.hosted.eventHead, expected.sourceCommit); assert.equal(binding.hosted.repository, policy.repository);
    assert.equal(binding.hosted.workflow, policy.workflowName); assert.equal(binding.hosted.jobKey, policy.jobKey);
    assert.equal(binding.hosted.label, policy.label); assert.equal(binding.hosted.pullRequest, policy.pullRequestNumber);
  } else {
    assert.equal(binding.publicationSha256, null); assert.equal(binding.hosted, null);
    assert.deepEqual(binding.sourceFiles, expected.files); assert.equal(index.publication, null);
  }
  const manifestPath = ownedPath(root, policy.manifestFile); const manifest = readJSON(manifestPath);
  assert.equal(hashFile(manifestPath), index.manifestSha256); verifyManifest(manifest, expected.mode);
  assert.equal(index.packageVerification.verified, true); assert.equal(index.packageVerification.artifactId, worker.selectedArtifactId);
  assert.equal(index.packageVerification.nativeBinarySha256, worker.nativeBinarySha256);
  assert.ok(index.processes.length <= inputs.length);
  const observations = []; const pids = new Set(); const prefixes = new Map();
  const totals = { processes: 0, measured: 0, warmup: 0, windows: 0, documents: 0, firstUnclearStates: 0, finalClearStates: 0 };
  let previousEnd = -1; let captureDirectory = index.captureDirectory;
  const workerRelative = 'reports/benchmarks/native-class-ownership/control-precision/pilot/' +
    (expected.mode === policy.captureMode ? 'capture/worker.cjs' : 'worker.cjs');
  const engineRelative = 'reports/benchmarks/native-class-ownership/control-precision/pilot/worker-engine.cjs';
  for (const [ordinal, entry] of index.processes.entries()) {
    const input = inputs[ordinal]; assert.deepEqual(entry.input, input);
    const name = String(input.ordinal).padStart(policy.ordinalPaddingWidth, '0');
    assert.equal(entry.directory, 'workers/' + name);
    if (!entry.complete) { assert.equal(index.complete, false); assert.equal(ordinal, index.processes.length - 1); break; }
    const invocation = entry.invocation; const command = readJSON(ownedPath(root, entry.directory + '/' + processPolicy.commandFile));
    assert.deepEqual(command, invocation.command); assert.equal(command.complete, true);
    assert.equal(command.exitCode, 0); assert.equal(command.signal, null); assert.equal(command.timedOut, false); assert.equal(command.cancelled, false);
    assert.equal(command.failure, undefined); assert.notEqual(command.leftoverProcessGroupDetected, true);
    assert.ok(Number.isSafeInteger(command.pid) && command.pid > 0 && !pids.has(command.pid)); pids.add(command.pid);
    assert.equal(command.cwd, binding.sourceDirectory);
    assert.ok(Number.isFinite(invocation.startMonotonicMs) && invocation.startMonotonicMs > previousEnd);
    assert.ok(Number.isFinite(invocation.endMonotonicMs) && invocation.endMonotonicMs > invocation.startMonotonicMs);
    assert.ok(Number.isFinite(command.elapsedMs) && command.elapsedMs >= 0 && command.elapsedMs <= invocation.endMonotonicMs - invocation.startMonotonicMs);
    previousEnd = invocation.endMonotonicMs;
    const flags = workerArguments(input.factor);
    // Only the private earlier functional profile lacked an explicit captureDirectory; infer it consistently from its original argv.
    if (captureDirectory === undefined) { assert.equal(expected.mode, policy.functionalMode); captureDirectory = path.posix.dirname(command.argv[flags.length + 3]); }
    assert.ok(path.posix.isAbsolute(captureDirectory));
    assert.deepEqual(command.argv, [index.executable, ...flags, path.posix.join(binding.sourceDirectory, workerRelative),
      expected.mode === policy.captureMode ? policy.captureOption : policy.functionalOption,
      path.posix.join(captureDirectory, policy.manifestFile), path.posix.join(captureDirectory, 'inputs', name + '.json'),
      path.posix.join(captureDirectory, entry.directory, policy.workerReportFile)]);
    assert.deepEqual(readJSON(ownedPath(root, 'inputs/' + name + '.json')), input);
    for (const filename of [processPolicy.stdoutFile, processPolicy.stderrFile]) ownedPath(root, entry.directory + '/' + filename);
    const report = readJSON(ownedPath(root, entry.directory + '/' + policy.workerReportFile));
    const context = readJSON(ownedPath(root, entry.directory + '/' + policy.workerReportFile + policy.workerContextSuffix));
    const replay = replayBoundProcess(report, context, manifest, input,
      { mode: expected.mode, node: index.node, pid: command.pid, parentPid: binding.parentPid, hostId: index.hostId,
        startMonotonicMs: invocation.startMonotonicMs, endMonotonicMs: invocation.endMonotonicMs, methodBindingSha256: index.bindingSha256 },
      { parentPid: binding.parentPid, workerSourceSha256: expected.files[workerRelative], workerEngineSourceSha256: expected.files[engineRelative] });
    const tasks = report.blocks.flatMap((block) => block.tasks);
    const taskSpanMs = tasks.at(-1).startMs + tasks.at(-1).durationMs - tasks[0].startMs;
    assert.ok(Number.isFinite(taskSpanMs) && taskSpanMs > 0 && taskSpanMs <= command.elapsedMs,
      'Pilot replay: child task interval exceeds the independently observed invocation');
    const observed = { measured: replay.replay.samplesMs.length, warmup: replay.replay.warmupSamplesMs.length,
      windows: replay.trackedOwners.window, documents: replay.trackedOwners.document, cleanupTrace: replay.cleanupTrace,
      producerBindingsChecked: replay.producerBindingsChecked, analysisObservation: replay.analysisObservation };
    assert.deepEqual(entry.observed, observed);
    const prefix = prefixes.get(input.factor);
    if (prefix === undefined) prefixes.set(input.factor, report.randomProbe); else assert.deepEqual(report.randomProbe, prefix);
    totals.processes += 1;
    for (const field of ['measured', 'warmup', 'windows', 'documents']) totals[field] += observed[field];
    totals.firstUnclearStates += Number(!observed.cleanupTrace[0].clear); totals.finalClearStates += 2;
    if (expected.mode === policy.captureMode) observations.push(replay.analysisObservation);
    else assert.equal(replay.analysisObservation, null);
  }
  if (!index.complete) {
    assert.equal(expected.requireComplete, false, 'Pilot replay: incomplete criterion cannot yield analysis');
    return { complete: false, inventory, totals, analysis: null, sourceBindingChecked: true,
      transportAuthenticationPerformed: false, performanceAccepted: null, gateReevaluated: false };
  }
  assert.equal(index.failure, undefined); assert.equal(index.processes.length, inputs.length); assert.equal(totals.processes, inputs.length);
  const supervisor = verifySupervisor(root, index, binding, expected, manifest);
  assert.deepEqual(index.packageVerificationAfter, index.packageVerification);
  assert.equal(index.parentMemory.length, policy.parentStages.length);
  for (const [ordinal, snapshot] of index.parentMemory.entries()) {
    assert.equal(snapshot.stage, policy.parentStages[ordinal]); assert.equal(snapshot.completedWorkers, ordinal * inputs.length / 2);
    assert.ok(Number.isFinite(snapshot.monotonicMs) && (ordinal === 0 || snapshot.monotonicMs > index.parentMemory[ordinal - 1].monotonicMs));
    assert.ok(Number.isFinite(Date.parse(snapshot.observedAt)));
    for (const field of ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']) assert.ok(Number.isSafeInteger(snapshot.memory[field]) && snapshot.memory[field] >= 0);
    for (const field of ['user', 'system']) assert.ok(Number.isSafeInteger(snapshot.cpu[field]) && snapshot.cpu[field] >= 0);
  }
  assert.ok(index.parentMemory[0].monotonicMs < index.processes[0].invocation.startMonotonicMs);
  assert.ok(index.parentMemory[1].monotonicMs > index.processes[inputs.length / 2 - 1].invocation.endMonotonicMs);
  assert.ok(index.parentMemory[1].monotonicMs < index.processes[inputs.length / 2].invocation.startMonotonicMs);
  assert.ok(index.parentMemory[2].monotonicMs > previousEnd);
  const budget = (expected.mode === policy.captureMode ? policy.captureTimeoutMinutes : policy.functionalTimeoutMinutes) * 60_000;
  assert.equal(index.captureBudgetMs, budget); assert.ok(Number.isFinite(index.elapsedMs) && index.elapsedMs > 0 && index.elapsedMs <= budget);
  assert.ok(Number.isFinite(index.startedMonotonicMs) && index.startedMonotonicMs < index.parentMemory[0].monotonicMs);
  assert.ok(index.elapsedMs >= previousEnd - index.startedMonotonicMs);
  const analysis = expected.mode === policy.captureMode ? analyze(expected.criterionId, observations) : null;
  assert.deepEqual(index.analysis, analysis);
  return { complete: true, criterionId: expected.criterionId, mode: expected.mode, sourceCommit: expected.sourceCommit,
    inventory, totals, parentSnapshots: index.parentMemory, supervisor, analysis, sourceBindingChecked: true,
    transportAuthenticationPerformed: false, performanceAccepted: null, gateReevaluated: false,
    peakMemoryMeasured: false, universalLeakFreedomDemonstrated: false };
}

if (require.main === module) {
  try {
    assert.ok(process.argv.length === 5 || (process.argv.length === 6 && process.argv[5] === '--allow-partial'),
      'Pilot replay: provide data, independent expectation JSON, new result and optional --allow-partial');
    const expected = readJSON(process.argv[3]);
    if (process.argv[5] === '--allow-partial') expected.requireComplete = false;
    const result = verifyCriterion(process.argv[2], expected);
    writeNewJSON(process.argv[4], result);
    process.stdout.write(JSON.stringify({ complete: result.complete, totals: result.totals, performanceAccepted: null }) + '\n');
    if (!result.complete) process.exitCode = 1;
  } catch (error) {
    try {
      if (process.argv.length >= 5 && !fs.existsSync(process.argv[4])) writeNewJSON(process.argv[4],
        { complete: false, verificationFailure: { name: error.name, message: String(error.message).slice(0, worker.maximumFailureCharacters) },
          analysis: null, performanceAccepted: null, gateReevaluated: false });
    } catch (preservationError) {
      process.stderr.write('Pilot replay: rejection result could not be published; existing evidence preserved: ' + preservationError.stack + '\n');
    }
    process.stderr.write(error.stack + '\n'); process.exitCode = 2;
  }
}
module.exports = { verifyCriterion, verifyInventory, verifyManifest, physicalFiles, verifySupervisor };
