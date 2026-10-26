/** @file Measures real attribute reads, retained primitive outputs and Attr ownership with separate Document/Window endpoints. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync, readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('./memory-endpoint.cjs');
const { WINDOWS_PER_BATCH, MEASURED_CYCLES } = require('./constants/collection-query-memory.cjs');
const { ATTRIBUTES_PER_OWNER, ATTRIBUTE_READ_CYCLES, LONG_ATTRIBUTE_VALUE_UNITS } = require('./constants/attribute-reads-memory.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

/** @param {object} runtime - Real engine. @param {string} realm - Owner realm. @returns {object} Strong synchronous fixture. */
function fixture(runtime, realm) {
  const { window } = new runtime.JSDOM('<!doctype html><body>', realm === 'vm' ? { runScripts: 'outside-only' } : {});
  const document = window.document; const element = document.createElement('section'); document.head.append(element);
  for (let index = 0; index < ATTRIBUTES_PER_OWNER; index++) element.setAttributeNS(index % 2 === 0 ? null : 'urn:attribute-memory',
    index % 2 === 0 ? `key-${index}` : `p:key-${index}`, index === 0 ? '\ud800\0'.repeat(LONG_ATTRIBUTE_VALUE_UNITS / 2) : `value-${index}`);
  const attributes = [...element.attributes];
  for (let cycle = 0; cycle < ATTRIBUTE_READ_CYCLES; cycle++) {
    const attribute = attributes[cycle % attributes.length];
    attribute.value = `changed-${cycle}\ud800\0`;
    assert.equal(element.getAttribute(attribute.name), attribute.value);
    assert.equal(element.getAttributeNS(attribute.namespaceURI, attribute.localName), attribute.value);
    assert.equal(element.hasAttribute(attribute.name), true);
    assert.equal(element.hasAttributeNS(attribute.namespaceURI, attribute.localName), true);
    assert.equal(element.getAttribute(`missing-${cycle}`), null);
    assert.equal(element.hasAttributeNS('urn:missing', `missing-${cycle}`), false);
  }
  attributes[0].value = '\ud800\0'.repeat(LONG_ATTRIBUTE_VALUE_UNITS / 2);
  return { window, document, element, attributes };
}

/** @param {object} context - Strong synchronous owner. @returns {object} Weak references only. */
function observe(context) {
  return { windows: [new WeakRef(context.window)], documents: [new WeakRef(context.document)],
    elements: [new WeakRef(context.element)], attributes: context.attributes.map((attribute) => new WeakRef(attribute)) };
}

/** @param {object} runtime - Real engine. @param {string} realm - Realm. @returns {object} Closed owners with no strong references escaping. */
function batch(runtime, realm) {
  const groups = { windows: [], documents: [], elements: [], attributes: [] };
  for (let index = 0; index < WINDOWS_PER_BATCH; index++) {
    const context = fixture(runtime, realm);
    try { for (const [name, references] of Object.entries(observe(context))) groups[name].push(...references); }
    finally { context.window.close(); }
  }
  return groups;
}

/** @param {object} runtime - Real engine. @param {string} realm - Realm. @param {string} retention - Primitive output or live Attr. @returns {object} Explicit held result and otherwise weak owners. */
function retained(runtime, realm, retention) {
  const context = fixture(runtime, realm);
  try {
    return { held: retention === 'primitive' ? context.element.getAttribute('key-0') : context.attributes[0],
      groups: observe(context) };
  } finally { context.window.close(); }
}

/** @returns {Promise<void>} Preserve every bounded release trace, including failures. */
async function main() {
  assert.equal(typeof global.gc, 'function', 'Attribute read memory analysis requires --expose-gc');
  const report = { capturedAt: new Date().toISOString(), node: process.version, reference: require('jsdom/package.json').version,
    nativeBinarySha256: createHash('sha256').update(readFileSync('dist/rustdom.node')).digest('hex'),
    methodology: 'One warmup and three measured batches per engine/realm, twelve windows and 32 Attrs per owner, 64 read/mutate/miss cycles per owner. Separate retained-primitive and retained-Attr scenarios. Explicit major GC and two clear endpoint samples; every Document, Window, Element and Attr is observed separately, together with all native lifetime counters. Native result strings are retained while owner collection is checked.',
    limitations: 'Finite lifetime scenarios; RSS includes allocator retention. These checks do not prove absence of all possible leaks or measure peak memory.',
    cases: [], pass: false };
  mkdirSync('reports/memory', { recursive: true });
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-attribute-reads.json`;
  const save = () => writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
  try {
    for (const [engine, runtime] of Object.entries(engines)) for (const realm of ['default', 'vm']) {
      await collectGarbage(); const expectedNative = runtime.getNativeTreeStatistics?.();
      for (let cycle = 0; cycle <= MEASURED_CYCLES; cycle++) {
        const groups = batch(runtime, realm);
        const endpoint = await waitForMemoryQuiescence({ label: `${engine}/${realm}/batch-${cycle}`,
          sample: () => captureMemoryState(groups, runtime), expectedNative });
        report.cases.push({ engine, realm, kind: cycle === 0 ? 'warmup' : 'measured', cycle, endpoint }); save();
        assert.equal(endpoint.reached, true, endpoint.label);
      }
      for (const retention of ['primitive', 'attribute']) {
        const sample = retained(runtime, realm, retention);
        if (retention === 'primitive') {
          const endpoint = await waitForMemoryQuiescence({ label: `${engine}/${realm}/held-primitive`,
            sample: () => captureMemoryState(sample.groups, runtime), expectedNative });
          assert.equal(sample.held, '\ud800\0'.repeat(LONG_ATTRIBUTE_VALUE_UNITS / 2));
          report.cases.push({ engine, realm, kind: 'held-primitive', endpoint }); save();
          assert.equal(endpoint.reached, true, endpoint.label);
        } else {
          await collectGarbage();
          assert.equal(sample.held.ownerElement, sample.groups.elements[0].deref());
          assert.equal(sample.held.ownerDocument, sample.groups.documents[0].deref());
          report.cases.push({ engine, realm, kind: 'held-attribute', state: captureMemoryState(sample.groups, runtime) }); save();
        }
        sample.held = null;
        const endpoint = await waitForMemoryQuiescence({ label: `${engine}/${realm}/released-${retention}`,
          sample: () => captureMemoryState(sample.groups, runtime), expectedNative });
        report.cases.push({ engine, realm, kind: `released-${retention}`, endpoint }); save();
        assert.equal(endpoint.reached, true, endpoint.label);
      }
    }
    report.pass = true;
  } finally { save(); console.log(`Guardado: ${path}`); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
