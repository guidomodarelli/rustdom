'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = process.argv[2];
function replace(path, original, replacement) {
  const source = fs.readFileSync(root + '/' + path, 'utf8');
  assert.equal(source.split(original).length, 2, path);
  fs.writeFileSync(root + '/' + path, source.replace(original, replacement));
}
replace('benchmarks/worker.cjs', 'measuresDocumentNames ? 0\n', 'usesEmptyDocument ? 0\n');
replace('benchmarks/compare.cjs', "const { NAME_QUERY_ITERATIONS } = require('./constants/name-queries.cjs');",
  "const { NAME_QUERY_ITERATIONS } = require('./constants/name-queries.cjs');\nconst { FRAGMENT_ID_ITERATIONS } = require('./constants/fragment-id.cjs');");
replace('benchmarks/compare.cjs', '  schemaVersion: 1, capturedAt: new Date().toISOString(),',
  '  fragmentIdMethodology: `Prepare an empty HTML document and 100/1000 mixed-namespace Elements in a detached DocumentFragment, or a ShadowRoot for the shadow workload. Time ${FRAGMENT_ID_ITERATIONS} public getElementById reads consuming the first/last/missing identity. Foreign p:id attributes must not match. inputBytes is the 21-byte bootstrap, while row size counts prepared Elements. Verify native activity before auxiliary reads, then every identity/attribute and complete fragment/shadow XML serialization hash outside timing. Setup, validation, cleanup and GC are excluded.`,\n' +
  '  schemaVersion: 1, capturedAt: new Date().toISOString(),');
console.log(JSON.stringify({ resumed: true, root }));
