/** @file Exercises actual prepared XML roots and rejects changed runtime inputs without measuring. */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { inspect, readExperimentOutcome, run } = require('./xml-current-run.cjs');
const { inspectPrepared } = require('./inspect-xml-preparation.cjs');
const recipe = require('./constants/xml-hosted-build.cjs');
const settings = require('./constants/xml-current-run.cjs');
const archive = process.env.RUSTDOM_XML_BUILD_ARCHIVE;
const baseline = process.env.RUSTDOM_XML_RUN_BASELINE ?? path.join(process.cwd(), '.baseline');
const candidate = process.env.RUSTDOM_XML_RUN_CANDIDATE ?? process.cwd();
assert.ok(archive, 'XML current run tests: provide the actual XML preparation');
let temporary, copiedCandidate;
before(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-xml-current-run-'));
  copiedCandidate = path.join(temporary, 'candidate');
  fs.cpSync(path.join(archive, 'sources'), copiedCandidate, { recursive: true });
  fs.cpSync(path.join(archive, 'packages/B/dist'), path.join(copiedCandidate, 'dist'), { recursive: true });
  fs.cpSync(path.join(archive, 'node_modules'), path.join(copiedCandidate, 'node_modules'), { recursive: true, verbatimSymlinks: true });
});
after(() => {
  if (!temporary) return;
  const resolved = fs.realpathSync(temporary);
  assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('rustdom-xml-current-run-'));
  fs.rmSync(resolved, { recursive: true });
});

test('observes full distributions, locked dependencies and inputs from actual prepared runtimes', () => {
  const identity = inspectPrepared(baseline, candidate, archive);
  assert.equal(identity.measurementExecuted, false);
  assert.equal(identity.performanceAccepted, null);
  assert.equal(identity.scientificCaptureEligible, false);
  assert.equal(identity.gateReevaluated, false);
  assert.equal(identity.scope, 'preparation-only');
  assert.equal(identity.node, process.version);
  assert.equal(identity.inputs.sources.A, identity.sources.A.sourceHash);
  assert.equal(identity.inputs.sources.B, identity.sources.B.sourceHash);
  assert.ok(identity.distributions.B.files.some((entry) => entry.path === 'dist/rustdom.node'));
  assert.ok(identity.dependencies.B.files.some((entry) => entry.path === 'node_modules/jsdom/package.json'));
});

test('the actual CLI inspects matching physical roots without starting an experiment', () => {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'inspect-xml-preparation.cjs'), '--inspect', baseline, candidate, archive],
    { encoding: 'utf8', timeout: recipe.validationTimeoutMs, maxBuffer: settings.maxOutputBytes });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), inspectPrepared(baseline, candidate, archive));
});

test('preparation qualification does not widen the consumed XML method source scope or start a capture', () => {
  const identity = inspectPrepared(baseline, candidate, archive);
  const child = spawnSync(process.execPath, [path.join(__dirname, 'xml-current-run.cjs'), '--inspect', baseline, candidate, archive],
    { encoding: 'utf8', timeout: recipe.validationTimeoutMs, maxBuffer: settings.maxOutputBytes });
  assert.ifError(child.error);
  if (identity.inputs.sources.B === settings.candidateSourceHash) {
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), inspect(baseline, candidate, archive));
  } else {
    assert.equal(child.status, 2); assert.match(child.stderr, /candidate is outside the declared source scope/);
    assert.throws(() => inspect(baseline, candidate, archive), /candidate is outside the declared source scope/);
    const destination = path.join(temporary, 'forbidden-capture');
    if (process.version === settings.measurementNode) {
      assert.throws(() => run(baseline, candidate, archive, destination), /candidate is outside the declared source scope/);
    }
    assert.equal(fs.existsSync(destination), false);
  }
});

test('the preparation CLI rejects measurement modes and output arguments without creating a capture', () => {
  const destination = path.join(temporary, 'invalid-cli-capture');
  for (const args of [
    ['--run', baseline, candidate, archive], ['--capture', baseline, candidate, archive],
    ['--inspect', baseline, candidate, archive, destination],
  ]) {
    const child = spawnSync(process.execPath, [path.join(__dirname, 'inspect-xml-preparation.cjs'), ...args],
      { encoding: 'utf8', timeout: recipe.validationTimeoutMs });
    assert.ifError(child.error); assert.equal(child.status, 2); assert.equal(child.stdout, '');
    assert.equal(fs.existsSync(destination), false);
  }
});

for (const [name, relativePath] of [
  ['root build input', 'build.rs'],
  ['canonical implementation', 'src/lib.rs'],
  ['built JavaScript runtime', 'dist/index.cjs'],
  ['independent reference dependency', 'node_modules/jsdom/package.json'],
]) {
  test(`rejects a changed ${name} in a real physically copied candidate`, () => {
    const filename = path.join(copiedCandidate, relativePath);
    const original = fs.readFileSync(filename);
    try {
      fs.appendFileSync(filename, '\n');
      const message = relativePath.startsWith('dist/') ? /actual B distribution differs/ :
        relativePath.startsWith('node_modules/') ? /actual B dependencies differ/ : /actual source\/build inputs differ/;
      assert.throws(() => inspectPrepared(baseline, copiedCandidate, archive), message);
      assert.throws(() => inspect(baseline, copiedCandidate, archive), message);
    } finally { fs.writeFileSync(filename, original); }
  });
}

test('rejects undeclared Node runtime flags before selecting a measurement', () => {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'inspect-xml-preparation.cjs'), '--inspect', baseline, candidate, archive],
    { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '--no-warnings' }, timeout: recipe.validationTimeoutMs });
  assert.ifError(child.error); assert.equal(child.status, 2);
  assert.match(child.stderr, /XML current run: undeclared NODE_OPTIONS/);
});

test('refuses an overlapping capture before starting a worker or changing its runtime', () => {
  if (process.version !== 'v24.14.1') {
    assert.throws(() => run(baseline, candidate, archive, copiedCandidate), /measurement requires the declared Node/);
  } else {
    const identity = inspectPrepared(baseline, copiedCandidate, archive);
    const expected = identity.inputs.sources.B === settings.candidateSourceHash ? /capture must not overlap/ : /candidate is outside the declared source scope/;
    assert.throws(() => run(baseline, copiedCandidate, archive, path.join(copiedCandidate, 'capture')), expected);
    assert.equal(fs.existsSync(path.join(copiedCandidate, 'capture')), false);
  }
});

test('preserves the original null acceptance when a recorded real XML experiment stopped after A/A', () => {
  const directory = path.join(__dirname, 'unplanned-xml/39662377152');
  const outcome = readExperimentOutcome(directory);
  assert.equal(outcome.complete, true);
  assert.equal(outcome.accepted, null);
});
