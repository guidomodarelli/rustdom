/** @module confirmation-consumption-contracts Synthetic receipt-schema cases and a real disabled CLI; no GitHub event, source execution or scientific authorization is fabricated. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { validateReceipt } = require('./consumption.cjs');
const policy = require('./constants/capture.json');

/** @returns {object} Explicit synthetic schema fixture, never an authenticated hosted context or executable receipt. */
function synthetic() {
  const hosted = { repository: policy.repository, workflow: policy.workflowName, jobKey: policy.jobKey,
    attempt: 1, pullRequest: policy.pullRequest, label: policy.label, runId: '1', eventHead: '0'.repeat(40) };
  const receipt = { revision: policy.revision, consumed: true, creatorJobKey: policy.prepareJobKey,
    hosted: { ...hosted, jobKey: policy.prepareJobKey }, priorNonSkippedRunIds: ['1'], priorRunIdsSha256: '1'.repeat(64),
    publicationSha256: '2'.repeat(64), methodFilesDigest: '3'.repeat(64), performanceAccepted: null, gateReevaluated: false };
  return { hosted, receipt };
}

test('the schema distinguishes prepare/criterion roles without granting actual hosted authenticity', () => {
  const value = synthetic(); assert.equal(validateReceipt(value.receipt, value.hosted), undefined);
});

test('another run, attempt, label, source or prior execution cannot reuse the same consumption', () => {
  for (const mutate of [
    (receipt) => { receipt.hosted.runId = '2'; }, (receipt) => { receipt.hosted.attempt = 2; },
    (receipt) => { receipt.hosted.label += '-other'; }, (receipt) => { receipt.hosted.eventHead = '1'.repeat(40); },
    (receipt) => { receipt.priorNonSkippedRunIds.push('2'); }, (receipt) => { receipt.priorNonSkippedRunIds = []; },
    (receipt) => { receipt.creatorJobKey = policy.jobKey; }, (receipt) => { receipt.consumed = false; },
    (receipt) => { receipt.performanceAccepted = true; }, (receipt) => { receipt.gateReevaluated = true; },
  ]) {
    const value = synthetic(); mutate(value.receipt); assert.throws(() => validateReceipt(value.receipt, value.hosted));
  }
});

test('the real record CLI cannot create a receipt while the scientific method is unpublished', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-consumption-disabled-'));
  context.after(() => fs.rmSync(directory, { recursive: true }));
  const filename = path.join(directory, 'receipt.json');
  const child = spawnSync(process.execPath, [path.join(__dirname, 'consumption.cjs'), '--record', 'nonexistent-api-data', filename],
    { encoding: 'utf8', timeout: 20000 });
  assert.ifError(child.error); assert.equal(child.status, 2); assert.equal(child.stdout, '');
  assert.match(child.stderr, /scientific method is not published/); assert.equal(fs.existsSync(filename), false);
});
