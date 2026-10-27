/** @module confirmation-production-equivalence Compares every published compiler input with the selected candidate; source equivalence is not performance acceptance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { hashFile } = require('../combined-process-study/io.cjs');
const policy = require('./constants/production.json');
const repository = path.resolve(__dirname, '../../../..');

/** @param {string} relative - Independently pinned source path. @returns {string[]} Safe canonical path components. */
function components(relative) {
  assert.equal(typeof relative, 'string');
  assert.ok(relative.length > 0 && !path.posix.isAbsolute(relative) && !/[\\:\r\n\0]/.test(relative));
  const parts = relative.split('/');
  assert.ok(parts.every((part) => part !== '' && part !== '.' && part !== '..' && part !== '.git'));
  return parts;
}

/**
 * Read all 344 immutable candidate source identities before inspecting the caller's tree.
 * @returns {object} Exact selected compiler input map, not a denominator for migration or compatibility.
 */
function declaredInputs() {
  const filename = path.join(repository, ...components(policy.declaration.path));
  const status = fs.lstatSync(filename);
  assert.ok(status.isFile() && !status.isSymbolicLink() && status.size <= policy.maximumDeclarationBytes);
  const descriptor = fs.openSync(filename, 'r');
  let declaration;
  try {
    const opened = fs.fstatSync(descriptor);
    assert.equal(opened.dev, status.dev); assert.equal(opened.ino, status.ino); assert.equal(opened.size, status.size);
    const raw = Buffer.allocUnsafe(opened.size + 1); let total = 0;
    while (total < raw.length) {
      const length = fs.readSync(descriptor, raw, total, raw.length - total, null);
      if (length === 0) break;
      total += length;
    }
    assert.equal(total, opened.size); assert.equal(fs.fstatSync(descriptor).size, opened.size);
    const bytes = raw.subarray(0, total);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), policy.declaration.sha256,
      'Production equivalence: selected compiler input declaration changed');
    declaration = JSON.parse(bytes.toString('utf8'));
  } finally { fs.closeSync(descriptor); }
  assert.ok(declaration.candidateInputs && typeof declaration.candidateInputs === 'object' && !Array.isArray(declaration.candidateInputs));
  assert.equal(Object.keys(declaration.candidateInputs).length, policy.inputCount);
  for (const [relative, digest] of Object.entries(declaration.candidateInputs)) {
    components(relative); assert.equal(typeof digest, 'string'); assert.match(digest, /^[a-f0-9]{64}$/);
  }
  return declaration.candidateInputs;
}

/**
 * Describe every mismatch instead of treating a qualified isolated candidate as the production implementation.
 * Git identity and artifact authentication are independent checks owned by the future integral producer/reader.
 * @param {string} source - Physical current production or authenticated candidate-source root.
 * @returns {object} Complete file identity comparison; never a performance decision or a claim that a binary was built.
 */
function inspectProduction(source) {
  const inputs = declaredInputs();
  assert.equal(typeof source, 'string');
  const sourceDirectory = fs.realpathSync(source);
  assert.ok(fs.lstatSync(sourceDirectory).isDirectory());
  const differences = []; const observedInputs = {};
  // The selected declaration has no project-local Cargo, npm or toolchain overrides.
  // Inspect names without following links: even a dangling link must block equivalence.
  // This closes these optional project inputs; it does not authenticate build environment or global configuration.
  const unregisteredBuildInputs = fs.readdirSync(sourceDirectory).filter((name) =>
    policy.absentBuildConfigurationNames.includes(name) ||
    policy.absentBuildConfigurationPrefixes.some((prefix) => name.startsWith(prefix))).sort();
  for (const relative of unregisteredBuildInputs) {
    differences.push({ path: relative, expectedSha256: null, actualSha256: null, reason: 'unregistered-build-configuration' });
  }
  for (const [relative, expectedSha256] of Object.entries(inputs)) {
    const filename = path.join(sourceDirectory, ...components(relative));
    let actualSha256 = null; let reason = 'missing-input';
    if (fs.existsSync(filename)) {
      const status = fs.lstatSync(filename);
      const physical = fs.realpathSync(filename);
      if (!status.isFile() || status.isSymbolicLink() || !physical.startsWith(sourceDirectory + path.sep)) reason = 'nonphysical-or-escaping-input';
      else {
        actualSha256 = hashFile(filename, policy.maximumCompilerInputBytes, false);
        reason = actualSha256 === expectedSha256 ? null : 'different-input-bytes';
      }
    }
    observedInputs[relative] = actualSha256;
    if (reason !== null) differences.push({ path: relative, expectedSha256, actualSha256, reason });
  }
  return { revision: policy.revision, sourceDirectory, inputCount: policy.inputCount,
    selectedPackageArtifact: policy.selectedPackageArtifact, selectedNativeBinarySha256: policy.selectedNativeBinarySha256,
    declarationSha256: policy.declaration.sha256, observedInputs, unregisteredBuildInputs, differences,
    matchesSelectedCompilerInputs: differences.length === 0,
    globalConfigurationAuthenticated: false, buildEnvironmentAuthenticated: false,
    GitIdentityAuthenticated: false, packageAuthenticatedByThisFunction: false, binaryBuiltByThisFunction: false,
    performanceAccepted: null, gateReevaluated: false };
}

/** @param {string} source - Actual producer root, independently identified by Git. @returns {object} Complete matching input proof; capture must remain blocked on any mismatch. */
function requireProductionEquivalence(source) {
  const result = inspectProduction(source);
  assert.equal(result.matchesSelectedCompilerInputs, true,
    'Production equivalence: ' + result.differences.length + ' compiler inputs differ from the selected candidate: ' +
    result.differences.map((entry) => entry.path).join(', '));
  return result;
}

module.exports = { inspectProduction, requireProductionEquivalence };
