/** @file Exercises real assembled packages, independent artifact pins and preservation failures without timing samples or mocks. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { prepare, verify } = require('./prepare.cjs');
const identity = require('./identity.cjs');
const policy = require('./constants/packages.json');
const root = fs.realpathSync.native(process.env[policy.testPreparedEnvironment]);
const historical = process.env[policy.testHistoricalEnvironment];
const source = process.env[policy.testSourceEnvironment];
const indexFile = path.join(root, policy.paths.index);
const packageRoot = (label) => path.join(root, policy.paths.packages, label);
const readIndex = () => JSON.parse(fs.readFileSync(indexFile, 'utf8'));
const saveIndex = (value) => fs.writeFileSync(indexFile, JSON.stringify(value, null, 2) + '\n');

/** @param {string[]} filenames - Only files in this caller-owned assembly. @param {Function} action - One controlled tamper case. @returns {void} */
function preserving(filenames, action) {
  for (const filename of filenames) assert.ok(path.resolve(filename).startsWith(root + path.sep));
  const originals = filenames.map((filename) => fs.readFileSync(filename));
  try { action(); }
  finally { filenames.forEach((filename, position) => fs.writeFileSync(filename, originals[position])); }
}

/** @param {Function} action - One operation on a verified private temporary fixture. @returns {void} */
function temporary(action) {
  const parent = fs.realpathSync.native(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, policy.testTemporaryPrefix));
  try { action(directory); }
  finally {
    assert.equal(fs.realpathSync.native(directory), directory); assert.equal(path.dirname(directory), parent);
    assert.ok(path.basename(directory).startsWith(policy.testTemporaryPrefix)); fs.rmSync(directory, { recursive: true });
  }
}

test('the complete five-package assembly retains the independent hosted binary and historical controls', () => {
  const result = verify(root);
  assert.equal(result.verified, true); assert.equal(result.distributions.B, '0d2c083529f559397a72bf1757ae30c167cba8040cb4bb45cda6e4ac57eb1b2d');
  assert.equal(result.binarySha256, '43410883b1fb21dfb3fa35dfefce2a0adc9eaa5fd4a45b684c37c39b344fbdb4');
  assert.equal(result.distributions.A0, result.distributions.A1); assert.equal(result.distributions.J0, result.distributions.J1);
  assert.equal(result.dependenciesSha256, '149eb8f5355cfbc03dab34ef795060d5b97f75d6b8d2b74cf316c55ce6e72998');
  assert.equal(result.benchmarkExecuted, false); assert.equal(result.rustRebuilt, false); assert.equal(result.performanceAccepted, null);
  const index = readIndex();
  assert.equal(index.actualCandidateSource.sourceCommit, 'b63cf834de153c3b033d88ad961afb6329c19f5a');
  assert.equal(index.hostedHead, 'da0f4f80ea1ce6c48f43430206cf40f919da2a9b');
  assert.deepEqual(index.actualCandidateSource.sourceGitErrors, []);
});

test('the public verification CLI reads the actual self-contained package set', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'prepare.cjs'), '--verify', root], { encoding: 'utf8', maxBuffer: policy.metadataOutputLimitBytes });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).verified, true);
});

test('an existing destination is preserved before any assembly mutation', () => {
  temporary((directory) => {
    const destination = path.join(directory, 'existing'); fs.mkdirSync(destination);
    const sentinel = path.join(destination, 'index.json'); fs.writeFileSync(sentinel, 'foreign evidence');
    assert.throws(() => prepare(historical, source, destination), /preserve existing/);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'foreign evidence'); assert.deepEqual(fs.readdirSync(destination), ['index.json']);
  });
});

test('a nested original-source destination cannot modify the candidate checkout', () => {
  const destination = path.join(source, policy.testTemporaryPrefix + 'forbidden');
  assert.equal(fs.existsSync(destination), false);
  assert.throws(() => prepare(historical, source, destination), /must be disjoint/);
  assert.equal(fs.existsSync(destination), false);
});

test('a changed JavaScript distribution fails even after resealing its local index', () => {
  const filename = path.join(packageRoot('B'), 'dist/index.cjs');
  preserving([filename, indexFile], () => {
    fs.appendFileSync(filename, '\n/* altered runtime fixture */\n');
    const index = readIndex(); index.distributions.B = identity.fingerprint(packageRoot('B'), policy.nativeDistributionParts); saveIndex(index);
    assert.throws(() => verify(root), { code: 'ERR_ASSERTION' });
  });
});

test('a same-byte loader symlink cannot redirect B to the baseline addon even after resealing the link index', () => {
  const filename = path.join(packageRoot('B'), 'dist/native.cjs');
  const baseline = path.join(packageRoot('A0'), 'dist/native.cjs');
  assert.deepEqual(fs.readFileSync(filename), fs.readFileSync(baseline));
  preserving([filename, indexFile], () => {
    fs.unlinkSync(filename); fs.symlinkSync(path.relative(path.dirname(filename), baseline), filename);
    try {
      const index = readIndex(); index.links = identity.inspectLinks(root); saveIndex(index);
      assert.throws(() => verify(root), { code: 'ERR_ASSERTION' });
    } finally { fs.unlinkSync(filename); }
  });
});

test('the memory probe refuses an authentic A0 package before creating output or starting a probe', () => {
  temporary((directory) => {
    const output = path.join(directory, 'baseline-must-not-be-B');
    const command = spawnSync(process.execPath, [path.join(__dirname, policy.paths.memoryProbe), packageRoot('A0'), output], { encoding: 'utf8' });
    assert.notEqual(command.status, 0); assert.match(command.stderr, /requires the canonical B package/);
    assert.equal(fs.existsSync(output), false);
  });
});

test('a resealed baseline distribution cannot borrow the original A/A fingerprint', () => {
  const filename = path.join(packageRoot('A0'), 'dist/index.cjs');
  preserving([filename, indexFile], () => {
    fs.appendFileSync(filename, '\n/* altered baseline fixture */\n');
    const index = readIndex(); index.distributions.A0 = identity.fingerprint(packageRoot('A0'), policy.nativeDistributionParts); saveIndex(index);
    assert.throws(() => verify(root), { code: 'ERR_ASSERTION' });
  });
});

test('resealed dependency metadata cannot replace the independently qualified dependency tree', () => {
  const filename = path.join(root, policy.paths.dependencies, 'jsdom/package.json');
  preserving([filename, indexFile], () => {
    fs.appendFileSync(filename, '\n');
    const index = readIndex(); index.dependencies = identity.fingerprint(root, [policy.paths.dependencies]); saveIndex(index);
    assert.throws(() => verify(root), { code: 'ERR_ASSERTION' });
  });
});

test('an omitted selected artifact member cannot be hidden by resealing the receipt and its index', () => {
  const filename = path.join(root, policy.paths.artifactReceipt);
  preserving([filename, indexFile], () => {
    const receipt = JSON.parse(fs.readFileSync(filename, 'utf8')); receipt.selectedFiles.pop(); fs.writeFileSync(filename, JSON.stringify(receipt));
    const index = readIndex(); index.files[policy.paths.artifactReceipt] = identity.hash(filename); saveIndex(index);
    assert.throws(() => verify(root), { code: 'ERR_ASSERTION' });
  });
});

test('a resealed candidate source snapshot still must match the qualified source bytes', () => {
  const relative = policy.paths.candidateSources + '/src/dom/range_state.rs'; const filename = path.join(root, relative);
  preserving([filename, indexFile], () => {
    fs.appendFileSync(filename, '\n'); const index = readIndex(); index.files[relative] = identity.hash(filename); saveIndex(index);
    assert.throws(() => verify(root), { code: 'ERR_ASSERTION' });
  });
});

test('an optimized materializer refuses invocation before creating a destination', () => {
  temporary((directory) => {
    const destination = path.join(directory, 'candidate');
    const command = spawnSync('python3', ['-O', path.join(__dirname, policy.paths.materializer), path.resolve(__dirname, '../../../..'), destination], { encoding: 'utf8' });
    assert.notEqual(command.status, 0); assert.match(command.stderr, /non-optimized Python/); assert.equal(fs.existsSync(destination), false);
  });
});

/** @param {object} engine - Independent public DOM engine. @returns {object[]} Public collapse/clone/mutation observations. */
function observe(engine) {
  const dom = new engine.JSDOM('<main>abcdef<span>ghijkl</span></main>');
  try {
    const document = dom.window.document; const first = document.querySelector('main').firstChild;
    const second = document.querySelector('span').firstChild; const observations = [];
    for (const sameOwner of [true, false]) for (const input of [undefined, false, true, 0, 1, null, '', 'false', {}, Symbol('truthy')]) {
      const range = document.createRange(); range.setStart(first, 1); range.setEnd(sameOwner ? first : second, 4);
      const clone = range.cloneRange(); range.collapse(input);
      assert.equal(range.startContainer, input ? first : sameOwner ? first : second);
      assert.equal(range.startContainer, range.endContainer);
      first.insertData(0, '!'); second.insertData(0, '?');
      observations.push({ sameOwner, start: range.startOffset, end: range.endOffset, collapsed: range.collapsed, clone: clone.toString() });
      first.deleteData(0, 1); second.deleteData(0, 1);
    }
    return observations;
  } finally { dom.window.close(); }
}

test('both public entrypoints execute the exact native candidate with independent jsdom parity', async () => {
  const { NativeRange } = require(path.join(packageRoot('B'), 'dist/native.cjs'));
  const range = new NativeRange(); assert.throws(() => range.collapse(true), { code: 'InvalidArg' });
  range.setStart(1, 2); range.setEnd(2, 4); assert.equal(range.collapse(false), true);
  assert.equal(range.start.node, 2); assert.equal(range.startOffset, 4); assert.equal(range.endOffset, 4);
  const expected = observe(require(packageRoot('J0')));
  assert.deepEqual(observe(require(packageRoot('B'))), expected);
  assert.deepEqual(observe(await import(pathToFileURL(path.join(packageRoot('B'), 'dist/index.mjs')).href)), expected);
});

test('all controls and source packages still authenticate after the real negative and public behavior cases', () => {
  assert.equal(verify(root).verified, true);
});
