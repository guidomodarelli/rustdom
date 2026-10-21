'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const primary = 'C:/Users/guido/ghq/projects/rustdom';
const repository = 'C:/Users/guido/.codex/worktrees/native-collection-queries/rustdom';
const merged = JSON.parse(fs.readFileSync(primary + '/.cache/pr75-merged.json'));
assert.equal(merged.state, 'MERGED'); assert.equal(merged.treeMatchesReviewedHead, true);
assert.equal(merged.tag, 'checkpoint-063-fragment-id');
const git = (...args) => execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain'), ''); assert.equal(git('branch', '--show-current'), '');
assert.equal(git('rev-parse', 'HEAD'), merged.mergeCommit.oid);
assert.equal(git('branch', '--list', 'feature/native-id-lookups'), '');
git('switch', '-c', 'feature/native-id-lookups', merged.mergeCommit.oid);
const runtime = fs.readFileSync(primary + '/.cache/id-lookups-root.txt', 'utf8').trim();
execFileSync('wsl.exe', ['-e', '/mnt/c/Users/guido/ghq/projects/rustdom/.tools/node/bin/node',
  '/mnt/c/Users/guido/ghq/projects/rustdom/.cache/copy-id-lookups-sources.cjs', runtime,
  '/mnt/c/Users/guido/.codex/worktrees/native-collection-queries/rustdom', '/mnt/c/Users/guido/ghq/projects/rustdom'], { stdio: 'pipe' });
const source = require(repository + '/benchmarks/sources.cjs').captureSourceIdentity(repository);
const runtimeSource = JSON.parse(fs.readFileSync(repository + '/.cache/id-lookups-runtime-source.json'));
assert.equal(source.sourceHash, runtimeSource.sourceHash); assert.equal(source.measuredSources.length, 312);
const hashes = JSON.parse(fs.readFileSync(repository + '/.cache/id-lookups-copied-hashes.json'));
const status = execFileSync('git', ['-C', repository, 'status', '--porcelain=v1', '-z', '--untracked-files=all'], { encoding: 'utf8' });
const dirty = status.split('\0').filter(Boolean).map((entry) => entry.slice(3));
assert.deepEqual(dirty.sort(), hashes.map((file) => file.path).sort());
for (const target of [repository + '/.cache/id-lookups-current-source.json', primary + '/.cache/id-lookups-current-source.json']) {
  fs.writeFileSync(target, JSON.stringify(source, null, 2) + '\n');
}
const proof = { capturedAt: new Date().toISOString(), base: merged.mergeCommit.oid, tag: merged.tag,
  branch: 'feature/native-id-lookups', sourceHash: source.sourceHash, measuredSources: source.measuredSources.length,
  dirtyPaths: dirty, hashes, baselinePublishedHead: merged.headRefOid, baselineTreeEqualsMain: true };
fs.writeFileSync(primary + '/.cache/id-lookups-start-proof.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ branch: proof.branch, base: proof.base, sourceHash: proof.sourceHash, ownChangedFiles: dirty.length }));
