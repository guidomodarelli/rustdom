/** @module combined-decision-contracts Uses actual recorded progress and immutable historical identities to test framing, rejection and evidence preservation without a new measurement. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { decide, readProducerLog } = require('./decision.cjs');
const { read } = require('./processes.cjs');
const policy = require('./constants/protocol.json');
const reference = require('./constants/transport-reference.json');

test('real 64-process parent log retains progress and reads its terminal result without treating it as scientific evidence', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-parent-log-'));
  try {
    const directory = path.join(temporary, 'data');
    const child = spawnSync('python3', ['-B', path.join(__dirname, 'materialize-functional.py'), '--parent-log', directory],
      { encoding: 'utf8', timeout: policy.preparationTimeoutMs });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
    const index = read(path.join(directory, 'index.json')); const filename = path.join(directory, 'stdout.log');
    const raw = fs.readFileSync(filename, 'utf8');
    const result = readProducerLog(filename, index.processes);
    assert.equal(result.processes, 64); assert.equal(result.functionalOnly, true);
    assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
    fs.writeFileSync(filename, raw.trimEnd().split('\n').slice(1).join('\n') + '\n');
    assert.throws(() => readProducerLog(filename, index.processes));
    fs.writeFileSync(filename, raw.replace('"exitCode":0', '"exitCode":1'));
    assert.throws(() => readProducerLog(filename, index.processes));
  } finally { fs.rmSync(temporary, { recursive: true }); }
});

test('historical transport cannot produce acceptance and failed readers preserve their fresh output', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-decision-rejected-'));
  try {
    const binding = path.join(temporary, 'binding.json'); fs.writeFileSync(binding, JSON.stringify(reference.binding));
    const directory = path.join(temporary, 'reader');
    const result = decide(binding, path.resolve(__dirname, '../../../..', reference.collection), directory);
    assert.equal(result.complete, false); assert.equal(result.captureAuthenticated, false);
    assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
    assert.equal(result.phase, 'publication'); assert.ok(result.failure.message.length > 0);
    const before = fs.readFileSync(path.join(directory, 'decision.json'));
    assert.throws(() => decide(binding, path.resolve(__dirname, '../../../..', reference.collection), directory), /preserve existing output/);
    assert.deepEqual(fs.readFileSync(path.join(directory, 'decision.json')), before);
    assert.equal(fs.existsSync(path.join(directory, 'extracted')), false);
  } finally { fs.rmSync(temporary, { recursive: true }); }
});
