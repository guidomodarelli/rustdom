/** @file Measures complete parser and normal wholeText operations with untimed correctness checks. */
'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { cpus, totalmem, platform, arch, release } = require('node:os');
const { runtimeEntry, nativeBinaryPath, runtimeRoot } = require('./runtime.cjs');
const { captureSourceIdentity } = require('./sources.cjs');
const { WARMUP_SAMPLES, MEASURED_SAMPLES, OPERATIONS_PER_SAMPLE,
  ADJACENT_TEXT_COUNT, BASELINE_UNDEFINED_MESSAGE, HTML_MARKUP, XML_MARKUP, SCENARIOS } = require('./constants/dom-parser.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require(runtimeEntry) };

/**
 * Prepare owners outside timing and validate every retained result after the loop.
 * @param {object} runtime - Actual engine, optionally a historical package.
 * @param {string} scenario - Complete public operation to measure.
 * @returns {object} Timed run, untimed validation and mandatory cleanup.
 */
function fixture(runtime, scenario) {
  let dom = new runtime.JSDOM('');
  let parser = new dom.window.DOMParser();
  let results = [];
  const baseline = runtime.getNativeTreeStatistics?.().domParserOperations?.calls;
  let text;
  let parents;
  if (scenario === 'xml-undefined') {
    const owner = parser[Object.getOwnPropertySymbols(parser).find((symbol) => symbol.description === 'impl')];
    const original = owner.createScriptingDisabledDocument;
    let calls = 0;
    owner.createScriptingDisabledDocument = function (...args) {
      if (++calls % 2 === 1) throw 42;
      return Reflect.apply(original, this, args);
    };
  } else if (scenario === 'whole-text') {
    const parent = dom.window.document.createElement('group');
    for (let index = 0; index < ADJACENT_TEXT_COUNT; index++) parent.append(dom.window.document.createTextNode('a'));
    text = parent.lastChild;
  } else if (scenario === 'normalize') {
    parents = Array.from({ length: OPERATIONS_PER_SAMPLE }, () => {
      const parent = dom.window.document.createElement('group');
      for (let index = 0; index < ADJACENT_TEXT_COUNT; index++) parent.append(dom.window.document.createTextNode('a'));
      return parent;
    });
  }
  return {
    /** @returns {void} Consume all outputs of the same operation count. */
    run() {
      for (let index = 0; index < OPERATIONS_PER_SAMPLE; index++) {
        if (scenario === 'whole-text') results.push(text.wholeText);
        else if (scenario === 'normalize') { parents[index].normalize(); results.push(parents[index]); }
        else results.push(parser.parseFromString(scenario === 'html' ? HTML_MARKUP
          : scenario === 'xml-malformed' ? '<root>' : XML_MARKUP,
        scenario === 'html' ? 'text/html' : 'text/xml'));
      }
    },
    /** @returns {void} Check complete structures and native activation outside the timed interval. */
    validate() {
      assert.equal(results.length, OPERATIONS_PER_SAMPLE);
      for (const result of results) {
        if (scenario === 'whole-text') assert.equal(result, 'a'.repeat(ADJACENT_TEXT_COUNT));
        else if (scenario === 'normalize') {
          assert.equal(result.childNodes.length, 1);
          assert.equal(result.firstChild.data, 'a'.repeat(ADJACENT_TEXT_COUNT));
        }
        else if (scenario === 'html') assert.equal(result.querySelector('main p').textContent, 'text & more');
        else if (scenario === 'xml') {
          assert.equal(result.documentElement.namespaceURI, 'urn:root');
          assert.equal(result.documentElement.textContent, 'text & more');
        } else {
          assert.equal(result.documentElement.localName, 'parsererror');
          if (scenario === 'xml-undefined') assert.equal(result.documentElement.firstChild.data, undefined);
          else assert.ok(result.documentElement.textContent.length > 0);
        }
      }
      if (baseline !== undefined && scenario !== 'whole-text' && scenario !== 'normalize') {
        assert.ok(runtime.getNativeTreeStatistics().domParserOperations.calls > baseline);
      }
    },
    /** @returns {void} Release the result array, parser and realm even when historical recovery fails. */
    dispose() { results = null; parser = null; text = null; parents = null; dom.window.close(); dom = null; },
  };
}

const report = { capturedAt: new Date().toISOString(), node: process.version,
  oracle: require('jsdom/package.json').version, hardware: { cpu: cpus()[0].model,
    cores: cpus().length, totalMemory: totalmem(), platform: platform(), arch: arch(), release: release() },
  runtimeRoot, nativeBinarySha256: createHash('sha256').update(readFileSync(nativeBinaryPath)).digest('hex'),
  source: captureSourceIdentity(runtimeRoot),
  harnessSha256: createHash('sha256').update(readFileSync(__filename)).update(readFileSync(require.resolve('./constants/dom-parser.cjs'))).digest('hex'),
  warmupSamples: WARMUP_SAMPLES, measuredSamples: MEASURED_SAMPLES, operationsPerSample: OPERATIONS_PER_SAMPLE,
  adjacentTextCount: ADJACENT_TEXT_COUNT, cases: [],
  methodology: 'Separate invocations for historical/candidate packages. Time complete public parseFromString or wholeText calls, including the Rust/JS bridge and output creation. Setup, validation of every output, teardown and optional explicit GC are outside timing. Retain outputs through validation. Store all warmup/raw measurements. An unsupported historical undefined-recovery operation has no timing and cannot be used as a speed comparison. Single-host measurements do not prove a general performance improvement.' };
for (const [engine, runtime] of Object.entries(engines)) for (const scenario of SCENARIOS) {
  const observation = { engine, scenario, supported: true, warmupMs: [], samplesMs: [] };
  for (let sample = -WARMUP_SAMPLES; sample < MEASURED_SAMPLES; sample++) {
    if (global.gc) global.gc();
    const prepared = fixture(runtime, scenario);
    try {
      const started = performance.now();
      prepared.run();
      const durationMs = performance.now() - started;
      prepared.validate();
      (sample < 0 ? observation.warmupMs : observation.samplesMs).push(durationMs);
    } catch (error) {
      if (sample === -WARMUP_SAMPLES && engine === 'rustdom' && scenario === 'xml-undefined'
          && process.env.RUSTDOM_BENCHMARK_PACKAGE && error.name === 'Error' && error.message === BASELINE_UNDEFINED_MESSAGE) {
        observation.supported = false;
        observation.error = { name: error.name, message: error.message };
        break;
      }
      throw error;
    } finally { prepared.dispose(); }
  }
  report.cases.push(observation);
}
mkdirSync('reports/benchmarks/dom-parser', { recursive: true });
const path = `reports/benchmarks/dom-parser/${report.capturedAt.replaceAll(':', '-')}-${process.version}.json`;
writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ path, cases: report.cases.length, node: report.node })}\n`);
