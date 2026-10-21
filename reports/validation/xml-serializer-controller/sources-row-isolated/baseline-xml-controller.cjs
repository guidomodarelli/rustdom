'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const task = '/mnt/c/Users/guido/ghq/projects/rustdom';
const managed = '/mnt/c/Users/guido/.codex/worktrees/migration-inventory/rustdom';
const candidate = fs.readFileSync(task + '/.cache/xml-controller-root.txt', 'utf8').trim();
const reference = fs.realpathSync('/home/guido/rustdom-element-collection-ffhkkq/baseline-engine');
const delta = spawnSync('git', ['diff', '--exit-code', 'checkpoint-065-attribute-reads..checkpoint-066-reference-catalog', '--',
  'src', 'scripts/build.mjs', 'scripts/build-native.mjs', 'Cargo.toml', 'Cargo.lock', 'third-party', 'types'], { cwd: task, encoding: 'utf8' });
assert.equal(delta.status, 0, delta.stdout + delta.stderr);
const binarySha256 = createHash('sha256').update(fs.readFileSync(reference + '/dist/rustdom.node')).digest('hex');
assert.equal(binarySha256, '10ebf630ccc70bf2ac94fec4c4a2e8ba2aaacb90070c4f229dabcde164a96803');
const root = fs.mkdtempSync('/home/guido/rustdom-xml-controller-baseline-');
fs.symlinkSync(reference + '/dist', root + '/dist', 'dir');
fs.symlinkSync('/home/guido/rustdom-pr67-review-union-W0qZNw/node_modules', root + '/node_modules', 'dir');
fs.mkdirSync(root + '/tests');
fs.copyFileSync(managed + '/tests/xml-serializer-controller.spec.cjs', root + '/tests/xml-serializer-controller.spec.cjs');
const outcomes = [];
for (const executable of [task + '/.tools/node/bin/node', task + '/.tools/node-22/bin/node']) {
  const version = spawnSync(executable, ['--version'], { encoding: 'utf8' }).stdout.trim();
  const result = spawnSync(executable, ['--test', '--test-name-pattern=preserve', root + '/tests/xml-serializer-controller.spec.cjs'], { cwd: root, encoding: 'utf8' });
  fs.writeFileSync(candidate + '/reports/validation/xml-serializer-controller/baseline-contracts-' + version + '.log', result.stdout + result.stderr);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const passed = Number(result.stdout.match(/^(?:#|ℹ)\s+pass\s+(\d+)/m)?.[1]); assert.ok(passed > 0);
  outcomes.push({ node: version, pass: true, publicDifferentialCases: passed });
}
fs.writeFileSync(candidate + '/reports/validation/xml-serializer-controller/reference.json', JSON.stringify({
  referenceCheckpoint: 'checkpoint-066-reference-catalog', referenceCommit: '75db9bb095db8457a6ae567f219e2224a55b9f36',
  runtimeBuiltAtCheckpoint: 'checkpoint-065-attribute-reads', productionSourcesIdenticalAcrossCheckpoints65And66: true,
  nativeBinarySha256: binarySha256, runtimeRoot: reference, fixtureRoot: root, outcomes,
  excludedNewNativeCounterCase: 'The new operation counter does not exist in the previous runtime; every public differential behavior case runs on the previous runtime.' }, null, 2) + '\n');
console.log(JSON.stringify({ outcomes, binarySha256, pass: true }));
