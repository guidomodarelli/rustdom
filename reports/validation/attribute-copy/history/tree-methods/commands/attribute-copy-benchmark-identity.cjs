'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const root = '/home/guido/rustdom-attribute-copy-zCfwmZ';
const managed = '/mnt/c/Users/guido/.codex/worktrees/native-clone-seeds/rustdom';
const baseline = fs.realpathSync('/home/guido/rustdom-element-collection-ffhkkq/baseline-engine');
const file = root + '/reports/benchmarks/attribute-copy/variants.json';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function distribution(directory, relative = 'dist') {
  return fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).flatMap((entry) => {
    const name = relative + '/' + entry.name;
    return entry.isDirectory() ? distribution(directory, name) : [{ path: name, sha256: digest(fs.readFileSync(path.join(directory, name))) }];
  }).sort((left, right) => left.path.localeCompare(right.path));
}
const identity = require(root + '/benchmarks/sources.cjs').captureSourceIdentity;
if (process.argv[2] === 'verify') {
  const manifest = JSON.parse(fs.readFileSync(file));
  assert.equal(identity(root).sourceHash, manifest.sourceIdentity.sourceHash);
  assert.equal(identity(managed).sourceHash, manifest.sourceIdentity.sourceHash);
  for (const variant of Object.values(manifest.variants)) assert.deepEqual(distribution(variant.root), variant.files);
  console.log('Source, candidate and checkpoint-65 distributions are unchanged');
} else {
  assert.equal(fs.existsSync(file), false, 'Do not overwrite frozen benchmark identities');
  const budget = JSON.parse(fs.readFileSync(managed + '/reports/benchmarks/attribute-copy/public-clone-budget.json'));
  assert.equal(digest(fs.readFileSync(baseline + '/dist/rustdom.node')), budget.reference.nativeBinarySha256);
  const sourceIdentity = identity(root);
  assert.equal(identity(managed).sourceHash, sourceIdentity.sourceHash);
  const variants = Object.fromEntries(Object.entries({ baseline, candidate: root }).map(([name, directory]) => [name, {
    root: directory, files: distribution(directory), nativeBuild: JSON.parse(fs.readFileSync(directory + '/dist/native-build.json')),
  }]));
  const manifest = { capturedAt: new Date().toISOString(), sourceIdentity, sourceBaseCommit: budget.reference.commit,
    note: 'The source identity describes the shared current harness and candidate. Baseline is the frozen checkpoint-65 distribution identified by the original budget and every distribution file below.', variants };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ sourceHash: sourceIdentity.sourceHash, measuredFiles: sourceIdentity.measuredSources.length,
    nativeHashes: Object.fromEntries(Object.entries(variants).map(([name, variant]) => [name,
      variant.files.find((entry) => entry.path === 'dist/rustdom.node').sha256])) }));
}
