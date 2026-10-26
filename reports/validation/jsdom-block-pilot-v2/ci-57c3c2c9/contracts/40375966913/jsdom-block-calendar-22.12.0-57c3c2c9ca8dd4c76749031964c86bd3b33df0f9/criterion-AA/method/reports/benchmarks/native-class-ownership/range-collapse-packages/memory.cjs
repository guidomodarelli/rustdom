/** @file Runs the unchanged reviewed resource probe against the exact assembled runtime, with real Node resolution. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const policy = require('./constants/packages.json');
const candidate = require('../range-collapse-candidate/constants/candidate.json');
const { hash, verify } = require('./identity.cjs');

assert.equal(process.argv.length, 4, 'Provide the independently assembled B package and fresh resource output');
const repository = path.resolve(__dirname, '../../../..');
const root = fs.realpathSync.native(process.argv[2]);
const output = path.join(fs.realpathSync.native(path.dirname(path.resolve(process.argv[3]))), path.basename(process.argv[3]));
assert.ok(!fs.existsSync(output), 'Range package probe: preserve existing output');
const assembly = path.resolve(root, '../..');
assert.equal(root, path.join(assembly, policy.paths.packages, policy.candidateLabel), 'Range package probe requires the canonical B package');
for (const input of [repository, assembly]) assert.ok(output !== input && !output.startsWith(input + path.sep) && !input.startsWith(output + path.sep));
verify(assembly);
assert.equal(hash(path.join(root, policy.paths.binary)), policy.binarySha256);
fs.mkdirSync(output);
for (const name of policy.probeFixtureNames) {
  const original = path.join(repository, path.dirname(policy.qualificationSourcePolicy), '..', name);
  assert.equal(hash(original), candidate.functional[name].sha256);
  const target = path.join(output, candidate.functional[name].target);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(original, target, fs.constants.COPYFILE_EXCL);
}
const endpoint = path.join(repository, policy.memoryEndpoint.path);
assert.equal(hash(endpoint), policy.memoryEndpoint.sha256);
const destination = path.join(output, policy.memoryEndpoint.path);
fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(endpoint, destination, fs.constants.COPYFILE_EXCL);
fs.symlinkSync(path.join(root, 'dist'), path.join(output, 'dist'), 'dir');
const argv = ['--expose-gc', path.join(output, candidate.functional[policy.probeFixtureNames[0]].target)];
const stdout = fs.openSync(path.join(output, 'memory.json'), 'wx');
const stderr = fs.openSync(path.join(output, 'memory.stderr.log'), 'wx');
let result;
try { result = spawnSync(process.execPath, argv, { stdio: ['ignore', stdout, stderr], timeout: policy.materializeTimeoutMs }); }
finally { fs.closeSync(stdout); fs.closeSync(stderr); }
fs.writeFileSync(path.join(output, 'command.json'), JSON.stringify({ executable: process.execPath, argv,
  node: process.version, sha256: hash(process.execPath), exitCode: result.status, signal: result.signal,
  error: result.error?.message ?? null, benchmarkExecuted: false, performanceAccepted: null }, null, 2) + '\n');
assert.ifError(result.error); assert.equal(result.status, 0, 'Range package resource probe failed; preserve its raw output');
console.log(JSON.stringify({ node: process.version, pass: true, benchmarkExecuted: false, performanceAccepted: null }));
