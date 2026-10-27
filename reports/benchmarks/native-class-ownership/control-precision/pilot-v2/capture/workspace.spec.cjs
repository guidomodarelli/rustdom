'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const test = require('node:test');
const { prepareWorkspace } = require('./workspace.cjs');
const source = require('./source.cjs');
const { readJSON, writeNewJSON, hashFile } = require('./io.cjs');
const policy = require('../constants/capture.json');
const worker = require('../constants/worker.json');
const origin = source.producer(policy.functionalMode);

/** @param {Function} callback - Real filesystem scenario. @returns {*} Scenario result. */
function fresh(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-pilot-workspace-'));
  try { return callback(root); }
  finally {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('rustdom-pilot-workspace-'));
    fs.rmSync(root, { recursive: true });
  }
}

test('the shared producer setup snapshots the actual graph and package, then accepts worker input', () => fresh((root) => {
  const snapshot = prepareWorkspace(origin, root, source);
  assert.deepEqual(Object.keys(snapshot).sort(), Object.keys(origin.files).sort());
  assert.ok(fs.statSync(path.join(root, 'workers')).isDirectory());
  assert.equal(hashFile(path.join(root, policy.packageSnapshot)), worker.archiveSha256);
  for (const [relative, member] of Object.entries(snapshot)) {
    assert.equal(member.sha256, origin.files[relative]);
    if (member.location !== null) assert.equal(hashFile(path.join(root, member.location)), member.sha256);
  }
  writeNewJSON(path.join(root, 'inputs', 'layout-check.json'), { prepared: true });
  assert.deepEqual(readJSON(path.join(root, 'inputs', 'layout-check.json')), { prepared: true });
  assert.deepEqual(readJSON(path.join(root, policy.methodSnapshotIndex)), snapshot);
}));

test('existing inputs are rejected and their bytes are preserved', () => fresh((root) => {
  fs.mkdirSync(path.join(root, 'inputs'));
  const existing = path.join(root, 'inputs', 'preserve.bin');
  const bytes = Buffer.from([0, 255, 13, 10, 128]);
  fs.writeFileSync(existing, bytes, { flag: 'wx' });
  assert.throws(() => prepareWorkspace(origin, root, source), { code: 'EEXIST' });
  assert.deepEqual(fs.readFileSync(existing), bytes);
  assert.equal(fs.existsSync(path.join(root, policy.methodSnapshotIndex)), false);
}));

test('linked input directories are rejected before writing through them', () => fresh((root) => {
  const owned = path.join(root, 'owned'); const outside = path.join(root, 'outside');
  fs.mkdirSync(owned); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'preserve.txt'), 'unchanged', { flag: 'wx' });
  fs.symlinkSync(outside, path.join(owned, 'inputs'), 'junction');
  assert.throws(() => prepareWorkspace(origin, owned, source), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(path.join(outside, 'preserve.txt'), 'utf8'), 'unchanged');
  assert.deepEqual(fs.readdirSync(outside), ['preserve.txt']);
}));
