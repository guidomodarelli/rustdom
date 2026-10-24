/** @file Validates actual checkpoint066/current source capture without compiling or loading DOM packages. */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { captureXmlBuildInputs } = require('./xml-build-inputs.cjs');
const { captureCurrentInputs } = require('./current-build-inputs.cjs');
const policy = require('./constants/xml-build-inputs.cjs');
const recipe = require('./constants/xml-hosted-build.cjs');
const contracts = require('./constants/xml-build-contracts.cjs');
const baseline = process.env.RUSTDOM_XML_INPUTS_BASELINE;
const candidate = process.env.RUSTDOM_XML_INPUTS_CANDIDATE;
assert.ok(baseline && candidate, 'Provide actual checkpoint066/current source snapshots from the XML preparation');
let directory; let ownedBaseline; let ownedCandidate;

before(() => {
  for (const root of [baseline, candidate]) for (const excluded of ['node_modules', 'dist']) {
    assert.equal(fs.existsSync(path.join(root, excluded)), false, 'Use source snapshots without installed or built outputs');
  }
  directory = fs.mkdtempSync(path.join(os.tmpdir(), contracts.sourceInputsDirectoryPrefix));
  ownedBaseline = path.join(directory, 'baseline'); ownedCandidate = path.join(directory, 'candidate');
  fs.cpSync(baseline, ownedBaseline, { recursive: true }); fs.cpSync(candidate, ownedCandidate, { recursive: true });
});

after(() => {
  if (!directory) return;
  const resolved = fs.realpathSync(directory);
  assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith(contracts.sourceInputsDirectoryPrefix));
  fs.rmSync(resolved, { recursive: true });
});

/** Mutate only this test's owned source copy, restoring its exact bytes after the observation. */
function withChangedFile(root, relative, action) {
  const filename = path.join(root, relative); const original = fs.readFileSync(filename);
  try { fs.writeFileSync(filename, Buffer.concat([original, Buffer.from('\n// Source fingerprint fixture.\n')])); return action(); }
  finally { fs.writeFileSync(filename, original); }
}

test('records the actual XML baseline, current graph and all root build inputs without timing approval', () => {
  const inputs = captureXmlBuildInputs(ownedBaseline, ownedCandidate);
  assert.equal(inputs.policy, recipe.revision); assert.equal(inputs.sources.A, policy.baselineSourceHash);
  assert.match(inputs.sources.B, contracts.sha256Pattern); assert.match(inputs.harnessSha256, contracts.sha256Pattern);
  assert.equal(Object.hasOwn(inputs, 'accepted'), false);
  assert.equal(inputs.buildInputHashes.A['package.json'], policy.baselineBuildInputHashes['package.json']);
  assert.equal(inputs.buildInputHashes.B['build.rs'], createHash('sha256').update(fs.readFileSync(path.join(ownedCandidate, 'build.rs'))).digest('hex'));
  assert.equal(inputs.buildInputHashes.B['.cargo/config.toml'], null);
  assert.deepEqual(captureXmlBuildInputs(ownedBaseline, ownedCandidate), inputs);
});

test('the historical ownership capture still rejects checkpoint066 rather than relabeling it', () => {
  assert.throws(() => captureCurrentInputs(ownedBaseline, ownedCandidate), /checkpoint067 sources differ/);
  assert.equal(captureXmlBuildInputs(ownedBaseline, ownedCandidate).sources.A, policy.baselineSourceHash);
});

test('changes to the real baseline canonical sources are rejected', () => {
  withChangedFile(ownedBaseline, 'benchmarks/worker.cjs', () => {
    assert.throws(() => captureXmlBuildInputs(ownedBaseline, ownedCandidate), /checkpoint066 sources differ/);
  });
});

test('changes to independent baseline build inputs are rejected', () => {
  withChangedFile(ownedBaseline, 'build.rs', () => {
    assert.throws(() => captureXmlBuildInputs(ownedBaseline, ownedCandidate), /checkpoint066 build input differs: build.rs/);
  });
});

test('an undeclared baseline npm configuration cannot enter a supposedly fixed preparation', () => {
  const filename = path.join(ownedBaseline, '.npmrc');
  assert.equal(fs.existsSync(filename), false);
  try {
    fs.writeFileSync(filename, 'audit=false\n', { flag: 'wx' });
    assert.throws(() => captureXmlBuildInputs(ownedBaseline, ownedCandidate), /checkpoint066 build input differs: .npmrc/);
  } finally { fs.unlinkSync(filename); }
});

test('new candidate build.rs bytes become a new recorded build input, without changing the baseline', () => {
  const initial = captureXmlBuildInputs(ownedBaseline, ownedCandidate);
  withChangedFile(ownedCandidate, 'build.rs', () => {
    const changed = captureXmlBuildInputs(ownedBaseline, ownedCandidate);
    assert.equal(changed.sources.A, initial.sources.A);
    assert.notEqual(changed.buildInputHashes.B['build.rs'], initial.buildInputHashes.B['build.rs']);
    assert.equal(Object.hasOwn(changed, 'accepted'), false);
  });
});

test('new candidate benchmark bytes change its source and harness identities without changing the baseline', () => {
  const initial = captureXmlBuildInputs(ownedBaseline, ownedCandidate);
  withChangedFile(ownedCandidate, 'benchmarks/worker.cjs', () => {
    const changed = captureXmlBuildInputs(ownedBaseline, ownedCandidate);
    assert.equal(changed.sources.A, initial.sources.A);
    assert.notEqual(changed.sources.B, initial.sources.B); assert.notEqual(changed.harnessSha256, initial.harnessSha256);
  });
});
