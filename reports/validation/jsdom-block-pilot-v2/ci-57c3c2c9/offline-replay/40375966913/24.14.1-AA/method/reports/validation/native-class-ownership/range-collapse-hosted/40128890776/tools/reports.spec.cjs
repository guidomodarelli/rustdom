/** @file Replays a genuine hosted report and rejects altered parity, execution and coverage while preserving shared regressions. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verifyWpt, verifyHtml } = require('./verify-reports.cjs');
const settings = require('./constants/testing.json');
const repository = path.resolve(__dirname, '../../../../../..');
const wpt = JSON.parse(fs.readFileSync(process.env[settings.wptInputEnvironment], 'utf8'));
const html = JSON.parse(fs.readFileSync(process.env[settings.htmlInputEnvironment], 'utf8'));

/** @returns {object} A small mutable row copy; original hosted observations stay unchanged. */
function changedFirstRow() {
  return { ...wpt, results: [structuredClone(wpt.results[0]), ...wpt.results.slice(1)] };
}

test('the genuine full hosted report preserves all assertions and the published incomplete standards scope', () => {
  const result = verifyWpt(repository, wpt);
  assert.equal(result.fixtures, 240); assert.equal(result.assertions, 83007);
  assert.equal(result.sharedNonpassCount, 1203); assert.equal(result.complete, false);
  assert.deepEqual(result.excludedFixtures, wpt.excludedFixtures); assert.deepEqual(result.blockedSuites, wpt.blockedSuites);
  assert.equal(result.standardsCertifiedComplete, false); assert.equal(result.performanceAccepted, null);
});

test('a changed candidate result cannot borrow the declared pass flag', () => {
  const report = changedFirstRow(); report.results[0].actual.tests[0].status = 1;
  assert.throws(() => verifyWpt(repository, report), { code: 'ERR_ASSERTION' });
});

test('an incomplete reference harness stays a failure even if individual assertions match', () => {
  const report = changedFirstRow(); report.results[0].expected.status = 2;
  assert.throws(() => verifyWpt(repository, report), { code: 'ERR_ASSERTION' });
});

test('a signalled fixture process cannot be represented as a successful comparison', () => {
  const report = changedFirstRow(); report.results[0].execution.candidate.signal = 'SIGKILL';
  assert.throws(() => verifyWpt(repository, report), { code: 'ERR_ASSERTION' });
});

test('an omitted fixture cannot keep the full coverage claim', () => {
  assert.throws(() => verifyWpt(repository, { ...wpt, results: wpt.results.slice(0, -1) }), { code: 'ERR_ASSERTION' });
});

test('new shared nonpasses remain visible and do not certify standards or performance', () => {
  const report = changedFirstRow();
  for (const role of ['actual', 'expected']) {
    report.results[0][role].tests[0].status = 1;
    report.results[0][role].tests[0].message = 'New shared diagnostic in owned JSON fixture';
  }
  const result = verifyWpt(repository, report);
  assert.equal(result.sharedNonpassCount, 1204); assert.equal(result.sharedNonpassCountMatchesLocal, false);
  assert.equal(result.standardsCertifiedComplete, false); assert.equal(result.performanceAccepted, null);
});

test('the real HTML differential report keeps parser fallbacks and scripting exclusions intact', () => {
  const result = verifyHtml(html);
  assert.equal(result.passed, 1784); assert.equal(result.excludedScriptOn, 8);
  assert.deepEqual(result.parserStatistics, html.parserStatistics); assert.deepEqual(result.mismatches, []);
  assert.throws(() => verifyHtml({ ...html, mismatches: [{ case: 'changed input' }] }), { code: 'ERR_ASSERTION' });
});
