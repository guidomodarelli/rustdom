/** @file Aggregates sampled V8 CPU time by function and URL without attributing inclusive totals additively. */
'use strict';
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const profilePath = process.argv[2]; assert.ok(profilePath, 'Provide a .cpuprofile path');
const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
const nodes = new Map(profile.nodes.map((node) => [node.id, node])); const parents = new Map();
for (const node of profile.nodes) for (const child of node.children ?? []) parents.set(child, node.id);
const groups = new Map(); let durationUs = 0;
assert.equal(profile.samples.length, profile.timeDeltas.length);
for (const [index, sample] of profile.samples.entries()) {
  const sampleUs = profile.timeDeltas[index]; durationUs += sampleUs; const seen = new Set();
  let cursor = sample; let leaf = true;
  while (cursor !== undefined) {
    const frame = nodes.get(cursor).callFrame; const key = `${frame.url}:${frame.functionName}`;
    if (!groups.has(key)) groups.set(key, { function: frame.functionName, url: frame.url, selfUs: 0, inclusiveUs: 0 });
    const group = groups.get(key); if (leaf) group.selfUs += sampleUs;
    if (!seen.has(key)) group.inclusiveUs += sampleUs;
    seen.add(key); leaf = false; cursor = parents.get(cursor);
  }
}
/** @param {object} group - Microsecond totals. @returns {object} Human-readable milliseconds and percentages. */
const summarize = (group) => ({ function: group.function, url: group.url, selfMs: group.selfUs / 1000,
  inclusiveMs: group.inclusiveUs / 1000, selfPercent: group.selfUs / durationUs * 100, inclusivePercent: group.inclusiveUs / durationUs * 100 });
const report = { profilePath, profileSha256: createHash('sha256').update(readFileSync(profilePath)).digest('hex'),
  samples: profile.samples.length, durationMs: durationUs / 1000,
  methodology: 'Sum microsecond timeDeltas at leaves for self time; count each function+URL once per sample for inclusive time. Inclusive totals overlap. Native work is attributed to V8 call boundaries, not Rust-native stack frames.',
  topSelf: [...groups.values()].sort((left, right) => right.selfUs - left.selfUs).slice(0, 25).map(summarize),
  producer: [...groups.values()].filter((group) => /mutation|native-tree/i.test(group.url)).sort((left, right) => right.inclusiveUs - left.inclusiveUs).map(summarize) };
const output = profilePath.replace(/\.cpuprofile$/, '-analysis.json'); assert.notEqual(output, profilePath);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output, durationMs: report.durationMs, topSelf: report.topSelf.slice(0, 8), producer: report.producer.slice(0, 18) }, null, 2)}\n`);
