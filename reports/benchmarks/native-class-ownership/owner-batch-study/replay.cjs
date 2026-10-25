/** @module owner-batch-replay Reads all raw processes with current code; numerical completeness remains separate from external artifact authentication. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const policy = require('./constants/capture.json');
const sampler = require('./constants/sampler.json');
const workerPolicy = require('./constants/worker.json');
const model = require('../combined-process-study/model.cjs');
const { workerArguments } = require('./worker.cjs');
const { plan } = require('./capture.cjs');
const { validateWorker, validateSeedGroups } = require('./results.cjs');
const { compare } = require('./compare.cjs');
const { validate: validateBinding, filesDigest } = require('./binding.cjs');
const { snapshot } = require('../combined-process-study/inventory.cjs');
const { readJSON, writeNewJSON, hashFile } = require('./io.cjs');
const { failureView } = require('./batches.cjs');
const source = require('./source.cjs');
const executableHashes = require('../constants/current-ownership.json').runtimeExecutableHashes;

/** @param {object[]} snapshots - Three actual parent endpoints. @param {number} workers - Complete fixed part count. @param {number} parentPid - Observed parent. @returns {void} Verify positions, types and actual process identity, without deriving peak memory. */
function verifyParent(snapshots, workers, parentPid) {
  assert.deepEqual(snapshots.map((entry) => entry.stage), policy.parentStages);
  assert.deepEqual(snapshots.map((entry) => entry.completedWorkers), [0, workers / 2, workers]);
  let previous = 0;
  for (const entry of snapshots) {
    assert.equal(entry.pid, parentPid); assert.ok(Number.isFinite(entry.monotonicMs) && entry.monotonicMs >= previous);
    previous = entry.monotonicMs;
    for (const name of ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']) assert.ok(Number.isSafeInteger(entry.memory[name]) && entry.memory[name] >= 0);
    for (const name of ['user', 'system']) assert.ok(Number.isSafeInteger(entry.cpu[name]) && entry.cpu[name] >= 0);
  }
}

/** @param {string} directory - Current data extraction, never a code module root. @param {'functional'|'capture'} mode - Explicit reader role. @returns {object} All scalar process observations; acceptance stays null. */
function verifyPart(directory, mode = 'capture') {
  assert.ok(['functional', 'capture'].includes(mode));
  assert.equal(process.platform, 'linux');
  assert.equal(hashFile(process.execPath, policy.maximumExecutableBytes, false), executableHashes[process.version]);
  const root = fs.realpathSync(directory); const index = readJSON(path.join(root, policy.indexFile));
  assert.equal(index.revision, policy.revision); assert.equal(index.mode, mode);
  assert.equal(index.purpose, mode === 'capture' ? policy.purpose : policy.functionalPurpose);
  assert.equal(index.functionalOnly, mode === 'functional'); assert.equal(index.complete, true);
  assert.equal(index.failure, undefined); assert.equal(index.inventoryFailure, undefined); assert.equal(index.interruptedBy, undefined);
  assert.equal(index.performanceAccepted, null); assert.equal(index.gateReevaluated, false);
  assert.ok(Object.hasOwn(executableHashes, index.runtime.node));
  assert.equal(index.runtime.executableSha256, executableHashes[index.runtime.node]);
  assert.equal(index.runtime.versions.node, index.runtime.node.slice(1));
  for (const name of ['captureDirectory', 'preparedDirectory', 'sourceDirectory']) {
    assert.ok(path.posix.isAbsolute(index[name]) && path.posix.normalize(index[name]) === index[name]);
  }
  assert.match(index.sourceCommit, /^[a-f0-9]{40}$/); assert.equal(typeof index.sourceChangesRaw, 'string');
  assert.deepEqual(index.sourceGitErrors, []);
  let files;
  if (mode === 'capture') {
    assert.equal(policy.executionReady, true); assert.equal(index.sourceChangesRaw, '');
    const publication = readJSON(path.join(source.repository, policy.publication));
    assert.equal(publication.revision, policy.revision); assert.equal(publication.executionReady, true);
    assert.equal(publication.actionableFindings, 0); files = publication.files;
    assert.equal(hashFile(path.join(root, 'publication.json')), hashFile(path.join(source.repository, policy.publication)));
    assert.equal(index.publicationSha256, hashFile(path.join(root, 'publication.json')));
    assert.deepEqual(readJSON(path.join(root, 'publication.json')), publication);
    assert.equal(index.hosted.eventHead, index.sourceCommit);
    assert.ok(Number.isFinite(index.setupElapsedSeconds) && index.setupElapsedSeconds >= 0 && index.setupElapsedSeconds <= policy.setupBudgetMinutes * 60);
  } else {
    const declared = readJSON(path.join(source.repository, policy.catalog));
    files = { ...declared.files, [policy.catalog]: hashFile(path.join(source.repository, policy.catalog)) };
    if (!isDeepStrictEqual(index.sourceFiles, files)) {
      const references = readJSON(path.join(source.repository, policy.functionalReferences));
      const matched = references.profiles.find((entry) => entry.indexSha256 === hashFile(path.join(root, policy.indexFile)));
      assert.ok(matched, 'Owner batch replay: original functional producer is not independently pinned');
      assert.equal(matched.sourceCommit, index.sourceCommit); assert.equal(matched.sourceFilesDigest, filesDigest(index.sourceFiles));
      files = index.sourceFiles;
    }
    assert.equal(index.publicationSha256, undefined); assert.equal(index.hosted, null);
  }
  assert.deepEqual(index.sourceFiles, files);
  source.verifySnapshot(root, files);
  const references = Object.fromEntries(Object.entries(files).filter(([name]) => source.snapshotRole(name) === 'published-reference')
    .map(([name, sha256]) => [name, { sha256, bytes: fs.statSync(path.join(source.repository, name)).size }]));
  assert.deepEqual(index.publishedReferences, references);
  assert.equal(hashFile(path.join(root, policy.packageSnapshot)), policy.packageArchiveSha256);
  const manifest = readJSON(path.join(root, policy.manifestFile)); assert.deepEqual(index.manifest, manifest);
  assert.equal(manifest.packageArchiveSha256, policy.packageArchiveSha256); assert.equal(manifest.runtimeExecuted, false);
  assert.equal(manifest.selectedArtifactId, workerPolicy.selectedArtifactId);
  for (const [physical, expected] of Object.entries(workerPolicy.distributions)) assert.equal(manifest.distributions[physical].sha256, expected);
  assert.equal(index.packageVerification.verified, true); assert.equal(index.packageVerification.artifactId, workerPolicy.selectedArtifactId);
  assert.equal(index.packageVerification.binarySha256, workerPolicy.selectedBinarySha256);
  assert.equal(index.packageVerification.runtimeExecuted, false); assert.equal(index.packageVerification.benchmarkExecuted, false);
  assert.equal(index.packageVerification.performanceAccepted, null);
  const binding = readJSON(path.join(root, policy.bindingFile));
  assert.deepEqual(binding, index.methodBinding); assert.equal(hashFile(path.join(root, policy.bindingFile)), index.methodBindingSha256);
  validateBinding(binding, { mode, sourceDirectory: index.sourceDirectory, sourceCommit: index.sourceCommit,
    parentPid: index.parentPid, node: index.runtime.node, files });
  const inputs = plan(mode); assert.equal(index.processes.length, inputs.length);
  const entries = []; const seeds = []; const pids = new Set();
  let measured = 0; let warmup = 0; let windows = 0; let documents = 0;
  for (const [position, input] of inputs.entries()) {
    const entry = index.processes[position]; assert.deepEqual(entry.input, input); assert.equal(entry.complete, true);
    assert.equal(entry.directory, 'workers/' + String(position).padStart(4, '0'));
    const directory = path.join(root, entry.directory); const originalDirectory = path.posix.join(index.captureDirectory, entry.directory);
    const argv = [index.runtime.executable, ...workerArguments(input.position), path.posix.join(index.sourceDirectory, policy.workerFile),
      ...(mode === 'functional' ? [workerPolicy.functionalOption] : []), path.posix.join(index.captureDirectory, policy.manifestFile),
      input.phase, input.engine, String(input.position), input.label, path.posix.join(originalDirectory, 'report.json'), String(input.rowIndex)];
    assert.deepEqual(entry.argv, argv);
    assert.deepEqual(readJSON(path.join(directory, 'command.json')), entry.command);
    assert.deepEqual(entry.command.argv, argv); assert.equal(entry.command.complete, true);
    assert.equal(entry.command.cwd, index.sourceDirectory);
    assert.equal(entry.command.exitCode, 0); assert.equal(entry.command.signal, null);
    assert.equal(entry.command.timedOut, false); assert.equal(entry.command.cancelled, false);
    assert.notEqual(entry.command.leftoverProcessGroupDetected, true);
    assert.equal(entry.command.processGroupTerminationAttempted, false);
    assert.ok(Number.isSafeInteger(entry.command.pid) && entry.command.pid > 0 && !pids.has(entry.command.pid)); pids.add(entry.command.pid);
    assert.deepEqual(fs.readdirSync(directory).sort(), Object.keys(entry.files).sort());
    assert.deepEqual(Object.keys(entry.files).sort(), ['command.json', 'report.json', 'stderr.log', 'stdout.log']);
    for (const [name, member] of Object.entries(entry.files)) {
      assert.equal(hashFile(path.join(directory, name)), member.sha256); assert.equal(fs.statSync(path.join(directory, name)).size, member.bytes);
    }
    const report = readJSON(path.join(directory, 'report.json'));
    assert.equal(report.v8, index.runtime.versions.v8);
    const observation = validateWorker(report, manifest, input, { mode, pid: entry.command.pid, node: index.runtime.node,
      methodBindingSha256: index.methodBindingSha256, parentPid: index.parentPid });
    assert.deepEqual(entry.observed, { measuredDurations: observation.samplesMs.length, warmupDurations: observation.warmupSamplesMs.length,
      windows: observation.observedWindows, documents: observation.observedDocuments, processMeanMs: observation.processMeanMs, blockMeans: observation.blockMeans });
    measured += observation.samplesMs.length; warmup += observation.warmupSamplesMs.length;
    windows += observation.observedWindows; documents += observation.observedDocuments;
    entries.push({ ...input, observation }); seeds.push({ ...input, observation: { randomProbe: report.randomProbe } });
  }
  validateSeedGroups(seeds);
  assert.equal(measured, inputs.length * sampler.logicalTasksPerBlock * sampler.measuredBlocksPerProcess);
  assert.equal(warmup, inputs.length * sampler.logicalTasksPerBlock * sampler.warmupBlocksPerProcess);
  assert.equal(windows, inputs.length * (sampler.warmupBlocksPerProcess + sampler.measuredBlocksPerProcess)); assert.equal(documents, windows);
  const budget = (mode === 'capture' ? policy.captureTimeoutMinutes : policy.functionalTimeoutMinutes) * 60000;
  assert.equal(index.captureBudgetMs, budget); assert.ok(Number.isFinite(index.captureElapsedMs) && index.captureElapsedMs > 0 && index.captureElapsedMs <= budget);
  verifyParent(index.parentMemory, inputs.length, index.parentPid);
  assert.equal(hashFile(path.join(root, policy.inventoryFile)), index.inventorySha256);
  assert.deepEqual(readJSON(path.join(root, policy.inventoryFile)), snapshot(root));
  const readerIdentity = source.gitIdentity(); assert.deepEqual(readerIdentity.sourceGitErrors, []);
  return { verified: true, payloadComplete: true, mode, functionalOnly: mode === 'functional', revision: policy.revision,
    sourceCommit: index.sourceCommit, sourceChangesRaw: index.sourceChangesRaw, sourceGitErrors: index.sourceGitErrors,
    hosted: index.hosted, methodBinding: binding, methodBindingSha256: index.methodBindingSha256,
    publicationSha256: index.publicationSha256 ?? null, sourceFiles: files, runtime: index.runtime,
    readerIdentity, readerSourceFiles: source.readerFiles(), processes: inputs.length, measuredDurations: measured, warmupDurations: warmup,
    windows, documents, parentSnapshots: index.parentMemory.length, entries,
    captureAuthenticated: false, performanceAccepted: null, gateReevaluated: false };
}

/** @param {object[]} parts - Two complete payload-verification results in SDK order. @returns {object} All 64 numerical criteria; external artifact authentication is still mandatory. */
function combine(parts) {
  assert.deepEqual(parts.map((part) => part.runtime.node), model.settings.nodeVersions);
  for (const part of parts) { assert.equal(part.verified, true); assert.equal(part.payloadComplete, true); assert.equal(part.mode, 'capture'); assert.equal(part.processes, 1024); }
  for (const field of ['sourceCommit', 'sourceChangesRaw', 'sourceGitErrors', 'hosted', 'publicationSha256', 'sourceFiles']) assert.deepEqual(parts[0][field], parts[1][field]);
  const comparison = compare(parts.map((part) => ({ node: part.runtime.node, entries: part.entries })));
  return { revision: policy.revision, processes: parts.reduce((sum, part) => sum + part.processes, 0),
    measuredDurations: parts.reduce((sum, part) => sum + part.measuredDurations, 0),
    warmupDurations: parts.reduce((sum, part) => sum + part.warmupDurations, 0),
    windows: parts.reduce((sum, part) => sum + part.windows, 0), documents: parts.reduce((sum, part) => sum + part.documents, 0),
    parentSnapshots: parts.reduce((sum, part) => sum + part.parentSnapshots, 0), comparison,
    captureAuthenticated: false, performanceAccepted: null, gateReevaluated: false };
}
module.exports = { verifyParent, verifyPart, combine };

if (require.main === module) {
  try {
    const [operation, ...args] = process.argv.slice(2);
    let result; let output; let roots;
    if (['--verify', '--functional'].includes(operation)) {
      assert.equal(args.length, 2, 'Provide input capture and new external output file');
      [roots, output] = [[args[0]], args[1]];
      result = verifyPart(args[0], operation === '--functional' ? 'functional' : 'capture');
    } else {
      assert.equal(operation, '--combine'); assert.equal(args.length, 3, 'Provide Node22 part, Node24 part and new external output');
      roots = args.slice(0, 2); output = args[2]; result = combine(roots.map((root) => verifyPart(root, 'capture')));
    }
    output = path.join(fs.realpathSync(path.dirname(path.resolve(output))), path.basename(output));
    assert.equal(fs.existsSync(output), false, 'Owner batch replay: preserve existing verification');
    for (const input of [...roots.map((root) => fs.realpathSync(root)), source.repository]) assert.ok(output !== input && !output.startsWith(input + path.sep),
      'Owner batch replay: write verification outside source and immutable capture');
    writeNewJSON(output, result);
    process.stdout.write(JSON.stringify({ verified: true, processes: result.processes, measuredDurations: result.measuredDurations,
      warmupDurations: result.warmupDurations, captureAuthenticated: false, performanceAccepted: null }) + '\n');
  } catch (error) { process.stderr.write(JSON.stringify(failureView(error)) + '\n'); process.exitCode = policy.failureExitCode; }
}
