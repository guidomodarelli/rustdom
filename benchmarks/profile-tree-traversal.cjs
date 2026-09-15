/** @file Profiles public traversal scans after setup and retains raw V8 samples for attribution. */
'use strict';
const { Session } = require('node:inspector');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { cpus } = require('node:os');
const { traversalFixture } = require('./tree-traversal.cjs');
const runtime = require('../dist/index.cjs');
const ROW_COUNT = 1000;
const PROFILE_SCANS = 30;
const WARMUP_SCANS = 3;
const SAMPLING_INTERVAL_US = 100;

/** @returns {Promise<void>} Samples both cursor types with and without actual filters. */
async function main() {
  const dom = new runtime.JSDOM('<table><tbody>' + '<tr><td>A</td><td>B</td></tr>'.repeat(ROW_COUNT) + '</tbody></table>');
  const session = new Session(); session.connect();
  /** @param {string} method - Inspector method. @param {object} [params] - Parameters. @returns {Promise<object>} Inspector response. */
  const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
  mkdirSync('reports/benchmarks', { recursive: true });
  try {
    await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: SAMPLING_INTERVAL_US });
    for (const name of ['iterator-scan', 'iterator-filter', 'walker-scan', 'walker-filter']) {
      const fixture = traversalFixture(runtime, dom.window, ROW_COUNT, name);
      for (let index = 0; index < WARMUP_SCANS; index++) { fixture.prepare(); fixture.validate(fixture.run()); }
      await new Promise((resolve) => setImmediate(resolve)); global.gc?.();
      const capturedAt = new Date().toISOString(); const prefix = `reports/benchmarks/${capturedAt.replaceAll(':', '-')}-traversal-${name}`;
      await post('Profiler.start');
      for (let index = 0; index < PROFILE_SCANS; index++) {
        fixture.prepare(); fixture.validate(fixture.run());
        await new Promise((resolve) => setImmediate(resolve));
      }
      const { profile } = await post('Profiler.stop');
      const report = { capturedAt, node: process.version, cpu: cpus()[0].model, workload: name,
        rows: ROW_COUNT, scans: PROFILE_SCANS, samplingIntervalUs: SAMPLING_INTERVAL_US,
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
        sourceSha256: createHash('sha256').update(readFileSync(__filename)).digest('hex'),
        methodology: 'Setup and warmup precede sampling. Profile includes cursor creation, scans, identity/callback validation and a yielded turn per scan. Native work is attributed to V8 boundaries; this is diagnostic evidence, not an isolated Rust timing or the end-to-end comparison benchmark.' };
      writeFileSync(`${prefix}.cpuprofile`, JSON.stringify(profile)); writeFileSync(`${prefix}.json`, `${JSON.stringify(report, null, 2)}\n`);
      process.stdout.write(`${JSON.stringify({ profile: `${prefix}.cpuprofile`, samples: profile.samples.length })}\n`);
    }
  } finally { session.disconnect(); dom.window.close(); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
