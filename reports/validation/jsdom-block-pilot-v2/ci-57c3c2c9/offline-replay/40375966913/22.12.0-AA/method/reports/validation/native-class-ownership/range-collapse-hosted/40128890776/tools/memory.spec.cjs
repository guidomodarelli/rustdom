/** @file Replays genuine candidate observations and rejects missing or falsely released resources. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { verifyMemory } = require('./verify-memory.cjs');
const policy = require('./constants/transport.json');
const repository = path.resolve(__dirname, '../../../../../..');
const filename = path.join(repository, policy.referenceMemoryPath);
const original = JSON.parse(fs.readFileSync(filename, 'utf8'));

test('real probes in both fixed Nodes preserve separate owners, negative endpoints and native baselines', () => {
  for (const name of ['memory-node22.json', 'memory-node24.json']) {
    const report = JSON.parse(fs.readFileSync(path.join(path.dirname(filename), name), 'utf8'));
    const result = verifyMemory(repository, report);
    assert.equal(result.windowsObserved, 6); assert.equal(result.documentsObserved, 6);
    assert.equal(result.rangesObserved, 384); assert.equal(result.nativeRangesObserved, 384);
    assert.equal(result.retainedEndpoints, 12); assert.equal(result.requiredFinalClearStates, 12);
    assert.equal(result.performanceAccepted, null); assert.equal(result.peakMemoryMeasured, false);
    assert.equal(result.universalLeakFreedomProven, false);
  }
});

test('the public CLI replays a real saved report without importing a native addon', () => {
  const result = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'verify-memory.cjs'), repository, filename], { encoding: 'utf8' }));
  assert.equal(result.cycles, 6); assert.equal(result.collectorExecutedDOM, false);
  assert.deepEqual(result.baseline, original.baseline);
});

for (const kind of ['window', 'document']) {
  test(`missing ${kind} observations cannot become zero survivors`, () => {
    const report = structuredClone(original);
    delete report.cycles[0].released.trace.at(-1).survivors[kind];
    assert.throws(() => verifyMemory(repository, report), { code: 'ERR_ASSERTION' });
  });
  test(`a retained ${kind} contradicts an asserted clear endpoint`, () => {
    const report = structuredClone(original);
    report.cycles[0].released.trace.at(-1).survivors[kind] = 1;
    assert.throws(() => verifyMemory(repository, report), { code: 'ERR_ASSERTION' });
  });
}

test('a missing native category cannot borrow equality by disappearing from both baseline and snapshots', () => {
  const report = structuredClone(original);
  delete report.baseline.abortStates;
  for (const cycle of report.cycles) for (const outcome of [cycle.retained, cycle.released]) {
    delete outcome.state.nativeTree.abortStates;
    for (const endpoint of outcome.trace) delete endpoint.nativeTree.abortStates;
  }
  assert.throws(() => verifyMemory(repository, report), { code: 'ERR_ASSERTION' });
});

test('a substituted native baseline cannot approve otherwise clear endpoints', () => {
  const report = structuredClone(original); report.baseline.napiClasses.live++;
  assert.throws(() => verifyMemory(repository, report), { code: 'ERR_ASSERTION' });
});

test('a truncated release trace cannot claim the two required final observations', () => {
  const report = structuredClone(original); report.cycles[0].released.trace.pop();
  assert.throws(() => verifyMemory(repository, report), { code: 'ERR_ASSERTION' });
});

test('a single retained observation requires the actual declared deadline boundary', () => {
  const report = structuredClone(original); const outcome = report.cycles[0].retained;
  outcome.trace = [outcome.trace[0]];
  for (const field of ['survivors', 'memory', 'nativeTree']) outcome.state[field] = structuredClone(outcome.trace[0][field]);
  assert.throws(() => verifyMemory(repository, report), { code: 'ERR_ASSERTION' });
  // Exercise the owned JSON boundary with a genuine endpoint at the declared deadline; no new GC or timing capture.
  outcome.trace[0].elapsedMs = outcome.timeoutMs;
  assert.equal(verifyMemory(repository, report).retainedEndpoints, 11);
});
