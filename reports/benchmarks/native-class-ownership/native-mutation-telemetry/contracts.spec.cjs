/** @file Verify the real diagnostic plan without starting a worker or collecting a sample. */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { plan } = require('./schedule.cjs');
const { analyzeProcess } = require('./analyze.cjs');
const { annotate } = require('./worker.cjs');
const coordinator = require('./run.cjs');
const policy = require('./constants/protocol.json');
const repository = path.resolve(__dirname, '../../../..');
const study = require('../current-ownership-experiment.cjs');
const settings = require('../constants/current-ownership.cjs');
const entries = plan(repository);
const historicalRoot = process.env.NATIVE_TELEMETRY_HISTORICAL_CORPUS;
const historical = JSON.parse(fs.readFileSync(path.join(historicalRoot, 'index.json'), 'utf8'));
const originalReader = require('../jsdom-telemetry/analyze.cjs');
const originalPolicy = require('../jsdom-telemetry/constants/protocol.json');
const historicalIdentity = { engine: 'jsdom', reportRevision: settings.revision, telemetryRevision: originalPolicy.revision };
const profiles = policy.nodeVersions.flatMap((node) => policy.modes.map((mode) => {
  const ordinal = historical.processes.findIndex((entry) => entry.node === node && entry.input.mode === mode);
  assert.ok(ordinal >= 0);
  const entry = historical.processes[ordinal];
  const directory = path.join(historicalRoot, ordinal < historical.processes.length / 2 ? 'node22' : 'node24',
    String(ordinal % (historical.processes.length / 2)).padStart(3, '0'));
  for (const [name, expected] of Object.entries(entry.files)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex'), expected);
  }
  return { node, mode, directory };
}));

/** Exercise controlled corruption of a real CPU artifact, without changing its original files. */
function withCorruptedReport(change, inspect) {
  const source = profiles.find((entry) => entry.mode === 'cpu');
  const parent = fs.realpathSync(os.tmpdir()); const temporary = fs.mkdtempSync(path.join(parent, 'rustdom-native-telemetry-corruption-'));
  const names = ['report.json', 'report.json.telemetry.json', 'cpu.cpuprofile'];
  try {
    for (const name of names) fs.copyFileSync(path.join(source.directory, name), path.join(temporary, name));
    const report = JSON.parse(fs.readFileSync(path.join(temporary, 'report.json'), 'utf8'));
    change(report); fs.writeFileSync(path.join(temporary, 'report.json'), JSON.stringify(report));
    inspect(temporary);
  } finally {
    assert.equal(path.dirname(temporary), parent);
    for (const name of names) if (fs.existsSync(path.join(temporary, name))) fs.unlinkSync(path.join(temporary, name));
    fs.rmdirSync(temporary);
  }
}

test('diagnostic plan preserves all phases engines labels and sixteen seeds for the declared row', () => {
  const original = study.processSchedule().filter((entry) => entry.rowIndex === policy.rowIndex);
  assert.equal(entries.length, 512);
  for (const node of policy.nodeVersions) for (const mode of policy.modes) {
    const group = entries.filter((entry) => entry.node === node && entry.mode === mode);
    assert.equal(group.length, 128);
    assert.deepEqual(group.map(({ node: actualNode, mode: actualMode, ...input }) => input), original);
    assert.deepEqual([...new Set(group.map((entry) => entry.position))].sort((left, right) => left - right), Array.from({ length: 16 }, (_, position) => position));
    for (const phase of settings.phases) for (const engine of settings.engines) for (const label of settings.labels) {
      assert.equal(group.filter((entry) => entry.phase === phase && entry.engine === engine && entry.label === label).length, 16);
    }
  }
});
test('mutating a diagnostic plan cannot change the original schedule rows or budgets', () => {
  const original = study.processSchedule();
  const originalSettings = structuredClone({ rows: settings.rows, phases: settings.phases, controlBudgetPercent: settings.controlBudgetPercent,
    rustBudgetPercent: settings.rustBudgetPercent });
  const modified = plan(repository); modified[0].rowIndex = -1; modified[0].label = 'changed'; modified[0].position = -1;
  assert.deepEqual(study.processSchedule(), original);
  assert.deepEqual({ rows: settings.rows, phases: settings.phases, controlBudgetPercent: settings.controlBudgetPercent,
    rustBudgetPercent: settings.rustBudgetPercent }, originalSettings);
});

test('identified historical CPU/JIT profiles preserve every original clock GC frame and signed-delta result', () => {
  for (const profile of profiles) {
    const expected = originalReader.analyzeProcess(profile.directory);
    const actual = analyzeProcess(profile.directory, historicalIdentity);
    assert.equal(actual.engine, 'jsdom');
    assert.equal(actual.sourceReportRevision, settings.revision);
    assert.equal(actual.sourceTelemetryRevision, originalPolicy.revision);
    const comparable = Object.fromEntries(Object.keys(expected).map((name) => [name, actual[name]]));
    assert.deepEqual(comparable, { ...expected, revision: policy.revision });
    assert.equal(actual.spans.length, 12); assert.equal(actual.accepted, null); assert.equal(actual.gateReevaluated, false);
  }
});
test('historical jsdom telemetry cannot borrow a native or new-capture identity', () => {
  const profile = profiles[0];
  assert.throws(() => analyzeProcess(profile.directory, { ...historicalIdentity, engine: 'rustdom' }), { code: 'ERR_ASSERTION' });
  assert.throws(() => analyzeProcess(profile.directory, { ...historicalIdentity, reportRevision: policy.revision }), { code: 'ERR_ASSERTION' });
  assert.throws(() => analyzeProcess(profile.directory, { ...historicalIdentity, telemetryRevision: policy.revision }), { code: 'ERR_ASSERTION' });
});
test('a corrupted jsdom report cannot claim native release without a native baseline', () => {
  for (const baseline of [undefined, { napiClasses: { live: -1 } }]) {
    withCorruptedReport((report) => { report.engine = 'rustdom'; report.nativeBaseline = baseline; }, (temporary) => {
      assert.throws(() => analyzeProcess(temporary, { ...historicalIdentity, engine: 'rustdom' }), {
        code: 'ERR_ASSERTION', message: 'Native telemetry: missing or invalid native class baseline' });
    });
  }
});
test('missing release rounds or a report-supplied weaker requirement cannot claim release', () => {
  for (const change of [(report) => { report.batches[0].cleanupTrace = []; },
    (report) => { delete report.batches[0].cleanupTrace; },
    (report) => { report.batches[0].cleanupTrace = report.batches[0].cleanupTrace.slice(-2); },
    (report) => { report.settings.requiredClearRounds = 0; }]) {
    withCorruptedReport(change, (temporary) => assert.throws(() => analyzeProcess(temporary, historicalIdentity), { code: 'ERR_ASSERTION' }));
  }
});
test('a report cannot omit spans by declaring a smaller measurement plan', () => {
  withCorruptedReport((report) => {
    report.settings.warmupSamples = 0; report.settings.measuredSamples = 0;
    report.batches[0].sampleTimings = []; report.batches[0].samplesMs = [];
  }, (temporary) => assert.throws(() => analyzeProcess(temporary, historicalIdentity), { code: 'ERR_ASSERTION' }));
});
test('an incomplete batch or omitted owner observations cannot claim complete release', () => {
  for (const change of [(report) => { report.batches[0].complete = false; },
    (report) => { delete report.batches[0].trackedOwners.window; }]) {
    withCorruptedReport(change, (temporary) => assert.throws(() => analyzeProcess(temporary, historicalIdentity), { code: 'ERR_ASSERTION' }));
  }
});
test('the real worker CLI refuses local execution and repeated hosted attempts before writing evidence', () => {
  const parent = fs.realpathSync(os.tmpdir()); const temporary = fs.mkdtempSync(path.join(parent, 'rustdom-native-worker-guard-'));
  const output = path.join(temporary, 'report.json');
  try {
    for (const [hosted, attempt, message] of [['false', '1', 'requires the declared hosted runner'], ['true', '2', 'repeated attempts are forbidden']]) {
      const result = spawnSync(process.execPath, [path.join(__dirname, 'worker.cjs'), 'unused', 'AA', 'rustdom', '0', 'A', output, '0'], {
        env: { ...process.env, GITHUB_ACTIONS: hosted, GITHUB_RUN_ATTEMPT: attempt }, encoding: 'utf8', timeout: 10000 });
      assert.equal(result.status, 2); assert.ok(result.stderr.includes(message));
      assert.deepEqual(fs.readdirSync(temporary), []);
    }
  } finally { assert.equal(path.dirname(temporary), parent); fs.rmdirSync(temporary); }
});
test('already-annotated historical study reports cannot be relabeled as fresh sampler output', () => {
  const report = JSON.parse(fs.readFileSync(path.join(process.env.NATIVE_TELEMETRY_QUALIFICATION_CORPUS, 'node22/000/report.json'), 'utf8'));
  assert.throws(() => annotate(report, policy, '0'.repeat(64), {}), { code: 'ERR_ASSERTION' });
});
test('the real coordinator CLI refuses local execution and repeated attempts before touching output', () => {
  const parent = fs.realpathSync(os.tmpdir()); const temporary = fs.mkdtempSync(path.join(parent, 'rustdom-native-coordinator-guard-'));
  try {
    for (const [hosted, attempt, message] of [['false', '1', 'requires the declared hosted runner'], ['true', '2', 'repeated attempts are forbidden']]) {
      const result = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), '--capture', 'unused', path.join(temporary, 'capture'),
        '0'.repeat(40), process.execPath, process.execPath], {
        env: { ...process.env, GITHUB_ACTIONS: hosted, GITHUB_RUN_ATTEMPT: attempt }, encoding: 'utf8', timeout: 10000 });
      assert.equal(result.status, 2); assert.ok(result.stderr.includes(message)); assert.deepEqual(fs.readdirSync(temporary), []);
    }
  } finally { assert.equal(path.dirname(temporary), parent); fs.rmdirSync(temporary); }
});
test('a genuinely derived CPU/JIT tree matches registered bytes without running it', () => {
  for (const mode of policy.modes) {
    const directory = `${process.env.NATIVE_TELEMETRY_DERIVED_PREFIX}-${mode}`;
    const receipt = JSON.parse(fs.readFileSync(path.join(directory, 'preparation.json'), 'utf8'));
    assert.equal(coordinator.verifyDerived(directory, receipt, mode), receipt);
  }
});
test('self-consistent local hashes or same-byte symlinks cannot redefine the reviewed executable graph', () => {
  const parent = fs.realpathSync(os.tmpdir()); const temporary = fs.mkdtempSync(path.join(parent, 'rustdom-native-derivation-corruption-'));
  try {
    const original = `${process.env.NATIVE_TELEMETRY_DERIVED_PREFIX}-cpu`;
    for (const variant of ['changed-bytes', 'redirected-path', 'extra-dependency']) {
      const directory = path.join(temporary, variant); fs.cpSync(original, directory, { recursive: true });
      const receipt = JSON.parse(fs.readFileSync(path.join(directory, 'preparation.json'), 'utf8'));
      if (variant === 'changed-bytes') {
        fs.appendFileSync(path.join(directory, 'worker.cjs'), '\n// corrupted input\n');
        receipt.derivedFiles['worker.cjs'] = createHash('sha256').update(fs.readFileSync(path.join(directory, 'worker.cjs'))).digest('hex');
        fs.writeFileSync(path.join(directory, 'preparation.json'), JSON.stringify(receipt));
      } else if (variant === 'redirected-path') {
        const target = path.join(temporary, 'same-worker.cjs'); fs.renameSync(path.join(directory, 'worker.cjs'), target);
        fs.symlinkSync(target, path.join(directory, 'worker.cjs'));
      } else {
        fs.mkdirSync(path.join(directory, 'node_modules')); fs.writeFileSync(path.join(directory, 'node_modules/overlay.cjs'), 'module.exports = {};\n');
      }
      assert.throws(() => coordinator.verifyDerived(directory, receipt, 'cpu'), { code: 'ERR_ASSERTION' });
    }
  } finally {
    assert.equal(path.dirname(temporary), parent); assert.equal(fs.realpathSync(temporary), temporary);
    fs.rmSync(temporary, { recursive: true });
  }
});
test('actual paired startup probes remain complete and reject missing labels or corrupted values', () => {
  const root = process.env.NATIVE_TELEMETRY_QUALIFICATION_CORPUS;
  const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
  const entries = index.processes.flatMap((entry, ordinal) => {
    if (entry.node !== policy.nodeVersions[0] || entry.input.phase !== 'AA' || entry.input.position !== 0 || entry.input.rowIndex !== policy.rowIndex) return [];
    const report = JSON.parse(fs.readFileSync(path.join(root, 'node22', String(ordinal).padStart(3, '0'), 'report.json'), 'utf8'));
    return [{ ...entry.input, node: entry.node, probe: report.randomProbe }];
  });
  coordinator.validateProbeGroup(entries);
  assert.throws(() => coordinator.validateProbeGroup(entries.slice(1)), { code: 'ERR_ASSERTION' });
  const corrupted = structuredClone(entries); corrupted[0].probe[0] = -1;
  assert.throws(() => coordinator.validateProbeGroup(corrupted), { code: 'ERR_ASSERTION' });
});
test('the full replay cannot promote a genuine historical diagnostic to this method', () => {
  assert.throws(() => coordinator.verify(historicalRoot), { code: 'ERR_ASSERTION' });
});
