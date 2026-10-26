'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { replayEnvelope } = require('./envelope.cjs');
const policy = require('./constants/envelope.json');
const repository = path.resolve(__dirname, '../../../../..');
const digest = (raw) => createHash('sha256').update(raw).digest('hex');
const catalogRaw = fs.readFileSync(path.join(repository, policy.functionalFixture.manifest));
assert.equal(digest(catalogRaw), policy.functionalFixture.manifestSha256);
const catalog = JSON.parse(catalogRaw);

/** @param {string} relative - Actual archived functional fixture data. @returns {object} Independently pinned parsed JSON, never executable code. */
function readFixture(relative) {
  const raw = fs.readFileSync(path.join(repository, relative));
  assert.equal(raw.length, catalog.files[relative].bytes);
  assert.equal(digest(raw), catalog.files[relative].sha256);
  return JSON.parse(raw);
}

const fixtures = [];
for (const version of ['22.12.0', '24.14.1']) {
  const root = policy.functionalFixture.root + '/node-' + version;
  const index = readFixture(root + '/index.json');
  assert.equal(index.sourceIdentity.sourceCommit, policy.functionalFixture.producerCommit);
  assert.equal(policy.functionalFixture.producerIsPublishedCommit, false);
  for (const entry of index.processes) {
    fixtures.push({
      report: readFixture(root + '/' + entry.directory + '/report.json'),
      context: readFixture(root + '/' + entry.directory + '/report.json.context.json'), manifest: index.manifest,
      input: entry.input,
      invocation: { mode: 'functional', node: index.node, pid: entry.invocation.command.pid,
        hostId: 'functional-parent-' + index.parentPid,
        startMonotonicMs: entry.invocation.startMonotonicMs, endMonotonicMs: entry.invocation.endMonotonicMs },
      producer: { parentPid: index.parentPid, workerSourceSha256: index.ownSourceFiles['worker.cjs'] }
    });
  }
}

/** @param {object} fixture - Real decoded payload and trusted original invocation. @returns {object} Complete sidecar-bound replay. */
function replay(fixture) {
  return replayEnvelope(fixture.report, fixture.context, fixture.manifest, fixture.input, fixture.invocation, fixture.producer);
}

test('replays all 32 real producer envelopes without promoting functional tasks to scientific observations', () => {
  assert.equal(fixtures.length, 32);
  for (const fixture of fixtures) {
    const result = replay(fixture);
    assert.equal(result.producerBindingsChecked, true);
    assert.equal(result.analysisObservation, null);
    assert.equal(result.producerSourceAuthenticationPerformed, false);
    assert.equal(result.transportAuthenticationPerformed, false);
    assert.equal(result.replay.samplesMs.length, 144);
    assert.equal(result.replay.warmupSamplesMs.length, 48);
    assert.equal(result.trackedOwners.window, 12);
    assert.equal(result.trackedOwners.document, 12);
  }
});

test('rejects a valid raw report paired with another real SDK or process sidecar', () => {
  for (const index of [1, 16]) {
    const fixture = structuredClone(fixtures[0]); fixture.context = structuredClone(fixtures[index].context);
    assert.throws(() => replay(fixture));
  }
});

test('rejects a foreign parent or child PID without trusting the sidecar claim', () => {
  for (const field of ['parentPid', 'pid']) {
    const fixture = structuredClone(fixtures[0]); fixture.context[field] += 1;
    assert.throws(() => replay(fixture), /PID differs/);
  }
});

test('requires an independent worker digest and rejects a different otherwise valid digest', () => {
  for (const value of [undefined, '', '0'.repeat(64)]) {
    const fixture = structuredClone(fixtures[0]); fixture.producer.workerSourceSha256 = value;
    assert.throws(() => replay(fixture));
  }
});

test('rejects SDK, package artifact and calendar tuple substitutions', () => {
  for (const alter of [
    (fixture) => { fixture.context.node = 'v24.14.1'; },
    (fixture) => { fixture.context.numericPackageArtifactId += 1; },
    (fixture) => { fixture.context.plannedInput.ordinal += 1; },
    (fixture) => { fixture.manifest.selectedArtifactId += 1; }
  ]) {
    const fixture = structuredClone(fixtures[0]); alter(fixture); assert.throws(() => replay(fixture));
  }
});

test('rejects incomplete contexts and changed worker or raw format revisions', () => {
  for (const change of [{ complete: false }, { workerRevision: 'foreign-worker' }, { rawPayloadContractRevision: 'foreign-format' }]) {
    const fixture = structuredClone(fixtures[0]); Object.assign(fixture.context, change);
    assert.throws(() => replay(fixture));
  }
});

test('rejects false authentication, acceptance and scientific claims in functional data', () => {
  for (const change of [
    { packageAuthenticationPerformedHere: true }, { producerSourceAuthenticationPerformedHere: true },
    { performanceAccepted: true }, { gateReevaluated: true }, { scientificCaptureExecuted: true },
    { analysisObservation: {} }, { mode: 'capture' }
  ]) {
    const fixture = structuredClone(fixtures[0]); Object.assign(fixture.context, change);
    assert.throws(() => replay(fixture));
  }
});

test('cannot elevate a complete functional payload by asking for capture mode', () => {
  const fixture = structuredClone(fixtures[0]); fixture.invocation.mode = 'capture';
  assert.throws(() => replay(fixture), /scientific capture is not implemented/);
});

test('continues checking raw task correctness and cleanup after the sidecar passes', () => {
  const fixture = structuredClone(fixtures[0]); fixture.report.complete = false;
  assert.throws(() => replay(fixture));
  const retained = structuredClone(fixtures[0]); retained.report.cleanupTrace.at(-1).clear = false;
  assert.throws(() => replay(retained));
});
