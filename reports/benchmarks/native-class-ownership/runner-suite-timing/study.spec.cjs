/** @file Tests numerical decisions, authenticated inputs and actual process failure preservation. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const settings = require('./constants/study.json');
const { plan, median, summarize } = require('./plan.cjs');
const { execute, runCommands } = require('./process.cjs');
const study = require('./study.cjs');

/** Keep fixture processes and outputs in a unique owned directory. */
function temporary(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rustdom-suite-timing-contract-'));
  try { return run(root); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

/** Create numerical observations only; no platform dependency is replaced. */
function numericalRecords(aaRatio = 1, abRatio = 1) {
  return plan().filter((selection) => selection.stage === 'measured').map((selection) => {
    const elapsedMs = selection.label === 'A' ? 1000 : 1000 * (selection.phase === 'AA' ? aaRatio : abRatio);
    return { selection, elapsedMs, elapsedNs: String(Math.round(elapsedMs * 1e6)), complete: true, exitCode: 0 };
  });
}

test('the complete schedule balances every pair, assignment and runner rotation', () => {
  const selections = plan(); assert.equal(selections.length, 342);
  assert.equal(selections.filter((selection) => selection.stage === 'warmup').length, 54);
  for (const node of settings.nodeVersions) for (const phase of settings.phases) for (const runner of settings.runners) {
    const own = selections.filter((selection) => selection.node === node && selection.phase === phase && selection.runner === runner);
    assert.equal(own.length, 24);
    for (const label of ['A', 'B']) {
      const values = own.filter((selection) => selection.label === label);
      assert.equal(new Set(values.map((selection) => `${selection.factors.rotation}/${selection.factors.reversePair}/${selection.factors.reverseAssignment}`)).size, 12);
      assert.equal(values.filter((selection) => selection.factors.reversePair).length, 6);
      assert.equal(values.filter((selection) => selection.factors.reverseAssignment).length, 6);
    }
    const first = node === settings.nodeVersions[0] ? 0 : 11;
    assert.equal(own[0].position, first);
    for (let position = 0; position < own.length; position += 2) {
      assert.equal(own[position].position, own[position + 1].position);
      assert.notEqual(own[position].label, own[position + 1].label);
    }
    if (phase === 'AB') assert.ok(own.filter((selection) => selection.label === 'B').every((selection) => selection.physical === 'B'));
  }
});

test('median preserves observations and rejects unusable clock values', () => {
  const values = [100, 2, 5, 1];
  assert.equal(median(values), 3.5); assert.deepEqual(values, [100, 2, 5, 1]);
  for (const invalid of [[], [0], [-1], [NaN], [Infinity]]) assert.throws(() => median(invalid), /invalid duration/);
});

test('Linux runner invocations retain the qualified public CLI contract', () => {
  for (const runner of settings.runners) {
    assert.deepEqual(study.runnerArgv('/opt/node/bin/node', '/tmp/package', runner, '/tmp/output', '/tmp/dependencies'),
      study.qualified().runner.runnerCommand('/opt/node/bin/node', '/tmp/package', runner, '/tmp/output', '/tmp/dependencies'));
  }
});

test('exact five-percent bounds pass and larger changes fail without an epsilon', () => {
  assert.equal(summarize(numericalRecords(1.05, 1.05)).suiteTimingAccepted, true);
  assert.equal(summarize(numericalRecords(0.95, 0.5)).suiteTimingAccepted, true);
  assert.equal(summarize(numericalRecords(1.050001, 1)).suiteTimingAccepted, false);
  assert.equal(summarize(numericalRecords(0.949999, 1)).suiteTimingAccepted, false);
  assert.equal(summarize(numericalRecords(1, 1.050001)).suiteTimingAccepted, false);
});

test('a passing A/C cannot bypass failed A/A calibration', () => {
  const result = summarize(numericalRecords(1.1, 0.9));
  assert.equal(result.suiteTimingAccepted, false);
  assert.ok(result.rows.filter((row) => row.phase === 'AB').every((row) => !row.calibrated && !row.withinBudget));
  assert.equal(result.ownershipAcceptanceChanged, false);
});

test('no row accepts missing or duplicate paired CLI positions', () => {
  const records = numericalRecords();
  assert.throws(() => summarize(records.slice(1)), /incomplete cell/);
  records[0] = records.find((record) => record.selection.node === records[0].selection.node &&
    record.selection.phase === records[0].selection.phase && record.selection.runner === records[0].selection.runner &&
    record.selection.label === records[0].selection.label && record.selection.position !== records[0].selection.position);
  assert.throws(() => summarize(records), /duplicate position/);
});

test('the immutable real preparation passes and an altered receipt fails before loading a runner', () => {
  const prepared = process.env.RUSTDOM_SUITE_TIMING_PREPARED;
  assert.ok(prepared, 'Set RUSTDOM_SUITE_TIMING_PREPARED to the qualified preparation');
  const actual = study.authenticatePreparation(prepared);
  assert.equal(actual.dependenciesSha256, 'eea14c732c46379d926191592dc05855090dbed1348b3c219ab838b15b3f264a');
  temporary((root) => {
    const index = fs.readFileSync(path.join(prepared, 'index.json'));
    fs.writeFileSync(path.join(root, 'index.json'), Buffer.concat([index, Buffer.from('\n')]));
    assert.throws(() => study.authenticatePreparation(root), /independent pin/);
  });
});

test('a changed source receipt is rejected without altering project files', () => {
  const publication = { commit: 'a'.repeat(40), files: study.sourceIdentity() };
  study.verifyPublication(publication);
  const first = Object.keys(publication.files)[0]; publication.files[first] = '0'.repeat(64);
  assert.throws(() => study.verifyPublication(publication), /source receipt/);
});

test('the real formal CLI rejects null and false publication values before creating outputs', () => temporary((root) => {
  const prepared = process.env.RUSTDOM_SUITE_TIMING_PREPARED;
  assert.ok(prepared);
  for (const [position, publication] of [null, false, 0, '', [], { commit: 'a'.repeat(40), files: {} }].entries()) {
    const filename = path.join(root, `publication-${position}.json`); fs.writeFileSync(filename, JSON.stringify(publication));
    const output = path.join(root, `never-${position}`);
    const child = spawnSync(process.execPath, [path.join(__dirname, 'study.cjs'), prepared, filename, output, process.execPath, process.execPath], { encoding: 'utf8' });
    assert.equal(child.status, 2); assert.match(child.stderr, /publication|source receipt/);
    assert.equal(fs.existsSync(output), false, 'Malformed publication must not enter qualification or launch suites');
  }
}));

test('a real delayed Node process is fully timed and resource data is preserved', () => temporary((root) => {
  const index = { processes: [] };
  const command = { selection: { stage: 'contract' }, directory: path.join(root, 'successful'), cwd: root,
    argv: [process.execPath, '-e', 'setTimeout(()=>process.stdout.write("finished"),100)'] };
  const result = execute(command, index, () => {});
  assert.equal(result.exitCode, 0); assert.ok(BigInt(result.elapsedNs) >= 50_000_000n);
  assert.equal(result.elapsedMs, Number(result.elapsedNs) / 1e6);
  assert.ok(result.resources.maxRssKiB > 0);
  assert.equal(fs.readFileSync(path.join(command.directory, 'suite.stdout.log'), 'utf8'), 'finished');
  assert.equal(JSON.parse(fs.readFileSync(path.join(command.directory, 'timing.json'))).elapsedNs, result.elapsedNs);
}));

test('real exit seven preserves logs and never launches the following selection', () => temporary((root) => {
  const marker = path.join(root, 'unexpected');
  const commands = [
    { selection: { stage: 'failure' }, directory: path.join(root, 'failed'), cwd: root,
      argv: [process.execPath, '-e', 'process.stdout.write("before");process.stderr.write("expected");process.exitCode=7'] },
    { selection: { stage: 'never' }, directory: path.join(root, 'never'), cwd: root,
      argv: [process.execPath, '-e', 'require("node:fs").writeFileSync(process.argv[1],"wrong")', marker] },
  ];
  const index = { processes: [] };
  assert.throws(() => runCommands(commands, index, () => {}, () => ({})), /process failed/);
  assert.equal(index.processes.length, 1); assert.equal(index.processes[0].exitCode, 7);
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.readFileSync(path.join(root, 'failed/suite.stdout.log'), 'utf8'), 'before');
  assert.equal(fs.readFileSync(path.join(root, 'failed/suite.stderr.log'), 'utf8'), 'expected');
  assert.ok(fs.existsSync(path.join(root, 'failed/resources.json')));
}));

test('inspection errors after real exit zero stop the next command and preserve the invalid output', () => temporary((root) => {
  const directory = path.join(root, 'invalid');
  const commands = [{ selection: { stage: 'invalid' }, directory, cwd: root,
    argv: [process.execPath, '-e', 'require("node:fs").writeFileSync(process.argv[1],"{bad")', path.join(directory, 'report.json')] },
  { selection: { stage: 'never' }, directory: path.join(root, 'never'), cwd: root, argv: [process.execPath, '-e', 'process.exit(0)'] }];
  const index = { processes: [] };
  assert.throws(() => runCommands(commands, index, () => {}, () => JSON.parse(fs.readFileSync(path.join(directory, 'report.json')))), SyntaxError);
  assert.equal(index.processes.length, 1); assert.equal(index.processes[0].exitCode, 0); assert.equal(index.processes[0].complete, false);
  assert.equal(fs.readFileSync(path.join(directory, 'report.json'), 'utf8'), '{bad');
  assert.equal(fs.existsSync(path.join(root, 'never')), false);
}));

test('a real child signal remains a failed launch rather than a zero resource exit', () => temporary((root) => {
  const index = { processes: [] };
  assert.throws(() => execute({ selection: { stage: 'signal' }, directory: root, cwd: root,
    argv: [process.execPath, '-e', 'process.kill(process.pid,"SIGTERM")'] }, index, () => {}), /process failed/);
  assert.notEqual(index.processes[0].exitCode, 0);
  assert.ok(fs.existsSync(path.join(root, 'resources.json')) && fs.existsSync(path.join(root, 'timing.json')));
}));
