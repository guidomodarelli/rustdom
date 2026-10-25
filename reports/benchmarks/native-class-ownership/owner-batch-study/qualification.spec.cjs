/** @file Validate genuine published CI records and reject incomplete, wrong-source or retried method qualifications. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { verifyQualification } = require('./tools/qualification.cjs');
const capture = require('./constants/capture.json');
const root = path.resolve(__dirname, '../../../../reports/validation/owner-batch-method-ci/40216555955');
const run = JSON.parse(fs.readFileSync(path.join(root, 'run.json'), 'utf8'));
const jobs = JSON.parse(fs.readFileSync(path.join(root, 'jobs.json'), 'utf8'));
const head = '564f0f554bcc43f8a12df1acaedc97525d1032ae';

test('all four actual published method jobs qualify their exact source without accepting performance', () => {
  const result = verifyQualification(head, run, jobs);
  assert.equal(result.qualified, true); assert.equal(result.runId, 40216555955); assert.equal(result.jobIds.length, 4);
  assert.equal(result.performanceAccepted, null); assert.equal(result.gateReevaluated, false);
});
test('the read-only live API contract is bound to its actual separately published successful run', () => {
  const directory = path.resolve(__dirname, '../../../../reports/validation/owner-batch-integral-ci/40224283558');
  const sourceRun = JSON.parse(fs.readFileSync(path.join(directory, 'run.json'), 'utf8'));
  const sourceJobs = JSON.parse(fs.readFileSync(path.join(directory, 'jobs.json'), 'utf8'));
  const result = verifyQualification(capture.qualificationContract.head, sourceRun, sourceJobs);
  assert.equal(result.runId, capture.qualificationContract.runId); assert.equal(result.qualified, true);
});
test('pending or failed CI cannot qualify scientific capture', () => {
  for (const changed of [{ ...run, status: 'in_progress', conclusion: null }, { ...run, conclusion: 'failure' }])
    assert.throws(() => verifyQualification(head, changed, jobs));
});
test('another source, workflow or retry is rejected rather than substituting a favorable run', () => {
  for (const changed of [{ ...run, head_sha: '0'.repeat(40) }, { ...run, path: '.github/workflows/ci.yml' }, { ...run, run_attempt: 2 }])
    assert.throws(() => verifyQualification(head, changed, jobs));
});
test('missing, duplicate, failed and foreign job identities are rejected', () => {
  for (const mutate of [(copy) => copy.jobs.pop(), (copy) => { copy.jobs[1] = copy.jobs[0]; },
    (copy) => { copy.jobs[0].conclusion = 'failure'; }, (copy) => { copy.jobs[0].run_id++; }]) {
    const changed = structuredClone(jobs); mutate(changed); assert.throws(() => verifyQualification(head, run, changed));
  }
});
