/** @module owner-batch-source Separates live producer checks from archived-byte authentication; offline replay never executes captured implementations. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { hashFile } = require('../combined-process-study/io.cjs');
const { readJSON: read } = require('./io.cjs');
const policy = require('./constants/capture.json');
const repository = path.resolve(__dirname, '../../../..');

/** @param {string} root - Actual native Git checkout, never a Windows gitfile read by WSL Git. @returns {object} Raw Git identity; failures are retained instead of normalized. */
function gitIdentity(root = repository) {
  assert.ok(fs.lstatSync(path.join(root, '.git')).isDirectory(), 'Owner batch source: use a native real Git checkout, not a Windows gitfile');
  const errors = [];
  const invoke = (args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: policy.maximumMetadataCommandMs,
      maxBuffer: policy.maximumMetadataOutputBytes });
    if (result.error || result.status !== 0) {
      errors.push({ operation: args, exitCode: result.status, stderr: result.stderr ?? '', error: result.error?.message ?? null });
      return null;
    }
    return result.stdout;
  };
  const commit = invoke(['rev-parse', 'HEAD']);
  const changes = invoke(['status', '--porcelain', '--untracked-files=all']);
  return { sourceCommit: commit === null ? null : commit.trim(), sourceChangesRaw: changes, sourceGitErrors: errors };
}

/** @returns {object} Current producer graph; called only before capture/qualification, not to freeze future runtime changes during historical replay. */
function currentFiles() {
  const receipt = path.join(repository, policy.historicalReceipt);
  assert.equal(hashFile(receipt), policy.historicalReceiptSha256);
  const pins = read(receipt).files; assert.equal(Object.keys(pins).length, policy.historicalPins);
  const names = new Set(Object.keys(pins)); names.add(policy.historicalReceipt);
  for (const [name, expected] of Object.entries(pins)) assert.equal(hashFile(path.join(repository, name)), expected);
  const visit = (relative) => {
    for (const entry of fs.readdirSync(path.join(repository, relative), { withFileTypes: true })) {
      if (entry.name === '__pycache__' || entry.name === 'fixtures') continue;
      const name = relative + '/' + entry.name;
      if (entry.isDirectory()) visit(name);
      else {
        assert.equal(entry.isSymbolicLink(), false);
        if (name === policy.catalog || entry.name === 'manifest.json' || entry.name === 'replay-fixtures.json' ||
          entry.name.endsWith('.spec.cjs') || entry.name.startsWith('test_')) continue;
        if (/\.(cjs|py|json)$/.test(entry.name)) names.add(name);
      }
    }
  };
  visit('reports/benchmarks/native-class-ownership/owner-batch-study');
  visit('reports/benchmarks/native-class-ownership/owner-batch-packages');
  names.add(policy.workflowPath); names.add('.github/workflows/owner-batch-method-contracts.yml');
  names.add(policy.packageArchive); names.add('reports/validation/owner-batch-package/20261025/archive.json');
  const artifact = require('../owner-batch-packages/constants/artifact.json');
  names.add(artifact.sourceManifestPath);
  for (const relative of Object.keys(artifact.collectionFiles)) names.add(policy.collection + '/' + relative);
  const files = Object.fromEntries([...names].sort().map((name) => [name, hashFile(path.join(repository, name))]));
  return { revision: policy.revision, historicalPins: policy.historicalPins, files };
}

/** @param {boolean} requirePublication - Scientific capture requires the independent reviewed receipt; functional qualification cannot enable it. @returns {object} Exact live producer files and raw Git identity; only scientific capture requires a clean checkout. */
function producer(requirePublication) {
  assert.equal(typeof requirePublication, 'boolean');
  const generated = currentFiles(); const declared = read(path.join(repository, policy.catalog));
  assert.deepEqual(generated, declared, 'Owner batch source: regenerate and review the complete producer catalog');
  const files = { ...declared.files, [policy.catalog]: hashFile(path.join(repository, policy.catalog)) };
  const identity = gitIdentity();
  assert.deepEqual(identity.sourceGitErrors, []);
  if (requirePublication) assert.equal(identity.sourceChangesRaw, '');
  assert.match(identity.sourceCommit, /^[a-f0-9]{40}$/);
  let publication = null;
  if (requirePublication) {
    publication = read(path.join(repository, policy.publication));
    assert.equal(publication.revision, policy.revision); assert.equal(publication.actionableFindings, 0);
    assert.equal(publication.executionReady, true); assert.deepEqual(publication.files, files);
    assert.equal(publication.performanceAccepted, null); assert.equal(publication.gateReevaluated, false);
  }
  return { ...identity, files, publication };
}

/** @param {string} name - Bound producer member. @returns {string} Current source, embedded package or already published immutable compressed data. */
function snapshotRole(name) {
  if (name === policy.packageArchive) return 'embedded-package';
  return policy.publishedReferenceExtensions.includes(path.posix.extname(name)) ? 'published-reference' : 'copied-source';
}
/** @param {string} root - Current extraction root. @param {object} files - Independently bound producer files. @returns {void} Compare bytes as data; do not freeze future runtime edits or import captured code. */
function verifySnapshot(root, files) {
  for (const [name, expected] of Object.entries(files)) {
    assert.equal(path.posix.normalize(name), name);
    assert.ok(!path.posix.isAbsolute(name) && !name.startsWith('../') && !name.includes('\\') && !name.includes(':'));
    const role = snapshotRole(name);
    const filename = role === 'embedded-package' ? path.join(root, policy.packageSnapshot) :
      role === 'published-reference' ? path.join(repository, name) : path.join(root, policy.snapshotDirectory, name);
    assert.equal(hashFile(filename), expected, 'Owner batch replay: changed producer snapshot/reference ' + name);
  }
}
/** @returns {object} Actual current reader module bytes, separately recorded from immutable producer snapshots. */
function readerFiles() {
  const files = {};
  for (const filename of Object.keys(require.cache).sort()) {
    const relative = path.relative(repository, filename).split(path.sep).join('/');
    if (relative.startsWith('../') || path.isAbsolute(relative)) continue;
    files[relative] = hashFile(filename);
  }
  return files;
}
module.exports = { repository, gitIdentity, currentFiles, producer, snapshotRole, verifySnapshot, readerFiles };
