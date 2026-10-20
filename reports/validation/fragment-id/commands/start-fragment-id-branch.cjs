'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const primary = 'C:/Users/guido/ghq/projects/rustdom';
const repository = 'C:/Users/guido/.codex/worktrees/native-collection-queries/rustdom';
const merged = JSON.parse(fs.readFileSync(primary + '/.cache/pr74-merged.json'));
assert.equal(merged.state, 'MERGED');
assert.equal(merged.treeMatchesReviewedHead, true);
assert.equal(merged.tag, 'checkpoint-062-name-queries');
const git = (...args) => execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain'), '');
assert.equal(git('branch', '--show-current'), '');
assert.equal(git('rev-parse', 'HEAD'), merged.mergeCommit.oid);
assert.equal(git('branch', '--list', 'feature/native-fragment-id'), '');
git('switch', '-c', 'feature/native-fragment-id', merged.mergeCommit.oid);
const runtime = fs.readFileSync(primary + '/.cache/fragment-id-root.txt', 'utf8').trim();
execFileSync('wsl.exe', ['-e', '/mnt/c/Users/guido/ghq/projects/rustdom/.tools/node/bin/node',
  '/mnt/c/Users/guido/ghq/projects/rustdom/.cache/copy-fragment-id-sources.cjs', runtime,
  '/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom', '/mnt/c/Users/guido/ghq/projects/rustdom'], { stdio: 'pipe' });
const source = require(repository + '/benchmarks/sources.cjs').captureSourceIdentity(repository);
assert.equal(source.sourceHash, '73f242643bfee440594c36b15635917118a01221cabea18bd7b85bd58553ef73');
assert.equal(source.measuredSources.length, 310);
const hashes = JSON.parse(fs.readFileSync(repository + '/.cache/fragment-id-copied-source-hashes.json'));
const status = execFileSync('git', ['-C', repository, 'status', '--porcelain=v1', '-z', '--untracked-files=all'], { encoding: 'utf8' });
const dirty = status.split('\0').filter(Boolean).map((entry) => entry.slice(3));
assert.deepEqual(dirty.sort(), hashes.map((file) => file.path).sort());
for (const target of [repository + '/.cache/fragment-id-current-source.json', primary + '/.cache/fragment-id-current-source.json']) {
  fs.writeFileSync(target, JSON.stringify(source, null, 2) + '\n');
}
const proof = { capturedAt: new Date().toISOString(), base: merged.mergeCommit.oid, tag: merged.tag,
  branch: 'feature/native-fragment-id', sourceHash: source.sourceHash, measuredSources: source.measuredSources.length,
  dirtyPaths: dirty, hashes, baselinePublishedHead: merged.headRefOid, baselineTreeEqualsMain: true };
fs.writeFileSync(primary + '/.cache/fragment-id-start-proof.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ branch: proof.branch, base: proof.base, sourceHash: proof.sourceHash, ownChangedFiles: dirty.length, allHashesMatch: true }));
