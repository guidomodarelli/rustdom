/** @file Explicit synthetic API-boundary controls for one-time admission; no fabricated measurements, SDK mocks or DOM execution. */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const capture = require('./constants/capture.json');
const { mergeHistory, verifyFirstCapture } = require('./tools/once.cjs');
const head = 'a'.repeat(40);
const current = { id: 20, workflow_id: 100, run_number: 2, head_sha: head, run_attempt: 1,
  repository: { full_name: capture.repository }, event: 'pull_request', path: capture.workflowPath,
  created_at: '2026-10-25T20:00:00Z', status: 'in_progress', conclusion: null };
const pages = (runs) => [{ total_count: runs.length, workflow_runs: runs }];
const jobs = (run, conclusion, status = 'completed') => ({ total_count: 1,
  jobs: [{ id: run.id * 10, run_id: run.id, run_attempt: 1, status, conclusion }] });
const previous = { ...current, id: 10, run_number: 1, head_sha: 'b'.repeat(40),
  created_at: '2026-10-25T19:59:00Z', status: 'completed', conclusion: 'failure' };

test('the sole current run is admitted without a performance decision', () => {
  const result = verifyFirstCapture(head, current.id, current, pages([current]), {});
  assert.equal(result.allowed, true); assert.equal(result.currentRunId, current.id);
  assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
});
test('another head never resets consumption after success, failure, cancellation or an active original attempt', () => {
  for (const conclusion of ['success', 'failure', 'cancelled', null]) {
    const run = { ...previous, conclusion, status: conclusion === null ? 'in_progress' : 'completed' };
    assert.throws(() => verifyFirstCapture(head, current.id, current, pages([run, current]),
      { [run.id]: jobs(run, conclusion, run.status) }));
  }
});
test('a later skipped retry cannot hide a consumed original first attempt', () => {
  const run = { ...previous, run_attempt: 2, conclusion: 'skipped' };
  assert.throws(() => verifyFirstCapture(head, current.id, current, pages([run, current]), { [run.id]: jobs(run, 'failure') }));
});
test('conclusively skipped original jobs from another label do not consume a capture', () => {
  const run = { ...previous, conclusion: 'success' };
  const result = verifyFirstCapture(head, current.id, current, pages([run, current]), { [run.id]: jobs(run, 'skipped') });
  assert.equal(result.allowed, true);
});
test('a later pending duplicate cannot interrupt the original run, and must be rejected after the original completes', () => {
  // IDs deliberately oppose ordering: the stable workflow run number resolves a same-second pending arrival.
  const first = { ...current, run_number: 1 };
  const later = { ...current, id: 10, run_number: 2, head_sha: 'b'.repeat(40), status: 'queued' };
  assert.equal(verifyFirstCapture(head, first.id, first, pages([first, later]), { [later.id]: jobs(later, null, 'queued') }).allowed, true);
  const finished = { ...first, status: 'completed', conclusion: 'success' };
  assert.throws(() => verifyFirstCapture(later.head_sha, later.id, later, pages([finished, later]), { [finished.id]: jobs(finished, 'success') }));
});
test('an already finished later-created attempt blocks an older queued run as well', () => {
  const later = { ...previous, id: 30, run_number: 3, created_at: '2026-10-25T20:00:01Z', conclusion: 'failure' };
  assert.throws(() => verifyFirstCapture(head, current.id, current, pages([current, later]), { [later.id]: jobs(later, 'failure') }));
});
test('pagination must include every record exactly once without capped or changing totals', () => {
  assert.equal(mergeHistory([{ total_count: 2, workflow_runs: [previous] }, { total_count: 2, workflow_runs: [current] }]).length, 2);
  for (const partial of [[{ total_count: 2, workflow_runs: [current] }],
    [{ total_count: 2, workflow_runs: [current, current] }],
    [{ total_count: 2, workflow_runs: [previous] }, { total_count: 3, workflow_runs: [current] }],
    [{ total_count: capture.maximumHistoryRuns, workflow_runs: [current] }]]) assert.throws(() => mergeHistory(partial));
});
test('foreign source, missing current run and a second attempt cannot pass admission', () => {
  assert.throws(() => verifyFirstCapture('b'.repeat(40), current.id, current, pages([current]), {}));
  assert.throws(() => verifyFirstCapture(head, current.id, { ...current, run_attempt: 2 }, pages([current]), {}));
  assert.throws(() => verifyFirstCapture(head, current.id, current, pages([previous]), {}));
});
test('a new run after the fixed activation window is rejected even without retained history', () => {
  const expired = { ...current, created_at: new Date(Date.parse(capture.activationDeadlineUTC) + 1000).toISOString() };
  assert.throws(() => verifyFirstCapture(head, expired.id, expired, pages([expired]), {}));
});
test('missing or latest-only job records cannot be treated as a skipped first attempt', () => {
  assert.throws(() => verifyFirstCapture(head, current.id, current, pages([previous, current]), {}));
  const wrong = jobs(previous, 'skipped'); wrong.jobs[0].run_attempt = 2;
  assert.throws(() => verifyFirstCapture(head, current.id, current, pages([previous, current]), { [previous.id]: wrong }));
});
