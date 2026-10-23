/** @file Exercises the actual ownership workflow CLI and the real fixture preparation boundary. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { captureHarness } = require('./row-isolation-experiment.cjs');
const policy = require('./constants/row-isolation-evidence.json');
const settings = require('./constants/recorded-evidence.json');
const studySettings = require('./constants/row-isolation.cjs');
const transportSettings = require('./constants/recorded-archive.json');
assert.ok(process.env.RUSTDOM_RECORDED_EVIDENCE_FIXTURE && process.env.RUSTDOM_RECORDED_ARCHIVE_FIXTURE,
  'Ownership workflow contracts require prepared complete real-data fixtures');
assert.ok(path.isAbsolute(process.env.RUSTDOM_RECORDED_EVIDENCE_FIXTURE) &&
  path.isAbsolute(process.env.RUSTDOM_RECORDED_ARCHIVE_FIXTURE),
'Ownership workflow contracts require absolute fixture paths because CLI children change working directory');
const evidence = JSON.parse(fs.readFileSync(process.env.RUSTDOM_RECORDED_EVIDENCE_FIXTURE, 'utf8'));
const transport = JSON.parse(fs.readFileSync(process.env.RUSTDOM_RECORDED_ARCHIVE_FIXTURE, 'utf8'));
const row = evidence.scenarios.find((scenario) => scenario.kind === 'rowIsolated');
assert.ok(row);

/**
 * Own temporary mutation inputs while keeping all recorded datasets unchanged.
 * @param {import('node:test').TestContext} context - Owns cleanup after the real child invocation.
 * @returns {string} Fresh temporary directory.
 */
function temporaryDirectory(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), transportSettings.contractTemporaryDirectoryPrefix));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith(transportSettings.contractTemporaryDirectoryPrefix));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

/**
 * Preserve the actual public CLI outcome without replacing any platform dependency.
 * @param {string} name - Unique recorded contract name.
 * @param {string} executable - Actual Node or Python binary.
 * @param {string[]} argumentsList - Real CLI arguments.
 * @param {object} [options] - Child working directory and optional Python guard environment.
 * @returns {object} Real child process outcome.
 */
function execute(name, executable, argumentsList, options = {}) {
  const child = spawnSync(executable, argumentsList, { encoding: 'utf8', timeout: settings.cliTimeoutMs, ...options });
  fs.writeFileSync(path.join(evidence.outputRoot, `workflow-${name}.stdout.log`), child.stdout ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(evidence.outputRoot, `workflow-${name}.stderr.log`), child.stderr ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(evidence.outputRoot, `workflow-${name}.process.json`), `${JSON.stringify({
    command: [executable, ...argumentsList], cwd: options.cwd ?? process.cwd(), pid: child.pid,
    exitCode: child.status, signal: child.signal, error: child.error?.message ?? null })}\n`, { flag: 'wx' });
  assert.ifError(child.error); assert.equal(child.signal, null);
  return child;
}

test('the actual current ownership gate reports all seven control failures with budget exit one', () => {
  const child = execute('current-gate', process.execPath, [path.join(__dirname, 'row-isolation-evidence.cjs'),
    row.baselineRoot, row.archiveRoot]);
  assert.equal(child.status, 1); assert.match(child.stderr, /has not accepted the performance budget/);
  const result = JSON.parse(child.stdout);
  assert.equal(result.verified, true); assert.equal(result.accepted, false); assert.equal(result.measurementExecuted, false);
  assert.equal(result.authenticatedFiles, 7429);
  assert.deepEqual(result.current.measuredSources, policy.sourceHashes);
  assert.deepEqual(result.current.compiledSources, policy.compiledSourceHashes);
  assert.equal(result.current.harnessSha256, policy.harnessSha256);
  assert.deepEqual(result.results.map((entry) => entry.processes), [1024, 1024]);
  assert.deepEqual(result.results.map((entry) => entry.measuredDurations), [9216, 9216]);
  assert.deepEqual(result.results.map((entry) => Object.values(entry.summaries).flat()
    .filter((summary) => Math.abs(summary.jsdomControlChangePercent) > studySettings.controlBudgetPercent).length), [4, 3]);
});

test('the actual gate rejects a changed build input before emitting any recorded budget result', (context) => {
  const candidate = temporaryDirectory(context);
  const names = new Set([...captureHarness(row.candidateRoot).files.map((entry) => entry.path),
    ...Object.keys(policy.buildInputHashes.B)]);
  for (const name of names) {
    const source = path.join(row.candidateRoot, name);
    if (!fs.existsSync(source)) continue;
    const target = path.join(candidate, name);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
  }
  fs.appendFileSync(path.join(candidate, 'build.rs'), '\n');
  const child = execute('changed-build-input', process.execPath, [path.join(__dirname, 'row-isolation-evidence.cjs'),
    row.baselineRoot, row.archiveRoot], { cwd: candidate });
  assert.equal(child.status, 2); assert.equal(child.stdout, ''); assert.match(child.stderr, /current B build input differs: build\.rs/);
});

test('the actual gate rejects missing arguments without consuming any dataset', () => {
  const child = execute('missing-arguments', process.execPath, [path.join(__dirname, 'row-isolation-evidence.cjs')]);
  assert.equal(child.status, 2); assert.equal(child.stdout, ''); assert.match(child.stderr, /provide baseline and archive paths/);
});

test('the fixture preparation CLI preserves an existing destination and its user file', (context) => {
  const destination = temporaryDirectory(context);
  fs.writeFileSync(path.join(destination, 'sentinel'), 'preserved user file');
  const child = execute('existing-fixture-destination', settings.pythonCommand, ['-B',
    path.join(__dirname, 'prepare-recorded-fixtures.py'), row.baselineRoot, transport.sourceRoot, destination]);
  assert.equal(child.status, 1); assert.equal(child.stdout, ''); assert.match(child.stderr, /preserve an existing output directory/);
  assert.deepEqual(fs.readdirSync(destination), ['sentinel']);
  assert.equal(fs.readFileSync(path.join(destination, 'sentinel'), 'utf8'), 'preserved user file');
});

for (const level of ['1', '2']) {
  test(`fixture preparation cannot bypass integrity with Python optimization ${level}`, (context) => {
    const directory = temporaryDirectory(context);
    const destination = path.join(directory, 'fresh');
    const child = execute(`fixture-python-optimize-${level}`, settings.pythonCommand, ['-B',
      path.join(__dirname, 'prepare-recorded-fixtures.py'), row.baselineRoot, transport.sourceRoot, destination],
    { env: { ...process.env, PYTHONOPTIMIZE: level } });
    assert.equal(child.status, 1); assert.equal(child.stdout, '');
    assert.match(child.stderr, /Python optimization disables required checks/);
    assert.equal(fs.existsSync(destination), false);
  });
}
