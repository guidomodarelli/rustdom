/** @file Replays saved functional/resource evidence without running a DOM or measurement. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { isReleased } = require('../../../../scripts/memory-endpoint.cjs');
const settings = require('./constants/qualification.json');
const ownership = require('../constants/current-ownership.cjs');
const preparation = require('../constants/current-ownership-study.cjs').preparation.identity;
const references = require('../current-source-results/39921160254/original-verification.json').results;

/** Require the complete matrix, actual native baselines and every saved final resource boundary. */
function verify(filenames) {
  const totals = { windows: 0, documents: 0, cases: 0, firstUnclearStates: 0, requiredFinalClearStates: 0 };
  const outputs = new Map();
  const groups = {};
  for (const [index, filename] of filenames.entries()) {
    const evidence = JSON.parse(fs.readFileSync(filename, 'utf8'));
    assert.equal(evidence.node, ownership.nodeVersions[index]);
    assert.equal(evidence.functionalOnly, true); assert.equal(evidence.samplerExecuted, false);
    assert.equal(evidence.performanceAccepted, null); assert.equal(evidence.cases.length, 38);
    assert.deepEqual(evidence.preparationIdentity, preparation);
    const reference = references.find((entry) => entry.node === evidence.node);
    const matrix = new Set();
    const guards = new Set();
    for (const entry of evidence.cases) {
      const key = `${evidence.node}/${entry.runtime}`;
      const group = groups[key] ?? { cases: 0, windows: 0, documents: 0, firstUnclearStates: 0,
        requiredFinalClearStates: 0, memoryRangesBytes: {}, nativeClassLiveValues: entry.runtime === 'rustdom' ? [] : null };
      const baseline = entry.nativeBaseline ?? undefined;
      if (entry.runtime === 'rustdom') assert.ok(baseline && entry.endpoint.state.nativeTree, 'Shared fixture evidence: native baseline is required');
      else { assert.equal(entry.runtime, 'jsdom'); assert.equal(baseline, undefined); }
      assert.equal(entry.windows, 1); assert.equal(entry.documents, 1);
      assert.equal(entry.endpoint.reached, true); assert.equal(entry.endpoint.requiredClearSamples, 2);
      assert.deepEqual(entry.endpoint.state.survivors, { window: 0, document: 0 });
      assert.equal(isReleased(entry.endpoint.state, baseline), true);
      assert.ok(entry.endpoint.trace.length >= entry.endpoint.requiredClearSamples);
      for (const state of entry.endpoint.trace) assert.equal(state.clear, isReleased(state, baseline));
      for (const state of entry.endpoint.trace.slice(-entry.endpoint.requiredClearSamples)) {
        assert.equal(state.clear, true); assert.equal(isReleased(state, baseline), true);
        assert.deepEqual(state.survivors, { window: 0, document: 0 });
        group.requiredFinalClearStates++;
      }
      group.cases++; group.windows++; group.documents++;
      group.firstUnclearStates += Number(!entry.endpoint.trace[0].clear);
      for (const state of entry.endpoint.trace) for (const [name, value] of Object.entries(state.memory)) {
        assert.ok(Number.isFinite(value) && value >= 0, 'Shared fixture evidence: invalid memory observation');
        const range = group.memoryRangesBytes[name] ?? { min: value, max: value };
        range.min = Math.min(range.min, value); range.max = Math.max(range.max, value); group.memoryRangesBytes[name] = range;
      }
      if (group.nativeClassLiveValues) group.nativeClassLiveValues.push(entry.endpoint.state.nativeTree.napiClasses.live);
      if (entry.output) {
        assert.ok(ownership.rows.includes(entry.key));
        assert.equal(entry.output.publicOutputHash, reference.summaries.AA.find((row) => row.key === entry.key).outputHash);
        assert.ok(Number.isInteger(entry.cycle) && entry.cycle >= 0 && entry.cycle < settings.cyclesPerRow);
        const identity = `${entry.runtime}/${entry.key}/${entry.cycle}`;
        assert.equal(matrix.has(identity), false); matrix.add(identity);
        if (outputs.has(entry.key)) assert.deepEqual(entry.output, outputs.get(entry.key)); else outputs.set(entry.key, entry.output);
      } else {
        assert.ok(['validation-error', 'unsupported-delivery', 'cancelled-delivery'].includes(entry.key));
        const identity = `${entry.runtime}/${entry.key}`;
        assert.equal(guards.has(identity), false); guards.add(identity);
      }
      groups[key] = group;
    }
    for (const runtime of ['jsdom', 'rustdom']) for (const key of ownership.rows) for (let cycle = 0; cycle < settings.cyclesPerRow; cycle++) {
      assert.ok(matrix.has(`${runtime}/${key}/${cycle}`), 'Shared fixture evidence: missing canonical matrix case');
    }
    for (const runtime of ['jsdom', 'rustdom']) for (const key of ['validation-error', 'unsupported-delivery', 'cancelled-delivery']) assert.ok(guards.has(`${runtime}/${key}`));
  }
  assert.equal(filenames.length, 2);
  for (const group of Object.values(groups)) {
    assert.equal(group.cases, 19);
    for (const name of Object.keys(totals)) totals[name] += group[name];
    if (group.nativeClassLiveValues) group.nativeClassLiveValues = [...new Set(group.nativeClassLiveValues)];
  }
  assert.equal(totals.windows, 76); assert.equal(totals.documents, 76);
  assert.equal(totals.requiredFinalClearStates, 152);
  return { functionalOnly: true, performanceAccepted: null, samplerExecuted: false, verified: true,
    totals, groups, outputs: Object.fromEntries(outputs),
    limits: ['Observaciones finitas tras GC; no representan memoria pico ni ausencia universal de fugas',
      'Fixtures candidatos y warmup original; todavía sin integrar al sampler de rendimiento congelado',
      'La identidad compartida de métodos no demuestra estabilidad de tiering ni de rendimiento'] };
}
if (require.main === module) {
  assert.equal(process.argv.length, 5, 'Provide Node22 evidence, Node24 evidence and a new output JSON');
  assert.ok(!fs.existsSync(process.argv[4]), 'Shared fixture evidence: preserve the existing output');
  const result = verify(process.argv.slice(2, 4));
  fs.writeFileSync(process.argv[4], JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ verified: result.verified, totals: result.totals, performanceAccepted: null }));
}
module.exports = { verify };
