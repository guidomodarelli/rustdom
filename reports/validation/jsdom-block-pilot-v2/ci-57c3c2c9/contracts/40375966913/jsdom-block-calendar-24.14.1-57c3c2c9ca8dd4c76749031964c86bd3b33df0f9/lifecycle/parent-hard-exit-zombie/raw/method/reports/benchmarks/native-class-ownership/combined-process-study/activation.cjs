/** @module combined-reviewed-activation Requires a successful exact-source contract workflow and records the real unique capture run/job binding before measurement. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const study = require('./study.cjs');
const { methodFilesDigest } = require('./publication.cjs');
const { hashFile } = require('./io.cjs');
const policy = require('./constants/protocol.json');
const capture = require('./constants/capture.json');
const transport = require('./constants/transport.json');
const repository = path.resolve(__dirname, '../../../..');

/** @param {object} run - Actual consumed run metadata. @param {object} jobs - Actual attempt jobs. @param {string} head - Independently selected producer source. @returns {object} Exact successful contract identity; similarly named checks in other workflows do not qualify. */
function verifyContractRun(run, jobs, head) {
  assert.equal(run.path.split('@')[0], capture.contractWorkflow); assert.equal(run.head_sha, head);
  assert.equal(run.run_attempt, 1); assert.equal(run.event, 'pull_request');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  assert.deepEqual(jobs.jobs.map((job) => job.name).sort(), [...capture.requiredChecks].sort());
  for (const job of jobs.jobs) {
    assert.equal(job.run_id, run.id); assert.equal(job.head_sha, head); assert.equal(job.run_attempt, 1);
    assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  }
  return { runId: run.id, attempt: 1, head, jobs: jobs.jobs.map((job) => ({ id: job.id, name: job.name })) };
}

/** @param {object} run - Real current capture run metadata. @param {object} jobs - Attempt jobs. @param {string} head - Actual Git source. @param {object} identity - Independent reviewed method identity. @returns {object} Immutable pre-artifact binding, never an execution request or performance acceptance. */
function captureBinding(run, jobs, head, identity) {
  assert.equal(run.path.split('@')[0], capture.workflow); assert.equal(run.head_sha, head);
  assert.equal(run.run_attempt, 1); assert.equal(run.event, 'pull_request');
  assert.equal(jobs.jobs.length, 1); const job = jobs.jobs[0];
  assert.equal(job.name, capture.jobKey); assert.equal(job.run_id, run.id);
  assert.equal(job.head_sha, head); assert.equal(job.run_attempt, 1);
  assert.ok(Number.isSafeInteger(run.id) && run.id > 0 && Number.isSafeInteger(job.id) && job.id > 0);
  return { repository: policy.apiRepository, revision: policy.revision, runId: run.id, jobId: job.id,
    head, attempt: 1, workflow: capture.workflow, artifactName: transport.artifactPrefix + head + '-attempt1',
    artifactId: null, tarName: transport.tarName, rootName: transport.rootName,
    publicationSha256: identity.publicationSha256, methodFilesSha256: identity.methodFilesSha256 };
}

/** @param {string} head - Exact source SHA. @param {string} destination - Fresh activation evidence outside the source tree. @returns {object} Real run/job/method receipt, with no DOM or sampler invocation. */
function activate(head, destination) {
  assert.equal(policy.executionReady, true);
  assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1');
  assert.equal(process.env.GITHUB_REPOSITORY, policy.apiRepository); assert.equal(process.env.GITHUB_WORKFLOW, policy.workflowName);
  assert.equal(process.env.GITHUB_JOB, capture.jobKey); assert.match(process.env.GITHUB_RUN_ID ?? '', /^[1-9][0-9]*$/);
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' });
  assert.ifError(git.error); assert.equal(git.status, 0, git.stderr); assert.equal(git.stdout.trim(), head);
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: repository, encoding: 'utf8' });
  assert.ifError(status.error); assert.equal(status.status, 0, status.stderr); assert.equal(status.stdout, '');
  const reviewed = study.publication();
  destination = path.join(fs.realpathSync.native(path.dirname(path.resolve(destination))), path.basename(destination));
  assert.ok(destination !== repository && !destination.startsWith(repository + path.sep) && !repository.startsWith(destination + path.sep));
  fs.mkdirSync(destination);
  const api = (endpoint, filename) => {
    const response = spawnSync('gh', ['api', 'repos/' + policy.apiRepository + '/' + endpoint],
      { cwd: repository, timeout: capture.activationRequestTimeoutMs, maxBuffer: policy.metadataOutputLimitBytes });
    fs.writeFileSync(path.join(destination, filename), response.stdout ?? Buffer.alloc(0), { flag: 'wx' });
    fs.writeFileSync(path.join(destination, filename + '.stderr.log'), response.stderr ?? Buffer.alloc(0), { flag: 'wx' });
    assert.ifError(response.error); assert.equal(response.status, 0, response.stderr?.toString());
    return JSON.parse(response.stdout.toString('utf8'));
  };
  const candidates = api('actions/workflows/' + path.basename(capture.contractWorkflow) + '/runs?event=pull_request&head_sha=' + head + '&per_page=100', 'contract-runs.json');
  const matching = candidates.workflow_runs.filter((run) => run.head_sha === head && run.run_attempt === 1 && run.status === 'completed' && run.conclusion === 'success')
    .sort((left, right) => right.run_number - left.run_number);
  assert.ok(matching.length > 0, 'Combined activation: no successful exact-source contract workflow');
  const run = api('actions/runs/' + matching[0].id, 'contract-run.json');
  const jobs = api('actions/runs/' + run.id + '/attempts/1/jobs?per_page=100', 'contract-jobs.json');
  const qualification = verifyContractRun(run, jobs, head);
  const current = api('actions/runs/' + process.env.GITHUB_RUN_ID, 'capture-run.json');
  assert.equal(String(current.id), process.env.GITHUB_RUN_ID);
  const currentJobs = api('actions/runs/' + current.id + '/attempts/1/jobs?per_page=100', 'capture-jobs.json');
  const identity = { publicationSha256: hashFile(path.join(repository, capture.publicationReceipt)), methodFilesSha256: methodFilesDigest(reviewed.files) };
  const binding = captureBinding(current, currentJobs, head, identity);
  const receipt = { qualification, binding, samplerInvoked: false, performanceAccepted: null, gateReevaluated: false };
  fs.writeFileSync(path.join(destination, 'binding.json'), JSON.stringify(binding, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(destination, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  return receipt;
}
if (require.main === module) {
  try { assert.equal(process.argv.length, 4, 'Combined activation: provide exact source SHA and fresh evidence directory');
    console.log(JSON.stringify(activate(...process.argv.slice(2)))); }
  catch (error) { process.stderr.write(error.stack + '\n'); process.exitCode = policy.failureExitCode; }
}
module.exports = { verifyContractRun, captureBinding, activate };
