/** @file Reuses a fully verified XML measurement only for the same sources and declared recipe. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const settings = require('./constants/xml-history.json');
const digest = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/** Include root build inputs outside the older canonical source digest, including declared absence. */
function matchesBuildInputs(root, inputs) {
  return Object.entries(inputs).every(([name, expected]) => {
    const filename = path.join(root, name);
    return (fs.existsSync(filename) ? digest(filename) : null) === expected;
  });
}

/**
 * Select by real source and workflow bytes; never infer acceptance from selection.
 * @param {string} baselineRoot - Actual checkpoint066 sources.
 * @param {string} archiveRoot - Recorded XML experiment.
 * @param {string} [candidateRoot] - Candidate's canonical implementation and harness sources.
 * @param {object} [recipe] - Explicit immutable recipe for historical contract checks.
 * @returns {boolean} Whether the declared inputs can reuse this archive after verification.
 */
function canReuse(baselineRoot, archiveRoot, candidateRoot = process.cwd(), recipe = settings) {
  const protocolPath = path.join(archiveRoot, 'constants/protocol.json');
  const workflowPath = path.join(candidateRoot, recipe.workflowPath);
  if (!fs.existsSync(protocolPath) || !fs.existsSync(workflowPath)) return false;
  const protocol = JSON.parse(fs.readFileSync(protocolPath, 'utf8'));
  const { captureSourceIdentity } = require(path.join(candidateRoot, 'benchmarks/sources.cjs'));
  return protocol.node === recipe.node && protocol.sourceHash === recipe.sourceHash &&
    protocol.baselineSourceHash === recipe.baselineSourceHash &&
    captureSourceIdentity(candidateRoot).sourceHash === protocol.sourceHash &&
    captureSourceIdentity(baselineRoot).sourceHash === protocol.baselineSourceHash &&
    matchesBuildInputs(candidateRoot, recipe.buildInputHashes.candidate) &&
    matchesBuildInputs(baselineRoot, recipe.buildInputHashes.baseline) &&
    digest(workflowPath) === recipe.workflowSha256;
}

/** Require the recipe's actual tools before selecting or consuming evidence in CI. */
function assertRuntime(candidateRoot, recipe = settings) {
  assert.equal(process.version, recipe.node, 'XML history: Node differs from the declared XML recipe');
  assert.equal(process.platform, recipe.platform, 'XML history: platform differs from the declared XML recipe');
  assert.equal(process.arch, recipe.arch, 'XML history: architecture differs from the declared XML recipe');
  for (const flag of recipe.unrecordedFlags) assert.ok(!process.env[flag], `XML history: undeclared ${flag} is set`);
  for (const name of Object.keys(process.env)) {
    if ((recipe.allowedDirectoryFlags || []).includes(name)) {
      if (process.env[name]) assert.ok(path.isAbsolute(process.env[name]), `XML history: ${name} must be an absolute directory`);
      continue;
    }
    if ((recipe.unrecordedFlagPrefixes || []).some((prefix) => name.startsWith(prefix))) {
      assert.ok(!process.env[name], `XML history: undeclared ${name} is set`);
    }
  }
  if (recipe.glibc) assert.equal(process.report.getReport().header.glibcVersionRuntime, recipe.glibc,
    'XML history: libc differs from the declared XML recipe');
  if (recipe.nodeExecutableSha256) assert.equal(digest(process.execPath), recipe.nodeExecutableSha256,
    'XML history: Node executable differs from the declared XML recipe');
  assert.equal(digest(path.join(candidateRoot, recipe.workflowPath)), recipe.workflowSha256,
    'XML history: workflow policy changed; prepare and review its declaration before verifying evidence');
  const compiler = spawnSync('rustc', ['-Vv'], { encoding: 'utf8' });
  if (compiler.error) throw new Error('XML history: rustc -Vv could not execute', { cause: compiler.error });
  assert.equal(compiler.status, 0, 'XML history: rustc -Vv failed');
  assert.equal(compiler.stdout.trim(), recipe.rustc, 'XML history: compiler differs from the declared XML recipe');
}

/** Authenticate declared metadata before selecting or verifying recorded evidence. */
function assertEvidenceFiles(archiveRoot, recipe) {
  for (const [name, expected] of Object.entries(recipe.evidenceFiles)) {
    const filename = path.join(archiveRoot, name);
    assert.ok(fs.existsSync(filename), `XML history: declared evidence file is missing: ${name}`);
    assert.equal(digest(filename), expected, `XML history: declared evidence file changed: ${name}`);
  }
  for (const [name, expected] of Object.entries(recipe.verifierSources || {})) {
    assert.equal(digest(path.resolve(__dirname, '../../..', name)), expected,
      `XML history: declared verifier source changed: ${name}`);
  }
}

/** Read actual ZIP metadata after authenticating its bytes, without evaluating timings. */
function readArchiveIdentity(archiveRoot, recipe = settings) {
  assertEvidenceFiles(archiveRoot, recipe);
  const arguments_ = ['-B', path.join(__dirname, 'xml-history-identity.py'), archiveRoot];
  if (recipe.fullInputCapture) arguments_.push('--full-inputs');
  const result = spawnSync(recipe.python, arguments_, { encoding: 'utf8' });
  if (result.error) throw new Error('XML history: recorded input reader could not execute', { cause: result.error });
  assert.equal(result.status, 0, `XML history: recorded input identities could not be read: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

/** Compare recorded tools and sources with the requested recipe, independently of its current host. */
function matchesArchiveIdentity(identity, recipe = settings) {
  return identity.node === recipe.node && identity.platform === recipe.platform && identity.arch === recipe.arch &&
    identity.rustc === recipe.rustc && identity.sourceHash === recipe.sourceHash &&
    identity.baselineSourceHash === recipe.baselineSourceHash;
}

/**
 * Recompute the original ZIP; false/null acceptance stays a failed gate.
 * @param {string} archiveRoot - Complete immutable XML artifact directory.
 * @param {object} [recipe] - Explicit immutable verifier/input identity for historical checks.
 * @returns {object} Original verifier result, with no new measurements.
 */
function verifyEvidence(archiveRoot, recipe = settings) {
  assertEvidenceFiles(archiveRoot, recipe);
  const arguments_ = recipe.fullInputCapture
    ? ['-B', path.join(__dirname, 'verify-xml-current-capture.py'), '--archive',
      path.join(archiveRoot, 'artifact.zip'), recipe.evidenceFiles['artifact.zip'], process.execPath]
    : ['-B', path.join(archiveRoot, 'verify.py')];
  const result = spawnSync(recipe.python, arguments_, { encoding: 'utf8' });
  if (result.error) throw new Error('XML history: archived verifier could not execute', { cause: result.error });
  assert.equal(result.status, 0, `XML history: archived observations failed verification: ${result.stderr}`);
  const verification = JSON.parse(result.stdout);
  assert.equal(verification.verified, true, 'XML history: archive did not confirm integrity');
  return verification;
}

/**
 * Require matching recorded evidence without authorizing another measurement.
 * @param {string[]} [arguments_] - Selection/verification mode, baseline directory and archive directory.
 * @returns {void} Writes an eligible selection or the original verified decision and preserves budget failures.
 * @throws {Error} When the runtime, source inputs, declared policy or evidence integrity does not match.
 */
function main(arguments_ = process.argv.slice(2), recipe = settings) {
  const [mode, baselineArgument, archiveArgument] = arguments_;
  assert.ok(mode === '--select' || mode === '--verify', 'XML history: use --select or --verify with baseline and archive paths');
  const candidateRoot = process.cwd();
  const baselineRoot = path.resolve(baselineArgument);
  const archiveRoot = path.resolve(archiveArgument);
  assertRuntime(candidateRoot, recipe);
  const recorded = readArchiveIdentity(archiveRoot, recipe);
  const reuse = matchesArchiveIdentity(recorded, recipe) && canReuse(baselineRoot, archiveRoot, candidateRoot, recipe);
  assert.equal(reuse, true,
    'XML history: current inputs do not match the declared evidence; prepare and review matching evidence. Automatic measurement is not authorized.');
  if (mode === '--select') process.stdout.write('reuse=true\n');
  else {
    const verification = verifyEvidence(archiveRoot, recipe);
    process.stdout.write(`${JSON.stringify(verification)}\n`);
    if (verification.accepted !== true) process.exitCode = 1;
  }
}
if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { canReuse, verifyEvidence, readArchiveIdentity, matchesArchiveIdentity, main };
