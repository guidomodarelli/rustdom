/** @file Reproduces self and inclusive CPU time from the recorded V8 signal-burst profile. */
'use strict';
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const profilePath = 'reports/benchmarks/slot-signals-2026-09-13.cpuprofile';
const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
const benchmarkPath = 'reports/benchmarks/2026-09-13T07-13-15.624Z-linux-x64.json';
const benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8'));
const nodes = new Map(profile.nodes.map((node) => [node.id, node])); const parents = new Map();
for (const node of profile.nodes) for (const child of node.children ?? []) parents.set(child, node.id);
const groups = new Map(); let totalUs = 0;
assert.equal(profile.samples.length, profile.timeDeltas.length);
for (const [index, sample] of profile.samples.entries()) {
  const durationUs = profile.timeDeltas[index]; totalUs += durationUs; const seen = new Set();
  let cursor = sample; let leaf = true;
  while (cursor !== undefined) {
    const frame = nodes.get(cursor).callFrame; const key = `${frame.url}:${frame.functionName}`;
    if (!groups.has(key)) groups.set(key, { function: frame.functionName, url: frame.url, selfUs: 0, inclusiveUs: 0 });
    const group = groups.get(key); if (leaf) group.selfUs += durationUs;
    if (!seen.has(key)) group.inclusiveUs += durationUs;
    seen.add(key); leaf = false; cursor = parents.get(cursor);
  }
}
/** @param {object} group - Aggregated call frame. @returns {object} Millisecond and percent summaries. */
function summarize(group) {
  return { function: group.function, url: group.url, selfMs: group.selfUs / 1000,
    inclusiveMs: group.inclusiveUs / 1000, selfPercent: group.selfUs / totalUs * 100,
    inclusivePercent: group.inclusiveUs / totalUs * 100 };
}
const report = { capturedAt: new Date().toISOString(), node: process.version, profilePath,
  source: { benchmarkPath, sourceCommit: benchmark.sourceCommit, sourceHash: benchmark.sourceHash,
    nativeBinarySha256: benchmark.nativeBinarySha256 },
  profileSha256: createHash('sha256').update(readFileSync(profilePath)).digest('hex'),
  command: 'node --cpu-prof --cpu-prof-dir=reports/benchmarks --cpu-prof-name=slot-signals-2026-09-13.cpuprofile --expose-gc benchmarks/worker.cjs rustdom slot-signal-burst',
  samples: profile.samples.length, durationMs: totalUs / 1000,
  methodology: 'Sum microsecond timeDeltas by sampled leaf for self time and unique function+URL ancestors for inclusive time; repeated recursive frames count once per sample.',
  limitations: 'Includes startup, setup, warmup, timed mutations, notification delivery and GC. V8 call boundaries attribute native work to calling frames; this is not a Rust-native stack profile or an unprofiled timing comparison.',
  topSelf: [...groups.values()].sort((left, right) => right.selfUs - left.selfUs).slice(0, 20).map(summarize),
  selectedInclusive: [...groups.values()].filter((group) => [
    'assignSlotableForTree', 'assignSlotable', 'slotAssignmentPlan', 'commitSlotAssignment',
    'queueSlotSignal', 'takeSlotSignals', 'queueMutationObserverMicrotask', 'slotSignalFixture', 'measure',
  ].includes(group.function)).map(summarize) };
writeFileSync('reports/benchmarks/slot-signals-2026-09-13-profile.json', `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ durationMs: report.durationMs, topSelf: report.topSelf.slice(0, 8), selectedInclusive: report.selectedInclusive }, null, 2)}\n`);
