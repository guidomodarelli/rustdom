/** @module confirmation-publication-data-contracts Explicit synthetic scalar/file consistency only; never authenticates a GitHub run or enables capture. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const test = require('node:test');
const { verifyPublicationData } = require('./criterion-reader.cjs');
const { filesDigest } = require('./source.cjs');
const { hashFile } = require('../owner-batch-study/io.cjs');
const policy = require('./constants/capture.json');
const sourcePolicy = require('./constants/source.json');

/** @param {object} context - Test owner. @returns {object} Explicit synthetic data plus physical metadata files, without source/Git/run authenticity. */
function synthetic(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmation-publication-data-'));
  context.after(() => fs.rmSync(root, { recursive: true }));
  const hosted = { repository: policy.repository, workflow: policy.workflowName, jobKey: policy.jobKey,
    attempt: 1, pullRequest: policy.pullRequest, label: policy.label, runId: '1', eventHead: '0'.repeat(40) };
  const consumption = { revision: policy.revision, consumed: true, creatorJobKey: policy.prepareJobKey,
    hosted: { ...hosted, jobKey: policy.prepareJobKey }, priorNonSkippedRunIds: ['1'], priorRunIdsSha256: '1'.repeat(64),
    publicationSha256: '2'.repeat(64), methodFilesDigest: '3'.repeat(64), performanceAccepted: null, gateReevaluated: false };
  const catalog = { files: { 'synthetic-not-source.txt': '4'.repeat(64) } }; const publication = { syntheticOnly: true };
  const write = (relative, value) => fs.writeFileSync(path.join(root, relative), JSON.stringify(value) + '\n');
  write(policy.files.catalogSnapshot, catalog); write(policy.files.publicationSnapshot, publication);
  const files = { ...catalog.files, [sourcePolicy.catalog]: hashFile(path.join(root, policy.files.catalogSnapshot)) };
  consumption.publicationSha256 = hashFile(path.join(root, policy.files.publicationSnapshot));
  consumption.methodFilesDigest = filesDigest(files);
  write(policy.files.consumptionSnapshot, consumption);
  const source = { hosted, catalog, publication, consumption, profile: { currentFiles: catalog.files },
    files,
    publicationSha256: hashFile(path.join(root, policy.files.publicationSnapshot)),
    consumptionSha256: hashFile(path.join(root, policy.files.consumptionSnapshot)) };
  const index = { publicationSha256: source.publicationSha256, hosted, consumptionSha256: source.consumptionSha256, consumption };
  return { root, index, expected: { mode: policy.captureMode, source } };
}

test('metadata consistency alone grants no execution, transport or performance authority', (context) => {
  const value = synthetic(context);
  assert.equal(verifyPublicationData(value.root, value.index, value.expected), undefined);
  assert.equal(policy.executionReady, false);
});

test('a missing or changed catalog, publication or consumption file cannot retain its independent digest', (context) => {
  const value = synthetic(context);
  for (const relative of [policy.files.catalogSnapshot, policy.files.publicationSnapshot, policy.files.consumptionSnapshot]) {
    const filename = path.join(value.root, relative); const original = fs.readFileSync(filename);
    fs.unlinkSync(filename); assert.throws(() => verifyPublicationData(value.root, value.index, value.expected));
    fs.writeFileSync(filename, original); fs.appendFileSync(filename, '\n');
    assert.throws(() => verifyPublicationData(value.root, value.index, value.expected)); fs.writeFileSync(filename, original);
  }
});

test('changed hosted identity, metadata digest or consumption in the parent index is rejected', (context) => {
  const value = synthetic(context);
  for (const mutate of [
    (index) => { index.publicationSha256 = '0'.repeat(64); },
    (index) => { index.hosted.runId = '2'; },
    (index) => { index.consumption.hosted.eventHead = '1'.repeat(40); },
    (index) => { index.consumption.priorNonSkippedRunIds.push('2'); },
    (index) => { index.consumptionSha256 = '0'.repeat(64); },
  ]) {
    const changed = structuredClone(value.index); mutate(changed);
    assert.throws(() => verifyPublicationData(value.root, changed, value.expected));
  }
});
