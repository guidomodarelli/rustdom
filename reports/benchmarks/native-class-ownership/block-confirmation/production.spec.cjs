/** @module production-equivalence-contracts Treats compiler sources as authenticated input data, never matches implementation strings or mocks the runtime. */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { inspectProduction, requireProductionEquivalence } = require('./production.cjs');
const policy = require('./constants/production.json');
const candidate = process.env[policy.candidateSourcesEnvironment];
const production = process.env[policy.sourceEnvironment];
const baseline = process.env[policy.baselineSourcesEnvironment];

test('isolated authenticated candidate sources match all 344 inputs but do not certify production, a build or performance', () => {
  const result = requireProductionEquivalence(candidate);
  assert.equal(result.inputCount, 344); assert.equal(result.differences.length, 0);
  assert.equal(result.GitIdentityAuthenticated, false); assert.equal(result.binaryBuiltByThisFunction, false);
  assert.equal(result.packageAuthenticatedByThisFunction, false); assert.equal(result.performanceAccepted, null);
  assert.equal(result.gateReevaluated, false);
});

test('published pre-integration baseline reports the complete four-file gap and blocks source-equivalence approval', () => {
  const result = inspectProduction(baseline);
  assert.equal(result.inputCount, 344); assert.equal(Object.keys(result.observedInputs).length, 344);
  assert.deepEqual(result.differences.map((entry) => entry.path).sort(),
    ['src/dom/native-tree.cjs', 'src/dom/range_state.rs', 'src/dom/range_state_binding.rs', 'types/native.d.cts']);
  assert.equal(result.matchesSelectedCompilerInputs, false);
  assert.throws(() => requireProductionEquivalence(baseline), /4 compiler inputs differ/);
});

test('actual current production is compared in full and cannot be approved when any input differs', () => {
  const result = inspectProduction(production);
  assert.equal(result.inputCount, 344); assert.equal(Object.keys(result.observedInputs).length, 344);
  if (result.differences.length === 0) assert.equal(requireProductionEquivalence(production).matchesSelectedCompilerInputs, true);
  else assert.throws(() => requireProductionEquivalence(production), /compiler inputs differ/);
  assert.equal(result.performanceAccepted, null);
});

/** @param {object} context - Node test cleanup context. @returns {string} Owned, complete compiler-input copy. */
function copyCandidate(context) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'rustdom-production-equivalence-'));
  context.after(() => {
    const resolved = fs.realpathSync(root);
    assert.ok(resolved.startsWith(parent + path.sep));
    assert.ok(path.basename(resolved).startsWith('rustdom-production-equivalence-'));
    fs.rmSync(resolved, { recursive: true });
  });
  const input = inspectProduction(candidate);
  for (const relative of Object.keys(input.observedInputs)) {
    const output = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(candidate, ...relative.split('/')), output);
  }
  return root;
}

test('one altered or missing compiler input in an owned copy cannot pass the selected candidate identity', (context) => {
  const root = copyCandidate(context);
  assert.equal(requireProductionEquivalence(root).matchesSelectedCompilerInputs, true);
  const target = path.join(root, 'Cargo.toml');
  fs.appendFileSync(target, '\n');
  assert.equal(inspectProduction(root).differences.length, 1);
  assert.throws(() => requireProductionEquivalence(root), /1 compiler inputs differ/);
  fs.unlinkSync(target);
  const missing = inspectProduction(root);
  assert.equal(missing.differences.length, 1); assert.equal(missing.differences[0].reason, 'missing-input');
});

test('undeclared Cargo, npm and toolchain overrides cannot approve otherwise identical compiler inputs', (context) => {
  const root = copyCandidate(context);
  for (const relative of ['.cargo/config.toml', '.cargo/config', '.npmrc', 'npm-shrinkwrap.json', 'rust-toolchain', 'rust-toolchain.toml', 'rust-toolchain.local']) {
    const filename = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, relative.startsWith('.cargo/') ? '[build]\nrustflags = ["-C", "opt-level=0"]\n' : 'project override\n');
    const result = inspectProduction(root);
    assert.equal(Object.keys(result.observedInputs).length, 344);
    assert.equal(result.differences.length, 1);
    assert.equal(result.differences[0].reason, 'unregistered-build-configuration');
    assert.equal(result.matchesSelectedCompilerInputs, false);
    assert.equal(result.buildEnvironmentAuthenticated, false);
    assert.equal(result.globalConfigurationAuthenticated, false);
    assert.throws(() => requireProductionEquivalence(root), /compiler inputs differ/);
    fs.unlinkSync(filename);
    if (relative.startsWith('.cargo/')) fs.rmdirSync(path.dirname(filename));
    assert.equal(requireProductionEquivalence(root).matchesSelectedCompilerInputs, true);
  }
  fs.symlinkSync(path.join(root, 'absent-configuration'), path.join(root, '.cargo'));
  assert.deepEqual(inspectProduction(root).unregisteredBuildInputs, ['.cargo']);
  assert.throws(() => requireProductionEquivalence(root), /compiler inputs differ/);
});
