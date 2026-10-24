/** @file Exercises complete real recorded datasets and rejects unmeasured inputs without running DOM samples. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createRecordedEvidenceVerifier } = require('./recorded-evidence.cjs');
const settings = require('./constants/recorded-evidence.json');
const fixtureArgument = process.env.RUSTDOM_RECORDED_EVIDENCE_FIXTURE;
assert.ok(fixtureArgument, 'Recorded evidence contracts require a preserved real-dataset fixture declaration');
const fixture = JSON.parse(fs.readFileSync(fixtureArgument, 'utf8'));
const implementations = {
  seeded: { study: require('./seeded-pre-gc-experiment.cjs'), method: require('./constants/seeded-pre-gc-study.cjs') },
  rowIsolated: { study: require('./row-isolation-experiment.cjs'), method: require('./constants/row-isolation-study.cjs') },
};
assert.deepEqual(fixture.scenarios.map((scenario) => scenario.kind), ['seeded', 'rowIsolated']);
assert.equal(fixture.scenarios[0].expectedAccepted, false, 'The complete historical rejection must stay rejected');
const digest = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

/**
 * Own a real temporary tree and confine cleanup to that tree's temporary parent.
 * @param {import('node:test').TestContext} context - Owns cleanup after the behavior assertion.
 * @returns {string} Fresh temporary directory, independent of preserved evidence.
 */
function temporaryDirectory(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-evidence-contract-'));
  context.after(() => {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('rustdom-evidence-contract-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

/**
 * Copy actual measured source bytes and build inputs before mutating a contract fixture.
 * @param {import('node:test').TestContext} context - Owns the disposable source tree.
 * @param {object} scenario - Complete original dataset and current-input fixture.
 * @returns {string} Independent real source tree; no platform or runtime is mocked.
 */
function candidateCopy(context, scenario) {
  const directory = temporaryDirectory(context);
  const { study } = implementations[scenario.kind];
  const names = new Set([...study.captureHarness(scenario.candidateRoot).files.map((entry) => entry.path),
    ...Object.keys(scenario.policy.buildInputHashes.B)]);
  for (const name of names) {
    const source = path.join(scenario.candidateRoot, name);
    if (!fs.existsSync(source)) continue;
    const destination = path.join(directory, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  return directory;
}

/**
 * Retain the exact rejected operation's error after observing real verifier behavior.
 * @param {string} name - Known contract-case filename under the preserved output directory.
 * @param {Function} operation - Real filesystem/archive verification operation.
 * @param {RegExp} message - Expected public error category.
 * @returns {object} Recorded rejection after checking the public error category.
 */
function recordRejection(name, operation, message) {
  let rejection;
  assert.throws(operation, (error) => {
    rejection = { name: error.name, message: error.message, stack: error.stack };
    return message.test(error.message);
  });
  fs.writeFileSync(path.join(fixture.outputRoot, `${name}.json`), `${JSON.stringify(rejection, null, 2)}\n`, { flag: 'wx' });
  return rejection;
}

/** @returns {Set<string>} Current decoder-owned directories, for observable cleanup assertions. */
function extractionDirectories() {
  return new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith(settings.temporaryDirectoryPrefix)));
}

for (const scenario of fixture.scenarios) {
  const { study, method } = implementations[scenario.kind];
  const verifier = createRecordedEvidenceVerifier({ study, method, policy: scenario.policy });

  test(`${scenario.kind}: full recorded evidence retains the original budget decision and releases extraction files`, () => {
    const before = extractionDirectories();
    const result = verifier.verifyEvidence(scenario.baselineRoot, scenario.archiveRoot, scenario.candidateRoot);
    assert.equal(result.verified, true); assert.equal(result.accepted, scenario.expectedAccepted);
    assert.equal(result.measurementExecuted, false); assert.equal(result.results.length, 2);
    for (const nodeResult of result.results) {
      assert.equal(nodeResult.processes, study.processSchedule().length);
      assert.equal(nodeResult.measuredDurations, 9216);
    }
    assert.deepEqual(result.current.measuredSources, scenario.policy.sourceHashes);
    assert.deepEqual(result.current.compiledSources, method.preparation.identity.inputs.sources);
    assert.equal(result.current.harnessSha256, scenario.policy.harnessSha256);
    assert.deepEqual(extractionDirectories(), before);
    fs.writeFileSync(path.join(fixture.outputRoot, `${scenario.kind}-complete.json`),
      `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  });

  test(`${scenario.kind}: unrecorded build input fails without consuming budget evidence`, (context) => {
    const candidate = candidateCopy(context, scenario);
    fs.appendFileSync(path.join(candidate, 'build.rs'), '\n');
    recordRejection(`${scenario.kind}-build-input`, () => verifier.verifyCurrentInputs(scenario.baselineRoot, candidate),
      /current B build input differs: build\.rs/);
  });

  test(`${scenario.kind}: repinning current sources cannot authorize an older valid archive`, (context) => {
    const candidate = candidateCopy(context, scenario);
    fs.appendFileSync(path.join(candidate, 'src/dom/mod.rs'), '\n');
    const harness = study.captureHarness(candidate);
    const policy = structuredClone(scenario.policy);
    policy.sourceHashes.B = harness.identity.sourceHash;
    policy.harnessSha256 = harness.sha256;
    const repinned = createRecordedEvidenceVerifier({ study, method, policy });
    const before = extractionDirectories();
    recordRejection(`${scenario.kind}-unmeasured-source`,
      () => repinned.verifyEvidence(scenario.baselineRoot, scenario.archiveRoot, candidate),
      /verified archive belongs to a different measurement harness/);
    assert.deepEqual(extractionDirectories(), before);
  });

  test(`${scenario.kind}: repinning package.json cannot hide a changed build command`, (context) => {
    const candidate = candidateCopy(context, scenario);
    const filename = path.join(candidate, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
    manifest.scripts.build += ' --unmeasured-contract-change';
    fs.writeFileSync(filename, `${JSON.stringify(manifest, null, 2)}\n`);
    const policy = structuredClone(scenario.policy);
    policy.buildInputHashes.B['package.json'] = digest(filename);
    const repinned = createRecordedEvidenceVerifier({ study, method, policy });
    const before = extractionDirectories();
    const rejection = recordRejection(`${scenario.kind}-unmeasured-build-command`,
      () => repinned.verifyEvidence(scenario.baselineRoot, scenario.archiveRoot, candidate),
      /package manifest changed build\/runtime fields beyond scripts\.test:compat/);
    assert.doesNotMatch(rejection.stack, /--unmeasured-contract-change/,
      'A rejected package manifest must not dump its command contents into logs');
    assert.deepEqual(extractionDirectories(), before);
  });
}

/**
 * Exercise the actual shared CLI with real archive verification and preserve process evidence.
 * @param {object} scenario - Declared historical or current dataset.
 * @param {string} name - Unique preserved result filename.
 * @param {string} candidateRoot - Actual current-source working directory of the child.
 * @param {string[]} argumentsList - Actual CLI arguments after the bound fixture scenario.
 * @returns {object} Complete synchronous child outcome, without mocking the platform.
 */
function executeCli(scenario, name, candidateRoot, argumentsList) {
  const command = [path.join(__dirname, 'recorded-evidence-contract-cli.cjs'), scenario.kind, ...argumentsList];
  const child = spawnSync(process.execPath, command, {
    cwd: candidateRoot, encoding: 'utf8', timeout: settings.cliTimeoutMs });
  fs.writeFileSync(path.join(fixture.outputRoot, `${name}.stdout.log`), child.stdout ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(fixture.outputRoot, `${name}.stderr.log`), child.stderr ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(fixture.outputRoot, `${name}.process.json`), `${JSON.stringify({
    command: [process.execPath, ...command], cwd: candidateRoot, pid: child.pid,
    exitCode: child.status, signal: child.signal, error: child.error?.message ?? null })}\n`, { flag: 'wx' });
  assert.ifError(child.error); assert.equal(child.signal, null);
  return child;
}

for (const scenario of fixture.scenarios) {
  test(`${scenario.kind}: real CLI reports the original acceptance without remapping a rejected budget`, () => {
    const child = executeCli(scenario, `${scenario.kind}-cli`, scenario.candidateRoot,
      [scenario.baselineRoot, scenario.archiveRoot]);
    assert.equal(child.status, scenario.expectedAccepted ? 0 : 1);
    const result = JSON.parse(child.stdout);
    assert.equal(result.verified, true); assert.equal(result.accepted, scenario.expectedAccepted);
    assert.equal(result.measurementExecuted, false);
    if (scenario.expectedAccepted) assert.equal(child.stderr, '');
    else assert.match(child.stderr, /has not accepted the performance budget/);
  });

  test(`${scenario.kind}: real CLI distinguishes stale build inputs from a rejected budget`, (context) => {
    const candidate = candidateCopy(context, scenario);
    fs.appendFileSync(path.join(candidate, 'build.rs'), '\n');
    const child = executeCli(scenario, `${scenario.kind}-cli-stale-inputs`, candidate,
      [scenario.baselineRoot, scenario.archiveRoot]);
    assert.equal(child.status, 2); assert.equal(child.stdout, '');
    assert.match(child.stderr, /current B build input differs: build\.rs/);
  });
}

test('real CLI rejects missing arguments before consuming any archive', () => {
  const scenario = fixture.scenarios[0];
  const child = executeCli(scenario, 'cli-missing-arguments', scenario.candidateRoot, []);
  assert.equal(child.status, 2); assert.equal(child.stdout, '');
  assert.match(child.stderr, /provide baseline and archive paths/);
});

for (const level of ['1', '2']) {
  test(`Python optimization ${level} fails before extracting any real evidence`, (context) => {
    const scenario = fixture.scenarios[0];
    const destination = temporaryDirectory(context);
    const command = ['-B', path.join(__dirname, 'recorded-evidence-extract.py'),
      path.join(scenario.archiveRoot, scenario.policy.archive.filename),
      path.join(scenario.archiveRoot, scenario.policy.rawManifest.filename), scenario.policy.archivePrefix, destination];
    const child = spawnSync(settings.pythonCommand, command, {
      encoding: 'utf8', env: { ...process.env, PYTHONOPTIMIZE: level }, timeout: settings.extractionTimeoutMs });
    fs.writeFileSync(path.join(fixture.outputRoot, `python-optimize-${level}.stdout.log`), child.stdout ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(fixture.outputRoot, `python-optimize-${level}.stderr.log`), child.stderr ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(fixture.outputRoot, `python-optimize-${level}.process.json`), `${JSON.stringify({
      command: [settings.pythonCommand, ...command], pid: child.pid, exitCode: child.status,
      signal: child.signal, error: child.error?.message ?? null, pythonOptimize: level })}\n`, { flag: 'wx' });
    assert.ifError(child.error); assert.equal(child.status, 1);
    assert.equal(child.stdout, ''); assert.match(child.stderr, /Python optimization disables required checks/);
    assert.deepEqual(fs.readdirSync(destination), []);
  });
}

for (const invalidCase of ['traversal', 'symbolic-link', 'hard-link', 'duplicate', 'undeclared', 'digest-mismatch']) {
  test(`real decoder rejects ${invalidCase} and the verifier removes partial extraction files`, (context) => {
    const scenario = fixture.scenarios[0];
    const directory = temporaryDirectory(context);
    const command = ['-B', path.join(__dirname, 'recorded-evidence-fixtures.py'), directory, invalidCase];
    const child = spawnSync(settings.pythonCommand, command, { encoding: 'utf8', timeout: settings.extractionTimeoutMs });
    fs.writeFileSync(path.join(fixture.outputRoot, `fixture-${invalidCase}.process.json`), `${JSON.stringify({
      command: [settings.pythonCommand, ...command], pid: child.pid, exitCode: child.status,
      signal: child.signal, error: child.error?.message ?? null,
      stdout: child.stdout, stderr: child.stderr })}\n`, { flag: 'wx' });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
    const generated = JSON.parse(child.stdout);
    const policy = structuredClone(scenario.policy);
    policy.archive = { filename: 'fixture.tar.gz', sha256: digest(path.join(directory, 'fixture.tar.gz')) };
    policy.rawManifest = { filename: 'raw-files.json', sha256: digest(path.join(directory, 'raw-files.json')) };
    policy.archivePrefix = generated.prefix;
    const { study, method } = implementations[scenario.kind];
    const verifier = createRecordedEvidenceVerifier({ study, method, policy });
    const before = extractionDirectories();
    recordRejection(`decoder-${invalidCase}`,
      () => verifier.verifyEvidence(scenario.baselineRoot, directory, scenario.candidateRoot),
      /archive extraction failed/);
    assert.deepEqual(extractionDirectories(), before);
    assert.equal(fs.existsSync(path.join(directory, 'escaped.txt')), false);
  });
}
