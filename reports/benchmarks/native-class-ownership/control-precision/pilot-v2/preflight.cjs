/** @module pilot-package-preflight Authenticates the current verifier before it reads a sealed package or imports the sampler graph. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const policy = require('./constants/worker.json');
const repository = path.resolve(__dirname, '../../../../..');

/**
 * Run only the independently pinned current Python authenticator, retaining both streams before interpreting its result.
 * @param {string} prepared - Existing disjoint package directory.
 * @param {string} destination - Existing parent-owned report directory.
 * @param {string} label - Fixed parent role identifying this verification.
 * @returns {object} Independent authenticated package receipt; no DOM is executed here.
 */
function authenticatePackage(prepared, destination, label) {
  for (const binding of Object.values(policy.authenticator)) {
    const location = path.join(repository, binding.path); const status = fs.lstatSync(location);
    assert.ok(status.isFile() && !status.isSymbolicLink() && status.size <= policy.maximumAuthenticatorBytes);
    const raw = fs.readFileSync(location);
    assert.ok(raw.length <= policy.maximumAuthenticatorBytes);
    assert.equal(createHash('sha256').update(raw).digest('hex'), binding.sha256,
      'Pilot qualifier: authenticator binding changed before execution: ' + binding.path);
  }
  const verification = spawnSync('python3', ['-B', path.join(repository, policy.authenticator.script.path),
    '--verify', prepared, process.execPath], { encoding: 'utf8', timeout: policy.authenticationTimeoutMs, maxBuffer: policy.maximumReportBytes });
  fs.writeFileSync(path.join(destination, label + '.stdout.log'), verification.stdout ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(destination, label + '.stderr.log'), verification.stderr ?? '', { flag: 'wx' });
  assert.ifError(verification.error); assert.equal(verification.status, 0, verification.stderr);
  const result = JSON.parse(verification.stdout);
  assert.equal(result.verified, true); assert.equal(result.artifactId, policy.selectedArtifactId);
  assert.equal(result.nativeBinarySha256, policy.nativeBinarySha256);
  return result;
}

module.exports = { authenticatePackage };
