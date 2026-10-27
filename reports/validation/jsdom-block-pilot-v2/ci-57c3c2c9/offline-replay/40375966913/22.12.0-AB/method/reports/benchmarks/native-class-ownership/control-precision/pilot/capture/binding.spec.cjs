/** @file Synthetic metadata contracts plus real CLI/filesystem boundaries; these are not observed source identities or timings. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { calendar } = require('../blocks.cjs');
const policy = require('../constants/capture.json');
const { validate } = require('./binding.cjs');
const { filesDigest, ownedPath } = require('./source.cjs');

/** @returns {object} Explicitly synthetic format examples, never used as actual capture evidence. */
function syntheticMetadata() {
  const shard = calendar()[0];
  const expected = { mode: policy.functionalMode, parentPid: 101, node: shard.node, nodeExecutable: '/synthetic-contract-sdk/node',
    sourceDirectory: '/synthetic-contract-source', sourceCommit: 'a'.repeat(policy.gitCommitHexLength),
    criterionId: shard.criterionId, files: { 'synthetic-contract.cjs': '1'.repeat(policy.sha256HexLength) } };
  const binding = { revision: policy.revision, ...expected,
    nodeExecutableSha256: policy.nodeExecutables[shard.node], sourceFilesDigest: filesDigest(expected.files),
    plannedProcesses: shard.processes.filter((input) => input.block < policy.functionalBlocks).length,
    publicationSha256: null, hosted: null, performanceAccepted: null, gateReevaluated: false };
  delete binding.files;
  return { binding, expected };
}

test('validates a complete functional binding without asserting a hosted run or performance observation', () => {
  const { binding, expected } = syntheticMetadata(); validate(binding, expected);
  assert.equal(binding.plannedProcesses, 32); assert.equal(binding.hosted, null);
});

test('rejects substitutions of actual-parent, SDK, source, criterion and process-count declarations', () => {
  for (const change of [
    { parentPid: 102 }, { node: 'v24.14.1' }, { nodeExecutable: '/foreign/node' },
    { nodeExecutableSha256: '0'.repeat(policy.sha256HexLength) }, { sourceDirectory: '/foreign/source' },
    { sourceCommit: 'b'.repeat(policy.gitCommitHexLength) }, { sourceFilesDigest: '0'.repeat(policy.sha256HexLength) },
    { criterionId: calendar()[1].criterionId }, { plannedProcesses: 31 },
    { publicationSha256: '0'.repeat(policy.sha256HexLength) }, { hosted: {} },
    { performanceAccepted: true }, { gateReevaluated: true }
  ]) {
    const { binding, expected } = syntheticMetadata(); Object.assign(binding, change);
    assert.throws(() => validate(binding, expected));
  }
});

test('uses a canonical source-map digest independent of insertion order and rejects malformed digests', () => {
  const first = { 'z.cjs': '1'.repeat(policy.sha256HexLength), 'a.cjs': '2'.repeat(policy.sha256HexLength) };
  const reversed = Object.fromEntries(Object.entries(first).reverse());
  assert.equal(filesDigest(first), filesDigest(reversed));
  for (const value of ['', 'g'.repeat(policy.sha256HexLength), '1'.repeat(policy.sha256HexLength) + '\n']) {
    assert.throws(() => filesDigest({ 'a.cjs': value }));
  }
});

test('keeps source members inside a real owned filesystem root and rejects aliases and control characters', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-pilot-source-'));
  const root = path.join(temporary, 'source'); const outside = path.join(temporary, 'outside');
  fs.mkdirSync(root); fs.mkdirSync(outside); fs.writeFileSync(path.join(root, 'member.json'), '{}');
  fs.writeFileSync(path.join(outside, 'external.json'), '{}');
  try {
    assert.equal(ownedPath(root, 'member.json'), path.join(fs.realpathSync(root), 'member.json'));
    for (const relative of ['../outside/external.json', '/absolute', 'a/../member.json', 'a//b', '.', 'c:member.json', 'a\\b', '\tbad', 'a\0b']) {
      assert.throws(() => ownedPath(root, relative));
    }
    fs.symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => ownedPath(root, 'linked/external.json'), /linked source member/);
    assert.equal(fs.readFileSync(path.join(outside, 'external.json'), 'utf8'), '{}');
  } finally {
    assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('rustdom-pilot-source-'));
    fs.rmSync(temporary, { recursive: true });
  }
});

test('real scientific worker and parent CLIs cannot bypass the unpublished method or missing hosted binding', () => {
  const environment = { ...process.env }; delete environment[policy.bindingEnvironment];
  for (const [file, args] of [
    ['worker.cjs', [policy.captureOption, 'unused-manifest', 'unused-input', 'unused-report']],
    ['run.cjs', [policy.captureOption, 'unused-package', 'unused-output', calendar()[0].criterionId]]
  ]) {
    const result = spawnSync(process.execPath, [path.join(__dirname, file), ...args],
      { encoding: 'utf8', env: environment, timeout: policy.maximumMetadataCommandMs });
    assert.equal(result.error, undefined); assert.equal(result.status, 2); assert.equal(result.stdout, '');
    assert.match(JSON.parse(result.stderr).message, /not enabled|not published|parent binding|declared workflow|GitHub Actions/);
  }
});
