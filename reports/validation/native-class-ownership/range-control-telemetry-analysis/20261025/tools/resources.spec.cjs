/** @file Checks resource preservation using original historical Range reports; never executes DOM. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { gunzipSync } = require('node:zlib');
const analysisPolicy = require('./constants/analysis.json');
const { resourceObservation } = require('./analyze.cjs');
const fixture = require('./constants/resource-fixture.json');
const directory = fs.realpathSync(path.resolve(__dirname, '../fixtures'));
const repository = path.resolve(__dirname, analysisPolicy.repositoryRelativePath);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = fs.readFileSync(path.join(directory, 'manifest.json'));
assert.equal(hash(manifestBytes), fixture.manifestSha256);
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.runId, fixture.runId); assert.equal(manifest.sourceCommit, fixture.sourceCommit);
assert.equal(manifest.indexSha256, fixture.indexSha256); assert.equal(manifest.reports.length, fixture.processes);
const indexBytes = fs.readFileSync(path.join(repository, fixture.originalIndexPath));
assert.equal(hash(indexBytes), fixture.indexSha256);
const originalIndex = JSON.parse(indexBytes);
const compressed = fs.readFileSync(path.join(directory, 'reports.bin.gz'));
assert.equal(hash(compressed), fixture.compressedSha256);
const rawReports = gunzipSync(compressed, { maxOutputLength: fixture.uncompressedBytes });
assert.equal(rawReports.length, fixture.uncompressedBytes);
let boundary = 0;
for (const entry of [...manifest.reports, ...manifest.additionalControls]) {
  assert.equal(entry.offset, boundary); boundary += entry.bytes;
  const original = originalIndex.processes[entry.ordinal];
  assert.equal(entry.sha256, original.files['report.json']);
  assert.equal(entry.node, original.node); assert.equal(entry.pid, original.pid);
  assert.deepEqual(entry.input, original.input);
}
assert.equal(boundary, rawReports.length);

/** @returns {Generator<object>} Authenticate each original report before exercising the current helper. */
function* reports(entries = manifest.reports) {
  for (const entry of entries) {
    const bytes = rawReports.subarray(entry.offset, entry.offset + entry.bytes);
    assert.equal(hash(bytes), entry.sha256);
    const report = JSON.parse(bytes);
    assert.equal(report.pid, entry.pid); assert.equal(report.node, entry.node);
    yield { entry, report, bytes, identity: { ordinal: entry.ordinal, node: entry.node, pid: entry.pid, ...entry.input } };
  }
}

test('all original Range resource families, endpoints and independent owners survive export without changing input', () => {
  let processed = 0; let native = 0;
  for (const { entry, report, bytes, identity } of reports()) {
    const before = JSON.stringify(report);
    const observed = resourceObservation(identity, report);
    const serialized = JSON.parse(JSON.stringify(observed));
    assert.deepEqual(serialized.nativeBaseline, report.nativeBaseline);
    assert.deepEqual(serialized.cleanupTrace, report.batches[0].cleanupTrace);
    assert.deepEqual(serialized.memoryAfterCleanup, report.batches[0].memoryAfterCleanup);
    assert.deepEqual(serialized.trackedOwners, report.batches[0].trackedOwners);
    assert.equal(serialized.ordinal, entry.ordinal); assert.equal(serialized.pid, entry.pid);
    assert.equal(serialized.cleanupTrace.length, fixture.cleanupRounds);
    assert.equal(serialized.memoryAfterCleanup.length, fixture.measuredEndpoints);
    if (entry.input.engine === 'rustdom') {
      native++;
      for (const family of fixture.familyNames) {
        assert.ok(Object.hasOwn(serialized.nativeBaseline, family));
        for (const round of serialized.cleanupTrace) assert.ok(Object.hasOwn(round.nativeTree, family));
      }
    }
    assert.equal(JSON.stringify(report), before); assert.equal(hash(bytes), entry.sha256);
    processed++;
  }
  assert.equal(processed, fixture.processes); assert.equal(native, fixture.nativeProcesses);
});

test('original absent baselines, false values and delayed cleanup survive across Range and one historical MutationRecord control', () => {
  let references = 0; let firstUnclear = 0; let falseFlags = 0; let observedCreatedRange = false;
  for (const { entry, report, identity } of reports([...manifest.reports, ...manifest.additionalControls])) {
    const record = JSON.parse(JSON.stringify(resourceObservation(identity, report)));
    if (entry.input.engine === 'jsdom') {
      references++; assert.equal(Object.hasOwn(record, 'nativeBaseline'), Object.hasOwn(report, 'nativeBaseline'));
      assert.equal(record.nativeBaseline, report.nativeBaseline);
    } else {
      for (const round of record.cleanupTrace) {
        assert.equal(round.nativeTree.mutationNotifications.microtaskQueued, false); falseFlags++;
        observedCreatedRange ||= round.nativeTree.rangeStates.created > 0;
      }
    }
    if (!report.batches[0].cleanupTrace[0].clear) {
      firstUnclear++; assert.equal(record.cleanupTrace[0].clear, false);
      assert.deepEqual(record.cleanupTrace[0].survivors, report.batches[0].cleanupTrace[0].survivors);
    }
    assert.equal(record.cleanupTrace.at(-1).clear, true);
    assert.equal(record.cleanupTrace.at(-2).clear, true);
  }
  assert.equal(references, fixture.nativeProcesses);
  assert.ok(firstUnclear > 0); assert.ok(falseFlags > 0); assert.equal(observedCreatedRange, true);
});

test('the helper rejects an ambiguous multi-workload report and absent resource observations', () => {
  const { report, identity } = reports().next().value;
  const multiple = structuredClone(report); multiple.batches.push(multiple.batches[0]);
  assert.throws(() => resourceObservation(identity, multiple), { code: 'ERR_ASSERTION' });
  const missingTrace = structuredClone(report); delete missingTrace.batches[0].cleanupTrace;
  assert.throws(() => resourceObservation(identity, missingTrace), { code: 'ERR_ASSERTION' });
  const missingEndpoints = structuredClone(report); delete missingEndpoints.batches[0].memoryAfterCleanup;
  assert.throws(() => resourceObservation(identity, missingEndpoints), { code: 'ERR_ASSERTION' });
});

test('the unbound new-result CLI still refuses historical data before touching an output directory', () => {
  const parent = fs.realpathSync(os.tmpdir());
  const temporary = fs.mkdtempSync(path.join(parent, 'rustdom-resource-guard-'));
  try {
    const output = path.join(temporary, 'not-created');
    const child = spawnSync(process.execPath, [path.join(__dirname, 'analyze.cjs'), directory, output, path.join(directory, 'manifest.json')], { encoding: 'utf8', timeout: 10000 });
    assert.notEqual(child.status, 0);
    assert.ok(child.stderr.includes('bind actual run, index and strict replay before exporting'));
    assert.equal(fs.existsSync(output), false);
    assert.equal(hash(fs.readFileSync(path.join(directory, 'manifest.json'))), fixture.manifestSha256);
  } finally {
    assert.equal(path.dirname(temporary), parent); assert.equal(fs.realpathSync(temporary), temporary);
    fs.rmSync(temporary, { recursive: true });
  }
});
