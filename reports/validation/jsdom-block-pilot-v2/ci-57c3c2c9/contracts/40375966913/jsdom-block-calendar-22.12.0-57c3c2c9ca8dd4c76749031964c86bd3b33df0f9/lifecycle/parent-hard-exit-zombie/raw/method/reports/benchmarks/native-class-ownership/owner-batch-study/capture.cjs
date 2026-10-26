/** @module owner-batch-capture Runs a single fixed Node part with bounded process ownership, complete raw data and explicit functional/scientific modes. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const policy = require('./constants/capture.json');
const workerPolicy = require('./constants/worker.json');
const sampler = require('./constants/sampler.json');
const model = require('../combined-process-study/model.cjs');
const { workerArguments } = require('./worker.cjs');
const { createManifest } = require('../owner-batch-packages/manifest.cjs');
const { execute } = require('./process.cjs');
const { validateWorker, validateSeedGroups } = require('./results.cjs');
const { collectGarbage } = require('../../../../scripts/memory-endpoint.cjs');
const { snapshot } = require('../combined-process-study/inventory.cjs');
const { failureView } = require('./batches.cjs');
const { filesDigest } = require('./binding.cjs');
const { readJSON, writeJSON, hashFile } = require('./io.cjs');
const source = require('./source.cjs');
const { verifyQualification } = require('./tools/qualification.cjs');
const { verifyFirstCapture } = require('./tools/once.cjs');
const executableHashes = require('../constants/current-ownership.json').runtimeExecutableHashes;

/** @param {'functional'|'capture'} mode - Full fixed capture or its fixed qualification subset. @returns {object[]} Exact tuples; capture has no row/subset option. */
function plan(mode) {
  assert.ok(['functional', 'capture'].includes(mode));
  const full = model.plan(); assert.equal(full.length, 1024);
  const inputs = mode === 'capture' ? full : full.filter((input) => input.phase === workerPolicy.qualificationPhase && input.position === workerPolicy.qualificationPosition);
  assert.equal(inputs.length, mode === 'capture' ? 1024 : 32); assert.equal(inputs.length % 2, 0);
  return inputs;
}

/** @param {'functional'|'capture'} mode - Explicit producer role. @returns {object|null} Actual reviewed hosted context for scientific capture; functional qualification does not enable it. */
function executionContext(mode) {
  assert.ok(['functional', 'capture'].includes(mode));
  if (mode === 'functional') return null;
  assert.equal(policy.executionReady, true, 'Owner batch capture: integral method publication is not enabled');
  assert.equal(workerPolicy.executionReady, true); assert.equal(sampler.executionReady, true);
  assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1');
  assert.equal(process.env.GITHUB_REPOSITORY, policy.repository);
  assert.equal(process.env.GITHUB_WORKFLOW, policy.workflowName); assert.equal(process.env.GITHUB_JOB, policy.jobKey);
  assert.equal(process.env.GITHUB_EVENT_NAME, 'pull_request');
  assert.match(process.env.GITHUB_RUN_ID ?? '', /^[1-9][0-9]*$/);
  assert.equal(typeof process.env.GITHUB_EVENT_PATH, 'string', 'Owner batch capture: GITHUB_EVENT_PATH is required');
  const event = readJSON(process.env.GITHUB_EVENT_PATH);
  assert.equal(event.label.name, policy.label); assert.equal(event.pull_request.number, 80);
  assert.equal(event.pull_request.head.repo.full_name, policy.repository);
  return { repository: process.env.GITHUB_REPOSITORY, workflow: process.env.GITHUB_WORKFLOW,
    runId: process.env.GITHUB_RUN_ID, attempt: 1, jobKey: process.env.GITHUB_JOB,
    pullRequest: event.pull_request.number, label: event.label.name, eventHead: event.pull_request.head.sha };
}

/** @param {string} stage - Fixed snapshot position. @param {number} completedWorkers - Actual terminal successful count. @returns {Promise<object>} Parent snapshots are endpoints, never inferred peaks. */
async function parentSnapshot(stage, completedWorkers) {
  await collectGarbage();
  return { stage, completedWorkers, pid: process.pid, observedAt: new Date().toISOString(),
    monotonicMs: performance.now(), memory: process.memoryUsage(), cpu: process.cpuUsage() };
}

/** @param {string} directory - One worker data directory. @returns {object} Complete independent file inventory, including failure logs. */
function processFiles(directory) {
  const files = {};
  for (const name of fs.readdirSync(directory).sort()) {
    const filename = path.join(directory, name); const status = fs.lstatSync(filename);
    assert.ok(status.isFile() && status.nlink === 1, 'Owner batch capture: regular independent process data required');
    files[name] = { bytes: status.size, sha256: hashFile(filename) };
  }
  return files;
}

/**
 * Execute one SDK part once, stopping at the first error and preserving partials. No numerical acceptance occurs here.
 * @param {'functional'|'capture'} mode - Fixed mode, never inferred from archived data.
 * @param {string} prepared - Independently extracted authenticated package.
 * @param {string} destination - New disjoint capture directory, outside the source checkout and package.
 * @returns {Promise<object>} Producer index; scientific acceptance requires both externally authenticated parts and integral replay.
 */
async function run(mode, prepared, destination) {
  const hosted = executionContext(mode);
  assert.equal(process.platform, 'linux'); assert.equal(typeof global.gc, 'function');
  assert.equal(Object.hasOwn(process.env, 'NODE_OPTIONS'), false);
  assert.ok(Object.hasOwn(executableHashes, process.version));
  assert.equal(hashFile(process.execPath, policy.maximumExecutableBytes, false), executableHashes[process.version]);
  assert.equal(policy.jobTimeoutMinutes, policy.setupBudgetMinutes + policy.captureTimeoutMinutes +
    policy.archiveBudgetMinutes + policy.uploadBudgetMinutes + policy.jobMarginMinutes);
  prepared = fs.realpathSync(prepared);
  destination = path.join(fs.realpathSync(path.dirname(path.resolve(destination))), path.basename(destination));
  assert.equal(fs.existsSync(destination), false, 'Owner batch capture: preserve previous capture');
  for (const root of [prepared, source.repository]) assert.ok(destination !== root && !destination.startsWith(root + path.sep) && !root.startsWith(destination + path.sep));
  if (mode === 'capture') {
    const disk = fs.statfsSync(path.dirname(destination));
    assert.ok(disk.bavail * disk.bsize >= policy.minimumCaptureFreeBytes, 'Owner batch capture: insufficient room to preserve raw data and a partial archive');
  }
  fs.mkdirSync(destination);
  const index = { revision: policy.revision, mode, purpose: mode === 'capture' ? policy.purpose : policy.functionalPurpose,
    complete: false, functionalOnly: mode === 'functional', performanceAccepted: null, gateReevaluated: false,
    captureDirectory: destination, preparedDirectory: prepared, sourceDirectory: source.repository,
    hosted, startedAt: new Date().toISOString(), runtime: { executable: process.execPath, node: process.version,
      executableSha256: executableHashes[process.version], versions: process.versions },
    parentPid: process.pid, parentWorkingDirectory: process.cwd(), machine: { platform: process.platform, arch: process.arch, release: os.release(),
      cpus: os.cpus(), totalMemory: os.totalmem() }, processes: [], parentMemory: [] };
  const save = () => writeJSON(path.join(destination, policy.indexFile), index);
  save();
  const cancellation = new AbortController();
  const interrupt = (signal) => { index.interruptedBy = signal; cancellation.abort(signal); };
  const onTerminate = () => interrupt('SIGTERM'); const onInterrupt = () => interrupt('SIGINT');
  process.once('SIGTERM', onTerminate); process.once('SIGINT', onInterrupt);
  let failed = false; let originalFailure;
  try {
    const checked = source.producer(mode === 'capture');
    Object.assign(index, { sourceCommit: checked.sourceCommit, sourceChangesRaw: checked.sourceChangesRaw,
      sourceGitErrors: checked.sourceGitErrors, sourceFiles: checked.files });
    if (hosted) assert.equal(hosted.eventHead, checked.sourceCommit);
    if (mode === 'capture') {
      const filename = process.env[policy.qualificationEnvironment];
      assert.equal(typeof filename, 'string', 'Owner batch capture: exact-source CI qualification is required');
      const qualification = readJSON(filename);
      index.sourceQualification = verifyQualification(checked.sourceCommit, qualification.run, qualification.jobs);
      const copied = path.join(destination, policy.qualificationFile);
      fs.copyFileSync(filename, copied, fs.constants.COPYFILE_EXCL);
      index.sourceQualificationSha256 = hashFile(copied);
      const consumedFile = process.env[policy.consumptionEnvironment];
      assert.equal(typeof consumedFile, 'string', 'Owner batch capture: one-time history proof is required');
      const consumed = readJSON(consumedFile); assert.equal(consumed.probeOnly, false);
      index.sourceConsumption = verifyFirstCapture(checked.sourceCommit, Number(hosted.runId), consumed.current, consumed.pages, consumed.firstJobs);
      const consumedCopy = path.join(destination, policy.consumptionFile);
      fs.copyFileSync(consumedFile, consumedCopy, fs.constants.COPYFILE_EXCL);
      index.sourceConsumptionSha256 = hashFile(consumedCopy);
    }
    if (checked.publication) {
      index.publicationSha256 = hashFile(path.join(source.repository, policy.publication));
      fs.copyFileSync(path.join(source.repository, policy.publication), path.join(destination, 'publication.json'), fs.constants.COPYFILE_EXCL);
    }
    index.publishedReferences = {};
    for (const [name, expected] of Object.entries(checked.files)) {
      const role = source.snapshotRole(name);
      if (role === 'published-reference') { index.publishedReferences[name] = { sha256: expected, bytes: fs.statSync(path.join(source.repository, name)).size }; continue; }
      if (role === 'embedded-package') continue;
      const target = path.join(destination, policy.snapshotDirectory, name); fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(source.repository, name), target, fs.constants.COPYFILE_EXCL); assert.equal(hashFile(target), expected);
    }
    const packageArchive = path.join(source.repository, policy.packageArchive);
    assert.equal(hashFile(packageArchive), policy.packageArchiveSha256);
    const packageSnapshot = path.join(destination, policy.packageSnapshot); fs.mkdirSync(path.dirname(packageSnapshot), { recursive: true });
    fs.copyFileSync(packageArchive, packageSnapshot, fs.constants.COPYFILE_EXCL);
    const verification = spawnSync('python3', ['-B', path.join(source.repository, 'reports/benchmarks/native-class-ownership/owner-batch-packages/assemble.py'),
      '--verify', prepared, path.join(source.repository, policy.collection), process.execPath],
    { encoding: 'utf8', timeout: policy.maximumMetadataCommandMs, maxBuffer: policy.maximumMetadataOutputBytes });
    fs.writeFileSync(path.join(destination, 'package-verification.stdout.log'), verification.stdout ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(destination, 'package-verification.stderr.log'), verification.stderr ?? '', { flag: 'wx' });
    assert.ifError(verification.error); assert.equal(verification.status, 0, verification.stderr);
    index.packageVerification = JSON.parse(verification.stdout);
    const discovered = createManifest(prepared);
    const binding = { revision: policy.revision, mode, sourceDirectory: source.repository, sourceCommit: checked.sourceCommit,
      sourceFilesDigest: filesDigest(checked.files), parentPid: process.pid, node: process.version, hosted,
      publicationSha256: index.publicationSha256 ?? null, performanceAccepted: null, gateReevaluated: false };
    const bindingFile = path.join(destination, policy.bindingFile); writeJSON(bindingFile, binding);
    index.methodBinding = binding; index.methodBindingSha256 = hashFile(bindingFile);
    const manifest = { copies: discovered.copies, distributions: discovered.distributions,
      packageArchiveSha256: policy.packageArchiveSha256, selectedArtifactId: workerPolicy.selectedArtifactId,
      purpose: 'authenticated-worker-inputs', runtimeExecuted: false, performanceAccepted: null, gateReevaluated: false };
    writeJSON(path.join(destination, policy.manifestFile), manifest); index.manifest = manifest;
    const inputs = plan(mode); const seedGroups = [];
    fs.mkdirSync(path.join(destination, 'workers'));
    if (mode === 'capture') {
      const started = Number(process.env[policy.jobStartedUptimeEnvironment]);
      assert.ok(Number.isFinite(started) && started > 0, 'Owner batch capture: actual job-start uptime is required');
      index.setupElapsedSeconds = os.uptime() - started;
      assert.ok(index.setupElapsedSeconds >= 0 && index.setupElapsedSeconds <= policy.setupBudgetMinutes * 60,
        'Owner batch capture: setup consumed the reserved archive/upload budget before any worker');
    }
    index.parentMemory.push(await parentSnapshot(policy.parentStages[0], 0)); save();
    const budgetMs = (mode === 'capture' ? policy.captureTimeoutMinutes : policy.functionalTimeoutMinutes) * 60000;
    const start = performance.now(); index.captureBudgetMs = budgetMs;
    for (const [position, input] of inputs.entries()) {
      const remainingMs = Math.floor(budgetMs - (performance.now() - start));
      assert.ok(remainingMs > 0, 'Owner batch capture: fixed collection deadline reached; preserve partials, never retry');
      const relative = 'workers/' + String(position).padStart(4, '0'); const directory = path.join(destination, relative);
      const argv = [process.execPath, ...workerArguments(input.position), path.join(source.repository, policy.workerFile),
        ...(mode === 'functional' ? [workerPolicy.functionalOption] : []), path.join(destination, policy.manifestFile),
        input.phase, input.engine, String(input.position), input.label, path.join(directory, 'report.json'), String(input.rowIndex)];
      const entry = { input, directory: relative, argv, complete: false }; index.processes.push(entry); save();
      try {
        entry.command = await execute(argv, directory, { timeoutMs: Math.min(policy.workerTimeoutMs, remainingMs), signal: cancellation.signal,
          cwd: source.repository, environment: { ...process.env, [policy.bindingEnvironment]: bindingFile } });
        assert.equal(entry.command.exitCode, 0, 'Owner batch capture: worker failed; no retry');
        assert.equal(entry.command.timedOut, false); assert.equal(entry.command.cancelled, false);
        assert.notEqual(entry.command.leftoverProcessGroupDetected, true);
        const report = readJSON(path.join(directory, 'report.json'));
        const result = validateWorker(report, manifest, input, { pid: entry.command.pid, node: process.version, mode,
          methodBindingSha256: index.methodBindingSha256, parentPid: process.pid });
        entry.observed = { measuredDurations: result.samplesMs.length, warmupDurations: result.warmupSamplesMs.length,
          windows: result.observedWindows, documents: result.observedDocuments, processMeanMs: result.processMeanMs, blockMeans: result.blockMeans };
        seedGroups.push({ ...input, observation: { randomProbe: report.randomProbe } });
        entry.complete = true;
        process.stdout.write(JSON.stringify({ node: process.version, sequenceIndex: position, completedWorkers: position + 1,
          ...input, pid: entry.command.pid, exitCode: entry.command.exitCode, elapsedCaptureMs: performance.now() - start }) + '\n');
      } finally { if (fs.existsSync(directory)) entry.files = processFiles(directory); save(); }
      if (position + 1 === inputs.length / 2) { index.parentMemory.push(await parentSnapshot(policy.parentStages[1], position + 1)); save(); }
    }
    index.captureElapsedMs = performance.now() - start;
    assert.ok(index.captureElapsedMs <= budgetMs, 'Owner batch capture: complete sequence exceeded fixed collection deadline');
    validateSeedGroups(seedGroups);
    index.parentMemory.push(await parentSnapshot(policy.parentStages[2], inputs.length));
    assert.deepEqual(source.gitIdentity(), { sourceCommit: checked.sourceCommit, sourceChangesRaw: checked.sourceChangesRaw, sourceGitErrors: checked.sourceGitErrors });
    assert.deepEqual(source.currentFiles().files, readJSON(path.join(source.repository, policy.catalog)).files);
    index.complete = true;
  } catch (error) { failed = true; originalFailure = error; index.failure = failureView(error); }
  finally {
    process.removeListener('SIGTERM', onTerminate); process.removeListener('SIGINT', onInterrupt);
    index.finishedAt = new Date().toISOString();
    try { writeJSON(path.join(destination, policy.inventoryFile), snapshot(destination)); index.inventorySha256 = hashFile(path.join(destination, policy.inventoryFile)); }
    catch (error) { index.inventoryFailure = failureView(error); if (!failed) { failed = true; originalFailure = error; } }
    if (failed) index.complete = false;
    save();
  }
  if (failed) throw originalFailure;
  return index;
}

if (require.main === module) {
  const [operation, prepared, destination] = process.argv.slice(2);
  if (!['--functional', '--capture'].includes(operation) || process.argv.length !== 5) {
    process.stderr.write('Provide --functional or --capture, authenticated package and new output directory\n'); process.exitCode = policy.failureExitCode;
  } else run(operation === '--functional' ? 'functional' : 'capture', prepared, destination).catch((error) => {
    process.stderr.write(JSON.stringify(failureView(error)) + '\n'); process.exitCode = policy.failureExitCode;
  });
}
module.exports = { plan, executionContext, parentSnapshot, processFiles, run };
