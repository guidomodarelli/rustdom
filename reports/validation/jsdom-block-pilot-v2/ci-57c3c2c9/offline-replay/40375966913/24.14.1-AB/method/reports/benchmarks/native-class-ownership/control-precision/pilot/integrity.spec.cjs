/** Negative byte-corruption tests of the authenticator boundary, using the actual functional CLI and sealed package. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const policy = require('./constants/worker.json');
const repository = path.resolve(__dirname, '../../../../..');
const prepared = process.env[policy.functionalPackageEnvironment];
assert.equal(process.platform, 'linux', 'Pilot authenticator probes require real Linux Git/filesystem');
assert.equal(typeof prepared, 'string', 'Provide the already-authenticated numeric package for real integrity probes');
assert.ok(fs.lstatSync(path.join(repository, '.git')).isDirectory());

function status() {
  const result = spawnSync('git', ['-c', 'core.longpaths=true', 'status', '--porcelain=v1', '--untracked-files=all'], { cwd: repository });
  assert.equal(result.status, 0, result.stderr.toString()); return result.stdout;
}

for (const [role, binding] of Object.entries(policy.authenticator)) {
  test(`changed ${role} bytes are rejected before invoking the Python authenticator or DOM`, { concurrency: false }, () => {
    const before = status(); assert.equal(before.length, 0, 'Integrity probes require a clean owned native checkout');
    const filename = path.join(repository, binding.path); const original = fs.readFileSync(filename);
    assert.equal(createHash('sha256').update(original).digest('hex'), binding.sha256);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-authenticator-probe-'));
    try {
      // Whitespace changes the bound bytes without substituting a fake library or helper implementation.
      fs.writeFileSync(filename, Buffer.concat([original, Buffer.from('\n')]));
      const destination = path.join(directory, 'rejected');
      const result = spawnSync(process.execPath, ['--expose-gc', path.join(__dirname, 'functional.cjs'), policy.functionalOption, prepared, destination],
        { cwd: repository, encoding: 'utf8', timeout: policy.authenticationTimeoutMs, killSignal: 'SIGTERM', maxBuffer: policy.maximumReportBytes });
      assert.equal(result.error, undefined); assert.equal(result.status, policy.failureExitCode);
      assert.match(result.stderr, /authenticator binding changed before execution/);
      assert.deepEqual(fs.readdirSync(destination), [], 'Rejected binding must not invoke the authenticator, sampler or workers');
    } finally {
      fs.writeFileSync(filename, original);
      assert.deepEqual(fs.readFileSync(filename), original);
      assert.deepEqual(status(), before);
      fs.rmSync(directory, { recursive: true });
    }
  });
}
