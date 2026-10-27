/** @module range-telemetry-readiness Binds one actual hosted attempt to its source, successful checks and complete workflow history. */
'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { policy } = require('./context.cjs');

/** @param {object[]} checks - Actual GitHub check runs. @param {string} commit - Exact source SHA. @param {string[]} names - Required names. @returns {void} Require the latest observed check for each name, not an older success. */
function validateChecks(checks, commit, names) {
  for (const name of names) {
    const current = checks.filter((entry) => entry.name === name && entry.head_sha === commit).sort((left, right) => right.id - left.id)[0];
    assert.ok(current, `Range telemetry: missing check ${name} on ${commit}`);
    assert.equal(current.status, 'completed', name); assert.equal(current.conclusion, 'success', name);
  }
}

/** @param {object} evidence - Original event/API observations. @param {string} commit - Actual checked-out source. @param {object} [declaration] - Fixed method identity. @returns {void} No capture or API mutation is performed. */
function validateActivation(evidence, commit, declaration = policy) {
  const { event, run, history, checks } = evidence;
  assert.equal(event.action, 'labeled'); assert.equal(event.label.name, declaration.label);
  assert.equal(event.pull_request.number, declaration.pullRequestNumber);
  assert.equal(event.pull_request.head.sha, commit);
  assert.equal(run.head_sha, commit); assert.equal(run.run_attempt, 1); assert.equal(run.event, 'pull_request');
  assert.equal(run.status, 'in_progress', 'Range telemetry: readiness must observe the current live hosted run');
  assert.equal(run.path, declaration.workflow); assert.equal(run.repository.full_name, declaration.apiRepository);
  assert.ok(history.some((entry) => entry.id === run.id));
  for (const entry of history) assert.ok(entry.id === run.id || entry.conclusion === 'skipped', 'Range telemetry: another non-skipped execution exists');
  validateChecks(checks, commit, declaration.requiredChecks);
}

/** @param {object} event - Hosted event. @returns {object} Raw API data for this exact attempt, including every history/check page. */
function readReadiness(event) {
  const endpoint = `repos/${policy.apiRepository}`;
  const query = (route, paginated = false) => JSON.parse(execFileSync('gh', ['api', ...(paginated ? ['--paginate', '--slurp'] : []), `${endpoint}/${route}`],
    { encoding: 'utf8', timeout: policy.metadataReadTimeoutMs, maxBuffer: policy.metadataOutputLimitBytes }));
  const run = query(`actions/runs/${process.env.GITHUB_RUN_ID}`);
  const historyPages = query(`actions/workflows/${path.basename(policy.workflow)}/runs?per_page=100`, true);
  const checkPages = query(`commits/${run.head_sha}/check-runs?per_page=100`, true);
  return { event, run, history: historyPages.flatMap((page) => page.workflow_runs), checks: checkPages.flatMap((page) => page.check_runs),
    historyPages, checkPages };
}
module.exports = { validateChecks, validateActivation, readReadiness };
