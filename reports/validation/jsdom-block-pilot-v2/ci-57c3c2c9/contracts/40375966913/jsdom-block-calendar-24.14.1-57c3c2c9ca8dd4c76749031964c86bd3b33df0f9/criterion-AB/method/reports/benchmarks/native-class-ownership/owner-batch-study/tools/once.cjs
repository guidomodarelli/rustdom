/** @module owner-batch-consumption Enforce one scientific run globally across heads; previous failures/partials still consume the method. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const capture = require('../constants/capture.json');

/** @param {object[]} pages - Complete raw repository history pages in a bounded server-time window. @returns {object[]} Every observed run, before selecting this method. */
function mergeHistory(pages) {
  assert.ok(pages.length > 0); const expected = pages[0].total_count;
  assert.ok(Number.isSafeInteger(expected) && expected >= 0 && expected < capture.maximumHistoryRuns);
  for (const page of pages) assert.equal(page.total_count, expected);
  const runs = pages.flatMap((page) => page.workflow_runs);
  for (const run of runs) assert.ok(Number.isSafeInteger(run.id) && run.id > 0);
  assert.equal(runs.length, expected, 'Owner batch once: incomplete/truncated repository history');
  assert.equal(new Set(runs.map((run) => run.id)).size, runs.length, 'Owner batch once: duplicate history entries');
  return runs;
}

/** @param {object} run - Earlier run metadata, possibly overwritten by a later attempt. @param {object} jobs - Original attempt1 jobs, never the latest retry. @returns {boolean} Only a conclusively skipped/no-job first attempt can be ignored. */
function skippedFirstAttempt(run, jobs) {
  assert.equal(jobs.total_count, jobs.jobs.length);
  assert.equal(new Set(jobs.jobs.map((job) => job.id)).size, jobs.jobs.length);
  for (const job of jobs.jobs) {
    assert.ok(Number.isSafeInteger(job.id) && job.id > 0); assert.equal(job.run_id, run.id); assert.equal(job.run_attempt, 1);
  }
  if (run.status !== 'completed') return false;
  if (jobs.jobs.length === 0) return ['success', 'skipped'].includes(run.conclusion);
  return jobs.jobs.every((job) => job.status === 'completed' && job.conclusion === 'skipped');
}

/** @param {string} head - Actual independently selected source. @param {number} currentId - Actual hosted run ID. @param {object} current - GitHub metadata for that run. @param {object[]} pages - Complete bounded repository history. @param {object} firstJobs - Attempt1 records of every earlier same-workflow run. @returns {object} Stable one-time authorization identity, never a performance decision. */
function verifyFirstCapture(head, currentId, current, pages, firstJobs) {
  assert.match(head, /^[a-f0-9]{40}$/); assert.ok(Number.isSafeInteger(currentId) && currentId > 0);
  assert.equal(current.id, currentId); assert.equal(current.head_sha, head); assert.equal(current.run_attempt, 1);
  assert.equal(current.repository.full_name, capture.repository); assert.equal(current.event, 'pull_request');
  assert.equal(current.path.split('@', 1)[0], capture.workflowPath);
  assert.ok(Number.isSafeInteger(current.run_number) && current.run_number > 0);
  assert.ok(Number.isSafeInteger(current.workflow_id) && current.workflow_id > 0);
  const created = Date.parse(current.created_at);
  assert.ok(Number.isFinite(created) && created >= Date.parse(capture.historyStartUTC) && created <= Date.parse(capture.activationDeadlineUTC),
    'Owner batch once: the fixed activation window has expired; do not extend or relabel this method');
  const runs = mergeHistory(pages);
  const actual = runs.filter((run) => run.id === currentId); assert.equal(actual.length, 1);
  for (const field of ['head_sha', 'run_number', 'created_at', 'path']) assert.equal(actual[0][field], current[field]);
  const others = runs.filter((run) => run.path.split('@', 1)[0] === capture.workflowPath && run.id !== currentId);
  for (const run of others) {
    assert.ok(Object.hasOwn(firstJobs, String(run.id)), 'Owner batch once: missing original attempt records');
    const jobs = firstJobs[String(run.id)];
    if (skippedFirstAttempt(run, jobs)) continue;
    assert.ok(Number.isSafeInteger(run.workflow_id) && run.workflow_id > 0);
    assert.ok(Number.isSafeInteger(run.run_number) && run.run_number > 0);
    const timestamp = Date.parse(run.created_at); assert.ok(Number.isFinite(timestamp));
    const later = timestamp > created || (run.created_at === current.created_at &&
      run.workflow_id === current.workflow_id && run.run_number > current.run_number);
    const pending = ['queued', 'waiting', 'pending', 'requested'].includes(run.status) &&
      jobs.jobs.every((job) => job.status === 'queued');
    // A later pending run cannot enter while the current workflow holds the global concurrency group.
    assert.ok(later && pending,
      'Owner batch once: another scientific attempt consumed this method; never relabel or substitute another head');
  }
  return { allowed: true, repository: capture.repository, workflow: capture.workflowPath, sourceCommit: head,
    currentRunId: currentId, currentRunNumber: current.run_number, historyStartUTC: capture.historyStartUTC,
    activationDeadlineUTC: capture.activationDeadlineUTC,
    performanceAccepted: null, gateReevaluated: false };
}

/** @param {string} endpoint - Same-repository read endpoint. @param {object[]} records - Raw transport history, preserved also on failure. @returns {object} Actual bounded API response. */
function api(endpoint, records) {
  const child = spawnSync('gh', ['api', 'repos/' + capture.repository + '/' + endpoint],
    { encoding: 'utf8', timeout: capture.maximumMetadataCommandMs, maxBuffer: capture.maximumMetadataOutputBytes });
  records.push({ endpoint, stdout: child.stdout ?? '', stderr: child.stderr ?? '', exitCode: child.status, error: child.error?.message ?? null });
  assert.ifError(child.error); assert.equal(child.status, 0, 'Owner batch once: GitHub history read failed for ' + endpoint);
  return JSON.parse(child.stdout);
}

/** @param {string} upper - Actual server creation time or read-only probe time. @param {object[]} records - Raw API history. @returns {object[]} Complete pages, globally across branches and workflow IDs. */
function history(upper, records) {
  assert.ok(Number.isFinite(Date.parse(upper)) && Date.parse(upper) >= Date.parse(capture.historyStartUTC));
  const pages = []; let count;
  for (let page = 1; ; page++) {
    const response = api('actions/runs?created=' + encodeURIComponent(capture.historyStartUTC + '..' + upper) +
      '&per_page=' + capture.qualificationPageSize + '&page=' + page, records);
    assert.ok(response.total_count < capture.maximumHistoryRuns, 'Owner batch once: history bound exceeded; do not capture with incomplete evidence');
    pages.push(response); count = pages.reduce((sum, entry) => sum + entry.workflow_runs.length, 0);
    if (count >= response.total_count || response.workflow_runs.length < capture.qualificationPageSize) break;
  }
  mergeHistory(pages); return pages;
}

/** @param {string} head - Exact producer SHA. @param {number} currentId - Actual run. @param {object[]} records - Raw responses. @returns {object} Complete evidence for the unique run before any DOM process starts. */
function inspectFirstCapture(head, currentId, records = []) {
  assert.ok(Number.isSafeInteger(currentId) && currentId > 0);
  const current = api('actions/runs/' + currentId, records);
  const pages = history(new Date().toISOString(), records); const jobs = {};
  for (const run of mergeHistory(pages)) {
    if (run.path.split('@', 1)[0] !== capture.workflowPath || run.id === currentId) continue;
    jobs[String(run.id)] = api('actions/runs/' + run.id + '/attempts/1/jobs?per_page=' + capture.qualificationPageSize, records);
  }
  return { ...verifyFirstCapture(head, currentId, current, pages, jobs), current, pages, firstJobs: jobs,
    apiRequests: records, probeOnly: false, DOMExecuted: false, scientificCaptureExecuted: false };
}
module.exports = { mergeHistory, skippedFirstAttempt, verifyFirstCapture, inspectFirstCapture };

if (require.main === module) {
  const records = [];
  try {
    if (process.argv.slice(2).join(' ') === '--probe') {
      const pages = history(new Date().toISOString(), records);
      process.stdout.write(JSON.stringify({ probeOnly: true, pages, apiRequests: records,
        observedMethodRuns: mergeHistory(pages).filter((run) => run.path.split('@', 1)[0] === capture.workflowPath).length,
        DOMExecuted: false, scientificCaptureExecuted: false, performanceAccepted: null, gateReevaluated: false }, null, 2) + '\n');
    } else {
      assert.equal(process.argv.length, 4);
      const result = inspectFirstCapture(process.argv[2], Number(process.argv[3]), records);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    }
  } catch (error) {
    process.stdout.write(JSON.stringify({ allowed: false, apiRequests: records, failure: error.message,
      DOMExecuted: false, scientificCaptureExecuted: false, performanceAccepted: null, gateReevaluated: false }, null, 2) + '\n');
    process.stderr.write(error.stack + '\n'); process.exitCode = capture.failureExitCode;
  }
}
