/** @file Exercises fresh source identity capture with real baseline/candidate files, without compilers or DOM. */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { captureCurrentInputs } = require('./current-build-inputs.cjs');
const { snapshotBuildSources } = require('./prepare-hosted-build.cjs');
const historical = require('./constants/ownership-evidence.json');
const recipe = require('./constants/current-hosted-build.cjs');
const contracts = require('./constants/current-build-contracts.cjs');
const baseline = process.env.RUSTDOM_CURRENT_INPUTS_BASELINE;
const candidate = process.env.RUSTDOM_CURRENT_INPUTS_CANDIDATE;
assert.ok(baseline && candidate, 'Use real checkpoint067 and current candidate source snapshots');
let directory; let ownedBaseline; let ownedCandidate;

before(() => {
  for (const root of [baseline, candidate]) {
    assert.equal(fs.existsSync(path.join(root, 'node_modules')), false, 'Use source snapshots without installed dependencies');
    assert.equal(fs.existsSync(path.join(root, 'dist')), false, 'Use source snapshots without build output');
  }
  directory = fs.mkdtempSync(path.join(os.tmpdir(), contracts.sourceInputsDirectoryPrefix));
  ownedBaseline = path.join(directory, 'baseline'); ownedCandidate = path.join(directory, 'candidate');
  fs.cpSync(baseline, ownedBaseline, { recursive: true });
  fs.cpSync(candidate, ownedCandidate, { recursive: true });
});
after(() => {
  if (!directory) return;
  const resolved = fs.realpathSync(directory);
  assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith(contracts.sourceInputsDirectoryPrefix));
  fs.rmSync(resolved, { recursive: true });
});

/** Mutate only a file in this test's owned copy, restoring its original bytes on every path. */
function withChangedFile(root, relative, action) {
  const filename = path.join(root, relative); const original = fs.readFileSync(filename);
  try {
    fs.writeFileSync(filename, Buffer.concat([original, Buffer.from('\n// Source identity regression fixture.\n')]));
    return action();
  } finally { fs.writeFileSync(filename, original); }
}

test('captures actual current sources and optional build inputs without performance acceptance', () => {
  const inputs = captureCurrentInputs(ownedBaseline, ownedCandidate);
  assert.equal(inputs.policy, recipe.revision);
  assert.equal(inputs.sources.A, historical.sourceHashes.A);
  assert.match(inputs.sources.B, contracts.sha256Pattern);
  assert.match(inputs.harnessSha256, contracts.sha256Pattern);
  assert.equal(Object.hasOwn(inputs, 'accepted'), false);
  assert.equal(inputs.buildInputHashes.B['build.rs'], createHash('sha256').update(fs.readFileSync(path.join(ownedCandidate, 'build.rs'))).digest('hex'));
  assert.equal(inputs.buildInputHashes.B['.cargo/config.toml'], null);
  assert.deepEqual(captureCurrentInputs(ownedBaseline, ownedCandidate), inputs);
});

test('records a changed benchmark as new evidence and preserves the fixed baseline', () => {
  const before = captureCurrentInputs(ownedBaseline, ownedCandidate);
  withChangedFile(ownedCandidate, 'benchmarks/worker.cjs', () => {
    const changed = captureCurrentInputs(ownedBaseline, ownedCandidate);
    assert.equal(changed.sources.A, before.sources.A);
    assert.notEqual(changed.sources.B, before.sources.B);
    assert.notEqual(changed.harnessSha256, before.harnessSha256);
  });
  assert.deepEqual(captureCurrentInputs(ownedBaseline, ownedCandidate), before);
});

test('records changed current build.rs instead of claiming the prior build is reusable', () => {
  const before = captureCurrentInputs(ownedBaseline, ownedCandidate);
  withChangedFile(ownedCandidate, 'build.rs', () => {
    const changed = captureCurrentInputs(ownedBaseline, ownedCandidate);
    assert.notEqual(changed.buildInputHashes.B['build.rs'], before.buildInputHashes.B['build.rs']);
  });
});

test('rejects changed baseline sources and independent baseline build inputs', () => {
  withChangedFile(ownedBaseline, 'benchmarks/worker.cjs', () => {
    assert.throws(() => captureCurrentInputs(ownedBaseline, ownedCandidate), /checkpoint067 sources differ/);
  });
  withChangedFile(ownedBaseline, 'build.rs', () => {
    assert.throws(() => captureCurrentInputs(ownedBaseline, ownedCandidate), /checkpoint067 build input differs: build.rs/);
  });
});

test('records changed method provenance independently from the implementation source digest', () => {
  const before = captureCurrentInputs(ownedBaseline, ownedCandidate);
  withChangedFile(ownedCandidate, 'reports/benchmarks/native-class-ownership/PAIRED-INLINE-PROTOCOL.md', () => {
    const changed = captureCurrentInputs(ownedBaseline, ownedCandidate);
    assert.equal(changed.sources.B, before.sources.B);
    assert.notEqual(changed.harnessSha256, before.harnessSha256);
  });
});

test('preserves a present optional npm configuration in the real source snapshot after relocation', () => {
  const filename = path.join(ownedCandidate, '.npmrc');
  const original = fs.existsSync(filename) ? fs.readFileSync(filename) : null;
  try {
    fs.writeFileSync(filename, 'audit=false\n');
    const inputsBefore = captureCurrentInputs(ownedBaseline, ownedCandidate);
    const output = path.join(directory, 'source-snapshot'); fs.mkdirSync(output);
    const index = { inputsBefore, files: {} };
    const names = snapshotBuildSources({ A: ownedBaseline, B: ownedCandidate }, output, index, recipe);
    assert.ok(names.B.includes('.npmrc'));
    assert.equal(index.files['sources/.npmrc'], inputsBefore.buildInputHashes.B['.npmrc']);
    assert.deepEqual(fs.readFileSync(path.join(output, 'sources/.npmrc')), fs.readFileSync(filename));
    const relocated = path.join(directory, 'relocated-snapshot');
    fs.cpSync(output, relocated, { recursive: true });
    assert.deepEqual(captureCurrentInputs(path.join(relocated, 'baseline-sources'), path.join(relocated, 'sources')), inputsBefore);
  } finally {
    if (original === null) fs.unlinkSync(filename); else fs.writeFileSync(filename, original);
  }
});
