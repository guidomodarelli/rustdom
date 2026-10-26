/** @module owner-batch-qualified-source Require all method checks for the exact source before any scientific worker starts; read-only GitHub requests never dispatch a workflow. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const capture = require('../constants/capture.json');

/** @param {string} head - Independently selected source SHA. @param {object} run - Actual completed GitHub run. @param {object} jobs - Complete first-attempt job response. @returns {object} Stable qualification identity, without performance acceptance. */
function verifyQualification(head, run, jobs) {
  assert.match(head, /^[a-f0-9]{40}$/);
  assert.ok(Number.isSafeInteger(run.id) && run.id > 0); assert.equal(run.repository.full_name, capture.repository);
  assert.equal(run.head_sha, head); assert.equal(run.run_attempt, 1); assert.equal(run.event, 'pull_request');
  assert.equal(run.path.split('@', 1)[0], capture.qualificationWorkflow);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  assert.equal(jobs.total_count, jobs.jobs.length); assert.equal(jobs.jobs.length, capture.qualificationJobs.length);
  assert.equal(new Set(jobs.jobs.map((job) => job.id)).size, jobs.jobs.length);
  assert.deepEqual(jobs.jobs.map((job) => job.name).sort(), [...capture.qualificationJobs].sort());
  for (const job of jobs.jobs) {
    assert.ok(Number.isSafeInteger(job.id) && job.id > 0);
    assert.equal(job.run_id, run.id); assert.equal(job.head_sha, head); assert.equal(job.run_attempt, 1);
    assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  }
  return { qualified: true, sourceCommit: head, runId: run.id, attempt: 1, workflow: capture.qualificationWorkflow,
    jobIds: jobs.jobs.map((job) => job.id).sort((left, right) => left - right), performanceAccepted: null, gateReevaluated: false };
}

/** @param {string} endpoint - Relative same-repository GitHub API endpoint. @param {object[]} records - Owned raw response history, including partial failures. @returns {object} Bounded decoded response; credentials are never requested or printed. */
function api(endpoint, records) {
  const child = spawnSync('gh', ['api', 'repos/' + capture.repository + '/' + endpoint],
    { encoding: 'utf8', timeout: capture.maximumMetadataCommandMs, maxBuffer: capture.maximumMetadataOutputBytes });
  records.push({ endpoint, stdout: child.stdout ?? '', stderr: child.stderr ?? '', exitCode: child.status,
    error: child.error?.message ?? null });
  assert.ifError(child.error); assert.equal(child.status, 0, 'Owner batch qualification: GitHub read failed for ' + endpoint);
  return JSON.parse(child.stdout);
}

/** @param {string} head - Exact producer commit. @returns {object} Complete independently fetched CI records and stable identity; no DOM or scientific processes execute. */
function inspectQualification(head, records = [], fixedRunId = null) {
  assert.match(head, /^[a-f0-9]{40}$/);
  let selected = fixedRunId;
  if (selected === null) {
    const workflow = capture.qualificationWorkflow.split('/').at(-1);
    const listed = api('actions/workflows/' + workflow + '/runs?event=pull_request&head_sha=' + head + '&per_page=' + capture.qualificationPageSize, records);
    assert.equal(listed.total_count, listed.workflow_runs.length);
    assert.equal(listed.workflow_runs.length, 1, 'Owner batch qualification: require one unambiguous source-specific CI run');
    selected = listed.workflow_runs[0].id;
  }
  assert.ok(Number.isSafeInteger(selected) && selected > 0);
  const run = api('actions/runs/' + selected, records);
  const jobs = api('actions/runs/' + run.id + '/attempts/1/jobs?per_page=' + capture.qualificationPageSize, records);
  return { ...verifyQualification(head, run, jobs), run, jobs, apiRequests: records,
    DOMExecuted: false, scientificCaptureExecuted: false };
}
module.exports = { verifyQualification, inspectQualification };

if (require.main === module) {
  const records = [];
  try {
    assert.equal(process.argv.length, 3);
    const contractOnly = process.argv[2] === '--contract';
    const result = contractOnly ? inspectQualification(capture.qualificationContract.head, records, capture.qualificationContract.runId) :
      inspectQualification(process.argv[2], records);
    process.stdout.write(JSON.stringify({ ...result, contractOnly }, null, 2) + '\n');
  }
  catch (error) {
    process.stdout.write(JSON.stringify({ qualified: false, apiRequests: records, failure: error.message,
      DOMExecuted: false, scientificCaptureExecuted: false, performanceAccepted: null, gateReevaluated: false }, null, 2) + '\n');
    process.stderr.write(error.stack + '\n'); process.exitCode = capture.failureExitCode;
  }
}
