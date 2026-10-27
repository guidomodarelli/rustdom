/** @module owner-batch-dispersion-verification Independently checks Python's archived-data moments; never executes DOM or accepts performance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const policy = require('./constants/diagnostic.json');

/** @param {number} actual - Calculated or serialized diagnostic. @param {number} expected - Independent reference. @returns {void} Numerical agreement only; this tolerance is never a performance budget. */
function close(actual, expected) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected));
  assert.ok(Math.abs(actual - expected) <= policy.numericVerificationTolerance * Math.max(1, Math.abs(expected)),
    `Dispersion verification: ${actual} differs from ${expected}`);
}

/** @param {number[]} values - Positive finite durations or finite moment values. @returns {number} Ordinary mean, independent of Python statistics. */
const mean = (values) => values.reduce((total, value) => total + value, 0) / values.length;
/** @param {number[]} values - Two or more numerical values. @returns {number} Two-pass unbiased sample variance. */
function variance(values) {
  assert.ok(values.length > 1);
  const average = mean(values);
  return values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
}
/** @param {number[]} samples - The nine measured historical durations in original order. @returns {object} Independently calculated process moments. */
function processMoments(samples) {
  assert.equal(samples.length, policy.measuredSpansPerProcess);
  assert.ok(samples.every((value) => Number.isFinite(value) && value > 0));
  const third = samples.length / 3;
  return { meanMs: mean(samples), sampleVarianceMsSquared: variance(samples),
    firstLastThirdChangePercent: 100 * (mean(samples.slice(-third)) / mean(samples.slice(0, third)) - 1) };
}
/** @param {object} input - One process or group. @returns {string} Complete factor identity without ambiguous delimiters. */
const groupKey = (input) => JSON.stringify([input.node, input.phase, input.engine, input.label, input.row]);
/** @param {string} filename - Caller-selected data file. @returns {Buffer} Bounded regular bytes. */
function bytes(filename) {
  const status = fs.lstatSync(filename);
  assert.ok(status.isFile() && status.nlink === 1 && status.size <= policy.inputLimitBytes);
  return fs.readFileSync(filename);
}
/** @param {string} filename - Official currently executing SDK binary. @returns {string} Bounded-buffer fingerprint. */
function executableHash(filename) {
  const status = fs.statSync(filename);
  assert.ok(status.isFile() && status.size <= policy.executableLimitBytes);
  const buffer = Buffer.allocUnsafe(policy.hashChunkBytes);
  const descriptor = fs.openSync(filename, 'r');
  const digest = createHash('sha256');
  try {
    let offset = 0;
    while (offset < status.size) {
      const count = fs.readSync(descriptor, buffer, 0, Math.min(buffer.length, status.size - offset), offset);
      assert.ok(count > 0); digest.update(buffer.subarray(0, count)); offset += count;
    }
  } finally { fs.closeSync(descriptor); }
  return digest.digest('hex');
}
/** @param {Buffer} content - Authenticated export in its fixed quoted scalar schema; these pinned fields are JSON-compatible. @returns {Map} Every actual span in its original process order. */
function sourceSpans(content) {
  const lines = content.toString('utf8').split(/\r?\n/);
  assert.equal(lines.pop(), '');
  assert.deepEqual(JSON.parse('[' + lines.shift() + ']'), policy.spanColumns);
  const result = new Map();
  for (const line of lines) {
    const fields = JSON.parse('[' + line + ']');
    assert.equal(fields.length, policy.spanColumns.length);
    assert.ok(fields.every((field) => typeof field === 'string'));
    const row = Object.fromEntries(policy.spanColumns.map((name, index) => [name, fields[index]]));
    const key = JSON.stringify([groupKey({ ...row, row: row.name + '/' + row.size }), Number(row.position)]);
    if (!result.has(key)) result.set(key, { pid: Number(row.pid), physical: row.physical,
      outputHash: row.outputHash, spans: [] });
    const record = result.get(key);
    assert.equal(Number(row.span), record.spans.length);
    assert.equal(row.stage, record.spans.length < policy.warmupSpansPerProcess ? 'warmup' : 'measured');
    record.spans.push(Number(row.durationMs));
  }
  return result;
}
/** @param {number[]} values - Nonempty finite observations. @returns {number} Ordinary descriptive median. */
function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
/** @param {string} repository - Current Git source containing immutable historical inputs. @param {string} filename - Python diagnostic data. @returns {object} Verification evidence only, with no gate decision. */
function verify(repository, filename) {
  assert.ok(policy.nodes.includes(process.version));
  const executableSha256 = executableHash(process.execPath);
  assert.equal(executableSha256, policy.runtimeExecutableHashes[process.version]);
  const inputs = {};
  for (const [name, identity] of Object.entries(policy.inputs)) {
    const content = bytes(path.join(repository, identity.path));
    assert.equal(content.length, identity.bytes);
    assert.equal(createHash('sha256').update(content).digest('hex'), identity.sha256);
    inputs[name] = name === 'spans' ? sourceSpans(content) : JSON.parse(content);
  }
  const diagnostic = JSON.parse(bytes(filename));
  assert.equal(diagnostic.revision, policy.revision);
  assert.deepEqual(diagnostic.inputs, policy.inputs);
  for (const name of ['measurementExecuted', 'DOMExecuted', 'archivedCodeExecuted', 'resampled', 'gateReevaluated', 'executionReady']) {
    assert.equal(diagnostic[name], false);
  }
  assert.equal(diagnostic.performanceAccepted, null);
  assert.equal(diagnostic.historicalPerformanceAccepted, false);
  assert.equal(inputs.decision.performanceAccepted, false);
  assert.equal(inputs.decision.captureAuthenticated, true);
  assert.equal(inputs.decision.complete, true);
  const original = inputs.decision.payload.comparison.results;
  assert.equal(diagnostic.processes.length, policy.processes);
  const grouped = new Map();
  const processKeys = new Set();
  for (const record of diagnostic.processes) {
    assert.ok(policy.nodes.includes(record.node) && policy.phases.includes(record.phase));
    assert.ok(policy.engines.includes(record.engine) && policy.labels.includes(record.label) && policy.rows.includes(record.row));
    assert.ok(Number.isInteger(record.position) && record.position >= 0 && record.position < policy.pairsPerComparison);
    assert.equal(record.warmupMs.length, policy.warmupSpansPerProcess);
    assert.ok(record.warmupMs.every((value) => Number.isFinite(value) && value > 0));
    const key = groupKey(record);
    const processKey = JSON.stringify([key, record.position]);
    assert.ok(!processKeys.has(processKey)); processKeys.add(processKey);
    const source = inputs.spans.get(processKey); assert.ok(source);
    assert.equal(record.pid, source.pid); assert.equal(record.physical, source.physical);
    assert.equal(record.outputHash, source.outputHash);
    assert.deepEqual(record.warmupMs, source.spans.slice(0, policy.warmupSpansPerProcess));
    assert.deepEqual(record.samplesMs, source.spans.slice(policy.warmupSpansPerProcess));
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
    for (const [name, expected] of Object.entries(processMoments(record.samplesMs))) close(record[name], expected);
    const reference = original.find((result) => result.node === record.node && result.phase === record.phase &&
      result.engine === record.engine && result.key === record.row);
    assert.ok(reference);
    close(record.meanMs, reference.processPairs[record.position][record.label === 'A' ? 'baselineMeanMs' : 'candidateMeanMs']);
  }
  assert.equal(inputs.spans.size, policy.processes);
  assert.equal(grouped.size, policy.groups);
  assert.equal(diagnostic.groups.length, policy.groups);
  const groupKeys = new Set();
  for (const group of diagnostic.groups) {
    const key = groupKey(group); assert.ok(!groupKeys.has(key)); groupKeys.add(key);
    const selected = grouped.get(key); assert.ok(selected);
    assert.equal(selected.length, policy.pairsPerComparison);
    const average = mean(selected.map((record) => record.meanMs));
    const within = mean(selected.map((record) => record.sampleVarianceMsSquared));
    const between = variance(selected.map((record) => record.meanMs));
    const contribution = within / policy.measuredSpansPerProcess;
    assert.equal(group.processes, policy.pairsPerComparison);
    assert.equal(group.spansPerProcess, policy.measuredSpansPerProcess);
    for (const [name, expected] of Object.entries({ meanMs: average,
      meanWithinProcessVarianceMsSquared: within, processMeansVarianceMsSquared: between,
      withinVarianceDividedBySpanCountMsSquared: contribution, signedMomentContrastMsSquared: between - contribution,
      pooledWithinCVPercent: 100 * Math.sqrt(within) / average,
      processMeansCVPercent: 100 * Math.sqrt(between) / average,
      meanFirstLastThirdChangePercent: mean(selected.map((record) => record.firstLastThirdChangePercent)) })) close(group[name], expected);
    if (between === 0) assert.equal(group.withinToMeansVarianceRatio, null);
    else close(group.withinToMeansVarianceRatio, contribution / between);
  }
  assert.equal(diagnostic.measuredSpans, policy.measuredSpans);
  assert.equal(diagnostic.warmupSpans, policy.warmupSpans);
  assert.equal(diagnostic.historicalCriteriaPassed, inputs.analysis.passed);
  assert.equal(diagnostic.historicalCriteriaFailed, inputs.analysis.failed);
  assert.equal(diagnostic.summary.negativeSignedMomentContrasts,
    diagnostic.groups.filter((group) => group.signedMomentContrastMsSquared < 0).length);
  const controls = inputs.analysis.results.filter((result) => result.engine === 'jsdom');
  const jsdomGroups = diagnostic.groups.filter((group) => group.engine === 'jsdom');
  const expectedSummary = { jsdomCriteria: controls.length,
    jsdomCriteriaRejected: controls.filter((result) => !result.passesBudget).length,
    jsdomPointsOutsideBudget: controls.filter((result) => Math.abs(result.pointChangePercent) > policy.controlBudgetPercent).length,
    medianJsdomIntervalWidthPercent: median(controls.map((result) => result.upperChangePercent - result.lowerChangePercent)),
    medianJsdomPooledWithinCVPercent: median(jsdomGroups.map((group) => group.pooledWithinCVPercent)),
    medianJsdomProcessMeansCVPercent: median(jsdomGroups.map((group) => group.processMeansCVPercent)) };
  for (const [name, expected] of Object.entries(expectedSummary)) close(diagnostic.summary[name], expected);
  return { verified: true, node: process.version, executableSha256, processes: processKeys.size,
    groups: groupKeys.size, measuredSpans: policy.measuredSpans, warmupSpans: policy.warmupSpans,
    historicalMeansMatched: processKeys.size, measurementExecuted: false, DOMExecuted: false,
    performanceAccepted: null, gateReevaluated: false };
}

if (require.main === module) {
  assert.equal(process.argv.length, 4, 'Dispersion verification: provide repository and diagnostic JSON');
  console.log(JSON.stringify(verify(...process.argv.slice(2))));
}
module.exports = { verify, processMoments, variance };
