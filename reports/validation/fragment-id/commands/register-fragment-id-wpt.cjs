'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const root = process.argv[2];
const primary = process.argv[3];
const source = JSON.parse(fs.readFileSync(primary + '/.cache/fragment-id-wpt-source.json'));
const manifestPath = root + '/tests/fixtures/wpt/manifest.json';
const before = fs.readFileSync(manifestPath);
const manifest = JSON.parse(before);
assert.equal(manifest.revision, source.revision);
assert.equal(manifest.suites['fragment-id-queries'], undefined);
fs.writeFileSync(root + '/reports/validation/fragment-id/wpt-manifest-before-fragment-suite.json', before);
for (const file of source.files) {
  const bytes = fs.readFileSync(primary + '/.cache/fragment-id-wpt-files/' + file.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  const target = root + '/tests/fixtures/wpt/' + file.path;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { flag: 'wx' });
  manifest.files[file.path] = file.sha256;
}
manifest.suites['fragment-id-queries'] = source.files.map((file) => file.path);
const expanded = JSON.stringify(manifest, null, 2) + '\n';
fs.writeFileSync(manifestPath, expanded);
fs.writeFileSync(root + '/reports/validation/fragment-id/wpt-manifest-with-fragment-suite.json', expanded);
fs.appendFileSync(root + '/tests/fixtures/wpt/README.md', '\nLa suite `fragment-id-queries` incorpora cuatro fixtures upstream intactos:\nDocument/DocumentFragment.getElementById y los dos casos dinámicos de ShadowRoot.\nCubre duplicados, ID vacío, cambios de atributos y hosts desconectados, con el\nmismo revision fijado y sin nuevas exclusiones. Se ejecuta con\n`npm run test:wpt -- fragment-id-queries`. La paridad con jsdom no certifica\nconformidad completa con el estándar.\n');
console.log(JSON.stringify({ registered: source.files.length, suite: 'fragment-id-queries', revision: source.revision }));
