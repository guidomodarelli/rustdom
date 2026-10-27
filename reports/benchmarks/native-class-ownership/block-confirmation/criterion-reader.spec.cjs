/** @module confirmation-criterion-replay-contracts Reads every real process and snapshot, then rejects altered physical copies without executing DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const test = require('node:test');
const { verifyCriterion } = require('./criterion-reader.cjs');
const root = process.env.RUSTDOM_CONFIRMATION_BOUND_FIXTURE;
const expectedFile = process.env.RUSTDOM_CONFIRMATION_BOUND_EXPECTED;
assert.ok(root && expectedFile, 'Criterion replay contracts: provide original real data and independent authenticated source/package observations');
const expected = JSON.parse(fs.readFileSync(expectedFile, 'utf8'));

/** @param {object} context - Real test owner. @returns {string} Own physical copy; original files never change. */
function copied(context) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-criterion-copy-'));
  context.after(() => fs.rmSync(temporary, { recursive: true }));
  const directory = path.join(temporary, 'data'); fs.cpSync(root, directory, { recursive: true, verbatimSymlinks: true });
  return directory;
}

/** @param {string} directory - Original or owned data root. @param {function(object):void} mutate - Explicit scalar-data mutation. @returns {void} Change only a test-owned index, not implementation text. */
function changeIndex(directory, mutate) {
  const filename = path.join(directory, 'index.json'); const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
  mutate(value); fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
}

test('whole real criterion verifies every command/source/resource and preserves original paths without statistical acceptance', () => {
  const result = verifyCriterion(root, expected);
  assert.equal(result.verified, true); assert.equal(result.analysis, null); assert.deepEqual(result.observations, []);
  assert.equal(result.transportAuthenticationPerformed, false); assert.equal(result.originalPathsRewritten, false);
  assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
  assert.equal(result.totals.processes, 32); assert.equal(result.totals.measuredDurations, 4608);
  assert.equal(result.totals.warmupDurations, 1536); assert.equal(result.totals.windows, 384); assert.equal(result.totals.documents, 384);
  assert.equal(result.totals.finalClearStates, 64);
});

test('a missing, duplicated or reversed process cannot complete the fixed criterion', (context) => {
  const directory = copied(context);
  const original = fs.readFileSync(path.join(directory, 'index.json'));
  for (const mutate of [
    (index) => { index.processes.pop(); },
    (index) => { index.processes[1] = structuredClone(index.processes[0]); },
    (index) => { index.processes.reverse(); },
  ]) {
    fs.writeFileSync(path.join(directory, 'index.json'), original); changeIndex(directory, mutate);
    assert.throws(() => verifyCriterion(directory, expected));
  }
});

test('changed raw report bytes, even a trailing newline, do not match the original parent file ledger', (context) => {
  const directory = copied(context); fs.appendFileSync(path.join(directory, 'workers/0000/report.json'), '\n');
  assert.throws(() => verifyCriterion(directory, expected), /AssertionError|changed worker file/);
});

test('changed command bytes cannot borrow exit zero from the parent index', (context) => {
  const directory = copied(context);
  const filename = path.join(directory, 'workers/0000/command.json'); const command = JSON.parse(fs.readFileSync(filename, 'utf8'));
  command.exitCode = 2; fs.writeFileSync(filename, JSON.stringify(command));
  assert.throws(() => verifyCriterion(directory, expected));
});

test('a changed source snapshot cannot retain the original authenticated source profile', (context) => {
  const directory = copied(context);
  fs.appendFileSync(path.join(directory, 'source/src/dom/range_state.rs'), '\n');
  assert.throws(() => verifyCriterion(directory, expected));
});

test('forged parent snapshots, changed SDK/host counts or functional-to-scientific promotion cannot pass', (context) => {
  const directory = copied(context); const original = fs.readFileSync(path.join(directory, 'index.json'));
  for (const mutate of [
    (index) => { index.parentMemory.pop(); },
    (index) => { index.parentMemory[1].completedWorkers = 0; },
    (index) => { index.parentMemory[2].monotonicMs = index.startedMonotonicMs - 1; },
    (index) => { index.node = 'v0.0.0'; },
    (index) => { index.hostId += '-other'; },
    (index) => { index.mode = 'capture'; },
    (index) => { index.analysis = { allBudgetsMet: true }; },
    (index) => { index.elapsedMs = index.timeoutMs + 1; },
  ]) {
    fs.writeFileSync(path.join(directory, 'index.json'), original); changeIndex(directory, mutate);
    assert.throws(() => verifyCriterion(directory, expected));
  }
});

test('a changed parent executable digest or startup flags cannot inherit a valid worker identity', (context) => {
  const directory = copied(context); const original = fs.readFileSync(path.join(directory, 'index.json'));
  for (const mutate of [
    (index) => { index.nodeExecutableSha256 = '0'.repeat(64); },
    (index) => { index.nodeExecutableSha256 = require('./constants/design.json').nodeExecutableSha256[index.node]; index.parentExecArgv = []; },
  ]) {
    fs.writeFileSync(path.join(directory, 'index.json'), original); changeIndex(directory, mutate);
    assert.throws(() => verifyCriterion(directory, expected));
  }
});

test('real supervisor failures, orphaned descendants and changed invocation cannot authenticate the criterion clock', (context) => {
  assert.ok(expected.supervisor, 'Clock contracts require the real supervised fixture');
  for (const mutate of [
    (supervisor) => { supervisor.deadlineReached = true; },
    (supervisor) => { supervisor.interrupted = true; },
    (supervisor) => { supervisor.unexpectedDescendants = true; },
    (supervisor) => { supervisor.cleanupFailure = { message: 'synthetic rejected cleanup failure' }; },
    (supervisor) => { supervisor.cleanupObserverFailure = { message: 'synthetic rejected observer failure' }; },
    (supervisor) => { supervisor.ownedDescendantsRemaining = [{ pid: 1 }]; },
    (supervisor) => { supervisor.parentPid += 1; },
    (supervisor) => { supervisor.argv[3] = '--capture'; },
    (supervisor) => { supervisor.captureStartMarkerSha256 = '0'.repeat(64); },
    (supervisor) => { supervisor.finishedUptimeSeconds = supervisor.captureDeadlineUptimeSeconds + 1; },
  ]) {
    const changed = structuredClone(expected); mutate(changed.supervisor);
    assert.throws(() => verifyCriterion(root, changed));
  }
});
