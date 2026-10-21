'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [root, primary] = process.argv.slice(2);
function replace(path, original, replacement) {
  const source = fs.readFileSync(root + '/' + path, 'utf8');
  assert.equal(source.split(original).length, 2, path + ': ' + original);
  fs.writeFileSync(root + '/' + path, source.replace(original, replacement));
}
fs.copyFileSync(primary + '/.cache/document_ids.rs', root + '/src/dom/document_ids.rs');
replace('src/dom/mod.rs', 'mod document_implementation;', 'mod document_ids;\nmod document_implementation;');
replace('src/dom/store.rs', '    pub(crate) attribute_collections: super::attribute_index::AttributeCollections,',
  '    pub(crate) attribute_collections: super::attribute_index::AttributeCollections,\n    pub(crate) document_ids: super::document_ids::DocumentIdRegistry,');
replace('src/dom/store.rs', '        self.root_hosts.release_node(id);', '        self.document_ids.release_node(id);\n        self.root_hosts.release_node(id);');
replace('src/dom/error.rs', '    NotDocumentType(u64),', '    NotDocument(u64),\n    NotDocumentType(u64),');
replace('src/dom/error.rs', '            Self::NotDocumentType(id) =>', '            Self::NotDocument(id) => write!(formatter, "NativeTree: node {id} is not a Document"),\n            Self::NotDocumentType(id) =>');
replace('src/dom/element_id.rs', '        let root = node_id(handle)?;\n        let mut current = self.links(root)?.first;\n        if id.is_empty() {',
  '        self.query_id_with_scope(handle, id, false)\n    }\n\n' +
  '    /// SVG lookup includes the root and accepts an explicitly empty ID attribute.\n' +
  '    pub(super) fn query_svg_element_by_id(&self, handle: f64, id: &[u16]) -> Result<f64> {\n        self.query_id_with_scope(handle, id, true)\n    }\n\n' +
  '    fn query_id_with_scope(&self, handle: f64, id: &[u16], inclusive: bool) -> Result<f64> {\n' +
  '        let root = node_id(handle)?;\n        let links = self.links(root)?;\n        let mut current = if inclusive { root } else { links.first };\n        if !inclusive && id.is_empty() {');
replace('src/dom/tree.rs', '/// Sparse name state contains numeric keys and owned strings, never JavaScript references.',
  '/// Document ID keys and registration records contain no JavaScript owners.\n#[napi(object)]\npub struct DocumentIdStatistics {\n' +
  ['documents', 'names', 'entries', 'elements', 'memberships', 'key_units', 'document_capacity', 'element_capacity', 'name_capacity', 'entry_capacity'].map((name) => `    pub ${name}: f64,`).join('\n') +
  '\n}\n\n/// Sparse name state contains numeric keys and owned strings, never JavaScript references.');
const statisticsFields = ['documents', 'names', 'entries', 'elements', 'memberships', 'key_units', 'document_capacity', 'element_capacity', 'name_capacity', 'entry_capacity'];
replace('src/dom/tree.rs', '    /// Resolve one public collection key against a snapshot of stable numeric member identities.',
  '    /// Preserve registration order and current-root filtering for the Document ID index.\n    #[napi]\n' +
  '    pub fn query_document_element_by_id(&mut self, document: f64, value: Utf16String) -> Result<f64> {\n' +
  '        self.collection_queries += 1;\n        self.store.query_document_element_by_id(document, &value).map_err(to_napi_error)\n    }\n\n' +
  '    #[napi]\n    pub fn attach_document_id(&mut self, document: f64, element: f64, value: Option<Utf16String>) -> Result<()> {\n' +
  '        self.store.attach_document_id(document, element, value.as_deref()).map_err(to_napi_error)\n    }\n\n' +
  '    #[napi]\n    pub fn detach_document_id(&mut self, document: f64, element: f64, value: Option<Utf16String>) -> Result<()> {\n' +
  '        self.store.detach_document_id(document, element, value.as_deref()).map_err(to_napi_error)\n    }\n\n' +
  '    /// Attribute hooks commit removal and insertion in one synchronous native transaction.\n    #[napi]\n' +
  '    pub fn change_document_id(&mut self, document: f64, element: f64, previous: Option<Utf16String>, value: Option<Utf16String>) -> Result<()> {\n' +
  '        self.store.change_document_id(document, element, previous.as_deref(), value.as_deref()).map_err(to_napi_error)\n    }\n\n' +
  '    #[napi]\n    pub fn query_svg_element_by_id(&mut self, root: f64, value: Utf16String) -> Result<f64> {\n' +
  '        self.collection_queries += 1;\n        self.store.query_svg_element_by_id(root, &value).map_err(to_napi_error)\n    }\n\n' +
  '    #[napi]\n    pub fn document_id_statistics(&self) -> DocumentIdStatistics {\n        let stats = self.store.document_ids.statistics();\n        DocumentIdStatistics {\n' +
  statisticsFields.map((name) => `            ${name}: stats.${name} as f64,`).join('\n') + '\n        }\n    }\n\n' +
  '    /// Resolve one public collection key against a snapshot of stable numeric member identities.');
replace('src/dom/native-tree.cjs', '  /** @param {object} root - Physical parent. @returns {object[]} Immediate Element implementations with numeric transport metadata. */',
  '  /** @param {object} document - Document implementation. @param {object} element - Attached implementation. @param {string|null} value - Current ID registration. @returns {void} */\n' +
  '  attachDocumentId(document, element, value) { this._arena.attachDocumentId(this._ensure(document), this._ensure(element), value); }\n' +
  '  /** @param {object} document - Document implementation. @param {object} element - Detached implementation. @param {string|null} value - Previous ID registration. @returns {void} */\n' +
  '  detachDocumentId(document, element, value) { this._arena.detachDocumentId(this._ensure(document), this._ensure(element), value); }\n' +
  '  /** @param {object} document - Document implementation. @param {object} element - Changed implementation. @param {string|null} previous - Old registration. @param {string|null} value - New registration. @returns {void} */\n' +
  '  changeDocumentId(document, element, previous, value) { this._arena.changeDocumentId(this._ensure(document), this._ensure(element), previous, value); }\n' +
  '  /** @param {object} document - Public lookup owner. @param {string} value - Converted ID. @returns {object|null} Original first eligible registered implementation. */\n' +
  '  documentElementById(document, value) { return this._object(this._arena.queryDocumentElementById(this._ensure(document), value)); }\n' +
  '  /** @param {object} root - SVG root implementation. @param {string} value - Converted ID, including empty. @returns {object|null} Original inclusive physical match. */\n' +
  '  svgElementById(root, value) { return this._object(this._arena.querySvgElementById(this._ensure(root), value)); }\n\n' +
  '  /** @param {object} root - Physical parent. @returns {object[]} Immediate Element implementations with numeric transport metadata. */');
replace('src/dom/native-tree.cjs', '      rootHosts: this._arena.rootHostStatistics(),', '      documentIds: this._arena.documentIdStatistics(), rootHosts: this._arena.rootHostStatistics(),');
replace('types/index.d.cts', 'export interface NativeRuntimeStatistics extends NativeTreeStatistics {',
  '/** Registration-ordered native ID index and capacity, without DOM owners. */\n' +
  'export interface NativeDocumentIdStatistics { documents: number; names: number; entries: number; elements: number; memberships: number; keyUnits: number; documentCapacity: number; elementCapacity: number; nameCapacity: number; entryCapacity: number; }\n' +
  'export interface NativeRuntimeStatistics extends NativeTreeStatistics { documentIds: NativeDocumentIdStatistics;');
replace('types/native.d.cts', '  /** Snapshot members stay owned by the calling JS collection; native storage keeps no collection cache. */',
  '  /** Document registration order and physical-root filtering; values may preserve namespaced mutation aliases. */\n' +
  '  queryDocumentElementById(document: number, value: string): number;\n' +
  '  attachDocumentId(document: number, element: number, value: string | null): void;\n' +
  '  detachDocumentId(document: number, element: number, value: string | null): void;\n' +
  '  changeDocumentId(document: number, element: number, previous: string | null, value: string | null): void;\n' +
  '  querySvgElementById(root: number, value: string): number;\n' +
  '  documentIdStatistics(): import(\'./index.cjs\').NativeDocumentIdStatistics;\n' +
  '  /** Snapshot members stay owned by the calling JS collection; native storage keeps no collection cache. */');
replace('scripts/memory-endpoint.cjs', '    native.rootHosts?.hostedRoots === expected.rootHosts?.hostedRoots &&',
  '    native.documentIds?.documents === expected.documentIds?.documents &&\n' +
  '    native.documentIds?.names === expected.documentIds?.names &&\n' +
  '    native.documentIds?.entries === expected.documentIds?.entries &&\n' +
  '    native.documentIds?.elements === expected.documentIds?.elements &&\n' +
  '    native.documentIds?.memberships === expected.documentIds?.memberships &&\n' +
  '    native.documentIds?.keyUnits === expected.documentIds?.keyUnits &&\n' +
  '    native.rootHosts?.hostedRoots === expected.rootHosts?.hostedRoots &&');
fs.appendFileSync(root + '/scripts/build.mjs', `
/** ID registrations preserve host hook ordering; state and candidate selection live in Rust. */
const documentIdPath = resolve(destination, 'lib/jsdom/living/nodes/Document-impl.js');
let documentIdSource = substituteOnce(await readFile(documentIdPath, 'utf8'), '    this._ids = Object.create(null);\\n', '');
documentIdSource = replaceRegion(documentIdSource, '  getElementById(id) {', '  get referrer() {',
  '  getElementById(id) { return domSymbolTree.documentElementById(this, id); }\\n\\n', substituteOnce);
await writeFile(documentIdPath, documentIdSource);
const elementIdPath = resolve(destination, 'lib/jsdom/living/nodes/Element-impl.js');
let elementIdSource = replaceRegion(await readFile(elementIdPath, 'utf8'), 'function attachId(id, elm, doc) {', 'class ElementImpl extends NodeImpl {',
  'function attachId(id, element, document) { domSymbolTree.attachDocumentId(document, element, id); }\\n' +
  'function detachId(id, element, document) { domSymbolTree.detachDocumentId(document, element, id); }\\n\\n', substituteOnce);
elementIdSource = substituteOnce(elementIdSource, '      detachId(oldValue, this, doc);\\n      attachId(value, this, doc);',
  '      domSymbolTree.changeDocumentId(doc, this, oldValue, value);');
await writeFile(elementIdPath, elementIdSource);
const svgIdPath = resolve(destination, 'lib/jsdom/living/nodes/SVGSVGElement-impl.js');
const svgIdSource = replaceRegion(await readFile(svgIdPath, 'utf8'), '  getElementById(elementId) {', '  suspendRedraw() {',
  '  getElementById(elementId) { return domSymbolTree.svgElementById(this, elementId); }\\n\\n', substituteOnce);
await writeFile(svgIdPath, svgIdSource);
`);
console.log(JSON.stringify({ implemented: true, root }));
