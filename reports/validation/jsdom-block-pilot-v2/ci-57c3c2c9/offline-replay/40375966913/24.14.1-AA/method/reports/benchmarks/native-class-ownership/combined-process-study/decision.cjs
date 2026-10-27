/** @module combined-authenticated-decision Reads one complete authenticated archive with current code, preserving partial reader results and all unfavorable criteria. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const study = require('./study.cjs');
const { methodFilesDigest } = require('./publication.cjs');
const { hashFile } = require('./io.cjs');
const { read, bytes } = require('./processes.cjs');
const policy = require('./constants/protocol.json');
const capture = require('./constants/capture.json');
const transportPolicy = require('./constants/transport.json');
const repository = path.resolve(__dirname, '../../../..');

/** @param {string} filename - Actual parent JSON-lines log. @param {object[]} processes - Independently verified index order. @returns {object} Terminal producer output after preserving and verifying every progress entry. */
function readProducerLog(filename, processes) {
  const lines = bytes(filename).toString('utf8').trimEnd().split('\n');
  assert.equal(lines.length, processes.length + 1, 'Combined decision: incomplete or additional producer log entries');
  for (const [index, entry] of processes.entries()) assert.deepEqual(JSON.parse(lines[index]),
    { node: entry.node, position: entry.input.position, label: entry.input.label, row: entry.input.rowIndex, exitCode: 0 });
  return JSON.parse(lines[lines.length - 1]);
}

/** @param {string} filename - Independent activation/result binding. @param {string} collection - Authenticated saved transport. @param {string} destination - Fresh evidence directory outside sources/transport. @returns {object} Complete decision or retained reader failure; never loads archived modules. */
function decide(filename, collection, destination) {
  assert.equal(process.platform, 'linux', 'Combined decision: use Linux/WSL');
  assert.ok(policy.nodes.includes(process.version));
  assert.equal(study.hashExecutable(process.execPath), require('../constants/current-ownership.json').runtimeExecutableHashes[process.version]);
  destination = path.join(fs.realpathSync.native(path.dirname(path.resolve(destination))), path.basename(destination));
  collection = fs.realpathSync.native(collection);
  for (const protectedRoot of [repository, collection]) assert.ok(destination !== protectedRoot &&
    !destination.startsWith(protectedRoot + path.sep) && !protectedRoot.startsWith(destination + path.sep));
  assert.ok(!fs.existsSync(destination), 'Combined decision: preserve existing output');
  fs.mkdirSync(destination);
  const result = { revision: policy.revision, readerNode: process.version, complete: false, captureAuthenticated: false,
    archivedCodeExecuted: false, samplerInvoked: false, performanceAccepted: null, gateReevaluated: false, phase: 'publication' };
  const write = () => fs.writeFileSync(path.join(destination, 'decision.json'), JSON.stringify(result, null, 2) + '\n');
  write();
  try {
    const reviewed = study.publication();
    const binding = read(filename);
    assert.equal(binding.revision, policy.revision); assert.equal(binding.head.length, 40);
    assert.equal(binding.publicationSha256, hashFile(path.join(repository, capture.publicationReceipt)));
    assert.equal(binding.methodFilesSha256, methodFilesDigest(reviewed.files));
    result.phase = 'transport'; write();
    const extracted = path.join(destination, 'extracted');
    const child = spawnSync('python3', ['-B', path.join(__dirname, 'transport.py'), '--extract', repository,
      path.resolve(filename), collection, extracted], { encoding: 'utf8', timeout: policy.preparationTimeoutMs,
      maxBuffer: policy.metadataOutputLimitBytes });
    fs.writeFileSync(path.join(destination, 'transport.stdout.log'), child.stdout ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(destination, 'transport.stderr.log'), child.stderr ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(destination, 'transport.exit-code'), String(child.status) + '\n', { flag: 'wx' });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
    const transport = JSON.parse(child.stdout);
    assert.equal(transport.transportAuthenticated, true); assert.equal(transport.head, binding.head);
    assert.equal(transport.runId, binding.runId); assert.equal(transport.jobId, binding.jobId); assert.equal(transport.attempt, 1);
    assert.equal(transport.performanceAccepted, null); assert.equal(transport.gateReevaluated, false);
    const root = path.join(extracted, transportPolicy.rootName);
    assert.equal(transport.root, root);
    result.transport = transport; result.phase = 'payload'; write();
    const payload = study.verify(path.join(root, 'capture'));
    assert.equal(payload.sourceCommit, binding.head);
    assert.equal(payload.hosted.runId, String(binding.runId)); assert.equal(payload.hosted.attempt, binding.attempt);
    assert.equal(payload.hosted.repository, binding.repository); assert.equal(payload.hosted.jobKey, capture.jobKey);
    assert.equal(payload.hosted.workflow, policy.workflowName);
    for (const field of transportPolicy.immutableBindingFields) assert.deepEqual(payload.activationBinding[field], binding[field], field);
    result.payload = payload; result.captureAuthenticated = true;
    const exitCode = fs.readFileSync(path.join(root, 'exit-code'), 'utf8').trim();
    assert.equal(exitCode, payload.comparison.allBudgetsMet ? '0' : '1', 'Combined decision: saved capture exit does not match the complete criteria');
    const producer = readProducerLog(path.join(root, 'stdout.log'), read(path.join(root, 'capture', capture.files.index)).processes);
    for (const field of ['revision', 'sourceCommit', 'hosted', 'activationBinding', 'processes', 'measuredDurations', 'warmupDurations',
      'windows', 'documents', 'comparison']) assert.deepEqual(producer[field], payload[field], field);
    const expectedConclusion = payload.comparison.allBudgetsMet ? 'success' : 'failure';
    assert.equal(transport.runConclusion, expectedConclusion, 'Combined decision: workflow conclusion is inconsistent or blocked by infrastructure');
    assert.equal(transport.jobConclusion, expectedConclusion, 'Combined decision: job conclusion is inconsistent or blocked by infrastructure');
    result.phase = 'complete'; result.complete = true; result.gateReevaluated = true;
    result.performanceAccepted = payload.comparison.allBudgetsMet;
  } catch (error) { result.failure = { message: error.message, stack: error.stack }; }
  finally { write(); }
  return result;
}
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 5, 'Combined decision: provide binding JSON, collection and fresh output');
    const result = decide(...process.argv.slice(2)); console.log(JSON.stringify(result));
    if (!result.complete) process.exitCode = policy.failureExitCode;
    else if (!result.performanceAccepted) process.exitCode = 1;
  } catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = policy.failureExitCode; }
}
module.exports = { decide, readProducerLog };
