/** @file Profiles real mutation production after setup/warmup and preserves the raw V8 CPU profile. */
'use strict';
const assert = require('node:assert/strict');
const { Session } = require('node:inspector');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { cpus } = require('node:os');
const { execFileSync } = require('node:child_process');
const runtime = require('../dist/index.cjs');
/** Bound retained fixture nodes while collecting enough producer samples. */
const BATCH_COUNT = 20;
const GROUPS_PER_BATCH = 1000;
const SAMPLING_INTERVAL_US = 100;

/** @returns {Promise<void>} Captures attribute, Text and child-list production with real takeRecords calls. */
async function main() {
  const dom = new runtime.JSDOM('<main></main>'); const document = dom.window.document; const host = document.querySelector('main');
  const text = host.appendChild(document.createTextNode('initial'));
  const observer = new dom.window.MutationObserver(() => {});
  const options = { attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true, childList: true, subtree: true };
  observer.observe(host, options);
  for (let index = 0; index < GROUPS_PER_BATCH; index++) { host.setAttribute('data-profile', String(index)); text.data = String(index); host.append(document.createElement('b')); }
  assert.equal(observer.takeRecords().length, GROUPS_PER_BATCH * 3);
  observer.disconnect(); host.replaceChildren(text);
  const batches = Array.from({ length: BATCH_COUNT }, () => Array.from({ length: GROUPS_PER_BATCH }, () => document.createElement('b')));
  observer.observe(host, options);
  await new Promise((resolve) => setImmediate(resolve)); global.gc?.();
  const session = new Session(); session.connect();
  /** @param {string} method - Inspector command. @param {object} [params] - Protocol parameters. @returns {Promise<object>} Inspector response. */
  const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
  const capturedAt = new Date().toISOString(); const prefix = `reports/benchmarks/${capturedAt.replaceAll(':', '-')}-mutation-producer`;
  mkdirSync('reports/benchmarks', { recursive: true });
  try {
    await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: SAMPLING_INTERVAL_US }); await post('Profiler.start');
    for (const [batch, children] of batches.entries()) {
      for (const [index, child] of children.entries()) {
        const value = String(batch * GROUPS_PER_BATCH + index);
        host.setAttribute('data-profile', value); text.data = value; host.appendChild(child);
      }
      assert.equal(observer.takeRecords().length, GROUPS_PER_BATCH * 3);
      await new Promise((resolve) => setImmediate(resolve));
    }
    const { profile } = await post('Profiler.stop');
    assert.equal(host.childNodes.length, BATCH_COUNT * GROUPS_PER_BATCH + 1);
    assert.equal(host.lastChild, batches.at(-1).at(-1)); assert.equal(text.data, String(BATCH_COUNT * GROUPS_PER_BATCH - 1));
    const report = { capturedAt, node: process.version, jsdom: require('jsdom/package.json').version, cpu: cpus()[0].model,
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
      workloadSourceSha256: createHash('sha256').update(readFileSync(__filename)).digest('hex'),
      batches: BATCH_COUNT, groupsPerBatch: GROUPS_PER_BATCH, expectedRecords: BATCH_COUNT * GROUPS_PER_BATCH * 3,
      samplingIntervalUs: SAMPLING_INTERVAL_US,
      methodology: 'Setup, node allocation and warmup precede profiling. Profile includes complete public attribute/Text/append mutations, takeRecords assertions and an event-loop turn per batch that releases job-kept references and processes empty notification batches. It is sampled CPU evidence, not an isolated Rust function benchmark or wall-time comparison.' };
    writeFileSync(`${prefix}.cpuprofile`, JSON.stringify(profile)); writeFileSync(`${prefix}.json`, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ profile: `${prefix}.cpuprofile`, metadata: `${prefix}.json`, samples: profile.samples.length })}\n`);
  } finally { session.disconnect(); observer.disconnect(); dom.window.close(); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
