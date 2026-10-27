/** @module owner-batch-authenticated-decision Connects externally authenticated two-job transport to complete current-code payload replay and all 64 fixed criteria. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { verifyPart, combine } = require('./replay.cjs');
const { readJSON, writeJSON, writeNewJSON, hashFile } = require('./io.cjs');
const { failureView } = require('./batches.cjs');
const source = require('./source.cjs');
const capture = require('./constants/capture.json');
const settings = require('./constants/decision.json');
const transportPolicy = require('./constants/transport.json');

/** @param {object} result - Owned pending decision. @returns {void} Publish final flags only after the last real provenance read succeeds. */
function finalize(result) {
  const readerSourceFiles = source.readerFiles();
  const acceptance = result.mode === 'capture' ? { captureAuthenticated: true,
    performanceAccepted: result.comparison.allBudgetsMet, gateReevaluated: true } : {};
  Object.assign(result, { readerSourceFiles, ...acceptance, complete: true, phase: settings.stages.complete });
}

/** @param {string} bindingFile - Independently retained API source/artifact pins, outside downloaded payload. @param {string} collection - Original preserved transport. @param {string} destination - Fresh external evidence directory. @param {'capture'|'functional'} mode - Explicit scope; functional evidence always keeps acceptance null. @returns {object} Whole decision or preserved incomplete reader failure; never imports captured implementation. */
function decide(bindingFile, collection, destination, mode = 'capture') {
  assert.ok(['capture', 'functional'].includes(mode)); assert.equal(process.platform, 'linux');
  collection = fs.realpathSync(collection);
  bindingFile = fs.realpathSync(bindingFile);
  destination = path.join(fs.realpathSync(path.dirname(path.resolve(destination))), path.basename(destination));
  for (const protectedRoot of [collection, source.repository]) assert.ok(destination !== protectedRoot &&
    !destination.startsWith(protectedRoot + path.sep) && !protectedRoot.startsWith(destination + path.sep));
  fs.mkdirSync(destination); // Exclusive even for dangling links or concurrent creators.
  const result = { revision: capture.revision, mode, readerNode: process.version, readerIdentity: source.gitIdentity(),
    complete: false, phase: settings.stages.transport, transportAuthenticated: false, captureAuthenticated: false,
    archivedCodeExecuted: false, DOMExecuted: false, performanceAccepted: null, gateReevaluated: false, parts: [] };
  const save = () => writeJSON(path.join(destination, settings.filename), result);
  save();
  try {
    const binding = readJSON(bindingFile); assert.equal(binding.mode, mode);
    const child = spawnSync('python3', ['-B', path.join(__dirname, 'extract.py'), bindingFile, collection,
      path.join(destination, settings.extractionDirectory)], { encoding: 'utf8', timeout: capture.maximumMetadataCommandMs,
      maxBuffer: capture.maximumMetadataOutputBytes });
    fs.writeFileSync(path.join(destination, settings.transportStdout), child.stdout ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(destination, settings.transportStderr), child.stderr ?? '', { flag: 'wx' });
    fs.writeFileSync(path.join(destination, settings.transportExit), String(child.status) + '\n', { flag: 'wx' });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
    const transport = JSON.parse(child.stdout);
    assert.equal(transport.complete, true); assert.equal(transport.transportAuthenticated, true);
    for (const field of ['mode', 'runId', 'head', 'attempt']) assert.equal(transport[field], binding[field]);
    assert.equal(transport.performanceAccepted, null); assert.equal(transport.gateReevaluated, false);
    const pythonFiles = Object.fromEntries(['transport.py', 'extract.py', 'constants/transport.json', 'constants/capture.json']
      .map((relative) => [relative, hashFile(path.join(__dirname, relative))]));
    assert.deepEqual(transport.readerPythonFiles, pythonFiles, 'Owner batch decision: current Python reader provenance differs');
    assert.equal(transport.runConclusion, 'success');
    assert.deepEqual(transport.artifacts.map((entry) => entry.node), transportPolicy.nodes);
    for (const entry of transport.artifacts) {
      assert.equal(entry.jobId, binding.jobs[entry.node]); assert.equal(entry.jobConclusion, 'success');
      assert.equal(entry.artifactId, binding.artifacts[entry.node].id); assert.equal(entry.artifactDigest, binding.artifacts[entry.node].digest);
    }
    result.transport = transport; result.transportAuthenticated = true; result.phase = settings.stages.payload; save();
    const parts = [];
    for (const entry of transport.tarFiles) {
      const root = mode === 'capture' ? path.join(entry.root, 'capture') : entry.root;
      const part = verifyPart(root, mode, transport.producerProfile);
      assert.equal(part.sourceCommit, binding.head); assert.equal(part.runtime.node, 'v' + entry.node);
      if (mode === 'capture') {
        assert.equal(part.hosted.runId, String(binding.runId)); assert.equal(part.hosted.attempt, binding.attempt);
        assert.equal(part.hosted.repository, binding.repository); assert.equal(part.hosted.jobKey, capture.jobKey);
        assert.equal(part.sourceConsumption.currentRunId, binding.runId);
        assert.equal(part.sourceConsumption.currentRunNumber, transport.runNumber);
      }
      const filename = path.join(destination, 'part-' + entry.node + '.json'); writeNewJSON(filename, part);
      result.parts.push({ node: entry.node, processes: part.processes, measuredDurations: part.measuredDurations,
        warmupDurations: part.warmupDurations, windows: part.windows, documents: part.documents,
        parentSnapshots: part.parentSnapshots, filename, bytes: fs.statSync(filename).size, sha256: hashFile(filename) });
      parts.push(part); save();
    }
    assert.deepEqual(parts.map((part) => part.runtime.node), transportPolicy.nodes.map((node) => 'v' + node));
    if (mode === 'capture') {
      const payload = combine(parts); assert.equal(payload.processes, 2048);
      result.comparison = payload.comparison;
    }
    finalize(result);
  } catch (error) {
    Object.assign(result, { complete: false, captureAuthenticated: false, performanceAccepted: null,
      gateReevaluated: false, failure: failureView(error) });
  }
  finally { save(); }
  return result;
}
module.exports = { decide, finalize };

if (require.main === module) {
  try {
    const [operation, ...args] = process.argv.slice(2);
    assert.ok(['--functional', '--verify'].includes(operation)); assert.equal(args.length, 3);
    const result = decide(...args, operation === '--functional' ? 'functional' : 'capture');
    process.stdout.write(JSON.stringify({ complete: result.complete, mode: result.mode, phase: result.phase,
      processes: result.parts.reduce((total, part) => total + part.processes, 0), performanceAccepted: result.performanceAccepted,
      gateReevaluated: result.gateReevaluated }) + '\n');
    if (!result.complete) process.exitCode = capture.failureExitCode;
    else if (result.performanceAccepted === false) process.exitCode = 1;
  } catch (error) { process.stderr.write(JSON.stringify(failureView(error)) + '\n'); process.exitCode = capture.failureExitCode; }
}
