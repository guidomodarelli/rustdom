/** @file Replays current resource and WPT comparison contracts; no archived code or DOM is executed. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { verifyMemory } = require('./verify-memory.cjs');
const policy = require('./constants/transport.json');

/**
 * Verify every saved WPT result using the unchanged, narrowly normalized comparison contract.
 * @param {string} repository - Current reviewed source checkout.
 * @param {object} report - Original WPT result JSON from the authenticated artifact.
 * @returns {object} Coverage, original exclusions and shared nonpasses without standards certification.
 */
function verifyWpt(repository, report) {
  const comparison = path.join(repository, policy.comparisonPath);
  assert.equal(createHash('sha256').update(fs.readFileSync(comparison)).digest('hex'), policy.comparisonSha256);
  const { assertWptParity } = require(comparison);
  assert.equal(report.jsdom, policy.referenceVersion); assert.equal(report.wptRevision, policy.wptRevision);
  assert.equal(report.pass, true); assert.equal(report.results.length, policy.expected.wptFixtures);
  const files = new Set(); let assertions = 0; const sharedNonpasses = [];
  for (const row of report.results) {
    assert.ok(!files.has(row.file)); files.add(row.file); assert.equal(row.pass, true);
    assertWptParity(row.file, row.actual, row.expected);
    assertions += row.actual.tests.length;
    for (const entry of row.actual.tests) if (entry.status !== 0) sharedNonpasses.push({ file: row.file, ...entry });
    for (const [role, engine] of [['reference', 'jsdom'], ['candidate', 'rustdom']]) {
      const execution = row.execution[role];
      assert.equal(execution.engine, engine); assert.equal(execution.node, report.node);
      assert.equal(execution.exitCode, 0); assert.equal(execution.signal, null);
    }
  }
  assert.equal(assertions, policy.expected.wptAssertions);
  return { node: report.node, fixtures: files.size, assertions, parityVerified: true,
    complete: report.complete, excludedFixtures: report.excludedFixtures, blockedSuites: report.blockedSuites,
    sharedNonpassCount: sharedNonpasses.length, sharedNonpasses,
    sharedNonpassCountMatchesLocal: sharedNonpasses.length === policy.expected.wptSharedNonpasses,
    standardsCertifiedComplete: false, performanceAccepted: null };
}

/**
 * Preserve the published differential HTML scope and native/fallback observations.
 * @param {object} report - Original saved corpus result.
 * @returns {object} Unmodified report after public differential checks.
 */
function verifyHtml(report) {
  assert.equal(report.oracle, 'jsdom ' + policy.referenceVersion); assert.equal(report.revision, policy.htmlRevision);
  assert.equal(report.total, policy.expected.htmlTotal); assert.equal(report.excludedScriptOn, policy.expected.htmlExcluded);
  assert.equal(report.passed + report.excludedScriptOn, report.total); assert.deepEqual(report.mismatches, []);
  return report;
}
if (require.main === module) {
  assert.equal(process.argv.length, 6, 'Provide reviewed repository and original memory, WPT and HTML JSON paths');
  const [repository, memory, wpt, html] = process.argv.slice(2).map((value) => path.resolve(value));
  const read = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
  const result = { memory: verifyMemory(repository, read(memory)), wpt: verifyWpt(repository, read(wpt)), html: verifyHtml(read(html)),
    collectorExecutedDOM: false, performanceAccepted: null, gateReevaluated: false };
  assert.equal(result.memory.node, result.wpt.node); assert.equal(result.html.node, result.wpt.node);
  console.log(JSON.stringify(result));
}
module.exports = { verifyWpt, verifyHtml };
