/** @file Authenticates recorded study archives and current inputs without collecting new measurements. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');
const { captureSourceIdentity } = require('../../../benchmarks/sources.cjs');
const settings = require('./constants/recorded-evidence.json');
const { additionalBuildInputs } = require('./constants/hosted-build.cjs');
const { buildInputHashes: historicalBuildInputs } = require('./constants/ownership-evidence.json');
const sha256Pattern = new RegExp(settings.sha256Pattern);
const requiredBuildInputs = [...new Set([...additionalBuildInputs, ...Object.keys(historicalBuildInputs.A)])].sort();
const digest = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/**
 * Resolve a declared file below its owner's directory, never an absolute or escaping path.
 * @param {string} directory - Directory that owns the declared relative path.
 * @param {string} relative - Canonical slash-separated policy path.
 * @returns {string} Absolute path confined to the owner directory.
 * @throws {Error} When the path is malformed or escapes its owner.
 */
function ownedPath(directory, relative) {
  assert.equal(typeof relative, 'string', 'Recorded evidence: policy path must be a string');
  assert.ok(relative && !relative.includes('\\') && !relative.includes(':') &&
    !path.posix.isAbsolute(relative) && !path.win32.isAbsolute(relative) &&
    !relative.split('/').some((part) => part === '' || part === '.' || part === '..'),
  `Recorded evidence: noncanonical policy path=${relative}`);
  const owner = path.resolve(directory);
  const resolved = path.resolve(owner, relative);
  const ownerPrefix = owner.endsWith(path.sep) ? owner : `${owner}${path.sep}`;
  assert.ok(resolved !== owner && resolved.startsWith(ownerPrefix), `Recorded evidence: path escapes owner: ${relative}`);
  return resolved;
}

/**
 * Bind an existing study verifier to a separately declared immutable archive policy.
 * @param {object} options - Trusted study implementation, preparation method and policy.
 * @param {object} options.study - Existing full offline verifier and harness capture functions.
 * @param {object} options.method - Preparation identity used by that study, including compiled source hashes.
 * @param {object} options.policy - Pins for archive, current source graph, build inputs and Node directories.
 * @returns {object} Current-input and full-evidence verification functions; neither runs a sampler.
 * @throws {Error} When the policy does not preserve compiled identities or its pins are malformed.
 */
function createRecordedEvidenceVerifier({ study, method, policy }) {
  assert.deepEqual(policy.compiledSourceHashes, method.preparation.identity.inputs.sources,
    'Recorded evidence: policy changed the official compiled source identities');
  assert.equal(policy.sourceHashes.A, policy.compiledSourceHashes.A,
    'Recorded evidence: reference sources differ from the official compiled checkpoint');
  for (const label of settings.sourceLabels) {
    assert.match(policy.sourceHashes[label], sha256Pattern);
    assert.deepEqual(Object.keys(policy.buildInputHashes[label]).sort(), requiredBuildInputs,
      `Recorded evidence: incomplete build-input coverage for ${label}`);
    for (const [name, expected] of Object.entries(policy.buildInputHashes[label])) {
      if (additionalBuildInputs.includes(name) || expected !== null) assert.match(expected, sha256Pattern);
      if (Object.hasOwn(historicalBuildInputs[label], name) && !(label === 'B' && name === 'package.json')) {
        assert.equal(expected, historicalBuildInputs[label][name],
          `Recorded evidence: policy changed the official ${label} build input: ${name}`);
      }
    }
  }
  assert.match(policy.harnessSha256, sha256Pattern);
  for (const pin of [policy.archive, policy.rawManifest]) assert.match(pin.sha256, sha256Pattern);
  assert.equal(typeof policy.archivePrefix, 'string');
  assert.ok(policy.archivePrefix && !policy.archivePrefix.includes('/'));
  ownedPath(os.tmpdir(), policy.archivePrefix);
  ownedPath(os.tmpdir(), policy.compiledPackageManifest);
  assert.ok(Array.isArray(policy.nodeDirectories) && policy.nodeDirectories.length > 0);

  /**
   * Permit the documented test command change while retaining every build/runtime manifest field.
   * @param {string} compiledManifest - Original source package manifest preserved with the archive.
   * @param {string} candidateRoot - Current source tree already matched against the policy.
   * @returns {object} Both manifest hashes and the single permitted test-only field.
   * @throws {Error} When the original manifest is unauthenticated or any other field differs.
   */
  function verifyPackageManifest(compiledManifest, candidateRoot) {
    const compiledSha256 = digest(compiledManifest);
    assert.equal(compiledSha256, historicalBuildInputs.B['package.json'],
      'Recorded evidence: compiled package manifest differs from the official declaration');
    const currentManifest = ownedPath(candidateRoot, 'package.json');
    const compiled = JSON.parse(fs.readFileSync(compiledManifest, 'utf8'));
    const candidate = JSON.parse(fs.readFileSync(currentManifest, 'utf8'));
    assert.equal(typeof candidate.scripts?.[settings.compatibilityTestCommandName], 'string',
      'Recorded evidence: current test:compat must remain an explicit command');
    const allowedField = `scripts.${settings.compatibilityTestCommandName}`;
    compiled.scripts[settings.compatibilityTestCommandName] = candidate.scripts[settings.compatibilityTestCommandName];
    assert.ok(isDeepStrictEqual(candidate, compiled),
      'Recorded evidence: package manifest changed build/runtime fields beyond scripts.test:compat');
    return { compiledSha256, currentSha256: digest(currentManifest), allowedField };
  }

  /**
   * Bind the current trees to measured harness inputs while preserving the official compiled identities.
   * @param {string} baselineRoot - Actual checkpoint source tree.
   * @param {string} candidateRoot - Actual candidate source tree.
   * @returns {object} Independently computed current and compiled identities.
   * @throws {Error} When sources, extra build inputs or the measurement harness differ.
   */
  function verifyCurrentInputs(baselineRoot, candidateRoot) {
    const roots = { A: baselineRoot, B: candidateRoot };
    const current = {};
    for (const label of settings.sourceLabels) {
      current[label] = captureSourceIdentity(roots[label]).sourceHash;
      assert.equal(current[label], policy.sourceHashes[label],
        `Recorded evidence: current ${label} sources differ from the measured inputs`);
      for (const [name, expected] of Object.entries(policy.buildInputHashes[label])) {
        const filename = ownedPath(roots[label], name);
        const actual = fs.existsSync(filename) ? digest(filename) : null;
        assert.equal(actual, expected, `Recorded evidence: current ${label} build input differs: ${name}`);
      }
    }
    const harness = study.captureHarness(candidateRoot);
    assert.equal(harness.sha256, policy.harnessSha256,
      'Recorded evidence: current harness differs from the measured method');
    return { measuredSources: current, compiledSources: { ...method.preparation.identity.inputs.sources },
      harnessSha256: harness.sha256 };
  }

  /**
   * Authenticate and recalculate the whole original dataset, retaining its original budget decision.
   * @param {string} baselineRoot - Actual reference checkout.
   * @param {string} archiveRoot - Directory containing the fixed tar and raw member manifest.
   * @param {string} [candidateRoot] - Actual current candidate, defaulting to the process working directory.
   * @returns {object} Full integrity and budget result with current/compiled identities and no new measurement.
   * @throws {Error} When inputs, pinned bytes, extraction or original dataset verification fail.
   */
  function verifyEvidence(baselineRoot, archiveRoot, candidateRoot = process.cwd()) {
    const current = verifyCurrentInputs(baselineRoot, candidateRoot);
    const archive = ownedPath(archiveRoot, policy.archive.filename);
    const manifest = ownedPath(archiveRoot, policy.rawManifest.filename);
    for (const [filename, pin] of [[archive, policy.archive], [manifest, policy.rawManifest]]) {
      assert.equal(digest(filename), pin.sha256, `Recorded evidence: pinned file changed: ${path.basename(filename)}`);
    }
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), settings.temporaryDirectoryPrefix));
    try {
      const command = [path.join(__dirname, 'recorded-evidence-extract.py'), archive, manifest,
        policy.archivePrefix, temporary];
      const extraction = spawnSync(settings.pythonCommand, ['-B', ...command], {
        encoding: 'utf8', timeout: settings.extractionTimeoutMs });
      if (extraction.error) throw new Error('Recorded evidence: authenticated archive extraction could not complete',
        { cause: extraction.error });
      assert.equal(extraction.status, 0, `Recorded evidence: archive extraction failed: ${extraction.stderr}`);
      const extracted = JSON.parse(extraction.stdout);
      assert.equal(extracted.verified, true); assert.equal(extracted.prefix, policy.archivePrefix);
      assert.ok(Number.isSafeInteger(extracted.files) && extracted.files > 0);
      const root = ownedPath(temporary, policy.archivePrefix);
      const directories = policy.nodeDirectories.map((directory) => ownedPath(root, directory));
      const result = study.verifySet(directories);
      for (const directory of directories) {
        const index = JSON.parse(fs.readFileSync(ownedPath(directory, 'index.json'), 'utf8'));
        assert.equal(index.harness.sha256, current.harnessSha256,
          'Recorded evidence: verified archive belongs to a different measurement harness');
        assert.equal(index.harness.identity.sourceHash, current.measuredSources.B,
          'Recorded evidence: verified archive belongs to different candidate sources');
        assert.deepEqual(index.manifest.preparation, method.preparation,
          'Recorded evidence: verified archive used a different official preparation');
        assert.deepEqual(index.manifest.preparation.identity.inputs.sources, current.compiledSources,
          'Recorded evidence: verified archive changed compiled source identities');
      }
      const packageManifest = verifyPackageManifest(ownedPath(archiveRoot, policy.compiledPackageManifest), candidateRoot);
      return { ...result, authenticatedFiles: extracted.files, current: { ...current, packageManifest }, measurementExecuted: false,
        scope: 'Complete recorded Linux study; offline replay does not measure the CI host or a different build.' };
    } finally {
      assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(os.tmpdir()),
        'Recorded evidence: cleanup directory escaped the temporary owner');
      assert.ok(path.basename(temporary).startsWith(settings.temporaryDirectoryPrefix));
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
  return { verifyCurrentInputs, verifyEvidence };
}

/**
 * Keep a rejected budget (1) distinct from stale inputs or damaged evidence (2) at the real CLI boundary.
 * @param {Function} createVerifier - Trusted factory for the declared study and archive policy.
 * @param {string[]} [argumentsList] - Baseline source directory and archive directory.
 * @returns {void} Writes the complete original decision; never starts a measurement.
 */
function runRecordedEvidenceCli(createVerifier, argumentsList = process.argv.slice(2)) {
  try {
    assert.equal(argumentsList.length, 2, 'Recorded evidence: provide baseline and archive paths');
    const result = createVerifier().verifyEvidence(path.resolve(argumentsList[0]), path.resolve(argumentsList[1]));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.accepted !== true) {
      process.stderr.write('Recorded evidence: the complete recorded study has not accepted the performance budget; no measurement was repeated.\n');
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 2;
  }
}

module.exports = { createRecordedEvidenceVerifier, runRecordedEvidenceCli };
