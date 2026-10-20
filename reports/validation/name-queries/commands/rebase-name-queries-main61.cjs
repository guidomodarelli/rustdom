'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const paths = ['benchmarks/compare.cjs', 'benchmarks/worker.cjs', 'benchmarks/workload-plan.cjs', 'scripts/build.mjs',
  'src/dom/attribute_view.rs', 'src/dom/collection_members.rs', 'src/dom/collection_queries.rs', 'src/dom/native-tree.cjs', 'src/dom/tree.rs',
  'tests/helpers/abort-runner-memory.cjs', 'tests/helpers/collection-query-memory.cjs', 'types/native.d.cts',
  'benchmarks/constants/name-queries.cjs', 'benchmarks/name-queries.cjs', 'tests/benchmarks/name-queries.spec.cjs', 'tests/name-queries.spec.cjs'];
const from = '0921ab08459a22b237faf1c2ba19a250720f1dd9';
assert.equal(git('rev-parse', 'HEAD'), from);
assert.equal(git('branch', '--show-current'), 'feature/native-name-queries');
git('diff', '--exit-code', from, 'origin/main');
const before = require(process.cwd() + '/benchmarks/sources.cjs').captureSourceIdentity(process.cwd());
const snapshot = paths.map((path) => ({ path, sha256: createHash('sha256').update(fs.readFileSync(path)).digest('hex') }));
git('stash', 'push', '--include-untracked', '--message', 'codex-owned-name-queries-main61', '--', ...paths);
const stash = git('rev-parse', 'stash@{0}');
fs.writeFileSync('.cache/name-queries-main61-owned-stash.txt', stash + '\n');
git('rebase', '--onto', 'origin/main', from, 'feature/native-name-queries');
git('stash', 'apply', stash);
for (const entry of snapshot) assert.equal(createHash('sha256').update(fs.readFileSync(entry.path)).digest('hex'), entry.sha256, entry.path);
const after = require(process.cwd() + '/benchmarks/sources.cjs').captureSourceIdentity(process.cwd());
assert.equal(before.sourceHash, after.sourceHash);
fs.writeFileSync('.cache/name-queries-before-main61-source.json', JSON.stringify(before, null, 2) + '\n');
fs.writeFileSync('.cache/name-queries-current-source.json', JSON.stringify(after, null, 2) + '\n');
const proof = { at: new Date().toISOString(), from, to: git('rev-parse', 'HEAD'), stash,
  equivalentParentTrees: true, preservedFiles: snapshot, sourceHash: after.sourceHash,
  validationReuse: 'Only unpublished branch ancestry changed; parent trees and all sixteen dirty files are byte-identical. Live validation process remains untouched.' };
fs.writeFileSync('C:/Users/guido/ghq/projects/rustdom/.cache/name-queries-main61-rebase.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ from, to: proof.to, preservedFiles: snapshot.length, sourceHash: after.sourceHash, stash }));
