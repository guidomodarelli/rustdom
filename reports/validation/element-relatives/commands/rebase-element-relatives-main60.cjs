'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const paths = ['.gitattributes', 'benchmarks/compare.cjs', 'benchmarks/worker.cjs', 'benchmarks/workload-plan.cjs',
  'scripts/build.mjs', 'src/dom/mod.rs', 'src/dom/native-tree.cjs', 'src/dom/tree.rs', 'tests/helpers/collection-query-memory.cjs',
  'types/index.d.cts', 'types/native.d.cts', 'benchmarks/constants/element-relatives.cjs', 'benchmarks/element-relatives.cjs',
  'src/dom/element_relatives.rs', 'tests/benchmarks/element-relatives.spec.cjs', 'tests/element-relatives.spec.cjs'];
const from = '2ae5f2cb71a3d5da7ed58e3eb5b87b558b887a47';
assert.equal(git('rev-parse', 'HEAD'), from);
assert.equal(git('branch', '--show-current'), 'feature/native-element-relatives');
git('diff', '--exit-code', from, 'origin/main');
const snapshot = paths.map((path) => ({ path, sha256: createHash('sha256').update(fs.readFileSync(path)).digest('hex') }));
git('stash', 'push', '--include-untracked', '--message', 'codex-owned-element-relatives-main60', '--', ...paths);
const stash = git('rev-parse', 'stash@{0}');
fs.writeFileSync('.cache/element-relatives-main60-owned-stash.txt', stash + '\n');
git('rebase', '--onto', 'origin/main', from, 'feature/native-element-relatives');
git('stash', 'apply', stash);
for (const entry of snapshot) assert.equal(createHash('sha256').update(fs.readFileSync(entry.path)).digest('hex'), entry.sha256, entry.path);
const sourcePath = '.cache/element-relatives-current-source.json';
const previous = JSON.parse(fs.readFileSync(sourcePath));
fs.writeFileSync('.cache/element-relatives-before-main60-source.json', JSON.stringify(previous, null, 2) + '\n');
const current = require(process.cwd() + '/benchmarks/sources.cjs').captureSourceIdentity(process.cwd());
assert.equal(current.sourceHash, previous.sourceHash);
fs.writeFileSync(sourcePath, JSON.stringify(current, null, 2) + '\n');
const proof = { at: new Date().toISOString(), from, to: git('rev-parse', 'HEAD'), stash,
  equivalentParentTrees: true, preservedFiles: snapshot, sourceHash: current.sourceHash,
  validationReuse: 'Only unpublished branch ancestry changed; parent trees and all sixteen dirty files are byte-identical. No source/build/test restart.' };
fs.writeFileSync('C:/Users/guido/ghq/projects/rustdom/.cache/element-relatives-main60-rebase.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ from, to: proof.to, preservedFiles: snapshot.length, sourceHash: current.sourceHash, stash }));
