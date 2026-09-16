/** @file Profiles actual Selection calls after warmup; preserves raw V8 samples and checks every result outside sampling. */
'use strict';
const { Session } = require('node:inspector');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { createHash } = require('node:crypto');
const { cpus } = require('node:os');
const { selectionFixture } = require(resolve('benchmarks/selection.cjs'));
const runtime = require(resolve('dist/index.cjs'));
/** Diagnostic sampling plan; timing comparisons live in the separate benchmark report. */
const plan = { operations: 20000, warmups: 3, warmupOperations: 1000, samplingIntervalUs: 100,
  workloads: ['selection-read', 'selection-associate', 'selection-stringify'] };
/** @returns {Promise<void>} Profiles public operations and verifies the same fixture used by comparison benchmarks. */
async function main() {
  const dom = new runtime.JSDOM('<body></body>');
  const session = new Session(); session.connect();
  /** @param {string} method - Inspector method. @param {object} [params] - Parameters. @returns {Promise<object>} Inspector result. */
  const post = (method, params = {}) => new Promise((resolveResult, reject) =>
    session.post(method, params, (error, result) => error ? reject(error) : resolveResult(result)));
  mkdirSync('reports/benchmarks', { recursive: true });
  const metadata = JSON.parse(readFileSync('reports/validation/selection-on-668/source-copy.json', 'utf8'));
  try {
    await post('Profiler.enable');
    await post('Profiler.setSamplingInterval', { interval: plan.samplingIntervalUs });
    for (const workload of plan.workloads) {
      for (let index = 0; index < plan.warmups; index++) {
        const warmup = selectionFixture(runtime, dom.window, plan.warmupOperations, workload);
        warmup.validate(warmup.run()); await warmup.dispose();
      }
      const fixture = selectionFixture(runtime, dom.window, plan.operations, workload);
      await new Promise((resolveResult) => setImmediate(resolveResult)); global.gc();
      const capturedAt = new Date().toISOString();
      const prefix = `reports/benchmarks/${capturedAt.replaceAll(':', '-')}-${workload}`;
      await post('Profiler.start');
      const result = fixture.run();
      const { profile } = await post('Profiler.stop');
      fixture.validate(result); await fixture.dispose();
      writeFileSync(`${prefix}.cpuprofile`, JSON.stringify(profile));
      writeFileSync(`${prefix}.json`, JSON.stringify({ capturedAt, node: process.version, cpu: cpus()[0].model,
        workload, plan, base: metadata.base, sourceHash: metadata.expected.sourceHash,
        nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
        profilerSha256: createHash('sha256').update(readFileSync(__filename)).digest('hex'),
        pass: true, samples: profile.samples.length,
        methodology: 'Setup, warmup, result validation and task drainage are outside sampling. Captures public Selection operations and their native crossings. V8 attributes native work to JS call boundaries; this is diagnostic evidence, not Rust stack attribution or a timing comparison. Other validation work may run on this host; use the separate isolated benchmark for speed claims.' }, null, 2) + '\n');
      process.stdout.write(JSON.stringify({ profile: `${prefix}.cpuprofile`, samples: profile.samples.length })+'\n');
    }
  } finally { session.disconnect(); dom.window.close(); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
