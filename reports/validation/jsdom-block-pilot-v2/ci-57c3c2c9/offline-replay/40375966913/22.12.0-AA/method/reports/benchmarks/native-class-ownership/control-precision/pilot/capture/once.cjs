/** @module pilot-once One globally consumed workflow attempt across all heads; read-only metadata never starts DOM. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { mergeHistory, skippedFirstAttempt } = require('../../../owner-batch-study/tools/once.cjs');
const original = require('../../../owner-batch-study/constants/capture.json');
const { readJSON, hashFile, writeNewJSON } = require('./io.cjs');
const policy = require('../constants/capture.json');

/**
 * Inspect complete original-attempt history, without accepting an earlier failure or partial as reusable authorization.
 * Metadata examples in unit tests are explicitly synthetic; live receipts preserve the actual raw API responses.
 * @param {string} head - Independently selected actual Git HEAD.
 * @param {number} currentId - Actual hosted run ID.
 * @param {object} current - Current run metadata from GitHub.
 * @param {object[]} pages - Complete repository history within the fixed server-time window.
 * @param {object} firstJobs - Original attempt1 jobs for every other same-path run.
 * @returns {object} Unique method identity only; no scientific observation or performance acceptance.
 */
function verifyFirstCapture(head, currentId, current, pages, firstJobs) {
  assert.equal(typeof head, 'string'); assert.equal(head.length, policy.gitCommitHexLength);
  assert.match(head, new RegExp(policy.gitCommitPattern));
  assert.ok(Number.isSafeInteger(currentId) && currentId > 0);
  assert.equal(current.id, currentId); assert.equal(current.head_sha, head); assert.equal(current.run_attempt, 1);
  assert.equal(current.status, 'in_progress'); assert.equal(current.conclusion, null);
  assert.equal(current.repository.full_name, policy.repository); assert.equal(current.event, 'pull_request');
  assert.equal(current.path.split('@', 1)[0], policy.workflowPath);
  assert.ok(Number.isSafeInteger(current.run_number) && current.run_number > 0);
  assert.ok(Number.isSafeInteger(current.workflow_id) && current.workflow_id > 0);
  const created = Date.parse(current.created_at);
  assert.ok(Number.isFinite(created) && created >= Date.parse(policy.historyStartUTC) && created <= Date.parse(policy.activationDeadlineUTC),
    'Pilot once: fixed activation window expired; never extend or relabel a published method');
  assert.equal(policy.maximumHistoryRuns, original.maximumHistoryRuns);
  const runs = mergeHistory(pages);
  const actual = runs.filter((run) => run.id === currentId); assert.equal(actual.length, 1);
  for (const field of ['head_sha', 'run_number', 'created_at', 'path', 'workflow_id']) assert.equal(actual[0][field], current[field]);
  for (const run of runs) {
    const timestamp = Date.parse(run.created_at);
    assert.ok(Number.isFinite(timestamp) && timestamp >= Date.parse(policy.historyStartUTC) && timestamp <= created,
      'Pilot once: history response falls outside its declared server-time query');
    if (run.path.split('@', 1)[0] !== policy.workflowPath || run.id === currentId) continue;
    assert.ok(Object.hasOwn(firstJobs, String(run.id)), 'Pilot once: original attempt1 jobs are missing');
    if (skippedFirstAttempt(run, firstJobs[String(run.id)])) continue;
    // The query ends at current.created_at. Only a later run in the same second can be visible;
    // workflow-wide cancel-in-progress=false keeps it queued until this unique attempt finishes.
    const later = run.created_at === current.created_at && run.workflow_id === current.workflow_id && run.run_number > current.run_number;
    const pending = ['queued', 'waiting', 'pending', 'requested'].includes(run.status) &&
      firstJobs[String(run.id)].jobs.every((job) => job.status === 'queued');
    assert.ok(later && pending, 'Pilot once: another attempt consumed this method, including failures or partials');
  }
  return { allowed: true, revision: policy.revision, repository: policy.repository, workflow: policy.workflowPath,
    sourceCommit: head, currentRunId: currentId, currentRunNumber: current.run_number,
    historyStartUTC: policy.historyStartUTC, activationDeadlineUTC: policy.activationDeadlineUTC,
    performanceAccepted: null, gateReevaluated: false };
}

/** @param {string} head - Actual producer commit. @param {number} currentId - Hosted run. @param {object[]} records - Preserved API transport, including failures. @returns {object} Raw and derived once receipt, without DOM. */
function inspectFirstCapture(head, currentId, records = [], preserve = () => {}) {
  const started = performance.now();
  const api = (endpoint) => {
    const remaining = Math.floor(policy.preflightTimeoutMs - (performance.now() - started));
    assert.ok(remaining > 0, 'Pilot once: metadata deadline reached; preserve partials without starting capture');
    const child = spawnSync('gh', ['api', 'repos/' + policy.repository + '/' + endpoint],
      { encoding: 'utf8', timeout: Math.min(remaining, policy.maximumMetadataCommandMs), maxBuffer: policy.maximumJSONBytes });
    records.push({ endpoint, stdout: child.stdout ?? '', stderr: child.stderr ?? '', exitCode: child.status, error: child.error?.message ?? null });
    preserve(records.at(-1), records.length - 1);
    assert.ifError(child.error); assert.equal(child.status, 0, 'Pilot once: GitHub metadata read failed for ' + endpoint);
    return JSON.parse(child.stdout);
  };
  const current = api('actions/runs/' + currentId + '/attempts/1');
  const pages = [];
  for (let page = 1; ; page += 1) {
    const response = api('actions/runs?created=' + encodeURIComponent(policy.historyStartUTC + '..' + current.created_at) +
      '&per_page=' + policy.historyPageSize + '&page=' + page);
    assert.ok(response.total_count < policy.maximumHistoryRuns, 'Pilot once: incomplete history bound; do not capture');
    pages.push(response);
    if (pages.reduce((total, entry) => total + entry.workflow_runs.length, 0) >= response.total_count) break;
    assert.ok(response.workflow_runs.length === policy.historyPageSize, 'Pilot once: truncated history page');
  }
  const firstJobs = {};
  for (const run of mergeHistory(pages)) {
    if (run.id !== currentId && run.path.split('@', 1)[0] === policy.workflowPath) {
      firstJobs[String(run.id)] = api('actions/runs/' + run.id + '/attempts/1/jobs?per_page=' + policy.historyPageSize);
    }
  }
  const authorization = verifyFirstCapture(head, currentId, current, pages, firstJobs);
  const sourceRuns = api('actions/runs?head_sha=' + head + '&per_page=' + policy.historyPageSize);
  assert.equal(sourceRuns.total_count, sourceRuns.workflow_runs.length, 'Pilot once: truncated source-qualification history');
  assert.ok(sourceRuns.total_count < policy.historyPageSize);
  const qualifications = [];
  for (const workflow of [policy.qualificationWorkflowPath, policy.generalWorkflowPath]) {
    const candidates = sourceRuns.workflow_runs.filter((run) => run.path.split('@', 1)[0] === workflow)
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at) || right.id - left.id);
    assert.ok(candidates.length > 0, 'Pilot once: missing published-source qualification ' + workflow);
    const run = candidates[0];
    assert.equal(run.run_attempt, 1, 'Pilot once: qualification must have its original attempt1 provenance');
    const jobs = api('actions/runs/' + run.id + '/attempts/1/jobs?per_page=' + policy.historyPageSize);
    qualifications.push({ workflow, run: runView(run), jobs: jobView(jobs) });
  }
  validateQualifications(head, current.created_at, qualifications);
  return { ...authorization, current: runView(current), pages: pages.map((page) =>
    ({ total_count: page.total_count, workflow_runs: page.workflow_runs.map(runView) })),
    firstJobs: Object.fromEntries(Object.entries(firstJobs).map(([id, result]) => [id,
      jobView(result)])), qualifications,
    apiRequests: records.map((record, ordinal) => ({ ordinal, endpoint: record.endpoint, exitCode: record.exitCode,
      error: record.error, stdoutSha256: createHash('sha256').update(record.stdout).digest('hex'),
      stderrSha256: createHash('sha256').update(record.stderr).digest('hex') })),
    DOMExecuted: false, scientificCaptureExecuted: false };
}

/** @param {object} run - Original metadata retained separately, without rewriting its bytes. @returns {object} Only classifier fields, avoiding duplicated repository/commit objects in the bounded controller receipt. */
function runView(run) {
  return { ...Object.fromEntries(['id', 'head_sha', 'run_attempt', 'event', 'path', 'run_number', 'workflow_id',
    'created_at', 'status', 'conclusion'].map((field) => [field, run[field]])),
    ...(run.repository ? { repository: { full_name: run.repository.full_name } } : {}) };
}

/** @param {object} result - Complete original jobs API payload, separately retained byte-for-byte. @returns {object} Minimal classifier/provenance view. */
function jobView(result) {
  return { total_count: result.total_count, jobs: result.jobs.map((job) => Object.fromEntries(
    ['id', 'name', 'head_sha', 'run_id', 'run_attempt', 'status', 'conclusion', 'started_at', 'completed_at'].map((field) => [field, job[field]]))) };
}

/** @param {string} head - Exact producer commit. @param {string} activatedAt - Actual label-run creation time. @param {object[]} qualifications - Complete original-attempt qualification metadata. @returns {void} Require both reviewed workflows completed successfully before activation. */
function validateQualifications(head, activatedAt, qualifications) {
  assert.equal(qualifications.length, 2);
  assert.equal(new Set(qualifications.map((record) => record.run.id)).size, qualifications.length);
  const jobIds = qualifications.flatMap((record) => record.jobs.jobs.map((job) => job.id));
  assert.equal(new Set(jobIds).size, jobIds.length);
  for (const [workflow, names] of [[policy.qualificationWorkflowPath, policy.qualificationJobs], [policy.generalWorkflowPath, policy.generalJobs]]) {
    const matching = qualifications.filter((record) => record.workflow === workflow); assert.equal(matching.length, 1);
    const { run, jobs } = matching[0];
    assert.ok(Number.isSafeInteger(run.id) && run.id > 0);
    assert.equal(run.path.split('@', 1)[0], workflow); assert.equal(run.head_sha, head); assert.equal(run.run_attempt, 1);
    assert.equal(run.repository.full_name, policy.repository); assert.equal(run.event, 'pull_request');
    assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
    assert.equal(jobs.total_count, jobs.jobs.length); assert.equal(jobs.jobs.length, names.length);
    assert.equal(new Set(jobs.jobs.map((job) => job.id)).size, jobs.jobs.length);
    assert.deepEqual(jobs.jobs.map((job) => job.name).sort(), [...names].sort());
    for (const job of jobs.jobs) {
      assert.ok(Number.isSafeInteger(job.id) && job.id > 0);
      assert.equal(job.run_id, run.id); assert.equal(job.head_sha, head); assert.equal(job.run_attempt, 1);
      assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
      assert.ok(Number.isFinite(Date.parse(job.started_at)) && Number.isFinite(Date.parse(job.completed_at)));
      assert.ok(Date.parse(job.started_at) <= Date.parse(job.completed_at) && Date.parse(job.completed_at) <= Date.parse(activatedAt),
        'Pilot once: qualification must finish before the capture label is applied');
    }
  }
}

/** @param {string} head - Actual independently checked source commit. @returns {object} Controller-bound same-run receipt; the producer cannot invent its own expected digest. */
function readConsumption(head) {
  const filename = process.env[policy.consumptionEnvironment];
  const expected = process.env[policy.consumptionDigestEnvironment];
  assert.equal(typeof filename, 'string'); assert.equal(typeof expected, 'string');
  assert.equal(expected.length, policy.sha256HexLength); assert.match(expected, new RegExp(policy.sha256Pattern));
  assert.equal(hashFile(filename, policy.maximumJSONBytes, false), expected, 'Pilot once: controller-bound receipt differs');
  const receipt = readJSON(filename);
  const authorization = verifyFirstCapture(head, Number(process.env.GITHUB_RUN_ID), receipt.current, receipt.pages, receipt.firstJobs);
  validateQualifications(head, receipt.current.created_at, receipt.qualifications);
  for (const [field, value] of Object.entries(authorization)) assert.deepEqual(receipt[field], value);
  assert.equal(receipt.DOMExecuted, false); assert.equal(receipt.scientificCaptureExecuted, false);
  return { receipt, sha256: expected };
}

if (require.main === module) {
  const records = [];
  let destination;
  try {
    assert.equal(policy.executionReady, true, 'Pilot once: scientific method is not published');
    assert.equal(process.argv.length, 5, 'Pilot once: provide head, current run and new receipt path');
    destination = process.argv[4]; assert.equal(fs.existsSync(destination), false);
    assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_JOB, policy.preflightJobKey);
    assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1'); assert.equal(process.env.GITHUB_WORKFLOW, policy.workflowName);
    assert.equal(process.env.GITHUB_REPOSITORY, policy.repository);
    assert.equal(process.env.GITHUB_RUN_ID, process.argv[3]);
    const origin = require('./source.cjs').producer(policy.captureMode);
    assert.equal(origin.sourceCommit, process.argv[2]);
    const apiRoot = path.join(path.dirname(destination), 'api'); fs.mkdirSync(apiRoot);
    const preserve = (record, ordinal) => {
      const prefix = path.join(apiRoot, String(ordinal).padStart(policy.ordinalPaddingWidth, '0'));
      fs.writeFileSync(prefix + '.stdout.json', record.stdout, { flag: 'wx' });
      fs.writeFileSync(prefix + '.stderr.log', record.stderr, { flag: 'wx' });
    };
    writeNewJSON(destination, inspectFirstCapture(origin.sourceCommit, Number(process.argv[3]), records, preserve));
    process.stdout.write(hashFile(destination) + '\n');
  } catch (error) {
    if (destination !== undefined && !fs.existsSync(destination)) writeNewJSON(destination, { allowed: false, apiRequests: records.map((record) =>
      ({ endpoint: record.endpoint, exitCode: record.exitCode, error: record.error })),
      failure: error.message, DOMExecuted: false, scientificCaptureExecuted: false, performanceAccepted: null, gateReevaluated: false });
    process.stderr.write(error.stack + '\n'); process.exitCode = 2;
  }
}
module.exports = { verifyFirstCapture, inspectFirstCapture, readConsumption, runView, jobView, validateQualifications };
