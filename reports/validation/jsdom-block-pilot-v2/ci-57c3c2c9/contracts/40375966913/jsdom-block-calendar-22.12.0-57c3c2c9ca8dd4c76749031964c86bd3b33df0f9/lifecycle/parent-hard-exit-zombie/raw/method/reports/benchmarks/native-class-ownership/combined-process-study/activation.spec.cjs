/** @module combined-activation-contracts Exercises real contract CI metadata and explicit data-only adversarial transformations; never invents an authorized or measured run. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { verifyContractRun, captureBinding, activate } = require('./activation.cjs');
const { verifyCaptureBinding, methodFilesDigest } = require('./publication.cjs');
const study = require('./study.cjs');
const { hashFile } = require('./io.cjs');
const capture = require('./constants/capture.json');
const policy = require('./constants/protocol.json');
const recordedRun = require('./fixtures/contract-ci-run.json');
const recordedJobs = require('./fixtures/contract-ci-jobs.json');

test('real completed contract CI binds its exact workflow, source, attempt and both successful jobs', () => {
  const result = verifyContractRun(recordedRun, recordedJobs, recordedRun.head_sha);
  assert.equal(result.runId, 40182447893); assert.equal(result.jobs.length, 2);
  for (const change of [{ path: '.github/workflows/unrelated.yml' }, { head_sha: '0'.repeat(40) },
    { run_attempt: 2 }, { conclusion: 'failure' }, { status: 'queued' }]) {
    assert.throws(() => verifyContractRun({ ...recordedRun, ...change }, recordedJobs, recordedRun.head_sha));
  }
  const missing = structuredClone(recordedJobs); missing.jobs.pop();
  assert.throws(() => verifyContractRun(recordedRun, missing, recordedRun.head_sha));
  const changed = structuredClone(recordedJobs); changed.jobs[0].conclusion = 'failure';
  assert.throws(() => verifyContractRun(recordedRun, changed, recordedRun.head_sha));
});

test('data-only capture binding contract retains independent method identity and rejects changed invocation fields', () => {
  // These explicit transformations exercise the mapping contract only. They are not GitHub observations or performance evidence.
  const run = { ...recordedRun, path: capture.workflow };
  const jobs = { jobs: [{ ...recordedJobs.jobs[0], name: capture.jobKey }] };
  const reviewed = study.publication();
  const identity = { publicationSha256: hashFile(path.resolve(__dirname, '../../../..', capture.publicationReceipt)),
    methodFilesSha256: methodFilesDigest(reviewed.files) };
  const binding = captureBinding(run, jobs, run.head_sha, identity);
  const expected = { sourceCommit: run.head_sha, hosted: { repository: policy.apiRepository,
    workflow: policy.workflowName, runId: String(run.id), attempt: 1, jobKey: capture.jobKey }, ...identity };
  verifyCaptureBinding(binding, expected);
  assert.equal(binding.artifactId, null); assert.equal(binding.publicationSha256, identity.publicationSha256);
  assert.equal(binding.performanceAccepted, undefined);
  for (const change of [{ runId: binding.runId + 1 }, { head: '0'.repeat(40) }, { attempt: 2 },
    { workflow: recordedRun.path }, { artifactId: 1 }, { publicationSha256: '0'.repeat(64) },
    { methodFilesSha256: '0'.repeat(64) }, { artifactName: 'unrelated-artifact' }]) {
    assert.throws(() => verifyCaptureBinding({ ...binding, ...change }, expected));
  }
  assert.throws(() => captureBinding(recordedRun, recordedJobs, run.head_sha, identity));
});

test('actual unrelated host cannot activate or write a capture binding', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-activation-guard-'));
  try {
    assert.notEqual(process.env.GITHUB_WORKFLOW, policy.workflowName);
    const destination = path.join(temporary, 'activation');
    assert.throws(() => activate(recordedRun.head_sha, destination));
    assert.equal(fs.existsSync(destination), false);
  } finally { fs.rmSync(temporary, { recursive: true }); }
});
