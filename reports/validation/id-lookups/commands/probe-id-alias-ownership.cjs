'use strict';
const fs = require('node:fs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require(process.argv[2] + '/scripts/memory-endpoint.cjs');
const root = process.argv[2];
const engines = { jsdom: require(root + '/node_modules/jsdom'), rustdom: require(root + '/dist/index.cjs') };
function fixture(runtime, namespace) {
  const { window } = new runtime.JSDOM('<!doctype html><body>');
  const document = window.document;
  const parent = document.createElement('section'); document.head.append(parent);
  const element = document.createElementNS(namespace, 'entry'); parent.append(element);
  element.setAttributeNS('urn:foreign-id-attribute', 'id', 'foreign-id');
  const registered = document.getElementById('foreign-id') === element;
  element.remove(); const missingAfterRemoval = document.getElementById('foreign-id') === null;
  const observed = { windows: [new WeakRef(window)], documents: [new WeakRef(document)],
    roots: [new WeakRef(parent)], elements: [new WeakRef(element)] };
  window.close();
  const exposedByWindow = window['foreign-id'] === element;
  return { window, document, parent, observed, registered, missingAfterRemoval, exposedByWindow };
}
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, cases: [] };
  for (const [engine, runtime] of Object.entries(engines)) for (const namespace of ['http://www.w3.org/1999/xhtml', 'http://www.w3.org/2000/svg', 'urn:foreign-element']) {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics?.();
    const sample = fixture(runtime, namespace);
    for (let round = 0; round < 4; round++) await collectGarbage();
    const held = captureMemoryState(sample.observed, runtime);
    sample.window = null; sample.document = null; sample.parent = null;
    const released = await waitForMemoryQuiescence({ label: `id-alias-${engine}-${namespace}-released`,
      sample: () => captureMemoryState(sample.observed, runtime), expectedNative: baseline });
    report.cases.push({ engine, namespace, registered: sample.registered, missingAfterRemoval: sample.missingAfterRemoval, exposedByWindow: sample.exposedByWindow,
      retainedElementWithDocumentHeld: held.survivors.elements, nativeIndexWhileHeld: held.nativeTree?.documentIds, released });
  }
  const path = root + '/reports/validation/id-lookups/alias-ownership-probe.json';
  fs.writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.cases.map(({ engine, namespace, registered, missingAfterRemoval, exposedByWindow, retainedElementWithDocumentHeld, nativeIndexWhileHeld, released }) =>
    ({ engine, namespace, registered, missingAfterRemoval, exposedByWindow, retainedElementWithDocumentHeld, nativeIndexWhileHeld, released: released.reached }))));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
