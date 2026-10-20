'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const root = process.cwd();
const source = JSON.parse(fs.readFileSync('C:/Users/guido/ghq/projects/rustdom/.cache/name-query-wpt-source.json'));
const manifestPath = 'tests/fixtures/wpt/manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath));
assert.equal(manifest.revision, source.revision);
for (const file of source.files) {
  assert.equal(createHash('sha256').update(fs.readFileSync('tests/fixtures/wpt/' + file.path)).digest('hex'), file.sha256);
  manifest.files[file.path] = file.sha256;
}
manifest.suites['document-name-queries'] = source.files.map((file) => file.path);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const readmePath = root + '/tests/fixtures/wpt/README.md';
const readme = fs.readFileSync(readmePath, 'utf8');
if (!readme.includes('La suite `document-name-queries`')) fs.appendFileSync(readmePath, '\nLa suite `document-name-queries` incorpora los 15 fixtures originales HTML/XHTML\nde `html/dom/documents/dom-tree-accessors/document.getElementsByName`, con sus\nbytes y aserciones intactos. Cubre parámetros, null/undefined, case, id frente\na name, namespaces, interfaces, identidad y listas vivas. Se ejecuta con\n`npm run test:wpt -- document-name-queries`. Los fallos de estándar compartidos\ncon jsdom permanecen visibles; paridad no equivale a conformidad completa.\n');
console.log(JSON.stringify({ registered: source.files.length, suite: 'document-name-queries', revision: source.revision }));
