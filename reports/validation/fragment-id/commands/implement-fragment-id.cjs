'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = process.argv[2];
const primary = process.argv[3];
function replace(path, original, replacement) {
  const source = fs.readFileSync(root + '/' + path, 'utf8');
  assert.equal(source.split(original).length, 2, path);
  fs.writeFileSync(root + '/' + path, source.replace(original, replacement));
}
fs.copyFileSync(primary + '/.cache/element_id.rs', root + '/src/dom/element_id.rs');
replace('src/dom/mod.rs', 'mod element_relatives;', 'mod element_id;\nmod element_relatives;');
replace('src/dom/tree.rs', '    /// Resolve one public collection key against a snapshot of stable numeric member identities.',
  '    /// First exact nonempty ID in the physical subtree; zero denotes absence without retaining owners.\n' +
  '    #[napi]\n    pub fn query_element_by_id(&mut self, root: f64, id: Utf16String) -> Result<f64> {\n' +
  '        self.collection_queries += 1;\n        self.store.query_element_by_id(root, &id).map_err(to_napi_error)\n    }\n\n' +
  '    /// Resolve one public collection key against a snapshot of stable numeric member identities.');
replace('src/dom/native-tree.cjs', '  /** @param {object} root - Physical parent. @returns {object[]} Immediate Element implementations with numeric transport metadata. */',
  '  /** @param {object} root - Fragment or ShadowRoot owner. @param {string} id - Converted exact ID. @returns {object|null} Original first matching descendant. */\n' +
  '  elementById(root, id) { return this._object(this._arena.queryElementById(this._ensure(root), id)); }\n\n' +
  '  /** @param {object} root - Physical parent. @returns {object[]} Immediate Element implementations with numeric transport metadata. */');
replace('types/native.d.cts', '  /** Snapshot members stay owned by the calling JS collection; native storage keeps no collection cache. */',
  '  /** First physical descendant with an exact nonempty ID; zero denotes absence and does not own nodes. */\n' +
  '  queryElementById(root: number, id: string): number;\n' +
  '  /** Snapshot members stay owned by the calling JS collection; native storage keeps no collection cache. */');
replace('scripts/build.mjs', 'await writeFile(fragmentImplementationPath, fragmentImplementation);',
  'fragmentImplementation = replaceRegion(fragmentImplementation, \'  getElementById(id) {\', \'\\n}\\n\\nmixin(DocumentFragmentImpl.prototype\',\n' +
  '  \'  getElementById(id) { return domSymbolTree.elementById(this, id); }\\n\', substituteOnce);\n' +
  'await writeFile(fragmentImplementationPath, fragmentImplementation);');
fs.appendFileSync(root + '/tests/fragment-id.spec.cjs', `
for (const realm of ['default', 'vm']) test(\`should execute every fragment ID query in Rust in \${realm}\`, () => {
  const runtime = runtimes.rustdom;
  const { window } = new runtime.JSDOM('<!doctype html><body>', realm === 'vm' ? { runScripts: 'outside-only' } : {});
  try {
    const document = window.document;
    const fragment = document.createDocumentFragment();
    const target = entry(document, 'fragment-target', 'chosen'); fragment.append(target);
    const host = entry(document, 'host', null); const shadow = host.attachShadow({ mode: 'open' });
    const shadowTarget = entry(document, 'shadow-target', 'chosen'); shadow.append(shadowTarget);
    const before = runtime.getNativeTreeStatistics().nativeCollectionQueries;
    assert.equal(fragment.getElementById('chosen'), target);
    assert.equal(fragment.getElementById('missing'), null);
    assert.equal(fragment.getElementById(''), null);
    assert.equal(shadow.getElementById('chosen'), shadowTarget);
    assert.equal(runtime.getNativeTreeStatistics().nativeCollectionQueries - before, 4);
  } finally { window.close(); }
});
`);
console.log(JSON.stringify({ implemented: true, root }));
