/** @file Exercises real derived artifacts and historical observations without DOM, profiling or new measurements. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { test } = require('node:test');
const context = require('./context.cjs');
const { policy, read, hash } = context;
const { expectedMap, verifyDerived } = require('./derived.cjs');
const { validateIndex } = require('./replay.cjs');
const { commandFor } = require('./commands.cjs');
const { plan } = require('./model.cjs');
const { validateChecks, validateActivation } = require('./readiness.cjs');
const { consume, requireBudget } = require('./capture.cjs');
const { analyzeEvidence, validateProcess } = require('./observations.cjs');
const fixtures = require('./constants/fixtures.json');
const qa = process.env.RANGE_TELEMETRY_QA;
const legacy = process.env.RANGE_TELEMETRY_LEGACY;
assert.ok(qa, 'Set RANGE_TELEMETRY_QA to owned fresh derivations, never an archived capture');
assert.deepEqual(read(path.join(qa, fixtures.qaOwnerFile)), { revision: policy.revision, role: fixtures.qaOwnerRole });

test('El grafo actual conserva los 563 pins y enlaza todos los componentes publicados', () => {
  const files = context.sourceFiles();
  const historical = context.historicalPins();
  assert.equal(Object.keys(historical).length, 563);
  assert.equal(files[policy.historicalReceipt.path], policy.historicalReceipt.sha256);
  for (const [name, digest] of Object.entries(historical)) assert.equal(files[name], digest);
  for (const name of policy.methodFiles) assert.equal(files[`${policy.methodDirectory}/${name}`], hash(path.join(__dirname, name)));
});

test('Los mapas independientes validan los árboles reales CPU/JIT completos', () => {
  assert.ok(qa, 'Set RANGE_TELEMETRY_QA to the real owned derivation evidence');
  const sourceManifest = read(path.join(qa, policy.paths.sourceManifest));
  for (const mode of policy.modes) {
    assert.deepEqual(read(path.join(context.repository, policy.codeMaps[mode])), expectedMap(mode));
    const receipt = verifyDerived(path.join(qa, policy.paths.derivedPrefix + mode), mode, sourceManifest, hash(path.join(qa, policy.paths.sourceManifest)));
    assert.equal(Object.keys(receipt.derivedFiles).length, 893);
    assert.equal(receipt.captureImplemented, true);
  }
});

test('Archivos extra y un recibo reescrito no pueden redefinir código derivado', () => {
  assert.ok(qa);
  const root = path.join(qa, policy.paths.derivedPrefix + policy.cpuMode);
  const sourceManifest = read(path.join(qa, policy.paths.sourceManifest));
  const filename = path.join(root, 'not-registered.json');
  assert.equal(fs.existsSync(filename), false);
  fs.writeFileSync(filename, '{}\n', { flag: 'wx' });
  try { assert.throws(() => verifyDerived(root, policy.cpuMode, sourceManifest, hash(path.join(qa, policy.paths.sourceManifest))), /extra or missing/); }
  finally { fs.unlinkSync(filename); }
  const receiptFile = path.join(root, policy.paths.preparation);
  const original = fs.readFileSync(receiptFile);
  const forged = JSON.parse(original); forged.derivedFiles[policy.samplerEntry] = '0'.repeat(64);
  fs.writeFileSync(receiptFile, JSON.stringify(forged));
  try { assert.throws(() => verifyDerived(root, policy.cpuMode, sourceManifest, hash(path.join(qa, policy.paths.sourceManifest)))); }
  finally { fs.writeFileSync(receiptFile, original); }
});

test('La ruta de ejecución y su argv se reproducen sin cambiar el root original durante replay', () => {
  for (const [ordinal, input] of plan().entries()) {
    const root = path.join(os.tmpdir(), 'original-capture-root');
    const runtime = { executable: path.join(os.tmpdir(), 'actual-node'), node: input.node };
    const command = commandFor(input, ordinal, root, runtime);
    assert.equal(command.directory, path.join(root, String(ordinal).padStart(4, '0')));
    assert.equal(command.argv[0], runtime.executable);
    assert.deepEqual(command.argv.slice(-7), [path.join(root, policy.paths.manifest), input.phase, input.engine,
      String(input.position), input.label, path.join(command.directory, policy.paths.report), '4']);
  }
});

test('El consumo exclusivo conserva el primer recibo ante una segunda invocación', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'range-aa-consumption-'));
  try {
    const filename = path.join(root, 'receipt.json'); const receipt = { fixture: true, attempt: 1 };
    consume(filename, receipt); const original = fs.readFileSync(filename);
    assert.throws(() => consume(filename, { fixture: true, attempt: 2 }), { code: 'EEXIST' });
    assert.deepEqual(fs.readFileSync(filename), original);
  } finally {
    assert.ok(fs.realpathSync(root).startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true });
  }
});

test('El contexto acepta un evento declarado sobre Git real y rechaza eventos y hosts ajenos sin APIs', () => {
  assert.equal(policy.captureImplemented, true);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'range-aa-context-'));
  try {
    const eventFile = path.join(directory, 'event.json');
    const sourceCommit = context.sourceContext().sourceCommit;
    const event = { action: 'labeled', label: { name: policy.label }, pull_request: { number: policy.pullRequestNumber, head: { sha: sourceCommit } } };
    const environment = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_RUN_ATTEMPT: '1',
      GITHUB_REPOSITORY: policy.apiRepository, GITHUB_WORKFLOW: policy.workflowName, GITHUB_RUN_ID: '1',
      NATIVE_TELEMETRY_SOURCE_COMMIT: sourceCommit, GITHUB_EVENT_PATH: eventFile };
    fs.writeFileSync(eventFile, JSON.stringify(event));
    // This invokes only the real context reader, never run(), readReadiness() or a profiler.
    const invoke = (overrides = {}) => spawnSync(process.execPath,
      ['-e', 'console.log(JSON.stringify(require(process.argv[1]).captureContext(process.argv[2])))', path.join(__dirname, 'capture.cjs'), sourceCommit],
      { encoding: 'utf8', env: { ...environment, ...overrides } });
    const accepted = invoke(); assert.equal(accepted.status, 0, accepted.stderr);
    assert.deepEqual(JSON.parse(accepted.stdout), event);
    for (const invalid of [{ GITHUB_ACTIONS: 'false' }, { GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_REPOSITORY: 'other/repository' },
      { GITHUB_WORKFLOW: 'other-workflow' }, { GITHUB_RUN_ID: '' }, { NATIVE_TELEMETRY_SOURCE_COMMIT: '0'.repeat(40) }]) {
      assert.notEqual(invoke(invalid).status, 0);
    }
    for (const invalid of [{ ...event, action: 'synchronize' }, { ...event, label: { name: 'other-label' } },
      { ...event, pull_request: { ...event.pull_request, number: 1 } },
      { ...event, pull_request: { ...event.pull_request, head: { sha: '0'.repeat(40) } } }]) {
      fs.writeFileSync(eventFile, JSON.stringify(invalid)); assert.notEqual(invoke().status, 0);
    }
    assert.deepEqual(fs.readdirSync(directory), ['event.json']);
  } finally {
    assert.ok(fs.realpathSync(directory).startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true });
  }
});

test('El presupuesto reserva el worker entero y también limita el procesamiento final', () => {
  requireBudget(0, 180001, 180000);
  assert.throws(() => requireBudget(1, 180001, 180000));
  requireBudget(1, 2);
  assert.throws(() => requireBudget(2, 2));
  assert.throws(() => requireBudget(3, 2));
  assert.throws(() => requireBudget(0, 2, -1));
});

test('Los headers parciales, ajenos o con aceptación se rechazan antes del replay', () => {
  const header = { revision: policy.revision, purpose: policy.purpose, complete: true, diagnosticOnly: true,
    runAttempt: 1, performanceAccepted: null, gateReevaluated: false, processes: Array(policy.plannedProcesses).fill(null) };
  validateIndex(header); // This checks only a header fixture, never complete capture validity.
  for (const invalid of [{ complete: false }, { failure: { message: 'partial fixture' } }, { performanceAccepted: true },
    { gateReevaluated: true }, { revision: 'historical-fixture' }, { processes: [] }, { runAttempt: 2 }]) {
    assert.throws(() => validateIndex({ ...header, ...invalid }));
  }
});

test('La selección de checks no acepta un éxito anterior a un check nuevo fallido', () => {
  const commit = '1'.repeat(40);
  const checks = [{ id: 1, name: 'fixture-check', head_sha: commit, status: 'completed', conclusion: 'success' }];
  validateChecks(checks, commit, ['fixture-check']);
  assert.throws(() => validateChecks([...checks, { ...checks[0], id: 2, conclusion: 'failure' }], commit, ['fixture-check']));
  assert.throws(() => validateChecks(checks, '2'.repeat(40), ['fixture-check']));
});

test('La vinculación de activación usa run.head_sha y rechaza otra ejecución no omitida', () => {
  const commit = '1'.repeat(40);
  const declaration = { label: 'fixture-label', pullRequestNumber: 1, workflow: '.github/workflows/fixture.yml', apiRepository: 'fixture/repository', requiredChecks: ['fixture-check'] };
  const evidence = { event: { action: 'labeled', label: { name: declaration.label }, pull_request: { number: 1, head: { sha: commit } } },
    run: { id: 1, head_sha: commit, run_attempt: 1, event: 'pull_request', status: 'in_progress', path: declaration.workflow, repository: { full_name: declaration.apiRepository },
      pull_requests: [{ head: { sha: 'later-live-head' } }] }, history: [{ id: 1 }, { id: 2, conclusion: 'skipped' }],
    checks: [{ id: 1, name: 'fixture-check', head_sha: commit, status: 'completed', conclusion: 'success' }] };
  validateActivation(evidence, commit, declaration);
  assert.throws(() => validateActivation({ ...evidence, history: [...evidence.history, { id: 3, conclusion: 'failure' }] }, commit, declaration));
  assert.throws(() => validateActivation({ ...evidence, run: { ...evidence.run, run_attempt: 2 } }, commit, declaration));
  assert.throws(() => validateActivation({ ...evidence, run: { ...evidence.run, status: 'completed' } }, commit, declaration));
});

test('El lector compartido reproduce ocho procesos reales históricos sin cambiar su identidad', () => {
  assert.ok(legacy, 'Set RANGE_TELEMETRY_LEGACY to authenticated native-mutation data');
  assert.equal(hash(path.join(legacy, policy.paths.index)), fixtures.index.sha256);
  const index = read(path.join(legacy, policy.paths.index));
  for (const ordinal of fixtures.ordinals) {
    const entry = index.processes[ordinal];
    const root = path.join(legacy, String(ordinal).padStart(4, '0'));
    for (const [name, expected] of Object.entries(entry.files)) assert.equal(hash(path.join(root, name)), expected, name);
    const report = read(path.join(root, policy.paths.report));
    const telemetry = read(path.join(root, policy.paths.telemetry));
    const actual = analyzeEvidence(root, { engine: report.engine, reportRevision: report.revision, telemetryRevision: telemetry.revision });
    const { startupRandomProbe, ...expected } = read(path.join(root, policy.paths.analysis));
    assert.deepEqual(actual, expected);
    assert.equal(actual.revision, 'native-mutation-telemetry-v1');
    assert.equal(actual.key, 'mutation-records-collect/100');
    assert.equal(actual.spans.length, 12);
    assert.throws(() => validateProcess(root, index.manifest, entry.input, entry, index.derivationSha256[entry.input.mode], index),
      (error) => error.actual === 'native-mutation-telemetry-v1' && error.expected === policy.revision);
  }
});

test('Git mantiene los espacios de porcelain y observa realmente el estado modificado', () => {
  const probe = process.env.RANGE_TELEMETRY_GIT_PROBE;
  assert.ok(probe, 'Set RANGE_TELEMETRY_GIT_PROBE to the owned tracked QA fixture');
  assert.equal(path.resolve(probe), path.join(context.repository, fixtures.gitProbe));
  assert.deepEqual(context.sourceContext().sourceChanges, []);
  const original = fs.readFileSync(probe);
  try {
    fs.writeFileSync(probe, Buffer.concat([original, Buffer.from('\nmodified fixture\n')]));
    const actual = context.sourceContext();
    const expected = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: context.repository, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
    assert.deepEqual(actual.sourceChanges, expected);
    assert.ok(actual.sourceChanges.some((line) => line.startsWith(' M ')));
  } finally { fs.writeFileSync(probe, original); }
  assert.deepEqual(context.sourceContext().sourceChanges, []);
});
