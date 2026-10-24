/** @file Authenticates inputs and preserves exactly one declared native tracing sequence. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createTraceCommand } = require('./command.cjs');
const settings = require('./constants/trace.json');
const hash = (content) => createHash('sha256').update(content).digest('hex');
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const writeJson = (filename, value) => fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);

/** Verify every derived byte against the independently pinned published receipt. */
function verifyDerived(directory) {
  const receiptPath = path.resolve(__dirname, '../../../validation/native-class-ownership/sampler-diagnostics-method/derived-preparation.json');
  const content = fs.readFileSync(receiptPath);
  assert.equal(hash(content), settings.derivedReceiptSha256, 'Compilation capture: changed pinned derivation receipt');
  const expected = JSON.parse(content);
  assert.deepEqual(readJson(path.join(directory, 'preparation.json')), expected, 'Compilation capture: changed local derivation claims');
  for (const [name, checksum] of Object.entries(expected.derivedFiles)) {
    assert.equal(hash(fs.readFileSync(path.join(directory, name))), checksum, `Compilation capture: changed derived file ${name}`);
  }
  return expected;
}

/** Check runtime bytes against a Git publication receipt verified externally before invocation. */
function verifySources(publication) {
  assert.match(publication.commit, /^[0-9a-f]{40}$/, 'Compilation capture: missing source commit');
  assert.deepEqual(Object.keys(publication.files).sort(), [...settings.methodFiles].sort(), 'Compilation capture: incomplete source receipt');
  for (const [name, checksum] of Object.entries(publication.files)) {
    assert.equal(hash(fs.readFileSync(path.join(__dirname, name))), checksum, `Compilation capture: source differs from receipt: ${name}`);
  }
}

/**
 * Execute real child processes serially, keeping all logs and stopping at the first failure.
 * The caller owns preparation checks and postprocessing; no retry or acceptance is implemented.
 */
function runCommands(commands, output, index, inspect = () => {}) {
  const save = () => writeJson(path.join(output, 'index.json'), index);
  for (const command of commands) {
    fs.mkdirSync(command.directory, { recursive: true });
    const record = { ...command, startedAt: new Date().toISOString() };
    index.processes.push(record); save();
    let stdout;
    let stderr;
    let result;
    try {
      stdout = fs.openSync(path.join(command.directory, 'stdout.log'), 'wx');
      stderr = fs.openSync(path.join(command.directory, 'stderr.log'), 'wx');
      result = spawnSync(command.argv[0], command.argv.slice(1), { stdio: ['ignore', stdout, stderr] });
    } finally {
      if (stdout !== undefined) fs.closeSync(stdout);
      if (stderr !== undefined) fs.closeSync(stderr);
    }
    record.pid = result.pid; record.exitCode = result.status; record.signal = result.signal;
    record.finishedAt = new Date().toISOString();
    if (result.error) record.spawnError = { message: result.error.message, code: result.error.code, stack: result.error.stack };
    save();
    if (result.error || result.status !== 0) {
      const error = new Error(`Compilation capture: ${command.physical}/${command.nodeVersion} failed, exit=${result.status}, signal=${result.signal}; logs: ${command.directory}`, { cause: result.error });
      index.failure = { message: error.message, stack: error.stack }; save(); throw error;
    }
    try { inspect(record); } catch (error) {
      index.failure = { message: error.message, stack: error.stack }; save(); throw error;
    }
    save();
    process.stdout.write(`${JSON.stringify({ physical: record.physical, node: record.nodeVersion, exitCode: record.exitCode })}\n`);
  }
}

/** Run the fixed ten-process protocol on verified packages; never grant budget acceptance. */
function main(diagnosticRoot, preparationRoot, publicationPath, output, ...nodes) {
  verifyDerived(diagnosticRoot);
  const publication = readJson(publicationPath); verifySources(publication);
  assert.equal(nodes.length, settings.nodeVersions.length, 'Compilation capture: two Node executables required');
  for (const [index, node] of nodes.entries()) {
    const result = spawnSync(node, ['--version'], { encoding: 'utf8' });
    assert.equal(result.status, 0, `Compilation capture: cannot read Node version from ${node}`);
    assert.equal(result.stdout.trim(), settings.nodeVersions[index], 'Compilation capture: undeclared Node version/order');
  }
  const resolvedOutput = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
  for (const input of [diagnosticRoot, preparationRoot]) {
    const resolvedInput = fs.realpathSync(input);
    assert.ok(resolvedOutput !== resolvedInput && !resolvedOutput.startsWith(`${resolvedInput}${path.sep}`) &&
      !resolvedInput.startsWith(`${resolvedOutput}${path.sep}`), 'Compilation capture: output and inputs must be disjoint');
  }
  const study = require(path.join(path.resolve(diagnosticRoot), 'harness/reports/benchmarks/native-class-ownership/hosted-main-experiment.cjs'));
  const manifest = study.createManifest(preparationRoot);
  fs.mkdirSync(output);
  const index = { diagnosticOnly: true, gateReevaluated: false, accepted: null, complete: false,
    revision: settings.revision, sourceCommit: publication.commit, sourceFiles: publication.files,
    startedAt: new Date().toISOString(), machine: { platform: os.platform(), release: os.release(),
      cpus: os.cpus(), memoryTotal: os.totalmem() }, processes: [], preparations: [] };
  const save = () => writeJson(path.join(output, 'index.json'), index);
  save();
  try {
    const copied = path.join(output, 'derived'); fs.cpSync(diagnosticRoot, copied, { recursive: true }); verifyDerived(copied);
    const methodSources = path.join(output, 'method-sources'); fs.mkdirSync(methodSources);
    for (const name of settings.methodFiles) {
      const destination = path.join(methodSources, name); fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(__dirname, name), destination);
    }
    writeJson(path.join(output, 'publication.json'), publication);
    const manifestPath = path.join(output, 'manifest.json'); writeJson(manifestPath, manifest);
    for (const [nodeIndex, node] of nodes.entries()) {
      const preparation = { node: settings.nodeVersions[nodeIndex], before: study.inspectPreparation(preparationRoot) };
      index.preparations.push(preparation); save();
      const plan = nodeIndex === 0 ? settings.capturePlan : [...settings.capturePlan].reverse();
      const commands = plan.map((treatment) => {
        const directory = path.join(output, settings.nodeVersions[nodeIndex], treatment.physical);
        return { ...treatment, nodeVersion: settings.nodeVersions[nodeIndex], directory,
          argv: createTraceCommand({ node, diagnosticRoot: copied, manifestPath, directory, ...treatment }) };
      });
      runCommands(commands, output, index, (record) => {
        const report = readJson(path.join(record.directory, 'report.json'));
        const telemetry = readJson(path.join(record.directory, 'report.json.telemetry.json'));
        assert.equal(report.complete, true); assert.equal(telemetry.complete, true);
        assert.equal(report.schedule.physical, record.physical);
        const traceContent = fs.readFileSync(path.join(record.directory, 'trace.json'));
        record.traceEvents = JSON.parse(traceContent).traceEvents.length;
        assert.ok(record.traceEvents > 0, 'Compilation capture: empty native trace');
        record.traceSha256 = hash(traceContent);
      });
      preparation.after = study.inspectPreparation(preparationRoot); save();
      verifyDerived(copied); verifySources(publication);
    }
    index.complete = true;
  } catch (error) {
    index.failure = { message: error.message, stack: error.stack }; throw error;
  } finally {
    index.finishedAt = new Date().toISOString(); save();
  }
}

if (require.main === module) {
  try { main(...process.argv.slice(2)); } catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; }
}
module.exports = { verifyDerived, verifySources, runCommands, main };
