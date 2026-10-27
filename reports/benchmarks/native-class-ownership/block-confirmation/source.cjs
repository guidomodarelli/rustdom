/** @module confirmation-current-source Profiles actual producer bytes without rewriting the separately authenticated historical graph. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { gitIdentity } = require('../owner-batch-study/source.cjs');
const { hashFile } = require('../owner-batch-study/io.cjs');
const { captureSourceIdentity } = require('../../../../benchmarks/sources.cjs');
const { inspectSource } = require('./authentication.cjs');
const { requireProductionEquivalence } = require('./production.cjs');
const historicalPolicy = require('./constants/authentication.json');
const policy = require('./constants/source.json');
const design = require('./constants/design.json');

/** @param {string} root - Physical producer root. @param {string} relative - Canonical relative member. @returns {string} Physical bounded regular file, never a captured implementation to import. */
function ownedFile(root, relative) {
  assert.equal(typeof relative, 'string'); assert.equal(path.posix.normalize(relative), relative);
  assert.ok(!path.posix.isAbsolute(relative) && !relative.includes('\\') && !relative.includes(':') && !relative.includes('\0'));
  let member = root;
  for (const segment of relative.split('/')) {
    assert.ok(segment && segment !== '.' && segment !== '..');
    member = path.join(member, segment); assert.equal(fs.lstatSync(member).isSymbolicLink(), false);
  }
  const stat = fs.statSync(member);
  assert.ok(stat.isFile() && stat.size <= policy.maximumSourceFileBytes, 'Confirmation source: bounded regular member required: ' + relative);
  assert.ok(fs.realpathSync(member).startsWith(root + path.sep));
  return member;
}

/** @param {object} files - Complete current path/digest dictionary. @returns {string} Stable lexical dictionary digest. */
function filesDigest(files) {
  return createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(files)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)))).digest('hex');
}

/**
 * Describe the current producer's real native Git identity and complete current graph independently from historical pins.
 * Historical source is authenticated in its own original checkout; it never substitutes for the current identity.
 * This preparation cannot authorize scientific execution, authenticate a runtime package or accept performance.
 * @param {string} current - Actual native current producer checkout.
 * @param {string} historical - Separate clean original checkout for the package authenticator.
 * @returns {object} Two distinct source profiles, all actual changes and the full matching compiler-input proof.
 */
function inspectCurrentSource(current, historical) {
  assert.equal(process.platform, 'linux', 'Confirmation source: native Linux Git is required');
  current = fs.realpathSync(current); historical = fs.realpathSync(historical);
  assert.notEqual(current, historical, 'Confirmation source: current and historical roles must remain separate');
  const gitDirectory = path.join(current, '.git');
  assert.ok(fs.lstatSync(gitDirectory).isDirectory() && !fs.lstatSync(gitDirectory).isSymbolicLink(),
    'Confirmation source: actual native Git directory required; Windows gitfiles and archive snapshots are not producer identity');
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: current, encoding: 'utf8',
    timeout: policy.gitCommandTimeoutMs, maxBuffer: policy.maximumGitCommandBytes });
  assert.equal(fs.realpathSync(top.trim()), current);
  const identity = gitIdentity(current); assert.deepEqual(identity.sourceGitErrors, []);
  assert.match(identity.sourceCommit, new RegExp(policy.gitCommitPattern));
  const canonical = captureSourceIdentity(current);
  assert.equal(canonical.sourceCommit, identity.sourceCommit); assert.deepEqual(canonical.sourceGitErrors, []);
  const original = inspectSource(historical);
  const production = requireProductionEquivalence(current);
  const names = new Set([...Object.keys(original.files), historicalPolicy.receipt.path, ...policy.extraFiles,
    ...canonical.measuredSources, ...Object.keys(production.observedInputs)]);
  const visit = (relative) => {
    const directory = path.join(current, relative);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = relative + '/' + entry.name;
      assert.equal(entry.isSymbolicLink(), false, 'Confirmation source: linked method member ' + name);
      if (entry.isDirectory()) { if (entry.name !== '__pycache__') visit(name); }
      else if (name !== policy.catalog && name !== policy.publication) names.add(name);
    }
  };
  visit(policy.methodDirectory);
  if (fs.existsSync(path.join(current, policy.captureWorkflow))) names.add(policy.captureWorkflow);
  const files = Object.fromEntries([...names].sort().map((relative) => [relative,
    hashFile(ownedFile(current, relative), policy.maximumSourceFileBytes, false)]));
  const readerSha256 = hashFile(__filename, policy.maximumSourceFileBytes, false);
  assert.equal(files[policy.readerPath], readerSha256, 'Confirmation source: profiled reader differs from the current inspector');
  assert.equal(files[policy.selectedPackageArchive], design.selectedPackageArchiveSha256,
    'Confirmation source: selected package archive changed');
  const changedHistoricalMembers = Object.entries(original.files).filter(([relative, expected]) => files[relative] !== expected)
    .map(([relative, originalSha256]) => ({ path: relative, originalSha256, currentSha256: files[relative] }));
  return { revision: policy.revision, sourceRole: policy.sourceRole, ...identity,
    profiledSourceDirectory: current, sourceProfileReaderSha256: readerSha256, profiledReaderMatchesCurrentInspector: true,
    canonicalRuntimeIdentity: canonical, currentFiles: files, currentFilesSha256: filesDigest(files),
    historicalSource: original, changedHistoricalMembers, productionCompilerInputs: production,
    historicalPinsRewritten: false, currentProducerIdentityReplaced: false,
    packageAuthenticatedHere: false, scientificCaptureEnabled: false, executionReady: false,
    scientificCaptureExecuted: false, performanceAccepted: null, gateReevaluated: false };
}

if (require.main === module) {
  try {
    assert.equal(process.argv.length, 5, 'Confirmation source: provide --inspect current-native-git original-native-git');
    assert.equal(process.argv[2], policy.inspectOption, 'Confirmation source: scientific execution is not enabled');
    process.stdout.write(JSON.stringify(inspectCurrentSource(process.argv[3], process.argv[4])) + '\n');
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = policy.failureExitCode; }
}
module.exports = { ownedFile, filesDigest, inspectCurrentSource };
