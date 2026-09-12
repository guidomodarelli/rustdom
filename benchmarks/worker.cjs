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
/** Keep a bounded default and a reproducible opt-in repeated-reference workload. */
const RANGE_STRINGIFICATION_READS = { 'range-stringify-1': 1, 'range-stringify-10': 10 };
/** Each iteration executes all eight setter/selection decisions against real row nodes. */
const RANGE_BOUNDARY_ITERATIONS = 100;
/** Measure both read-heavy access and complete Range/StaticRange lifetimes through public APIs. */
const RANGE_STATE_ITERATIONS = 1000;

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
  const stringifyReads = RANGE_STRINGIFICATION_READS[name];
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
      const comparisonRoot = name.startsWith('node-') ? document.querySelector('table') : null;
      const comparisonPeer = name === 'node-equality-100' ? comparisonRoot.cloneNode(true) : null;
      const comparisonNodes = name === 'node-position-1000' ? [...comparisonRoot.querySelectorAll('tr')] : null;
      const rangeNodes = name.startsWith('range-') && !stringifyReads ? [...document.querySelectorAll('tr')] : null;
      const ranges = name === 'range-state-lifecycle-1000' ? null : rangeNodes?.map((node) => { const range = document.createRange(); range.selectNodeContents(node); return range; });
      const lastRange = ranges?.at(-1);
      const stateTextNodes = name === 'range-state-lifecycle-1000'
        ? rangeNodes.map((node) => node.firstChild.firstChild.firstChild) : null;
      const expectedStateUnits = stateTextNodes ? Array.from({ length: RANGE_STATE_ITERATIONS },
        (_, index) => stateTextNodes[index % size].length).reduce((total, length) => total + length, 0) : 0;
      const rangeComparisonMode = dom.window.Range.START_TO_START;
      const rangePointNodes = name === 'range-text-point-1000'
        ? rangeNodes.map((node) => node.firstChild.firstChild.firstChild) : rangeNodes;
      const namespaceNode = name === 'namespace-lookup-1000' ? document.querySelector('a').firstChild : null;
      const textRoot = name === 'text-content-100' || stringifyReads || name.startsWith('normalize-') ? document.querySelector('table') : null;
      const expectedText = textRoot ? Array.from({ length: size }, (_, index) => `Row ${index} & value${index}`).join('') : null;
      let consumedTextUnits = 0;
      const stringifyRange = stringifyReads ? document.createRange() : null;
      if (stringifyRange) stringifyRange.selectNodeContents(textRoot);
      if (name === 'normalize-split-text') {
        for (const anchor of document.querySelectorAll('a')) {
          let text = anchor.firstChild;
          while (text.length > 4) text = text.splitText(4);
        }
      }
      if (namespaceNode) document.querySelector('table').setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:p', 'urn:benchmark');
      global.gc?.();
      const start = performance.now();
      if (stringifyReads) {
        for (let iteration = 0; iteration < stringifyReads; iteration++) {
          result = stringifyRange.toString(); consumedTextUnits += result.length;
        }
      } else if (name === 'range-control-1000') {
        result = 0;
        for (let iteration = 0; iteration < RANGE_STATE_ITERATIONS; iteration++) {
          const copy = lastRange.cloneRange(); copy.collapse(iteration % 2 === 0);
          result += copy.compareBoundaryPoints(rangeComparisonMode, lastRange);
        }
      } else if (name === 'range-state-read-1000') {
        result = 0;
        for (let iteration = 0; iteration < RANGE_STATE_ITERATIONS; iteration++) {
          result += lastRange.startOffset + lastRange.endOffset + Number(lastRange.collapsed);
        }
      } else if (name === 'range-state-lifecycle-1000') {
        result = 0;
        for (let iteration = 0; iteration < RANGE_STATE_ITERATIONS; iteration++) {
          const text = stateTextNodes[iteration % size];
          const range = document.createRange(); range.selectNodeContents(text);
          const clone = range.cloneRange();
          const frozen = new dom.window.StaticRange({ startContainer: text, startOffset: 0,
            endContainer: text, endOffset: text.length });
          clone.setStart(text, 1);
          result += range.endOffset + clone.endOffset + frozen.endOffset +
            Number(range.startOffset === 0 && clone.startOffset === 1 && frozen.startOffset === 0);
        }
      } else if (name === 'range-boundaries-100') {
        result = 0;
        for (let iteration = 0; iteration < RANGE_BOUNDARY_ITERATIONS; iteration++) {
          const node = rangeNodes[iteration % size];
          const text = node.firstChild.firstChild.firstChild;
          lastRange.selectNode(node);
          lastRange.setStartBefore(node);
          lastRange.setEndAfter(node);
          lastRange.selectNodeContents(node);
          lastRange.setStart(text, 1);
          lastRange.setEnd(text, text.length);
          lastRange.setStartAfter(node);
          lastRange.setEndBefore(node);
          result += Number(lastRange.collapsed && lastRange.commonAncestorContainer === node.parentNode);
        }
      } else if (name === 'range-compare-1000') {
        result = 0;
        for (let iteration = 0; iteration < 1000; iteration++) {
          const range = ranges[iteration % size];
          result += lastRange.compareBoundaryPoints(rangeComparisonMode, range) - range.compareBoundaryPoints(rangeComparisonMode, lastRange);
        }
      } else if (name === 'range-point-1000' || name === 'range-text-point-1000') {
        result = 0;
        for (let iteration = 0; iteration < 1000; iteration++) {
          const node = rangePointNodes[iteration % size];
          result += lastRange.comparePoint(node, 0) + Number(lastRange.isPointInRange(node, 0)) + Number(lastRange.intersectsNode(node));
        }
      } else if (name.startsWith('normalize-')) {
        textRoot.normalize();
      } else if (name === 'text-content-100') {
        for (let iteration = 0; iteration < 100; iteration++) {
          result = textRoot.textContent;
          consumedTextUnits += result.length;
        }
      } else if (name === 'namespace-lookup-1000') {
        result = 0;
        for (let iteration = 0; iteration < 1000; iteration++) {
          result += Number(namespaceNode.lookupNamespaceURI('p') === 'urn:benchmark');
          result += Number(namespaceNode.lookupPrefix('urn:benchmark') === 'p');
          result += Number(namespaceNode.isDefaultNamespace('http://www.w3.org/1999/xhtml'));
        }
      } else if (name === 'node-equality-100') {
        result = 0;
        for (let iteration = 0; iteration < 100; iteration++) result += Number(comparisonRoot.isEqualNode(comparisonPeer));
      } else if (name === 'node-position-1000') {
        result = 0;
        for (let iteration = 0; iteration < 1000; iteration++) {
          const node = comparisonNodes[iteration % comparisonNodes.length];
          result += comparisonNodes.at(-1).compareDocumentPosition(node) + Number(comparisonRoot.contains(node));
        }
      } else if (name === 'innerHTML') {
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
      } else if (name === 'attribute-collections-100') {
        const element = document.querySelector('tr');
        let current;
        for (let iteration = 0; iteration < 100; iteration++) {
          const attribute = document.createAttributeNS('urn:benchmark', 'p:transient');
          attribute.value = `value-${iteration}`;
          element.setAttributeNodeNS(attribute);
          current = element.attributes.getNamedItemNS('urn:benchmark', 'transient');
          result = current.value;
        }
        element.removeAttributeNode(current);
      } else if (name === 'attribute-data-100') {
        const element = document.querySelector('tr');
        const attribute = document.createAttribute('data-transient');
        element.setAttributeNode(attribute);
        for (let iteration = 0; iteration < 100; iteration++) {
          attribute.value = `value-${iteration}`;
          result = element.getAttribute('data-transient');
        }
        element.removeAttributeNode(attribute);
      } else if (name === 'character-data-100') {
        const text = document.querySelector('a').firstChild;
        for (let iteration = 0; iteration < 100; iteration++) {
          text.appendData('!');
          text.replaceData(0, 1, 'R');
          result = text.substringData(0, 4);
          text.deleteData(text.length - 1, 1);
        }
      } else if (name === 'serialize-utf8') {
        result = Buffer.byteLength(dom.serialize());
      } else throw new Error(`benchmark: unsupported workload ${name}`);
      elapsed = performance.now() - start;
      assert.equal(document.querySelectorAll('tr').length, size);
      if (name === 'selectors-100') assert.equal(result.length, size);
      if (name === 'serialize-utf8') assert.ok(result > 0);
      if (name === 'character-data-100') assert.equal(result, 'Row ');
      if (name === 'attribute-data-100') assert.equal(result, 'value-99');
      if (name === 'attribute-collections-100') assert.equal(result, 'value-99');
      if (name === 'node-equality-100') assert.equal(result, 100);
      if (name === 'namespace-lookup-1000') assert.equal(result, 3000);
      if (name === 'text-content-100') {
        assert.equal(result, expectedText);
        assert.equal(consumedTextUnits, expectedText.length * 100);
      }
      if (name.startsWith('normalize-')) {
        assert.equal(textRoot.textContent, expectedText);
        for (const anchor of document.querySelectorAll('a')) {
          assert.equal(anchor.childNodes.length, 1);
          assert.equal(anchor.firstChild.nodeType, dom.window.Node.TEXT_NODE);
        }
      }
      if (name === 'node-position-1000') assert.equal(result, (1000 - Math.floor(1000 / size)) * 2 + 1000);
      if (name === 'range-compare-1000') assert.equal(result, 2 * (1000 - Math.floor(1000 / size)));
      if (name === 'range-state-read-1000') assert.equal(result, RANGE_STATE_ITERATIONS * 2);
      if (name === 'range-control-1000') {
        assert.equal(result, Math.floor(RANGE_STATE_ITERATIONS / 2));
        assert.equal(lastRange.startOffset, 0); assert.equal(lastRange.endOffset, 2); assert.equal(lastRange.collapsed, false);
      }
      if (name === 'range-state-lifecycle-1000') assert.equal(result, expectedStateUnits * 3 + RANGE_STATE_ITERATIONS);
      if (name === 'range-boundaries-100') {
        const expectedIndex = (RANGE_BOUNDARY_ITERATIONS - 1) % size;
        assert.equal(result, RANGE_BOUNDARY_ITERATIONS);
        assert.equal(lastRange.startContainer, rangeNodes[expectedIndex].parentNode);
        assert.equal(lastRange.startOffset, expectedIndex);
        assert.equal(lastRange.endOffset, expectedIndex);
        assert.equal(lastRange.toString(), '');
      }
      if (name === 'range-point-1000' || name === 'range-text-point-1000') assert.equal(result, -1000 + 3 * Math.floor(1000 / size));
      if (stringifyReads) {
        assert.equal(result, expectedText);
        assert.equal(consumedTextUnits, expectedText.length * stringifyReads);
      }
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
  const plan = [
    ...[25, 250, 1000].flatMap((size) => ['construct-native-eligible', 'innerHTML'].map((name) => ({ name, size }))),
    ...['construct-script-compatible', 'selectors-100', 'mutations-100', 'character-data-100', 'attribute-data-100',
      'attribute-collections-100', 'node-equality-100', 'node-position-1000', 'namespace-lookup-1000'].map((name) => ({ name, size: 250 })),
    ...['environment-setup', 'environment-vm-setup'].map((name) => ({ name, size: 25 })),
    { name: 'node-position-1000', size: 1000 },
    ...[250, 1000].map((size) => ({ name: 'text-content-100', size })),
    ...[250, 1000].flatMap((size) => ['normalize-split-text', 'normalize-isolated-text'].map((name) => ({ name, size }))),
    ...[250, 1000].flatMap((size) => ['range-compare-1000', 'range-point-1000', 'range-text-point-1000'].map((name) => ({ name, size }))),
    ...[250, 1000].map((size) => ({ name: 'range-boundaries-100', size })),
    ...[250, 1000].flatMap((size) => ['range-state-read-1000', 'range-state-lifecycle-1000'].map((name) => ({ name, size }))),
    ...[250, 1000].map((size) => ({ name: 'range-control-1000', size })),
    ...[250, 1000].flatMap((size) => Object.keys(RANGE_STRINGIFICATION_READS).map((name) =>
      ({ name, size, manualOnly: RANGE_STRINGIFICATION_READS[name] > 1 }))),
    ...[250, 1000].map((size) => ({ name: 'serialize-utf8', size })),
  ];
  const requested = new Set(process.argv.slice(3));
  for (const name of requested) assert.ok(plan.some((workload) => workload.name === name), `Unknown benchmark workload: ${name}`);
  const selected = plan.filter(({ name, manualOnly }) => requested.size === 0 ? !manualOnly : requested.has(name));
  for (const { name, size } of selected) workloads.push(await measure(name, size));
  const parserStatistics = runtime.getParserStatistics?.();
  const nativeTreeStatistics = runtime.getNativeTreeStatistics?.();
  if (engine === 'rustdom') {
    assert.ok(parserStatistics.nativeDocument > 0);
    if (selected.some(({ name }) => name === 'innerHTML')) assert.ok(parserStatistics.nativeFragment > 0);
    if (selected.some(({ name }) => name === 'construct-script-compatible')) assert.ok(parserStatistics.fallback['document-scripts'] > 0);
    if (nativeTreeStatistics) assert.ok(nativeTreeStatistics.mutations > 0);
  }
  process.stdout.write(JSON.stringify({ engine, warmupSamples: WARMUP_SAMPLES,
    measuredSamples: MEASURED_SAMPLES, workloads, parserStatistics, nativeTreeStatistics }));
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
