/** @file Replay a genuine controller capture and reject adversarial data copies; captured code is never imported. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { test, after } = require('node:test');
const policy = require('./constants/capture.json');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-batch-part-'));
const part = process.env.RUSTDOM_OWNER_BATCH_PART_FOR_CONTRACTS;
assert.ok(part, 'Provide an actual completed functional controller part');
const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const index = read(path.join(part, policy.indexFile)); assert.equal(index.complete, true); assert.equal(index.mode, 'functional');
const executable = path.join(index.sourceDirectory, 'reports/benchmarks/native-class-ownership/owner-batch-study/replay.cjs');
const expectedBytes = fs.readFileSync(path.join(__dirname, 'replay.cjs'));
assert.deepEqual(fs.readFileSync(executable), expectedBytes, 'Run only current trusted replay bytes from a native Git namespace');
const results = [];

/** Invoke current trusted reader code; input trees are strictly data, including their .cjs snapshot members. */
function invoke(name, directory) {
  const output = path.join(root, name + '.json');
  const child = spawnSync(process.execPath, [executable, '--functional', directory, output],
    { encoding: 'utf8', timeout: policy.maximumMetadataCommandMs, maxBuffer: policy.maximumMetadataOutputBytes });
  fs.writeFileSync(path.join(root, name + '.stdout.log'), child.stdout ?? '');
  fs.writeFileSync(path.join(root, name + '.stderr.log'), child.stderr ?? '');
  results.push({ name, exitCode: child.status, error: child.error?.message ?? null, outputProduced: fs.existsSync(output) });
  return { child, output };
}

test('the real complete part replays through the current CLI with all measured and warmup intervals', () => {
  const { child, output } = invoke('complete', part); assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  const result = read(output); assert.equal(result.processes, 32); assert.equal(result.measuredDurations, 4608);
  assert.equal(result.warmupDurations, 1536); assert.equal(result.windows, 384); assert.equal(result.documents, 384);
  assert.equal(result.parentSnapshots, 3); assert.equal(result.captureAuthenticated, false); assert.equal(result.performanceAccepted, null);
});
test('duplicate process metadata is rejected without filling or rerunning the missing tuple', () => {
  const copy = path.join(root, 'duplicate'); fs.cpSync(part, copy, { recursive: true });
  const changed = read(path.join(copy, policy.indexFile)); changed.processes[1] = changed.processes[0];
  fs.writeFileSync(path.join(copy, policy.indexFile), JSON.stringify(changed));
  const { child, output } = invoke('duplicate-replay', copy);
  assert.notEqual(child.status, 0); assert.equal(fs.existsSync(output), false);
});

test('a dangling output link is preserved with its absent target', () => {
  const output = path.join(root, 'dangling.json'); const target = path.join(root, 'absent-target.json');
  fs.symlinkSync(target, output);
  const { child } = invoke('dangling', part);
  assert.ifError(child.error); assert.notEqual(child.status, 0);
  assert.equal(fs.readlinkSync(output), target); assert.equal(fs.existsSync(target), false);
});

test('an existing verification keeps its exact bytes', () => {
  const output = path.join(root, 'existing.json'); const bytes = Buffer.from('{"original":true}\n');
  fs.writeFileSync(output, bytes);
  const { child } = invoke('existing', part);
  assert.ifError(child.error); assert.notEqual(child.status, 0); assert.deepEqual(fs.readFileSync(output), bytes);
});

test('concurrent CLI readers publish exactly one complete verification', async () => {
  const output = path.join(root, 'concurrent.json');
  const readers = Array.from({ length: 2 }, (_, index) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [executable, '--functional', part, output]);
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      fs.writeFileSync(path.join(root, 'concurrent-' + index + '.stdout.log'), stdout);
      fs.writeFileSync(path.join(root, 'concurrent-' + index + '.stderr.log'), stderr);
      results.push({ name: 'concurrent-' + index, exitCode: code, outputProduced: fs.existsSync(output) }); resolve(code);
    });
  }));
  const codes = await Promise.all(readers);
  assert.equal(codes.filter((code) => code === 0).length, 1); assert.equal(codes.filter((code) => code !== 0).length, 1);
  const result = read(output); assert.equal(result.processes, 32); assert.equal(result.measuredDurations, 4608);
  assert.equal(fs.lstatSync(output).nlink, 1);
});
test('a false final resource-clear claim is rejected even after rebinding its changed local file hash', () => {
  const copy = path.join(root, 'false-clear'); fs.cpSync(part, copy, { recursive: true });
  const changed = read(path.join(copy, policy.indexFile)); const entry = changed.processes.find((entry) => entry.input.engine === 'rustdom');
  const reportPath = path.join(copy, entry.directory, 'report.json'); const report = read(reportPath);
  report.cleanupTrace[2].survivors.document = 1; const raw = Buffer.from(JSON.stringify(report)); fs.writeFileSync(reportPath, raw);
  entry.files['report.json'] = { bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') };
  fs.writeFileSync(path.join(copy, policy.indexFile), JSON.stringify(changed));
  const { child, output } = invoke('false-clear-replay', copy);
  assert.notEqual(child.status, 0); assert.equal(fs.existsSync(output), false);
});
test('a poisoned archived script is checked as data and never creates its benign side-effect marker', () => {
  const copy = path.join(root, 'poisoned'); fs.cpSync(part, copy, { recursive: true });
  const marker = path.join(root, 'archived-code-was-executed');
  const capturedCode = path.join(copy, policy.snapshotDirectory, policy.workerFile);
  fs.writeFileSync(capturedCode, 'require("node:fs").writeFileSync(' + JSON.stringify(marker) + ', "unexpected execution");\n');
  const { child, output } = invoke('poison-replay', copy);
  assert.notEqual(child.status, 0); assert.equal(fs.existsSync(output), false); assert.equal(fs.existsSync(marker), false);
});
after(() => fs.writeFileSync(path.join(root, 'observations.json'), JSON.stringify({ node: process.version,
  actualFunctionalPart: part, results, newDOMExecuted: false, archivedCodeExecuted: false, performanceAccepted: null }, null, 2) + '\n'));
