/** @module confirmation-invocation-binding Binds each fresh worker to its actual parent, SDK, calendar and current source without self-authenticating transport. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { schedule } = require('./calendar.cjs');
const { ownedFile, filesDigest } = require('./source.cjs');
const { gitIdentity } = require('../owner-batch-study/source.cjs');
const { readJSON, hashFile } = require('../owner-batch-study/io.cjs');
const policy = require('./constants/capture.json');
const sourcePolicy = require('./constants/source.json');
const worker = require('./constants/worker.json');
const design = require('./constants/design.json');
const repository = path.resolve(__dirname, '../../../..');

/** @param {string} mode - Independently selected parent/child mode. @returns {void} Reject unreviewed capture before reading a binding or loading DOM. */
function requireMode(mode) {
  assert.ok(policy.modes.includes(mode), 'Confirmation binding: unsupported invocation mode');
  if (mode === policy.captureMode) {
    assert.equal(design.executionReady, true, 'Confirmation binding: scientific method is not published');
    assert.equal(policy.executionReady, true, 'Confirmation binding: scientific worker is not published');
  }
}

/**
 * Compare untrusted decoded declarations against independent parent/reader observations.
 * @param {object} binding - Original method-binding data.
 * @param {object} expected - Caller-owned mode, PID, SDK, source, manifest and criterion observations.
 * @returns {void} Validated metadata only; source/transport authentication remains the caller's responsibility.
 */
function validateBinding(binding, expected) {
  requireMode(expected.mode);
  assert.ok(binding && typeof binding === 'object' && !Array.isArray(binding));
  assert.equal(binding.revision, policy.revision); assert.equal(binding.mode, expected.mode);
  assert.equal(binding.parentPid, expected.parentPid); assert.ok(Number.isSafeInteger(binding.parentPid) && binding.parentPid > 0);
  assert.equal(binding.node, expected.node); assert.ok(Object.hasOwn(design.nodeExecutableSha256, binding.node));
  assert.equal(binding.nodeExecutable, expected.nodeExecutable);
  assert.equal(binding.nodeExecutableSha256, design.nodeExecutableSha256[binding.node]);
  assert.equal(binding.sourceDirectory, expected.sourceDirectory); assert.equal(binding.sourceCommit, expected.sourceCommit);
  assert.match(binding.sourceCommit, new RegExp(sourcePolicy.gitCommitPattern));
  assert.equal(binding.sourceChangesRaw, expected.sourceChangesRaw); assert.deepEqual(binding.sourceGitErrors, []);
  assert.equal(binding.sourceFilesDigest, filesDigest(expected.files)); assert.deepEqual(binding.sourceFiles, expected.files);
  assert.equal(binding.manifestPath, expected.manifestPath); assert.equal(binding.manifestSha256, expected.manifestSha256);
  assert.match(binding.manifestSha256, new RegExp(policy.sha256Pattern));
  assert.equal(binding.criterionId, expected.criterionId);
  const planned = schedule(binding.criterionId); assert.equal(planned.node, binding.node);
  const inputs = expected.mode === policy.captureMode ? planned.processes : planned.processes.filter((input) => input.block < policy.functionalBlocks);
  assert.equal(binding.plannedProcesses, inputs.length);
  assert.equal(typeof binding.hostId, 'string'); assert.ok(binding.hostId.length > 0); assert.equal(binding.hostId, expected.hostId);
  assert.equal(binding.selectedPackageArtifact, design.selectedPackageArtifact);
  assert.equal(binding.selectedNativeBinarySha256, design.selectedNativeBinarySha256);
  assert.equal(binding.performanceAccepted, null); assert.equal(binding.gateReevaluated, false);
  if (expected.mode === policy.functionalMode) {
    assert.equal(binding.publicationSha256, null); assert.equal(binding.hosted, null); assert.equal(binding.consumptionSha256, null);
  } else {
    assert.equal(binding.sourceChangesRaw, '');
    assert.equal(binding.publicationSha256, expected.publicationSha256);
    assert.equal(binding.consumptionSha256, expected.consumptionSha256);
    for (const value of [binding.publicationSha256, binding.consumptionSha256]) assert.match(value, new RegExp(policy.sha256Pattern));
    assert.deepEqual(binding.hosted, expected.hosted);
    assert.equal(binding.hosted.repository, policy.repository); assert.equal(binding.hosted.workflow, policy.workflowName);
    assert.equal(binding.hosted.jobKey, policy.jobKey); assert.equal(binding.hosted.attempt, 1);
    assert.equal(binding.hosted.pullRequest, policy.pullRequest); assert.equal(binding.hosted.label, policy.label);
    assert.equal(binding.hosted.eventHead, binding.sourceCommit); assert.match(binding.hosted.runId, new RegExp(policy.positiveDecimalPattern));
  }
}

/**
 * Construct one parent-owned immutable declaration from an independently verified live source and manifest.
 * @param {object} source - Current profile plus independently checked scientific publication when applicable.
 * @param {string} criterionId - Exact full-calendar criterion.
 * @param {string} manifestPath - Physical parent-owned manifest.
 * @param {string} hostId - Parent-owned single-host criterion nonce; not an agent or memory identity.
 * @param {string} mode - Functional or published scientific invocation.
 * @returns {object} Data to publish exclusively before starting any worker.
 */
function createBinding(source, criterionId, manifestPath, hostId, mode) {
  requireMode(mode);
  assert.equal(source.profile.profiledSourceDirectory, repository, 'Confirmation binding: execute the producer from its actual profiled native Git root');
  assert.equal(source.profile.productionCompilerInputs.matchesSelectedCompilerInputs, true);
  const identity = gitIdentity(repository);
  assert.deepEqual(identity, { sourceCommit: source.profile.sourceCommit, sourceChangesRaw: source.profile.sourceChangesRaw, sourceGitErrors: source.profile.sourceGitErrors });
  const manifest = readJSON(manifestPath);
  assert.equal(manifest.functionalOnly, mode === policy.functionalMode);
  assert.equal(manifest.numericPackageVerifiedByParent, true); assert.equal(manifest.selectedArtifactId, design.selectedPackageArtifact);
  assert.equal(manifest.archiveSha256, design.selectedPackageArchiveSha256); assert.equal(manifest.nativeBinarySha256, design.selectedNativeBinarySha256);
  const binding = { revision: policy.revision, mode, parentPid: process.pid, node: process.version,
    nodeExecutable: fs.realpathSync(process.execPath), nodeExecutableSha256: hashFile(process.execPath, worker.maximumExecutableBytes, false),
    sourceDirectory: repository, ...identity, sourceFiles: source.files, sourceFilesDigest: filesDigest(source.files),
    manifestPath: fs.realpathSync(manifestPath), manifestSha256: hashFile(manifestPath), criterionId, hostId,
    plannedProcesses: schedule(criterionId).processes.filter((input) => mode === policy.captureMode || input.block < policy.functionalBlocks).length,
    selectedPackageArtifact: design.selectedPackageArtifact, selectedNativeBinarySha256: design.selectedNativeBinarySha256,
    publicationSha256: source.publicationSha256, hosted: source.hosted, consumptionSha256: source.consumptionSha256,
    performanceAccepted: null, gateReevaluated: false };
  assert.equal(binding.nodeExecutableSha256, design.nodeExecutableSha256[process.version]);
  validateBinding(binding, { ...binding, files: source.files });
  return binding;
}

/**
 * Check the actual child invocation against the independently supplied binding digest and parent observations.
 * @param {string} mode - Explicit worker role, never inferred from JSON.
 * @param {string} manifestPath - Actual manifest argument.
 * @param {object} input - Actual calendar input already decoded by the worker.
 * @returns {object} Exact binding identity for raw report/sidecar; no acceptance.
 */
function childBinding(mode, manifestPath, input) {
  requireMode(mode);
  const filename = process.env[policy.bindingEnvironment]; const expectedDigest = process.env[policy.bindingDigestEnvironment];
  assert.equal(typeof filename, 'string', 'Confirmation binding: bound worker requires a parent binding');
  assert.match(expectedDigest ?? '', new RegExp(policy.sha256Pattern));
  assert.equal(hashFile(filename), expectedDigest, 'Confirmation binding: parent binding bytes changed');
  const binding = readJSON(filename); const identity = gitIdentity(repository); assert.deepEqual(identity.sourceGitErrors, []);
  const expected = { mode, parentPid: process.ppid, node: process.version, nodeExecutable: fs.realpathSync(process.execPath),
    sourceDirectory: repository, ...identity, files: binding.sourceFiles, manifestPath: fs.realpathSync(manifestPath),
    manifestSha256: hashFile(manifestPath), criterionId: [input.node, input.phase, input.engine, input.row].join('/'),
    hostId: binding.hostId, publicationSha256: binding.publicationSha256,
    consumptionSha256: process.env[policy.consumptionDigestEnvironment], hosted: binding.hosted };
  validateBinding(binding, expected);
  assert.equal(hashFile(process.execPath, worker.maximumExecutableBytes, false), design.nodeExecutableSha256[process.version]);
  for (const relative of policy.childCriticalFiles) {
    assert.equal(typeof binding.sourceFiles[relative], 'string');
    assert.equal(hashFile(ownedFile(repository, relative)), binding.sourceFiles[relative], 'Confirmation binding: changed child source ' + relative);
  }
  if (mode === policy.captureMode) {
    const { requirePublication, hostedContext } = require('./capture-source.cjs');
    const published = requirePublication();
    assert.deepEqual(published.files, binding.sourceFiles); assert.equal(published.publicationSha256, binding.publicationSha256);
    assert.deepEqual(hostedContext(identity.sourceCommit), binding.hosted);
    const { requireConsumption } = require('./consumption.cjs');
    assert.equal(requireConsumption(published, binding.hosted).sha256, binding.consumptionSha256);
  }
  return { sha256: expectedDigest, parentPid: binding.parentPid, criterionId: binding.criterionId, revision: binding.revision,
    hostId: binding.hostId, manifestSha256: binding.manifestSha256 };
}

module.exports = { requireMode, validateBinding, createBinding, childBinding };
