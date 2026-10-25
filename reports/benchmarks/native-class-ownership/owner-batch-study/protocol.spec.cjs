/** @file Actual filesystem/provenance contracts and explicit synthetic control-plane mutations; no new DOM or performance samples. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, after } = require('node:test');
const { readJSON, writeJSON } = require('./io.cjs');
const source = require('./source.cjs');
const { plan, executionContext } = require('./capture.cjs');
const { validate: validateBinding } = require('./binding.cjs');
const policy = require('./constants/capture.json');
const model = require('../combined-process-study/model.cjs');
const artifact = require('../owner-batch-packages/constants/artifact.json');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-batch-protocol-'));
const part = process.env.RUSTDOM_OWNER_BATCH_PART_FOR_CONTRACTS;
assert.ok(part, 'Provide an actual completed functional controller part');
const index = readJSON(path.join(part, policy.indexFile));
assert.equal(index.complete, true); assert.equal(index.mode, 'functional');
const binding = readJSON(path.join(part, policy.bindingFile));
const expected = { mode: 'functional', sourceDirectory: index.sourceDirectory, sourceCommit: index.sourceCommit,
  parentPid: index.parentPid, node: index.runtime.node, files: index.sourceFiles };

test('bounded real JSON reads and atomic owned progress preserve the latest complete state', () => {
  const filename = path.join(root, 'progress.json'); writeJSON(filename, { completed: 1 });
  assert.deepEqual(readJSON(filename), { completed: 1 });
  writeJSON(filename, { completed: 2 }); assert.deepEqual(readJSON(filename), { completed: 2 });
  assert.equal(fs.existsSync(path.join(root, '.progress.json.next')), false);
});
test('an interrupted sibling and the last complete progress file are preserved on collision', () => {
  const filename = path.join(root, 'collision.json'); writeJSON(filename, { completed: 1 });
  const pending = path.join(root, '.collision.json.next'); fs.writeFileSync(pending, 'partial');
  assert.throws(() => writeJSON(filename, { completed: 2 }));
  assert.deepEqual(readJSON(filename), { completed: 1 }); assert.equal(fs.readFileSync(pending, 'utf8'), 'partial');
});
test('oversized, malformed and linked JSON are rejected through real filesystem boundaries', () => {
  const oversized = path.join(root, 'oversized.json'); fs.closeSync(fs.openSync(oversized, 'wx'));
  fs.truncateSync(oversized, policy.maximumJSONBytes + 1); assert.throws(() => readJSON(oversized));
  const invalid = path.join(root, 'invalid.json'); fs.writeFileSync(invalid, '{'); assert.throws(() => readJSON(invalid));
  const link = path.join(root, 'linked.json'); fs.symlinkSync(invalid, link); assert.throws(() => readJSON(link));
});
test('an actual empty Git repository retains its failed HEAD operation and real untracked status', () => {
  const directory = path.join(root, 'empty-git'); fs.mkdirSync(directory);
  const initialized = spawnSync('git', ['init', '--quiet', directory], { encoding: 'utf8' }); assert.equal(initialized.status, 0, initialized.stderr);
  fs.writeFileSync(path.join(directory, 'marker.txt'), 'actual file');
  const identity = source.gitIdentity(directory);
  assert.equal(identity.sourceCommit, null); assert.ok(identity.sourceChangesRaw.includes('marker.txt'));
  assert.equal(identity.sourceGitErrors.length, 1); assert.deepEqual(identity.sourceGitErrors[0].operation, ['rev-parse', 'HEAD']);
  assert.notEqual(identity.sourceGitErrors[0].exitCode, 0); assert.ok(identity.sourceGitErrors[0].stderr.length > 0);
});
test('a Windows-style gitfile is rejected before WSL Git can reinterpret it', () => {
  const directory = path.join(root, 'gitfile'); fs.mkdirSync(directory); fs.writeFileSync(path.join(directory, '.git'), 'gitdir: C:/unrelated\n');
  assert.throws(() => source.gitIdentity(directory), /native real Git checkout/);
});
test('real functional source Git metadata is not normalized into a published clean identity', () => {
  const actual = source.gitIdentity(index.sourceDirectory);
  assert.equal(actual.sourceCommit, index.sourceCommit); assert.deepEqual(actual.sourceGitErrors, []);
  assert.equal(typeof actual.sourceChangesRaw, 'string');
});
test('the candidate source manifest is in the complete current dependency closure', () => {
  const graph = source.currentFiles();
  assert.equal(graph.files[artifact.sourceManifestPath], artifact.sourceManifestSha256);
  for (const relative of Object.keys(artifact.collectionFiles)) assert.ok(Object.hasOwn(graph.files, policy.collection + '/' + relative));
});
test('the complete 1024-tuple plan is unchanged and qualification cannot narrow scientific capture', () => {
  assert.deepEqual(plan('capture'), model.plan()); assert.equal(plan('capture').length, 1024);
  assert.equal(plan('functional').length, 32); assert.throws(() => plan('only-favorable-rows'));
  const full = plan('capture');
  for (let position = 0; position < full.length; position += 2) {
    const first = full[position]; const second = full[position + 1];
    for (const field of ['phase', 'engine', 'position', 'rowIndex']) assert.equal(first[field], second[field]);
    assert.deepEqual(new Set([first.label, second.label]), new Set(['A', 'B']));
  }
});
test('the actual recorded functional binding validates without a scientific or clean-Git claim', () => {
  validateBinding(binding, expected);
  assert.equal(binding.hosted, null); assert.equal(binding.publicationSha256, null);
});
test('synthetic context mutations cannot change parent, SDK, source graph or producer identity', () => {
  for (const [field, value] of [['parentPid', binding.parentPid + 1], ['node', 'v0.0.0'], ['sourceFilesDigest', '0'.repeat(64)],
    ['sourceDirectory', '/unrelated']]) {
    assert.throws(() => validateBinding({ ...binding, [field]: value }, expected));
  }
  assert.throws(() => validateBinding(binding, { ...expected, sourceCommit: null }));
});
test('a functional binding cannot be promoted through a synthetic role or publication field', () => {
  assert.throws(() => validateBinding({ ...binding, mode: 'capture' }, expected));
  assert.throws(() => validateBinding({ ...binding, publicationSha256: '0'.repeat(64) }, expected));
});
test('the unpublished capture remains blocked before resolving any package or creating a worker', () => {
  assert.throws(() => executionContext('capture'));
  assert.equal(executionContext('functional'), null);
});
after(() => fs.writeFileSync(path.join(root, 'observations.json'), JSON.stringify({ node: process.version,
  actualFunctionalPart: part, actualSourceCommit: index.sourceCommit, actualSourceChangesRaw: index.sourceChangesRaw,
  sourceGitErrors: index.sourceGitErrors, newDOMExecuted: false, performanceAccepted: null }, null, 2) + '\n'));
