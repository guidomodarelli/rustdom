/** @file Measures equivalent end-to-end DOM workloads in one isolated runtime process. */
'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');

/** Select a real implementation, never a benchmark-specific stand-in. */
const engine = process.argv[2];
if (!['jsdom', 'rustdom'].includes(engine)) throw new Error('benchmark: engine must be jsdom or rustdom');
/** Load dependencies before measurement; cold module startup is explicitly excluded. */
const runtime = engine === 'jsdom' ? require('jsdom') : require('../dist/index.cjs');
/** Warm both JIT and parser before collecting independent samples. */
const WARMUP_SAMPLES = 3;
/** Keep raw samples so noise and distributions remain inspectable. */
const MEASURED_SAMPLES = 9;

/**
 * Build reproducible HTML with attributes, decoded entities, and table insertion modes.
 * @param {number} size - Number of data rows.
 * @returns {string} Identical input for both implementations.
 */
function fixture(size) {
  return '<!doctype html><html><head><title>Benchmark</title></head><body><table>' +
    Array.from({ length: size }, (_, index) =>
      `<tr class="row" data-index="${index}"><td><a href="/row/${index}">Row ${index} &amp; value</a></td><td>${index}</td></tr>`).join('') +
    '</table></body></html>';
}

/**
 * Measure one complete public operation; setup and assertions stay outside the timer.
 * @param {string} name - Workload name, including its configuration.
 * @param {number} size - Fixture row count.
 * @returns {Promise<object>} Raw milliseconds and post-cleanup memory snapshots.
 */
async function measure(name, size) {
  const html = fixture(size);
  const environment = name.startsWith('environment-')
    ? engine === 'jsdom' ? (await import('vitest/runtime')).builtinEnvironments.jsdom
      : (await import('../src/environments/vitest.mjs')).default
    : null;
  const samplesMs = [];
  const memory = [];
  let outputHash;
  for (let sample = 0; sample < WARMUP_SAMPLES + MEASURED_SAMPLES; sample++) {
    let dom;
    let elapsed;
    let result;
    let cleanup;
    let target;
    if (environment) {
      target = { setTimeout, clearTimeout, setInterval, clearInterval,
        Request: globalThis.Request, Response: globalThis.Response, URL: globalThis.URL,
        AbortController: globalThis.AbortController, AbortSignal: globalThis.AbortSignal };
      global.gc?.();
      const start = performance.now();
      const session = name === 'environment-vm-setup'
        ? await environment.setupVM({ jsdom: { html, runScripts: 'outside-only' } })
        : await environment.setup(target, { jsdom: { html, runScripts: 'outside-only' } });
      if (name === 'environment-vm-setup') target = session.getVmContext();
      dom = target.jsdom;
      elapsed = performance.now() - start;
      cleanup = () => session.teardown(target);
      assert.equal(dom.window.document.querySelectorAll('tr').length, size);
    } else if (name.startsWith('construct')) {
      const options = name === 'construct-script-compatible' ? { runScripts: 'dangerously' } : {};
      global.gc?.();
      const start = performance.now();
      dom = new runtime.JSDOM(html, options);
      elapsed = performance.now() - start;
      assert.equal(dom.window.document.querySelectorAll('tr').length, size);
    } else {
      dom = new runtime.JSDOM(name === 'innerHTML' ? '<!doctype html><body>' : html);
      const document = dom.window.document;
      global.gc?.();
      const start = performance.now();
      if (name === 'innerHTML') {
        document.body.innerHTML = html.slice(html.indexOf('<table>'), html.indexOf('</body>'));
      } else if (name === 'selectors-100') {
        for (let iteration = 0; iteration < 100; iteration++) {
          result = document.querySelectorAll('table > tbody > tr.row[data-index] a');
        }
      } else if (name === 'mutations-100') {
        for (let iteration = 0; iteration < 100; iteration++) {
          const element = document.createElement('div');
          element.textContent = 'new content';
          document.body.appendChild(element);
          element.setAttribute('data-value', 'updated');
          element.remove();
        }
      } else if (name === 'serialize-utf8') {
        result = Buffer.byteLength(dom.serialize());
      } else throw new Error(`benchmark: unsupported workload ${name}`);
      elapsed = performance.now() - start;
      assert.equal(document.querySelectorAll('tr').length, size);
      if (name === 'selectors-100') assert.equal(result.length, size);
      if (name === 'serialize-utf8') assert.ok(result > 0);
    }
    assert.equal(dom.window.document.querySelector('a').textContent, 'Row 0 & value');
    const checksum = createHash('sha256').update(dom.serialize()).digest('hex');
    if (outputHash) assert.equal(checksum, outputHash);
    outputHash = checksum;
    result = null;
    if (cleanup) await cleanup();
    else dom.window.close();
    cleanup = null;
    target = null;
    dom = null;
    // Let pending DOM readiness callbacks release references before the next GC.
    await new Promise((resolve) => setImmediate(resolve));
    global.gc?.();
    if (sample >= WARMUP_SAMPLES) {
      samplesMs.push(elapsed);
      memory.push(process.memoryUsage());
    }
  }
  return { name, rows: size, inputBytes: Buffer.byteLength(html), outputHash, samplesMs, memoryAfterCleanup: memory };
}

/**
 * Execute public workloads and prove the native route was exercised when expected.
 * @returns {Promise<void>} Writes one structured result to stdout.
 */
async function main() {
  const workloads = [];
  for (const size of [25, 250, 1000]) {
    for (const name of ['construct-native-eligible', 'innerHTML']) workloads.push(await measure(name, size));
  }
  for (const name of ['construct-script-compatible', 'selectors-100', 'mutations-100']) {
    workloads.push(await measure(name, 250));
  }
  for (const name of ['environment-setup', 'environment-vm-setup']) workloads.push(await measure(name, 25));
  for (const size of [250, 1000]) workloads.push(await measure('serialize-utf8', size));
  const parserStatistics = runtime.getParserStatistics?.();
  const nativeTreeStatistics = runtime.getNativeTreeStatistics?.();
  if (engine === 'rustdom') {
    assert.ok(parserStatistics.nativeDocument > 0);
    assert.ok(parserStatistics.nativeFragment > 0);
    assert.ok(parserStatistics.fallback['document-scripts'] > 0);
    if (nativeTreeStatistics) assert.ok(nativeTreeStatistics.mutations > 0);
  }
  process.stdout.write(JSON.stringify({ engine, warmupSamples: WARMUP_SAMPLES,
    measuredSamples: MEASURED_SAMPLES, workloads, parserStatistics, nativeTreeStatistics }));
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
