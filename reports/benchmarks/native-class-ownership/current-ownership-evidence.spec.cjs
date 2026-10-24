/** @file Exercises the real current-source gate, full original ZIP and stale/corrupted input rejection. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const study = require('./current-ownership-experiment.cjs');
const method = require('./constants/current-ownership-study.cjs');
const policy = require('./constants/current-ownership-evidence.json');
const gate = require('./current-ownership-evidence.cjs');
const baseline = process.env.RUSTDOM_CURRENT_OWNERSHIP_EVIDENCE_BASELINE;
const output = process.env.RUSTDOM_CURRENT_OWNERSHIP_EVIDENCE_TEST_OUTPUT;
assert.ok(baseline && output, 'Set the real checkpoint baseline and an existing fresh test-output directory');
const repository = path.resolve(__dirname, '../../..');
const packet = path.join(__dirname, policy.packetDirectory);
const original = require(path.join(packet, 'original-verification.json'));

/** Own test copies without changing source worktrees or the immutable original packet. */
function owner(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), policy.temporaryDirectoryPrefix));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith(policy.temporaryDirectoryPrefix));
    fs.rmSync(directory, { recursive: true });
  });
  return directory;
}

/** Preserve the complete CLI outcome, including expected rejected and invalid evidence. */
function execute(label, packetPath = packet, extraEnvironment = {}) {
  const command = [path.join(__dirname, 'current-ownership-evidence.cjs'), baseline, packetPath];
  const child = spawnSync(process.execPath, command,
    { encoding: 'utf8', env: { ...process.env, ...extraEnvironment }, maxBuffer: 4 * 1024 * 1024 });
  fs.writeFileSync(path.join(output, `${label}.stdout.json`), child.stdout ?? '');
  fs.writeFileSync(path.join(output, `${label}.stderr.log`), child.stderr ?? '');
  fs.writeFileSync(path.join(output, `${label}.process.json`), `${JSON.stringify({ command: [process.execPath, ...command],
    exitCode: child.status, signal: child.signal, error: child.error?.message ?? null }, null, 2)}\n`);
  assert.ifError(child.error);
  return child;
}

test('the actual baseline, current build inputs and current harness match the measured preparation', () => {
  const result = gate.verifyCurrentInputs(baseline);
  assert.deepEqual(result.inputs, method.preparation.identity.inputs);
  assert.equal(result.harnessSha256, policy.harnessSha256);
});

for (const [kind, filename] of [
  ['runtime source', 'src/dom/tree.rs'], ['build input', 'package.json'],
  ['measured worker', 'reports/benchmarks/native-class-ownership/current-ownership-worker.cjs'],
]) {
  test(`changed ${kind} is rejected before consuming recorded timings`, (context) => {
    const candidate = owner(context);
    const names = new Set(study.captureHarness().files.map((entry) => entry.path));
    for (const [name, expected] of Object.entries(method.preparation.identity.inputs.buildInputHashes.B)) {
      if (expected !== null) names.add(name);
    }
    for (const name of names) {
      const target = path.join(candidate, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(repository, name), target);
    }
    assert.deepEqual(gate.verifyCurrentInputs(baseline, candidate), gate.verifyCurrentInputs(baseline));
    fs.appendFileSync(path.join(candidate, filename), '\n');
    assert.throws(() => gate.verifyCurrentInputs(baseline, candidate), /current source\/build inputs differ|current harness differs/);
  });
}

test('the real CLI authenticates the full ZIP and returns budget rejection 1 instead of stale-input rejection 2', () => {
  const child = execute('complete-original');
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stderr, /complete current-source study rejected the performance budget/);
  const result = JSON.parse(child.stdout);
  assert.equal(result.verified, true); assert.equal(result.accepted, false);
  assert.deepEqual(result.results, original.results);
  assert.equal(result.measurementExecuted, false);
  assert.equal(result.transport.transportAuthenticated, true);
  assert.equal(result.transport.samplerExecuted, false);
  assert.equal(result.transport.regularFiles, 14058);
  assert.equal(result.transport.rawRegularBytes, 1392246717);
  assert.equal(result.results.reduce((total, node) => total + node.processes, 0), 2048);
  assert.equal(result.results.reduce((total, node) => total + node.measuredDurations, 0), 18432);
});

test('the real CLI preserves damaged-transport rejection 2 and does not emit an accepted decision', (context) => {
  const changed = owner(context);
  fs.copyFileSync(path.join(packet, 'artifact.zip'), path.join(changed, 'artifact.zip'));
  const descriptor = fs.openSync(path.join(changed, 'artifact.zip'), 'r+');
  try { fs.writeSync(descriptor, Buffer.from([0]), 0, 1, 0); } finally { fs.closeSync(descriptor); }
  const child = execute('damaged-transport', changed);
  assert.equal(child.status, 2); assert.equal(child.stdout, '');
  assert.match(child.stderr, /changed published input artifact.zip/);
});

test('optimized Python cannot bypass archive integrity checks', () => {
  const child = execute('optimized-python', packet, { PYTHONOPTIMIZE: '1' });
  assert.equal(child.status, 2); assert.equal(child.stdout, '');
  assert.match(child.stderr, /requires non-optimized Python/);
});

test('the CLI rejects incomplete arguments without producing a decision', () => {
  const child = spawnSync(process.execPath, [path.join(__dirname, 'current-ownership-evidence.cjs')], { encoding: 'utf8' });
  assert.ifError(child.error); assert.equal(child.status, 2); assert.equal(child.stdout, '');
  assert.match(child.stderr, /provide baseline and original packet paths/);
});
