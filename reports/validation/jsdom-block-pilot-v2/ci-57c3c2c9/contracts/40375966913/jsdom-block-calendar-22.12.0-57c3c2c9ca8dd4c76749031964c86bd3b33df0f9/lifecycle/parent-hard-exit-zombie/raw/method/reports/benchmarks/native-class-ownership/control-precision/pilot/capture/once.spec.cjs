/** @file Synthetic API metadata contracts; no run is activated, sampled or claimed as observed. */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { verifyFirstCapture, validateQualifications } = require('./once.cjs');
const policy = require('../constants/capture.json');

/** @returns {object} Explicitly synthetic run metadata for the pure first-attempt classifier. */
function example() {
  const head = 'a'.repeat(40);
  const current = { id: 100, head_sha: head, run_attempt: 1, repository: { full_name: policy.repository },
    event: 'pull_request', path: policy.workflowPath, run_number: 2, workflow_id: 10,
    created_at: '2026-10-26T13:00:00Z', status: 'in_progress', conclusion: null };
  return { head, current, runs: [current], firstJobs: {} };
}
function inspect(input) {
  return verifyFirstCapture(input.head, input.current.id, input.current,
    [{ total_count: input.runs.length, workflow_runs: input.runs }], input.firstJobs);
}
function addPrevious(input, changes = {}, jobs = []) {
  const previous = { ...input.current, id: 99, run_number: 1, created_at: '2026-10-26T12:59:59Z',
    status: 'completed', conclusion: 'failure', ...changes };
  input.runs.push(previous);
  input.firstJobs[previous.id] = { total_count: jobs.length, jobs: jobs.map((job) =>
    ({ id: 201, run_id: previous.id, run_attempt: 1, ...job })) };
}
test('a unique original attempt yields no performance or DOM claim', () => {
  const result = inspect(example()); assert.equal(result.allowed, true);
  assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
});
test('failures, partial cancellations, earlier live runs and success all consume the method across source heads', () => {
  for (const changes of [{}, { conclusion: 'cancelled' }, { conclusion: 'success' }, { status: 'in_progress' },
    { head_sha: 'b'.repeat(40) }, { run_attempt: 2 }]) {
    const input = example(); addPrevious(input, changes, [{ status: 'completed', conclusion: 'success' }]);
    assert.throws(() => inspect(input), /consumed/);
  }
});
test('only conclusively skipped first attempts can be ignored even if latest metadata reflects a retry', () => {
  const input = example(); addPrevious(input, { run_attempt: 3 }, [{ status: 'completed', conclusion: 'skipped' }]);
  assert.equal(inspect(input).allowed, true);
  input.firstJobs[99].jobs[0].run_attempt = 3; assert.throws(() => inspect(input));
});
test('empty failed attempts and missing original jobs cannot disappear from history', () => {
  const input = example(); addPrevious(input); assert.throws(() => inspect(input), /consumed/);
  delete input.firstJobs[99]; assert.throws(() => inspect(input), /original attempt1/);
});
test('a later queued same-second run cannot enter a second globally serialized capture', () => {
  const input = example(); addPrevious(input, { id: 101, run_number: 3, created_at: input.current.created_at, status: 'queued' });
  assert.equal(inspect(input).allowed, true);
  input.runs[1].status = 'in_progress'; assert.throws(() => inspect(input), /consumed/);
});
test('rejects changed event, head, attempt, repository, path and activation-window identities', () => {
  for (const changes of [{ event: 'workflow_dispatch' }, { head_sha: 'b'.repeat(40) }, { run_attempt: 2 },
    { repository: { full_name: 'foreign/repository' } }, { path: 'foreign.yml' },
    { created_at: '2026-10-25T23:59:59Z' }, { created_at: '2026-10-28T00:00:01Z' }]) {
    const input = example(); Object.assign(input.current, changes); assert.throws(() => inspect(input));
  }
});
test('rejects duplicates, missing pages and history entries beyond the requested server-time upper bound', () => {
  const input = example(); input.runs.push(input.current); assert.throws(() => inspect(input));
  assert.throws(() => verifyFirstCapture(input.head, 100, input.current, [{ total_count: 2, workflow_runs: [input.current] }], {}));
  const outside = example(); addPrevious(outside, { created_at: '2026-10-26T13:00:01Z' }); assert.throws(() => inspect(outside), /outside/);
});

/** @returns {object[]} Synthetic complete qualification metadata, not an assertion that hosted CI ran. */
function qualifiedExamples() {
  return [[policy.qualificationWorkflowPath, policy.qualificationJobs], [policy.generalWorkflowPath, policy.generalJobs]].map(([workflow, names], ordinal) => {
    const run = { ...example().current, id: 10 + ordinal, status: 'completed', conclusion: 'success', path: workflow };
    return { workflow, run, jobs: { total_count: names.length, jobs: names.map((name, index) => ({ id: 200 + ordinal * 100 + index,
      name, head_sha: run.head_sha, run_id: run.id, run_attempt: 1, status: 'completed', conclusion: 'success',
      started_at: '2026-10-26T12:00:00Z', completed_at: '2026-10-26T12:59:00Z' })) } };
  });
}
test('requires both exact published-source workflows to finish every original job before activation', () => {
  const examples = qualifiedExamples(); validateQualifications(example().head, example().current.created_at, examples);
  for (const change of [
    (records) => { records.pop(); },
    (records) => { records[0].run.head_sha = 'b'.repeat(40); },
    (records) => { records[0].run.run_attempt = 2; },
    (records) => { records[0].jobs.jobs[0].name = 'different test'; },
    (records) => { records[0].jobs.jobs[0].conclusion = 'skipped'; },
    (records) => { records[0].jobs.jobs[0].completed_at = '2026-10-26T13:00:01Z'; },
    (records) => { records[0].jobs.jobs[0].head_sha = 'b'.repeat(40); }
  ]) { const records = qualifiedExamples(); change(records); assert.throws(() => validateQualifications(example().head, example().current.created_at, records)); }
});
