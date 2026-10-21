/** @file Observes controller, callback and DOM lifetimes across real serialization, failures and held serializers. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('./memory-endpoint.cjs');
const { XML_SERIALIZER_MEMORY_SCENARIO: SCENARIO, XML_SERIALIZER_MEMORY_SCENARIOS: SCENARIOS,
  XML_SERIALIZER_MEMORY_REALMS: REALMS, XML_SERIALIZER_MEMORY_CYCLES: CYCLES,
  XML_SERIALIZER_HELD_COLLECTION_ROUNDS: HELD_ROUNDS, XML_SERIALIZER_MEMORY_DOCUMENT: DOCUMENT } = require('./constants/xml-serializer-controller-memory.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @returns {object} A retained result whose methods cannot capture any fixture owner. */
function independentReplacement() { return { replace() { global.gc(); return this; } }; }

/** @param {object} runtime - Real engine. @param {string} realm - Actual scripting profile. @param {string} scenario - Finite operation. @returns {object} Weak observations and an explicit caller-owned holder. */
function fixture(runtime, realm, scenario) {
  const dom = new runtime.JSDOM(DOCUMENT, { contentType: 'text/xml', ...(realm === 'default' ? {} : { runScripts: realm }) });
  const { window } = dom, document = window.document, root = document.documentElement;
  const serializer = new window.XMLSerializer(), text = document.createTextNode('text'); root.append(text);
  const observed = { windows: [new WeakRef(window)], documents: [new WeakRef(document)],
    nodes: [new WeakRef(root), new WeakRef(text)], serializers: [new WeakRef(serializer)], errors: [], callbacks: [] };
  let held;
  try {
    if (scenario === SCENARIO.success || scenario === SCENARIO.heldSerializer) {
      const output = serializer.serializeToString(root); assert.equal(output, '<root>text</root>');
      held = scenario === SCENARIO.heldSerializer ? serializer : output;
    } else if (scenario === SCENARIO.dynamic) {
      const replacement = independentReplacement(), read = () => replacement;
      observed.callbacks.push(new WeakRef(read));
      Object.defineProperty(text, 'data', { get: read });
      held = serializer.serializeToString(text); assert.equal(held, replacement);
    } else {
      const secondary = new Error('message getter failed'); secondary.node = root;
      const inner = document.createElement('inner'); observed.nodes.push(new WeakRef(inner));
      const failure = { node: root, get message() {
        global.gc();
        if (scenario === SCENARIO.messageThrow) throw secondary;
        if (scenario === SCENARIO.messageReentrant) assert.equal(serializer.serializeToString(inner), '<inner/>');
        return 'serializer getter failed';
      } };
      observed.errors.push(new WeakRef(failure), new WeakRef(secondary));
      const read = () => { global.gc(); throw failure; }; observed.callbacks.push(new WeakRef(read));
      Object.defineProperty(root, 'nodeType', { get: read });
      let caught = false;
      try { serializer.serializeToString(root); }
      catch (error) {
        caught = true; observed.errors.push(new WeakRef(error));
        if (scenario === SCENARIO.messageThrow) assert.equal(error, secondary);
        else assert.ok(error instanceof window.DOMException);
      }
      assert.equal(caught, true);
    }
    const statistics = runtime.getNativeTreeStatistics?.();
    if (statistics) {
      assert.equal(statistics.xmlSerializerOperations.active, 0);
      assert.equal(statistics.xmlSerialization.live, 0); assert.equal(statistics.xmlSerialization.references, 0);
      assert.equal(statistics.xmlSerialization.cleanupErrors, 0);
    }
    return { held, observed };
  } finally { dom.window.close(); }
}

/** @returns {Promise<void>} Preserve every held/released phase and bounded collector observation. */
async function main() {
  assert.equal(typeof global.gc, 'function', 'XMLSerializer controller analysis requires --expose-gc');
  const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version,
    nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
    methodology: 'One warmup per engine/realm, then three cycles of six scenarios. Preserve primitive/dynamic outputs while checking owner collection; observe held serializer before dropping it. Require separate Window/Document/serializer/callback/error collection and exact native lifetime baselines. Runs real default, outside-only and dangerously realms.',
    limitations: 'Finite cycles on one host. Report records intentionally retained results and allocator RSS; it does not establish universal leak absence or peak process memory.', cases: [], pass: false };
  mkdirSync('reports/memory', { recursive: true });
  const file = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-xml-serializer-controller.json`;
  const save = () => writeFileSync(file, JSON.stringify(report, null, 2) + '\n'); save();
  try {
    for (const [engine, runtime] of Object.entries(engines)) for (const realm of REALMS) {
      await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.();
      const warmup = fixture(runtime, realm, SCENARIO.success);
      const warmed = await waitForMemoryQuiescence({ label: `${engine}/${realm}/warmup`, sample: () => captureMemoryState(warmup.observed, runtime), expectedNative: baseline });
      report.cases.push({ engine, realm, phase: 'warmup', endpoint: warmed }); assert.equal(warmed.reached, true); save();
      for (let cycle = 0; cycle < CYCLES; cycle++) for (const scenario of SCENARIOS) {
        const sample = fixture(runtime, realm, scenario);
        if (scenario === SCENARIO.heldSerializer) {
          for (let round = 0; round < HELD_ROUNDS; round++) await collectGarbage();
          const held = captureMemoryState(sample.observed, runtime);
          assert.equal(held.survivors.windows, 1); assert.equal(held.survivors.serializers, 1);
          report.cases.push({ engine, realm, scenario, cycle, phase: 'held', state: held }); sample.held = null;
        }
        const endpoint = await waitForMemoryQuiescence({ label: `${engine}/${realm}/${scenario}/${cycle}/released`,
          sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
        report.cases.push({ engine, realm, scenario, cycle, phase: 'released', endpoint }); assert.equal(endpoint.reached, true);
        if (scenario === SCENARIO.dynamic) assert.equal(sample.held.replace(), sample.held);
        save();
      }
    }
    report.pass = true; save(); console.log(JSON.stringify({ file, cases: report.cases.length, pass: true }));
  } catch (error) { report.failure = { message: error.message, stack: error.stack }; save(); throw error; }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
