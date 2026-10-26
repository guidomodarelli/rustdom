/** @file Enforces the complete recorded C study without launching or selecting new measurements. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { captureSourceIdentity } = require('../../../benchmarks/sources.cjs');
const study = require('./paired-inline-experiment.cjs');
const settings = require('./constants/ownership-evidence.json');

/** Read a file's actual bytes independently of its recorded digest. */
function digest(filename) {
  return createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

/** Authenticate the fixed archive and every declared file before consuming any observation. */
function authenticateArchive(archiveRoot) {
  const manifestPath = path.join(archiveRoot, 'files.json');
  assert.equal(digest(manifestPath), settings.manifestSha256, 'Ownership evidence: archive manifest changed');
  const files = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const file of files) {
    const filename = path.resolve(archiveRoot, file.path);
    assert.ok(filename.startsWith(`${path.resolve(archiveRoot)}${path.sep}`),
      'Ownership evidence: archive file escapes its directory');
    assert.equal(fs.statSync(filename).size, file.bytes, `Ownership evidence: archive file size changed: ${file.path}`);
    assert.equal(digest(filename), file.sha256, `Ownership evidence: archive file changed: ${file.path}`);
  }
  return files.length;
}

/**
 * Check current source and build inputs against the actual recorded study, independently of its outcome.
 * @param {string} baselineRoot - Actual checkpoint067 source tree.
 * @param {string} candidateRoot - Current source tree, including all measured harness files.
 * @returns {object} Current identities, matching the pinned implementation and harness.
 */
function verifyCurrentInputs(baselineRoot, candidateRoot) {
  const identities = { A: captureSourceIdentity(baselineRoot), B: captureSourceIdentity(candidateRoot) };
  for (const [label, root] of Object.entries({ A: baselineRoot, B: candidateRoot })) {
    assert.equal(identities[label].sourceHash, settings.sourceHashes[label],
      `Ownership evidence: current ${label} sources differ; prepare and review evidence for the changed implementation`);
    for (const [name, expected] of Object.entries(settings.buildInputHashes[label])) {
      const filename = path.join(root, name);
      const actual = fs.existsSync(filename) ? digest(filename) : null;
      assert.equal(actual, expected, `Ownership evidence: current ${label} build input differs: ${name}`);
    }
  }
  const harness = study.captureHarness(candidateRoot);
  assert.equal(harness.sha256, settings.harnessSha256,
    'Ownership evidence: current measurement harness differs; declare and review the new method before measuring');
  return { sources: Object.fromEntries(Object.entries(identities).map(([label, identity]) => [label, identity.sourceHash])),
    harnessSha256: harness.sha256 };
}

/**
 * Recalculate both complete Node studies using the unchanged verifier and original acceptance rules.
 * @param {string} baselineRoot - Actual reference checkout.
 * @param {string} archiveRoot - Immutable C study with its pinned file manifest.
 * @param {string} [candidateRoot] - Actual current source tree.
 * @returns {object} Integrity, input identities and original acceptance, without new measurements.
 */
function verifyEvidence(baselineRoot, archiveRoot, candidateRoot = process.cwd()) {
  const authenticatedFiles = authenticateArchive(archiveRoot);
  const current = verifyCurrentInputs(baselineRoot, candidateRoot);
  const result = study.verifySet(settings.nodeDirectories.map((directory) => path.join(archiveRoot, directory)));
  return { ...result, authenticatedFiles, current, measurementExecuted: false,
    scope: 'Recorded Linux C study; offline replay is not a measurement of this CI host or its build.' };
}

/** Keep a failed budget (1) distinct from stale sources or damaged evidence (2) at the actual CI boundary. */
function main(arguments_ = process.argv.slice(2)) {
  assert.equal(arguments_.length, 2, 'Ownership evidence: provide baseline and archive paths');
  const result = verifyEvidence(path.resolve(arguments_[0]), path.resolve(arguments_[1]));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.accepted !== true) {
    process.stderr.write('Ownership evidence: verified C study has not accepted the performance budget; no measurement was repeated.\n');
    process.exitCode = 1;
  }
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { authenticateArchive, verifyCurrentInputs, verifyEvidence };
