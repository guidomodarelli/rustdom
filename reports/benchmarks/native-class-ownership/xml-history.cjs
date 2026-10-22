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
function assertRuntime(candidateRoot) {
  assert.equal(process.version, settings.node, 'XML history: Node differs from the declared XML recipe');
  assert.equal(process.platform, settings.platform, 'XML history: platform differs from the declared XML recipe');
  assert.equal(process.arch, settings.arch, 'XML history: architecture differs from the declared XML recipe');
  for (const flag of settings.unrecordedFlags) assert.ok(!process.env[flag], `XML history: undeclared ${flag} is set`);
  assert.equal(digest(path.join(candidateRoot, settings.workflowPath)), settings.workflowSha256,
    'XML history: workflow recipe changed; prepare and review its declaration before measuring');
  const compiler = spawnSync('rustc', ['-Vv'], { encoding: 'utf8' });
  if (compiler.error) throw new Error('XML history: rustc -Vv could not execute', { cause: compiler.error });
  assert.equal(compiler.status, 0, 'XML history: rustc -Vv failed');
  assert.equal(compiler.stdout.trim(), settings.rustc, 'XML history: compiler differs from the declared XML recipe');
}

/** Authenticate declared metadata before it can select either reuse or a new measurement. */
function assertEvidenceFiles(archiveRoot, recipe) {
  for (const [name, expected] of Object.entries(recipe.evidenceFiles)) {
    const filename = path.join(archiveRoot, name);
    assert.ok(fs.existsSync(filename), `XML history: declared evidence file is missing: ${name}`);
    assert.equal(digest(filename), expected, `XML history: declared evidence file changed: ${name}`);
  }
}

/** Read actual ZIP metadata after authenticating its bytes, without evaluating timings. */
function readArchiveIdentity(archiveRoot, recipe = settings) {
  assertEvidenceFiles(archiveRoot, recipe);
  const result = spawnSync(recipe.python, ['-B', path.join(__dirname, 'xml-history-identity.py'), archiveRoot], { encoding: 'utf8' });
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
  const result = spawnSync(recipe.python, ['-B', path.join(archiveRoot, 'verify.py')], { encoding: 'utf8' });
  if (result.error) throw new Error('XML history: archived verifier could not execute', { cause: result.error });
  assert.equal(result.status, 0, `XML history: archived observations failed verification: ${result.stderr}`);
  const verification = JSON.parse(result.stdout);
  assert.equal(verification.verified, true, 'XML history: archive did not confirm integrity');
  return verification;
}

/** Keep selection, integrity and budget exit codes distinct at the real CLI boundary. */
function main(arguments_ = process.argv.slice(2)) {
  const [mode, baselineArgument, archiveArgument] = arguments_;
  assert.ok(mode === '--select' || mode === '--verify', 'XML history: use --select or --verify with baseline and archive paths');
  const candidateRoot = process.cwd();
  const baselineRoot = path.resolve(baselineArgument);
  const archiveRoot = path.resolve(archiveArgument);
  assertRuntime(candidateRoot);
  const recorded = readArchiveIdentity(archiveRoot);
  const reuse = matchesArchiveIdentity(recorded) && canReuse(baselineRoot, archiveRoot, candidateRoot);
  if (mode === '--select') process.stdout.write(`reuse=${reuse}\n`);
  else {
    assert.equal(reuse, true, 'XML history: current sources do not match the selected evidence');
    const verification = verifyEvidence(archiveRoot);
    process.stdout.write(`${JSON.stringify(verification)}\n`);
    if (verification.accepted !== true) process.exitCode = 1;
  }
}
if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { canReuse, verifyEvidence, readArchiveIdentity, matchesArchiveIdentity };
