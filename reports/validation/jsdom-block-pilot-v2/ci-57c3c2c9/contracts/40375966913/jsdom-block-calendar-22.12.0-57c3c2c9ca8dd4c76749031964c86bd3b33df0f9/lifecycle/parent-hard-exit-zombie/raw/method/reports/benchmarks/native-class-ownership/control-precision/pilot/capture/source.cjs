/** @module pilot-capture-source Separates current producer bytes, reviewed catalogs and actual native Git identity. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { readJSON, hashFile } = require('./io.cjs');
const { gitIdentity } = require('../../../owner-batch-study/source.cjs');
const policy = require('../constants/capture.json');
const worker = require('../constants/worker.json');
const repository = path.resolve(__dirname, '../../../../../..');

/** @param {string} root - Physical source root. @param {string} relative - Canonical source member. @returns {string} Physical owned path; no symbolic links or traversal. */
function ownedPath(root, relative) {
  assert.equal(typeof relative, 'string'); assert.ok(relative.length > 0);
  assert.equal(path.posix.normalize(relative), relative);
  assert.ok(!path.posix.isAbsolute(relative) && !new RegExp(policy.invalidSourceCharactersPattern, 'u').test(relative));
  const segments = relative.split('/'); assert.ok(segments.every((segment) => segment !== '.' && segment !== '..'));
  root = fs.realpathSync(root); let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    assert.equal(fs.lstatSync(current).isSymbolicLink(), false, 'Pilot source: linked source member ' + relative);
  }
  assert.ok(current.startsWith(root + path.sep));
  return current;
}

/** @param {object} files - Complete path/digest dictionary. @returns {string} Stable graph digest, without executing any member. */
function filesDigest(files) {
  assert.ok(files && typeof files === 'object' && !Array.isArray(files));
  for (const [relative, digest] of Object.entries(files)) {
    assert.equal(typeof relative, 'string'); assert.equal(typeof digest, 'string');
    assert.equal(digest.length, policy.sha256HexLength); assert.match(digest, new RegExp(policy.sha256Pattern));
  }
  return createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(files)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)))).digest('hex');
}

/** @param {string} [root] - Actual current checkout. @param {boolean} [includeQualification] - Include reviewed tests, CI and authorization policy in the scientific publication. @returns {object} Frozen graph and prospective dependencies. */
function currentFiles(root = repository, includeQualification = false) {
  root = fs.realpathSync(root);
  const receiptPath = ownedPath(root, policy.historicalReceipt);
  assert.equal(hashFile(receiptPath), policy.historicalReceiptSha256);
  const historical = readJSON(receiptPath).files;
  assert.equal(Object.keys(historical).length, policy.historicalPins);
  const names = new Set([...Object.keys(historical), policy.historicalReceipt]);
  for (const [relative, expected] of Object.entries(historical)) assert.equal(hashFile(ownedPath(root, relative)), expected);
  const visit = (relative) => {
    const absolute = ownedPath(root, relative);
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === '__pycache__') continue;
      const member = relative + '/' + entry.name;
      assert.equal(entry.isSymbolicLink(), false, 'Pilot source: source dependency is a link');
      if (entry.isDirectory()) visit(member);
      else if (member !== policy.catalog && member !== policy.publication &&
          (includeQualification || (!entry.name.endsWith('.spec.cjs') && !entry.name.startsWith('test_'))) &&
          policy.sourceExtensions.includes(path.posix.extname(member))) names.add(member);
    }
  };
  for (const relative of policy.sourceDirectories) visit(relative);
  // The workflow/protocol are added when they exist during preparation; capture requires their reviewed catalog.
  for (const relative of [policy.workflowPath, 'reports/benchmarks/native-class-ownership/control-precision/pilot/capture/PROTOCOL.md']) {
    if (fs.existsSync(path.join(root, relative))) names.add(relative);
  }
  if (includeQualification) for (const relative of [policy.qualificationWorkflowPath, policy.generalWorkflowPath, 'AGENTS.md']) {
    names.add(relative); ownedPath(root, relative);
  }
  assert.equal(hashFile(ownedPath(root, policy.packageArchive)), worker.archiveSha256);
  names.add(policy.packageArchive); names.add('reports/validation/range-numeric-composed-package/20261026/archive.json');
  return Object.fromEntries([...names].sort().map((relative) => [relative, hashFile(ownedPath(root, relative))]));
}

/** @param {'functional'|'capture'} mode - Actual parent role. @returns {object} Current source graph and untouched Git diagnostics. */
function producer(mode) {
  assert.ok(policy.modes.includes(mode));
  if (mode === policy.captureMode) assert.equal(policy.executionReady, true, 'Pilot source: scientific method is not enabled');
  const files = currentFiles(repository, mode === policy.captureMode);
  const identity = gitIdentity(repository);
  assert.equal(identity.sourceGitErrors.length, 0);
  assert.equal(identity.sourceCommit.length, policy.gitCommitHexLength);
  assert.match(identity.sourceCommit, new RegExp(policy.gitCommitPattern));
  if (mode === policy.functionalMode) return { ...identity, files, publication: null };
  assert.equal(identity.sourceChangesRaw, '', 'Pilot source: scientific producer must be clean');
  assert.ok(files[policy.workflowPath]);
  assert.ok(files['reports/benchmarks/native-class-ownership/control-precision/pilot/capture/PROTOCOL.md']);
  const catalog = readJSON(ownedPath(repository, policy.catalog));
  assert.equal(catalog.revision, policy.revision); assert.deepEqual(catalog.files, files);
  assert.equal(catalog.executionReady, true); assert.equal(catalog.filesDigest, filesDigest(files));
  assert.deepEqual(catalog.criteria, require('../blocks.cjs').calendar().map((criterion, ordinal) =>
    ({ ordinal, criterionId: criterion.criterionId, node: criterion.node, phase: criterion.phase, row: criterion.row })));
  const complete = { ...files, [policy.catalog]: hashFile(ownedPath(repository, policy.catalog)) };
  const publication = readJSON(ownedPath(repository, policy.publication));
  assert.equal(publication.revision, policy.revision); assert.equal(publication.executionReady, true);
  assert.equal(publication.completeMethodReview, true); assert.equal(publication.actionableFindings, 0);
  assert.deepEqual(publication.files, complete); assert.equal(publication.filesDigest, filesDigest(complete));
  assert.equal(publication.performanceAccepted, null); assert.equal(publication.gateReevaluated, false);
  return { ...identity, files: complete, publication };
}

/**
 * Preserve the exact reviewed source as data; published binary archives remain independently hashed references.
 * @param {object} origin - Current verified producer files and optional publication.
 * @param {string} destination - Existing fresh parent-owned capture directory.
 * @returns {object} Every snapshot/reference path, size and digest. No copied implementation is executed.
 */
function snapshot(origin, destination) {
  assert.ok(origin && typeof origin.files === 'object');
  const copied = {};
  for (const [relative, expected] of Object.entries(origin.files)) {
    const source = ownedPath(repository, relative);
    assert.equal(hashFile(source), expected, 'Pilot snapshot: producer changed before copying ' + relative);
    const role = relative === policy.packageArchive ? 'embedded-package' :
      policy.publishedReferenceExtensions.includes(path.posix.extname(relative)) ? 'published-reference' : 'copied-source';
    const location = role === 'embedded-package' ? policy.packageSnapshot :
      role === 'copied-source' ? policy.methodSnapshotDirectory + '/' + relative : null;
    const bytes = fs.statSync(source).size;
    if (location !== null) {
      const target = path.join(destination, ...location.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
      assert.equal(hashFile(target), expected, 'Pilot snapshot: copied bytes differ ' + relative);
    }
    copied[relative] = { role, location, bytes, sha256: expected };
  }
  if (origin.publication !== null) {
    const source = ownedPath(repository, policy.publication);
    const target = path.join(destination, policy.publicationSnapshot);
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    assert.equal(hashFile(target), hashFile(source));
  }
  return copied;
}

module.exports = { repository, ownedPath, filesDigest, currentFiles, producer, snapshot };
