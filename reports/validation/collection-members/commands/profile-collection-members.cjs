/** Capture a real prepared public collection read loop, excluding setup/validation/cleanup. */
'use strict';
const assert = require('node:assert/strict');
const { Session } = require('node:inspector');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require(process.cwd() + '/dist/index.cjs');
const { collectionQueryFixture } = require(process.cwd() + '/benchmarks/collection-queries.cjs');
const session = new Session();
const post = (name) => new Promise((resolve, reject) => session.post(name, (error, result) => error ? reject(error) : resolve(result)));

async function main() {
  const { window } = new runtime.JSDOM('<!doctype html><body>');
  const fixture = collectionQueryFixture(runtime, window, 1000, 'collection-class-cached');
  try {
    fixture.validate(fixture.run());
    session.connect(); await post('Profiler.enable'); await post('Profiler.start');
    let checksum = 0;
    for (let repetition = 0; repetition < 10; repetition++) checksum += fixture.run();
    const { profile } = await post('Profiler.stop'); session.disconnect();
    assert.equal(checksum, 10 * 100 * 501); fixture.validate(checksum / 10);
    const nodes = new Map(profile.nodes.map((node) => [node.id, node.callFrame]));
    const counts = new Map();
    for (const id of profile.samples || []) {
      const frame = nodes.get(id); const key = `${frame.functionName} ${frame.url}:${frame.lineNumber + 1}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const label = process.argv[2] || 'before';
    mkdirSync('reports/benchmarks/collection-members', { recursive: true });
    writeFileSync(`reports/benchmarks/collection-members/profile-${label}.cpuprofile`, JSON.stringify(profile) + '\n');
    const summary = { node: process.version, label, reads: 1000, samples: profile.samples.length,
      elapsedProfilerUs: profile.endTime - profile.startTime,
      top: [...counts].sort((left, right) => right[1] - left[1]).slice(0, 20),
      methodology: 'Real cached public HTMLCollection length/item loop after fixture warmup; CPU sampling starts after setup and stops before validation/cleanup. Profiler overhead applies. Samples diagnose call paths, not an unprofiled benchmark speedup.' };
    writeFileSync(`reports/benchmarks/collection-members/profile-${label}.json`, JSON.stringify(summary, null, 2) + '\n');
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } finally { fixture.dispose(); window.close(); }
}
main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
