/** @file Profiles complete public dataset mutations after setup, without mixing correctness checks into samples. */
'use strict';
const assert = require('node:assert/strict');
const { Session } = require('node:inspector');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { cpus } = require('node:os');
const { datasetFixture } = require('./dom-string-map.cjs');
const runtime = require('../dist/index.cjs');
/** Large canonical collections expose repeated work within the native mutation boundary. */
const ATTRIBUTE_COUNT = 1000;
const PROFILE_ROUNDS = 20;
const WARMUP_ROUNDS = 3;
const SAMPLING_INTERVAL_US = 100;

/** @returns {Promise<void>} Save raw V8 boundary samples for mutation attribution, separately from benchmarks. */
async function main() {
  const session = new Session(); session.connect();
  /** @param {string} method - Inspector operation. @param {object} [params] - Arguments. @returns {Promise<object>} Inspector response. */
  const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (error, response) => error ? reject(error) : resolve(response)));
  mkdirSync('reports/benchmarks', { recursive: true });
  try {
    await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: SAMPLING_INTERVAL_US });
    for (const name of ['dataset-write', 'dataset-delete']) {
      const { window } = new runtime.JSDOM('<!doctype html><body>');
      try {
        for (let round = 0; round < WARMUP_ROUNDS; round++) { const fixture = datasetFixture(runtime, window, ATTRIBUTE_COUNT, name); fixture.validate(fixture.run()); }
        const fixtures = Array.from({ length: PROFILE_ROUNDS }, () => datasetFixture(runtime, window, ATTRIBUTE_COUNT, name));
        const results = []; await new Promise((resolve) => setImmediate(resolve)); global.gc?.();
        const capturedAt = new Date().toISOString(); const prefix = `reports/benchmarks/${capturedAt.replaceAll(':', '-')}-attributes-${name}`;
        const parserBefore = structuredClone(runtime.getParserStatistics());
        await post('Profiler.start');
        for (const fixture of fixtures) results.push(fixture.run());
        const { profile } = await post('Profiler.stop');
        const parserAfter = runtime.getParserStatistics();
        assert.deepEqual(parserAfter, parserBefore, 'dataset mutations must not be attributed to parsing');
        for (const [index, fixture] of fixtures.entries()) fixture.validate(results[index]);
        const report = { capturedAt, node: process.version, cpu: cpus()[0].model, workload: name,
          attributes: ATTRIBUTE_COUNT, rounds: PROFILE_ROUNDS, warmup: WARMUP_ROUNDS, samplingIntervalUs: SAMPLING_INTERVAL_US,
          sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
          sourceSha256: createHash('sha256').update(readFileSync(__filename)).digest('hex'),
          parserActivity: { before: parserBefore, after: parserAfter },
          methodology: 'All owners and attributes are prepared before sampling; warmups also precede sampling. Profile only public dataset mutations and checksum accumulation. Validate every result after Profiler.stop. Native time is attributed to V8 call boundaries, not Rust stack frames; use separate benchmark for before/after comparisons.' };
        writeFileSync(`${prefix}.cpuprofile`, JSON.stringify(profile)); writeFileSync(`${prefix}.json`, `${JSON.stringify(report, null, 2)}\n`);
        execFileSync(process.execPath, ['benchmarks/analyze-cpu-profile.cjs', `${prefix}.cpuprofile`], { stdio: 'inherit' });
      } finally { window.close(); }
    }
  } finally { session.disconnect(); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
