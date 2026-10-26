/** @module combined-process-preparation Builds the complete sampler manifest from independently authenticated package bytes without loading DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { fingerprint } = require('../paired-experiment.cjs');
const identity = require('./constants/identity.json');
const policy = require('./constants/protocol.json');
const packagePolicy = require('../range-combined-packages/constants/assembly.json');
const artifactBinding = require('../range-combined-packages/constants/artifact-binding.json');
const archive = require('../range-combined-packages/constants/archive.json');
const reference = require('../constants/hosted-build.cjs');
const repository = path.resolve(__dirname, '../../../..');

/**
 * Authenticate the full assembly first, then expose the unchanged sampler's narrower runtime fingerprints.
 * The independent full archive additionally covers types, locks, dependencies, sources and metadata.
 * @param {string} directory - Physical extracted assembly outside a Git checkout.
 * @returns {object} Complete original sampler interface and explicitly separated real source provenances.
 */
function createManifest(directory) {
  assert.equal(process.platform, 'linux', 'Combined manifest: authenticate Linux package links on Linux');
  const root = fs.realpathSync.native(directory);
  const command = spawnSync('python3', ['-B', path.join(__dirname, '../range-combined-packages/assemble.py'),
    '--verify', root, path.join(repository, artifactBinding.collectionDirectory), process.execPath],
  { encoding: 'utf8', timeout: policy.preparationTimeoutMs, maxBuffer: policy.metadataOutputLimitBytes });
  assert.ifError(command.error);
  assert.equal(command.status, 0, 'Combined manifest: full package authentication failed: ' + command.stderr);
  const checked = JSON.parse(command.stdout);
  assert.equal(checked.verified, true); assert.equal(checked.artifactId, policy.packageArtifact);
  assert.equal(checked.candidateFiles, identity.fullCandidateFiles);
  assert.equal(archive.archive.sha256, policy.packageArchiveSha256);
  const controls = path.join(root, packagePolicy.paths.controls);
  const copies = Object.fromEntries(Object.keys(identity.distributions).map((label) => [label,
    label === 'B' ? path.join(root, packagePolicy.paths.candidate) : path.join(controls, 'packages', label)]));
  const distributions = Object.fromEntries(Object.entries(copies).map(([label, directory]) => {
    const actual = fingerprint(directory, label.startsWith('J') ? identity.referenceParts : identity.nativeParts);
    assert.equal(actual.sha256, identity.distributions[label], 'Combined manifest: changed runtime distribution ' + label);
    if (label === 'B') assert.deepEqual(actual, identity.candidateRuntime);
    return [label, actual];
  }));
  return { copies, distributions, roots: { A: path.join(controls, 'baseline-sources'), B: path.join(root, packagePolicy.paths.sources) },
    sources: { A: checked.controlsIdentity.sourceTransportIdentity, B: checked.sourceSnapshotIdentity },
    compilerSources: { A: checked.controlsIdentity.baselineCompilerProvenance, B: checked.compilerSourceIdentity },
    dependencies: path.join(controls, 'node_modules'), dependenciesSha256: checked.controlsIdentity.dependenciesSha256,
    referenceVersion: reference.referenceVersion, preparationBefore: checked,
    preparation: { artifactId: checked.artifactId, archiveSha256: archive.archive.sha256,
      fullCandidateFiles: identity.fullCandidateFiles, samplerCandidateFiles: identity.candidateRuntimeFiles },
    samplerInvoked: false, performanceAccepted: null, gateReevaluated: false };
}
module.exports = { createManifest };
