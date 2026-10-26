'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = process.argv[2];
const expectedCommit = process.argv[3];
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(), expectedCommit);
const pilot = path.join(root, 'reports/benchmarks/native-class-ownership/control-precision/pilot-v2');
const source = require(path.join(pilot, 'capture/source.cjs'));
const policy = require(path.join(pilot, 'constants/capture.json'));
const {expectation} = require(path.join(pilot, 'capture/expectation.cjs'));
const origin = source.producer('capture');
assert.equal(origin.sourceCommit, expectedCommit);
assert.equal(origin.sourceChangesRaw, '');
assert.deepEqual(origin.sourceGitErrors, []);
assert.equal(Object.keys(origin.files).length, 903);
assert.equal(origin.publication.completeMethodReview, true);
assert.equal(process.env[policy.consumptionEnvironment], undefined);
assert.equal(process.env[policy.consumptionDigestEnvironment], undefined);
assert.throws(() => expectation('capture', process.version + '/AA/jsdom/mutation-records-collect/100'),
  (error) => error.code === 'ERR_ASSERTION' && error.actual === 'undefined' && error.expected === 'string');
process.stdout.write(JSON.stringify({sourceCommit: origin.sourceCommit, sourceChangesRaw: origin.sourceChangesRaw,
  sourceGitErrors: origin.sourceGitErrors, sourceFiles: Object.keys(origin.files).length,
  sourceIsPublished: true, reviewedSourceAdmitted: true, missingControllerRejected: true,
  DOMExecuted: false, scientificCaptureExecuted: false, node: process.version,
  performanceAccepted: null, gateReevaluated: false}) + '\n');
