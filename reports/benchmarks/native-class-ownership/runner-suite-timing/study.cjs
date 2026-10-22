/** @file Authenticates and records one complete whole-suite timing study. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const settings = require('./constants/study.json');
const { plan, summarize } = require('./plan.cjs');
const { runCommands, launcherArgv } = require('./process.cjs');
const repository = path.resolve(__dirname, '../../../..');
const qualifiedDirectory = path.join(__dirname, '../runner-suites');
const summaryPath = 'reports/validation/native-class-ownership/runner-suites-qualification/summary.json';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const writeJson = (filename, value) => fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);

/** Check frozen runner sources before loading their code; this does not load an addon. */
function qualified() {
  const bytes = fs.readFileSync(path.join(repository, summaryPath));
  assert.equal(hash(bytes), settings.qualificationSummarySha256, 'Suite timing: changed qualification receipt');
  const summary = JSON.parse(bytes);
  for (const entry of summary.sourceFiles) assert.equal(hash(fs.readFileSync(path.join(qualifiedDirectory, entry.path))), entry.sha256,
    `Suite timing: changed qualified source ${entry.path}`);
  return { preparation: require('../runner-suites/prepare.cjs'), runner: require('../runner-suites/qualify.cjs'),
    suiteSettings: require('../runner-suites/constants/suites.json'), summary };
}

/** Pin the complete preparation independently of the claims inside its own index. */
function authenticatePreparation(directory) {
  assert.equal(hash(fs.readFileSync(path.join(directory, 'index.json'))), settings.preparationIndexSha256,
    'Suite timing: preparation index differs from the published independent pin');
  return qualified().preparation.verify(directory);
}

/** Include all loaded project helpers and the complete declared method in the publication receipt. */
function sourceIdentity() {
  const runtime = qualified();
  const names = new Set([summaryPath, ...settings.methodFiles.map((name) => `reports/benchmarks/native-class-ownership/runner-suite-timing/${name}`),
    ...runtime.summary.sourceFiles.map((entry) => `reports/benchmarks/native-class-ownership/runner-suites/${entry.path}`)]);
  for (const filename of Object.keys(require.cache)) if (filename.startsWith(`${repository}${path.sep}`)) {
    names.add(path.relative(repository, filename).split(path.sep).join('/'));
  }
  return Object.fromEntries([...names].sort().map((name) => [name, hash(fs.readFileSync(path.join(repository, name)))]));
}

/** Compare bytes with an operator-authenticated Git receipt; this alone cannot authenticate GitHub. */
function verifyPublication(publication) {
  assert.ok(publication !== null && typeof publication === 'object' && !Array.isArray(publication), 'Suite timing: publication must be an object');
  assert.match(publication.commit, /^[0-9a-f]{40}$/, 'Suite timing: missing published commit');
  assert.ok(publication.files !== null && typeof publication.files === 'object' && !Array.isArray(publication.files), 'Suite timing: publication files must be an object');
  assert.deepEqual(publication.files, sourceIdentity(), 'Suite timing: source receipt differs from runtime files');
}

/** Retain real executable identities; UNKNOWN version output is recorded rather than invented. */
function tools(nodes) {
  const inspect = (filename) => {
    const actual = fs.realpathSync(filename);
    const version = spawnSync(actual, ['--version'], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
    assert.equal(version.status, 0, `Suite timing: failed executable version ${filename}`);
    return { filename: actual, bytes: fs.statSync(actual).size, sha256: hash(fs.readFileSync(actual)), version: version.stdout.trim() };
  };
  assert.equal(nodes.length, settings.nodeVersions.length);
  const nodeExecutables = Object.fromEntries(nodes.map((node, position) => {
    const identity = inspect(node); assert.equal(identity.version, settings.nodeVersions[position]);
    return [identity.version, identity];
  }));
  const time = inspect(settings.timeExecutable);
  const packageVersion = spawnSync('dpkg-query', ['-W', 'time'], { encoding: 'utf8' });
  return { nodes: nodeExecutables, time, timePackage: { exitCode: packageVersion.status,
    stdout: packageVersion.stdout?.trim() ?? '', stderr: packageVersion.stderr?.trim() ?? '' } };
}

/** Exercise all three physical packages and runners once per Node, without a performance decision. */
function exercisePlan() {
  return settings.nodeVersions.flatMap((node) => settings.physicalPackages.flatMap((physical) =>
    settings.runners.map((runner) => ({ node, stage: 'qualification', physical, runner }))));
}

/** Preserve Linux invocation paths when replaying the recorded study on another host. */
function runnerArgv(node, root, runner, directory, dependencies) {
  const report = path.posix.join(directory, 'report.json');
  if (runner === 'jest') return [node, path.posix.join(dependencies, 'jest/bin/jest.js'), '--runInBand', '--no-cache',
    '--config', path.posix.join(root, 'jest.config.cjs'), '--json', '--outputFile', report];
  assert.ok(settings.runners.includes(runner), 'Suite timing: unknown runner');
  return [node, path.posix.join(dependencies, 'vitest/vitest.mjs'), 'run', '--config', path.posix.join(root, 'vitest-suite.config.mjs'),
    '--no-cache', '--reporter=json', '--outputFile', report];
}

/** Build the same framework invocation used during qualification, with a fresh output cache. */
function commandFor(selection, sequence, prepared, output, identities) {
  const runtime = qualified();
  const root = path.join(prepared, 'packages', selection.physical);
  const directory = path.join(output, 'processes', String(sequence).padStart(4, '0'));
  const node = identities.nodes[selection.node].filename;
  return { selection, cwd: root, directory,
    argv: runnerArgv(node, root, selection.runner, directory, path.posix.join(prepared, 'node_modules')),
    environment: { [runtime.suiteSettings.expectedRootEnvironment]: root,
      [runtime.suiteSettings.runnerEnvironment]: selection.runner,
      [runtime.suiteSettings.cacheEnvironment]: path.join(directory, 'vite-cache') } };
}

/** Re-read stored results without depending on the original execution paths still existing. */
function inspectStoredSuite(directory, selection, originalRoot) {
  const suite = qualified().suiteSettings;
  const expected = suite.runners.find((runner) => runner.name === selection.runner);
  const report = readJson(path.join(directory, 'report.json'));
  assert.equal(report.success, true); assert.equal(report.numTotalTests, expected.expectedTests);
  assert.equal(report.numPassedTests, expected.expectedTests);
  for (const name of ['numFailedTests', 'numPendingTests', 'numTodoTests']) assert.equal(report[name] ?? 0, 0);
  const assertions = report.testResults.flatMap((entry) => entry.assertionResults);
  assert.equal(assertions.length, expected.expectedTests); assert.ok(assertions.every((entry) => entry.status === 'passed'));
  const logs = ['stdout', 'stderr'].map((kind) => fs.readFileSync(path.join(directory, `suite.${kind}.log`), 'utf8')).join('\n');
  const proofs = logs.split(/\r?\n/).filter((line) => line.includes(suite.probePrefix))
    .map((line) => JSON.parse(line.slice(line.indexOf(suite.probePrefix) + suite.probePrefix.length)));
  assert.equal(proofs.length, expected.expectedProbes);
  for (const proof of proofs) {
    assert.equal(proof.root, originalRoot); assert.equal(proof.nativeFile, path.posix.join(originalRoot, 'dist/native.cjs'));
    assert.equal(proof.node, selection.node); assert.equal(proof.created, 2);
  }
  return { tests: report.numTotalTests, passed: report.numPassedTests, proofs };
}

/** Verify every raw report and clock before recomputing the declared twelve-row decision. */
function verify(directory) {
  const index = readJson(path.join(directory, 'index.json'));
  assert.equal(index.complete, true); assert.deepEqual(index.settings, settings);
  assert.equal(index.formalMeasurementExecuted, !index.qualificationOnly);
  if (index.qualificationOnly) assert.equal(index.publication, null);
  else {
    assert.match(index.publication.commit, /^[0-9a-f]{40}$/);
    assert.deepEqual(index.publication.files, index.sources);
  }
  assert.deepEqual(Object.keys(index.sources).sort(), Object.keys(sourceIdentity()).sort(), 'Suite timing: incomplete source inventory');
  const selections = index.qualificationOnly ? exercisePlan() : plan();
  assert.equal(index.processes.length, selections.length);
  assert.deepEqual(fs.readdirSync(path.join(directory, 'processes')).sort(), selections.map((selection, sequence) => String(sequence).padStart(4, '0')));
  assert.deepEqual(index.preparationBefore, index.preparationAfter);
  assert.deepEqual(index.toolsBefore, index.toolsAfter);
  assert.equal(hash(fs.readFileSync(path.join(directory, 'preparation-index.json'))), settings.preparationIndexSha256);
  for (const [name, digest] of Object.entries(index.sources)) assert.equal(hash(fs.readFileSync(path.join(directory, 'sources', name))), digest);
  for (const [sequence, record] of index.processes.entries()) {
    assert.deepEqual(record.selection, selections[sequence]); assert.equal(record.complete, true); assert.equal(record.exitCode, 0);
    assert.ok(/^\d+$/.test(record.elapsedNs) && BigInt(record.elapsedNs) > 0n && record.elapsedMs === Number(record.elapsedNs) / 1e6);
    const actual = path.join(directory, 'processes', String(sequence).padStart(4, '0'));
    const root = path.posix.join(index.preparedRoot, 'packages', record.selection.physical);
    assert.equal(record.cwd, root);
    assert.deepEqual(record.argv, runnerArgv(index.toolsBefore.nodes[record.selection.node].filename,
      root, record.selection.runner, record.directory, path.posix.join(index.preparedRoot, 'node_modules')));
    const timing = readJson(path.join(actual, 'timing.json'));
    assert.deepEqual(Object.keys(timing).sort(), [...settings.timingFields].sort(), 'Suite timing: incomplete raw timing record');
    for (const [name, value] of Object.entries(timing)) assert.deepEqual(record[name], value);
    assert.deepEqual(record.launcherArgv, launcherArgv({ argv: record.argv, directory: record.directory }), 'Suite timing: unexpected launcher');
    assert.equal(record.signal, null, 'Suite timing: successful launcher has a signal');
    assert.deepEqual(Object.keys(record.files).sort(), ['report.json', 'resources.json', 'suite.stderr.log', 'suite.stdout.log', 'timing.json']);
    assert.deepEqual(inspectStoredSuite(actual, record.selection, root), record.result);
    assert.deepEqual(readJson(path.join(actual, 'resources.json')), record.resources);
    assert.equal(record.resources.exitStatus, 0); assert.ok(record.resources.maxRssKiB > 0);
    for (const [name, digest] of Object.entries(record.files)) assert.equal(hash(fs.readFileSync(path.join(actual, name))), digest);
  }
  const decision = index.qualificationOnly ? { suiteTimingAccepted: null, ownershipAcceptanceChanged: false } : summarize(index.processes);
  assert.deepEqual(decision, index.decision);
  return { verified: true, qualificationOnly: index.qualificationOnly, cliInvocations: selections.length,
    tests: index.processes.reduce((total, record) => total + record.result.tests, 0), ...decision };
}

/** Run once; preserve partial state on all failures and never incorporate exercise data into the study. */
function runSequence(preparedArgument, outputArgument, nodes, publication, qualificationOnly) {
  assert.equal(process.platform, 'linux'); assert.equal(process.arch, 'x64');
  for (const name of settings.forbiddenEnvironment) assert.equal(Object.hasOwn(process.env, name), false, `Suite timing: inherited ${name}`);
  const runtime = qualified(); const prepared = fs.realpathSync(preparedArgument);
  const output = runtime.preparation.inspectDestination(outputArgument, [prepared, __dirname, qualifiedDirectory]);
  const identities = tools(nodes), before = authenticatePreparation(prepared);
  const sources = sourceIdentity();
  fs.mkdirSync(output);
  const index = { complete: false, formalMeasurementExecuted: !qualificationOnly, qualificationOnly,
    settings, publication, sources, preparedRoot: prepared, preparationBefore: before, toolsBefore: identities,
    machine: { platform: os.platform(), release: os.release(), cpus: os.cpus(), totalMemory: os.totalmem(),
      affinity: fs.readFileSync('/proc/self/status', 'utf8').split('\n').filter((line) => line.startsWith('Cpus_allowed_list:')) },
    processes: [], decision: null };
  const save = () => writeJson(path.join(output, 'index.json'), index);
  save();
  try {
    fs.copyFileSync(path.join(prepared, 'index.json'), path.join(output, 'preparation-index.json'));
    for (const name of Object.keys(sources)) {
      const destination = path.join(output, 'sources', name); fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(repository, name), destination);
    }
    const selections = qualificationOnly ? exercisePlan() : plan();
    for (const version of settings.nodeVersions) {
      const commands = selections.map((selection, sequence) => ({ selection, sequence })).filter(({ selection }) => selection.node === version)
        .map(({ selection, sequence }) => commandFor(selection, sequence, prepared, output, identities));
      runCommands(commands, index, save, (entry) => {
        const result = runtime.runner.inspectReport(entry.directory, entry.selection.runner, entry.cwd, entry.selection.node);
        entry.files = Object.fromEntries(['report.json', 'resources.json', 'suite.stdout.log', 'suite.stderr.log', 'timing.json'].map((name) =>
          [name, hash(fs.readFileSync(path.join(entry.directory, name)))]));
        process.stdout.write(`${JSON.stringify({ completed: index.processes.length, planned: selections.length, ...entry.selection })}\n`);
        return result;
      });
      index.preparationAfter = authenticatePreparation(prepared); assert.deepEqual(index.preparationAfter, before); save();
    }
    index.toolsAfter = tools(nodes); assert.deepEqual(index.toolsAfter, identities);
    assert.deepEqual(sourceIdentity(), sources, 'Suite timing: method changed during execution');
    index.decision = qualificationOnly ? { suiteTimingAccepted: null, ownershipAcceptanceChanged: false } : summarize(index.processes);
    index.complete = true; save();
    return verify(output);
  } catch (error) {
    index.complete = false; index.failure = { message: error.message, stack: error.stack }; save(); throw error;
  }
}

/** Require an authenticated non-null receipt before touching preparation paths or launching any process. */
function run(prepared, output, nodes, publication) {
  verifyPublication(publication);
  return runSequence(prepared, output, nodes, publication, false);
}

/** Enter qualification explicitly; malformed formal input can never select this mode. */
function runExercise(prepared, output, nodes) {
  return runSequence(prepared, output, nodes, null, true);
}

if (require.main === module) {
  try {
    if (process.argv[2] === '--sources') process.stdout.write(`${JSON.stringify(sourceIdentity(), null, 2)}\n`);
    else if (process.argv[2] === '--verify') process.stdout.write(`${JSON.stringify(verify(process.argv[3]), null, 2)}\n`);
    else {
      const [prepared, publication, output, ...nodes] = process.argv.slice(2);
      const result = run(prepared, output, nodes, readJson(publication));
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.suiteTimingAccepted) process.exitCode = 1;
    }
  } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { qualified, authenticatePreparation, sourceIdentity, verifyPublication, tools, exercisePlan,
  runnerArgv, commandFor, inspectStoredSuite, verify, run, runExercise };
