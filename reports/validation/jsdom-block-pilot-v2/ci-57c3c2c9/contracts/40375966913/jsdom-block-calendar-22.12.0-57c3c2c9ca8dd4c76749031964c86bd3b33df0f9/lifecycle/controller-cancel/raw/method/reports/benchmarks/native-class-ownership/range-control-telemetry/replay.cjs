/** @module range-telemetry-replay Recomputes the complete diagnostic with current reviewed code, never archived scripts. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const context = require('./context.cjs');
const { policy, read, hash } = context;
const { plan } = require('./model.cjs');
const { verifyDerived } = require('./derived.cjs');
const { validateProcess, validateSeedGroups } = require('./observations.cjs');
const { validateActivation } = require('./readiness.cjs');
const { commandFor } = require('./commands.cjs');

/** @param {object} index - Saved capture header. @returns {void} Reject partial, foreign or acceptance-bearing data before any replay. */
function validateIndex(index) {
  assert.equal(index.revision, policy.revision); assert.equal(index.purpose, policy.purpose);
  assert.equal(index.complete, true); assert.equal(index.failure, undefined);
  assert.equal(index.diagnosticOnly, true); assert.equal(index.runAttempt, 1);
  assert.equal(index.performanceAccepted, null); assert.equal(index.gateReevaluated, false);
  assert.equal(index.processes.length, policy.plannedProcesses);
}

/** @param {string} directory - Authenticated complete capture. @returns {object} Verified observations, always performanceAccepted=null. */
function verify(directory) {
  context.requireRuntime();
  directory = fs.realpathSync(directory);
  const index = read(path.join(directory, policy.paths.index));
  validateIndex(index);
  assert.equal(policy.captureImplemented, true, 'Range telemetry: this implementation has not enabled capture');
  assert.ok(path.isAbsolute(index.captureRoot));
  context.requireClean(index.sourceCommit);
  const reviewed = context.publication(); assert.deepEqual(index.sourceFiles, reviewed.files);
  assert.deepEqual(read(path.join(directory, policy.paths.publication)), reviewed);
  for (const [name, expected] of Object.entries(reviewed.files)) assert.equal(hash(path.join(directory, policy.paths.method, name)), expected, name);
  const harness = require('../current-ownership-experiment.cjs').captureHarness();
  assert.deepEqual(index.harness, harness);
  const sourceManifest = read(path.join(directory, policy.paths.sourceManifest));
  assert.deepEqual(sourceManifest, { commit: index.sourceCommit, harnessSha256: harness.sha256, files: harness.files });
  const activation = read(path.join(directory, policy.paths.activation));
  validateActivation(activation, index.sourceCommit);
  assert.equal(String(activation.run.id), index.hostedRunId);
  const execution = read(path.join(directory, policy.paths.executionReceipt));
  assert.deepEqual(execution, index.executionReceipt);
  assert.equal(execution.revision, policy.revision); assert.equal(execution.hostedRunId, index.hostedRunId);
  assert.equal(execution.sourceCommit, index.sourceCommit); assert.equal(execution.runAttempt, 1);
  const manifest = read(path.join(directory, policy.paths.manifest));
  assert.deepEqual(manifest, index.manifest);
  const identity = require('../range-collapse-study/constants/identity.json');
  assert.deepEqual(manifest.preparationBefore, identity);
  const packagePolicy = require('../range-collapse-study/constants/protocol.json');
  assert.deepEqual(manifest.preparation, { archiveSha256: packagePolicy.archive.sha256, hostedHead: identity.hostedHead,
    artifactId: identity.artifactId, identity });
  assert.deepEqual(manifest.distributions, require('../range-collapse-study/preparation.cjs').verifyQualification().distributions);
  assert.deepEqual(index.runtimes.map((entry) => entry.node), policy.nodeVersions);
  const runtimes = require('../constants/current-ownership.json').runtimeExecutableHashes;
  for (const runtime of index.runtimes) assert.equal(runtime.sha256, runtimes[runtime.node]);
  for (const mode of policy.modes) {
    const root = path.join(directory, policy.paths.derivedPrefix + mode);
    assert.equal(hash(path.join(root, policy.paths.preparation)), index.derivationSha256[mode]);
    verifyDerived(root, mode, sourceManifest, hash(path.join(directory, policy.paths.sourceManifest)));
  }
  const inputs = plan(); assert.equal(index.processes.length, inputs.length);
  const totals = Object.fromEntries(Object.keys(policy.plannedTotals).map((name) => [name, 0]));
  totals.firstUnclearStates = 0;
  const probes = [];
  const { settings } = context.createModel();
  for (const [ordinal, entry] of index.processes.entries()) {
    assert.deepEqual(entry.input, inputs[ordinal]); assert.equal(entry.node, entry.input.node);
    assert.equal(entry.exitCode, 0); assert.equal(entry.signal, null); assert.equal(entry.error, null);
    const runtime = index.runtimes.find((candidate) => candidate.node === entry.input.node);
    const expectedCommand = commandFor(entry.input, ordinal, index.captureRoot, runtime);
    assert.equal(entry.directory, expectedCommand.directory); assert.deepEqual(entry.argv, expectedCommand.argv);
    const root = path.join(directory, String(ordinal).padStart(policy.workerOrdinalDigits, '0'));
    const expectedFiles = [...policy.workerFiles, entry.input.mode === policy.cpuMode ? policy.paths.profile : policy.paths.jit].sort();
    assert.deepEqual(fs.readdirSync(root).sort(), expectedFiles);
    assert.deepEqual(Object.keys(entry.files).sort(), expectedFiles);
    for (const [name, expected] of Object.entries(entry.files)) {
      assert.ok(fs.lstatSync(path.join(root, name)).isFile() && !fs.lstatSync(path.join(root, name)).isSymbolicLink());
      assert.equal(hash(path.join(root, name)), expected, name);
    }
    const analysis = validateProcess(root, manifest, entry.input, entry, index.derivationSha256[entry.input.mode], index);
    assert.deepEqual(read(path.join(root, policy.paths.analysis)), analysis);
    probes.push({ ...entry.input, probe: analysis.startupRandomProbe });
    totals.processes++; totals.warmupSpans += settings.warmupSamples; totals.measuredSpans += settings.measuredSamples;
    totals.windows += analysis.trackedOwners.window; totals.documents += analysis.trackedOwners.document;
    totals.finalClearStates += settings.requiredClearRounds; totals.firstUnclearStates += Number(!analysis.cleanupTrace[0].clear);
    totals.cpuProfiles += Number(entry.input.mode === policy.cpuMode); totals.jitLogs += Number(entry.input.mode !== policy.cpuMode);
  }
  validateSeedGroups(probes);
  for (const [name, expected] of Object.entries(policy.plannedTotals)) assert.equal(totals[name], expected, name);
  assert.deepEqual(index.parentMemory.map((entry) => entry.stage), [policy.stages.beforeWorkers, ...policy.nodeVersions.map((node) => policy.stages.afterNodePrefix + node)]);
  for (const entry of index.parentMemory) for (const name of policy.memoryFields) assert.ok(Number.isFinite(entry.state[name]) && entry.state[name] >= 0);
  return { revision: policy.revision, verified: true, complete: true, diagnosticOnly: true, sourceCommit: index.sourceCommit,
    hostedRunId: index.hostedRunId, runAttempt: 1, performanceAccepted: null, gateReevaluated: false, ...totals };
}
module.exports = { verify, validateIndex };
