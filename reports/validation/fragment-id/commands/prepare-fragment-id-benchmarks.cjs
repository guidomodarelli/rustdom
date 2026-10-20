'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = process.argv[2];
const primary = process.argv[3];
function replace(path, original, replacement) {
  const source = fs.readFileSync(root + '/' + path, 'utf8');
  assert.equal(source.split(original).length, 2, path + ': ' + original);
  fs.writeFileSync(root + '/' + path, source.replace(original, replacement));
}
for (const [source, target] of [
  ['fragment-id-benchmark-constants.cjs', 'benchmarks/constants/fragment-id.cjs'],
  ['fragment-id-benchmark.cjs', 'benchmarks/fragment-id.cjs'],
  ['fragment-id-benchmark.spec.cjs', 'tests/benchmarks/fragment-id.spec.cjs'],
]) fs.copyFileSync(primary + '/.cache/' + source, root + '/' + target);
replace('benchmarks/workload-plan.cjs', "const { NAME_QUERY_WORKLOADS } = require('./constants/name-queries.cjs');",
  "const { NAME_QUERY_WORKLOADS } = require('./constants/name-queries.cjs');\nconst { FRAGMENT_ID_WORKLOADS } = require('./constants/fragment-id.cjs');");
replace('benchmarks/workload-plan.cjs', '    ...[100, 1000].flatMap((size) => NAME_QUERY_WORKLOADS.map((name) => ({ name, size }))),',
  '    ...[100, 1000].flatMap((size) => NAME_QUERY_WORKLOADS.map((name) => ({ name, size }))),\n' +
  '    ...[100, 1000].flatMap((size) => FRAGMENT_ID_WORKLOADS.map((name) => ({ name, size }))),');
replace('benchmarks/worker.cjs', "const { NAME_QUERY_WORKLOADS, NAME_QUERY_DOCUMENT_HTML } = require('./constants/name-queries.cjs');",
  "const { NAME_QUERY_WORKLOADS, NAME_QUERY_DOCUMENT_HTML } = require('./constants/name-queries.cjs');\n" +
  "const { fragmentIdFixture } = require('./fragment-id.cjs');\nconst { FRAGMENT_ID_WORKLOADS, FRAGMENT_ID_DOCUMENT_HTML } = require('./constants/fragment-id.cjs');");
replace('benchmarks/worker.cjs', '  const html = measuresDocumentNames ? NAME_QUERY_DOCUMENT_HTML : fixture(size);',
  '  const measuresFragmentIds = FRAGMENT_ID_WORKLOADS.includes(name);\n' +
  '  const usesEmptyDocument = measuresDocumentNames || measuresFragmentIds;\n' +
  '  const html = measuresDocumentNames ? NAME_QUERY_DOCUMENT_HTML : measuresFragmentIds ? FRAGMENT_ID_DOCUMENT_HTML : fixture(size);');
replace('benchmarks/worker.cjs', '      if (NAME_QUERY_WORKLOADS.includes(name)) collectionWork = nameQueryFixture(runtime, dom.window, size, name);',
  '      if (NAME_QUERY_WORKLOADS.includes(name)) collectionWork = nameQueryFixture(runtime, dom.window, size, name);\n' +
  '      if (measuresFragmentIds) collectionWork = fragmentIdFixture(runtime, dom.window, size, name);');
replace('benchmarks/worker.cjs', 'if (!measuresDocumentNames) assert.equal', 'if (!usesEmptyDocument) assert.equal');
replace('benchmarks/worker.cjs', ".update(xmlWork?.serialize() ?? '').digest('hex');",
  ".update(xmlWork?.serialize() ?? '').update(collectionWork?.serialize?.() ?? '').digest('hex');");
replace('benchmarks/worker.cjs', 'measuresDocumentNames ? 0\n', 'usesEmptyDocument ? 0\n');
replace('benchmarks/compare.cjs', "const { NAME_QUERY_ITERATIONS } = require('./constants/name-queries.cjs');",
  "const { NAME_QUERY_ITERATIONS } = require('./constants/name-queries.cjs');\nconst { FRAGMENT_ID_ITERATIONS } = require('./constants/fragment-id.cjs');");
replace('benchmarks/compare.cjs', '  schemaVersion: 1, capturedAt: new Date().toISOString(),',
  '  fragmentIdMethodology: `Prepare an empty HTML document and 100/1000 mixed-namespace Elements in a detached DocumentFragment, or a ShadowRoot for the shadow workload. Time ${FRAGMENT_ID_ITERATIONS} public getElementById reads consuming the first/last/missing identity. Foreign p:id attributes must not match. inputBytes is the 21-byte bootstrap, while row size counts prepared Elements. Verify native activity before auxiliary reads, then every identity/attribute and complete fragment/shadow XML serialization hash outside timing. Setup, validation, cleanup and GC are excluded.`,\n' +
  '  schemaVersion: 1, capturedAt: new Date().toISOString(),');
console.log(JSON.stringify({ prepared: true, root }));
