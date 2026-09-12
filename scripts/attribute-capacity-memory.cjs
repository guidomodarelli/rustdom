/** @file Measures transient Attr collection while their Document and owning Element remain alive. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const os = require('node:os');

/** @returns {Promise<void>} Drains finalizers after asynchronous major collections. */
async function collect() {
  for (let turn = 0; turn < 4; turn++) {
    await new Promise((resolve) => setImmediate(resolve));
    await global.gc({ type: 'major', execution: 'async' });
  }
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * @param {Document} document - Live owner document.
 * @param {Element} element - Live receiving element.
 * @param {number} batch - Unique qualified-name domain.
 * @param {number} count - Number of temporary attributes.
 * @returns {WeakRef<Attr>[]} Observations that cannot retain removed attributes.
 */
function burst(document, element, batch, count) {
  const attributes = [];
  for (let index = 0; index < count; index++) {
    const attribute = document.createAttribute(`data-${batch}-${index}`);
    attribute.value = `value-${index}-` + 'x'.repeat(1024);
    element.setAttributeNode(attribute);
    attributes.push(attribute);
  }
  for (let index = attributes.length - 1; index >= 0; index--) element.removeAttributeNode(attributes[index]);
  return attributes.map((attribute) => new WeakRef(attribute));
}

/** @param {string} mode - Real DOM implementation. @returns {Promise<object>} Memory and GC evidence. */
async function measure(mode) {
  const engine = require(mode === 'rustdom' ? '../dist/index.cjs' : 'jsdom');
  await collect();
  const initialNative = engine.getNativeTreeStatistics?.();
  let dom = new engine.JSDOM('<!doctype html><main></main><aside></aside>');
  let document = dom.window.document;
  let element = document.querySelector('main');
  let other = document.querySelector('aside');
  let original = document.createAttributeNS('urn:alias', 'p:key');
  let replacement = document.createAttributeNS('urn:alias', 'q:key');
  original.value = 'still-live';
  element.setAttributeNodeNS(original);
  element.setAttributeNodeNS(replacement);
  element.removeAttributeNode(replacement);
  other.setAttributeNodeNS(original);
  const documentReference = new WeakRef(document);
  const windowReference = new WeakRef(dom.window);
  const aliasReference = new WeakRef(original);
  for (let warmup = 0; warmup < 3; warmup++) {
    burst(document, element, -warmup - 1, 2048);
    await collect();
  }
  const baseline = { memory: process.memoryUsage(), native: engine.getNativeTreeStatistics?.() };
  const samples = [];
  for (let batch = 0; batch < 5; batch++) {
    const references = burst(document, element, batch, 2048);
    await collect();
    const survivingAttributes = references.filter((reference) => reference.deref() !== undefined).length;
    assert.equal(survivingAttributes, 0, `removed attributes survive while the owner is live in batch ${batch}`);
    assert.equal(document.querySelector('main'), element);
    assert.deepEqual(element.getAttributeNames(), []);
    assert.equal(element.getAttributeNode('p:key'), original);
    assert.equal(element.getAttribute('p:key'), 'still-live');
    assert.equal(original.ownerElement, other);
    assert.equal(replacement.ownerElement, null);
    const native = engine.getNativeTreeStatistics?.();
    if (native) {
      for (const field of ['liveNodes', 'dataNodes', 'attributeCollections', 'attributeOwners', 'attributeHolders']) {
        assert.equal(native[field], baseline.native[field], `native ${field} retained transient state`);
      }
    }
    samples.push({ batch, observedAttributes: references.length, survivingAttributes,
      memory: process.memoryUsage(), native });
  }
  const finalLiveMemory = samples.at(-1).memory;
  dom.window.close();
  dom = null; document = null; element = null; other = null; original = null; replacement = null;
  await collect();
  const survivors = { document: documentReference.deref() !== undefined,
    window: windowReference.deref() !== undefined, alias: aliasReference.deref() !== undefined };
  assert.deepEqual(survivors, { document: false, window: false, alias: false });
  const finalNative = engine.getNativeTreeStatistics?.();
  if (finalNative) {
    for (const field of ['liveNodes', 'dataNodes', 'attributeCollections', 'attributeOwners', 'attributeHolders']) {
      assert.equal(finalNative[field], initialNative[field], `native ${field} retained closed document state`);
    }
  }
  return { mode, pass: true, baseline, samples, survivors, finalNative,
    growthWhileOwnerLive: Object.fromEntries(Object.keys(finalLiveMemory).map((field) =>
      [field, finalLiveMemory[field] - baseline.memory[field]])) };
}

if (process.argv[2]) {
  measure(process.argv[2]).then((result) => process.stdout.write(JSON.stringify(result))).catch((error) => {
    process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
  });
} else {
  const report = { capturedAt: new Date().toISOString(), node: process.version,
    jsdom: require('jsdom/package.json').version,
    machine: { platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0].model },
    nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
    methodology: 'Fresh process per engine; three 2048-attribute warmups; five measured bursts of 2048 unique attributes with 1 KiB values. The same Document, Element and live legacy alias persist across all batches. Asynchronous major GC and event-loop drainage precede samples. Removed Attr wrappers must be collected before window.close. Document and Window proxy are independently observed after close.',
    limitations: 'Finite stress cannot prove absence of leaks. Heap/external/RSS are retained process observations, not peak memory. Allocator pages may remain in RSS after their Rust capacities are released; native container capacities are asserted separately in Rust tests.',
    results: [] };
  for (const mode of ['jsdom', 'rustdom']) {
    const child = spawnSync(process.execPath, ['--expose-gc', __filename, mode], {
      encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 300_000,
    });
    if (child.error) throw child.error;
    report.results.push(child.status === 0 ? JSON.parse(child.stdout) : {
      mode, pass: false, exitCode: child.status, error: child.stderr,
    });
  }
  report.pass = report.results.every((result) => result.pass);
  mkdirSync('reports/memory', { recursive: true });
  const output = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-attribute-capacity.json`;
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report.results.map((result) => ({ mode: result.mode, pass: result.pass,
    growth: result.growthWhileOwnerLive, error: result.error })), null, 2)}\nGuardado: ${output}\n`);
  if (!report.pass) process.exitCode = 1;
}
