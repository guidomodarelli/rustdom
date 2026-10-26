/** @file Qualifies and records the explicitly authorized one-shot jsdom-only diagnostic. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const policy = require('./constants/protocol.json');
const study = require('../current-ownership-experiment.cjs');
const sampler = require('../current-ownership-worker.cjs');
const settings = require('../constants/current-ownership.cjs');
const { analyzeProcess } = require('./analyze.cjs');
const repository = path.resolve(__dirname, '../../../..');
const hash = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const write = (filename, value) => fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);

/** Pin the full transitive method independently of the frozen ownership harness. */
function sourceFiles() {
  const files = policy.methodFiles.map((name) => [path.relative(repository, path.join(__dirname, name)).split(path.sep).join('/'), hash(path.join(__dirname, name))]);
  return Object.fromEntries(files.concat(policy.sharedFiles.map((name) => [name, hash(path.join(repository, name))])));
}

/** Retain the original global order, selecting every row and both labels at the two declared positions. */
function plan(nodeIndex, mode) {
  return study.processSchedule().filter((entry) => entry.phase === policy.phase && entry.engine === policy.engine
    && (mode === 'qualification' ? entry.position === policy.positions[nodeIndex] : policy.positions.includes(entry.position)))
    .map((entry) => ({ ...entry, mode: policy.modesByLabel[entry.label] }));
}

/** Validate actual flags and observed child identity before reusing the original behavioral/resource contract. */
function validateReport(report, manifest, input, expectedProcess) {
  assert.deepEqual(report.execArgv, [...sampler.workerArguments(input.position), ...policy.nodeFlagsByMode[input.mode]]);
  study.validateWorker({ ...report, execArgv: sampler.workerArguments(input.position) }, manifest,
    { ...input, pid: expectedProcess.pid, node: expectedProcess.node });
  const reference = read(path.join(repository, policy.referenceFile)).results.find((result) => result.node === report.node);
  const batch = report.batches[0];
  const expected = reference.summaries.AA.find((row) => row.key === `${batch.name}/${batch.size}`);
  assert.equal(batch.outputHash, expected.outputHash, 'JSDOM telemetry: public output differs from the original independent jsdom control');
  return report;
}

/** Execute a fixed sequence once, stopping at the first error while retaining every partial file. */
function execute(commands, index, output, inspect) {
  for (const command of commands) {
    fs.mkdirSync(command.directory);
    const entry = { ...command, startedAt: new Date().toISOString() }; index.processes.push(entry); write(path.join(output, 'index.json'), index);
    let stdout; let stderr;
    let child;
    try {
      stdout = fs.openSync(path.join(command.directory, 'stdout.log'), 'wx');
      stderr = fs.openSync(path.join(command.directory, 'stderr.log'), 'wx');
      child = spawnSync(command.argv[0], command.argv.slice(1), { cwd: command.directory,
      stdio: ['ignore', stdout, stderr], timeout: policy.workerTimeoutMs }); }
    finally { if (stdout !== undefined) fs.closeSync(stdout); if (stderr !== undefined) fs.closeSync(stderr); }
    Object.assign(entry, { pid: child.pid, exitCode: child.status, signal: child.signal,
      error: child.error?.message ?? null, finishedAt: new Date().toISOString() }); write(path.join(output, 'index.json'), index);
    entry.files = Object.fromEntries(fs.readdirSync(command.directory).filter((name) => fs.statSync(path.join(command.directory, name)).isFile())
      .map((name) => [name, hash(path.join(command.directory, name))]));
    write(path.join(output, 'index.json'), index);
    assert.equal(child.status, 0, `JSDOM telemetry: failed process ${entry.directory}; preserve its logs, no retry`);
    inspect(entry);
    entry.files = Object.fromEntries(fs.readdirSync(command.directory).filter((name) => fs.statSync(path.join(command.directory, name)).isFile())
      .map((name) => [name, hash(path.join(command.directory, name))]));
    write(path.join(output, 'index.json'), index);
    process.stdout.write(`${JSON.stringify({ node: entry.node, position: entry.input.position, label: entry.input.label, row: entry.input.rowIndex, exitCode: 0 })}\n`);
  }
}

/** Prepare a separate derived harness and execute qualification or the single hosted capture. */
function run(mode, preparation, output, publicationFile, nodes) {
  assert.ok(['qualification', 'capture'].includes(mode)); assert.equal(nodes.length, settings.nodeVersions.length);
  const files = sourceFiles();
  if (mode === 'capture') {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', 'JSDOM telemetry: full capture requires the declared hosted runner');
    const publication = read(publicationFile);
    assert.equal(publication.actionableFindings, 0); assert.deepEqual(publication.files, files);
  }
  assert.equal(study.captureHarness().sha256, policy.sourceHarnessSha256);
  const manifest = study.createManifest(preparation);
  output = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
  for (const input of [preparation, repository]) {
    const root = fs.realpathSync(input);
    assert.ok(output !== root && !output.startsWith(`${root}${path.sep}`) && !root.startsWith(`${output}${path.sep}`),
      'JSDOM telemetry: output and verified input trees must be disjoint');
  }
  fs.mkdirSync(output);
  const index = { revision: policy.revision, mode, diagnosticOnly: true, accepted: null, gateReevaluated: false,
    complete: false, startedAt: new Date().toISOString(), sourceFiles: files, manifest,
    machine: { cpus: os.cpus(), platform: os.platform(), release: os.release(), totalMemory: os.totalmem() }, processes: [] };
  const save = () => write(path.join(output, 'index.json'), index); save();
  try {
    const harness = study.captureHarness();
    for (const [name, expected] of Object.entries(files)) {
      const destination = path.join(output, 'method', name); fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(repository, name), destination); assert.equal(hash(destination), expected);
    }
    if (mode === 'capture') fs.copyFileSync(publicationFile, path.join(output, 'publication.json'));
    write(path.join(output, 'source-manifest.json'), { commit: process.env.TELEMETRY_SOURCE_COMMIT ?? null,
      harnessSha256: harness.sha256, files: harness.files });
    const derivedRoots = {};
    const receipts = {};
    for (const observationMode of Object.keys(policy.nodeFlagsByMode)) {
      const derived = path.join(output, `derived-${observationMode}`);
      const derivedResult = spawnSync('python3', ['-B', path.join(__dirname, 'prepare.py'), repository,
        path.join(output, 'source-manifest.json'), derived, observationMode], { encoding: 'utf8' });
      fs.writeFileSync(path.join(output, `derivation-${observationMode}.stdout.log`), derivedResult.stdout ?? '');
      fs.writeFileSync(path.join(output, `derivation-${observationMode}.stderr.log`), derivedResult.stderr ?? '');
      assert.equal(derivedResult.status, 0, derivedResult.stderr);
      derivedRoots[observationMode] = derived;
      receipts[observationMode] = read(path.join(derived, 'preparation.json'));
    }
    const verifyDerived = () => {
      for (const observationMode of Object.keys(derivedRoots)) for (const [name, expected] of Object.entries(receipts[observationMode].derivedFiles)) {
        assert.equal(hash(path.join(derivedRoots[observationMode], name)), expected);
      }
    };
    const manifestPath = path.join(output, 'manifest.json'); write(manifestPath, manifest);
    for (const [nodeIndex, node] of nodes.entries()) {
      const version = spawnSync(node, ['--version'], { encoding: 'utf8' });
      assert.equal(version.status, 0); assert.equal(version.stdout.trim(), settings.nodeVersions[nodeIndex]);
      const executableHashes = require('../constants/current-ownership.json').runtimeExecutableHashes;
      assert.equal(hash(node), executableHashes[settings.nodeVersions[nodeIndex]]);
      const directory = path.join(output, `node${nodeIndex === 0 ? 22 : 24}`); fs.mkdirSync(directory);
      const commands = plan(nodeIndex, mode).map((input, position) => {
        const target = path.join(directory, String(position).padStart(3, '0'));
        return { input, node: settings.nodeVersions[nodeIndex], directory: target,
          argv: [node, ...sampler.workerArguments(input.position), ...policy.nodeFlagsByMode[input.mode], path.join(derivedRoots[input.mode], 'worker.cjs'),
            manifestPath, input.phase, input.engine, String(input.position), input.label, path.join(target, 'report.json'), String(input.rowIndex)] };
      });
      execute(commands, index, output, (entry) => {
        validateReport(read(path.join(entry.directory, 'report.json')), manifest, entry.input, entry);
        const analysis = analyzeProcess(entry.directory);
        assert.equal(analysis.mode, entry.input.mode);
        write(path.join(entry.directory, 'analysis.json'), analysis);
      });
      verifyDerived(); study.inspectPreparation(preparation); assert.deepEqual(sourceFiles(), files);
    }
    index.complete = true;
  } catch (error) { index.failure = { message: error.message, stack: error.stack }; throw error; }
  finally { index.finishedAt = new Date().toISOString(); save(); }
}
if (require.main === module) {
  const [mode, preparation, output, publication, ...nodes] = process.argv.slice(2);
  try {
    assert.equal(process.argv.length, 8, 'JSDOM telemetry: provide mode, preparation, output, publication, Node22 and Node24');
    run(mode, path.resolve(preparation), path.resolve(output), publication, nodes);
  }
  catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { sourceFiles, plan, validateReport, execute, run };
