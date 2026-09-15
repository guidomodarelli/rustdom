/** @file Observes XML parser buffers, retained result data, partial documents and closed realms independently. */
'use strict';
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { NativeXmlParser } = require('../../dist/native.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');

/** @param {boolean} malformed - Whether construction fails after creating a partial tree. @returns {object} Weak observations after closing the captured real window. */
function closedXml(malformed) {
  let window;
  try {
    new runtime.JSDOM(malformed ? '<r><a><![CDATA[x]]></wrong>' : '<r xmlns:p="urn:p"><p:a><![CDATA[x]]></p:a></r>',
      { contentType: 'text/xml', beforeParse(created) { window = created; } });
    assert.equal(malformed, false);
  } catch (error) { assert.equal(malformed, true); assert.equal(error.name, 'SyntaxError'); }
  const observed = { documents: [new WeakRef(window.document)], windows: [new WeakRef(window)], nodes: [new WeakRef(window.document.documentElement)] };
  window.close(); return observed;
}
/** @returns {object} Result values retained while the live native parser itself becomes unreachable. */
function retainedEvent() {
  const parser = new NativeXmlParser('<r a="kept">' + '<a>'.repeat(1000) + 'data' + '</a>'.repeat(1000) + '</r>', false);
  const declarations = Array.from({ length: 1000 }, (_, index) => `<!ENTITY e${index} "value${index}">`).join('');
  assert.equal(parser.applyDoctypeEntities(declarations), 1000);
  const event = parser.next(); const observed = { parsers: [new WeakRef(parser)] };
  return { event, observed };
}
/** @returns {Promise<void>} Save five GC cycles with raw quiescence observations. */
async function main() {
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: false, cycles: [] };
  try {
    await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
    for (let cycle = 0; cycle < 5; cycle++) {
      const observed = closedXml(cycle % 2 === 1); const retained = retainedEvent();
      const released = await waitForMemoryQuiescence({ label: `xml-${cycle}`,
        sample: () => captureMemoryState({ ...observed, ...retained.observed }, runtime), expectedNative: baseline });
      assert.equal(released.reached, true); assert.equal(retained.event.tag.attributes[0].value, 'kept');
      report.cycles.push(released);
    }
    report.pass = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  mkdirSync('reports/memory', { recursive: true }); const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-xml-parser.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ pass: report.pass, cycles: report.cycles.length, path, error: report.error })}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
