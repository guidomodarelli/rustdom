'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = process.argv[2];
function replace(path, original, replacement) {
  const source = fs.readFileSync(root + '/' + path, 'utf8');
  assert.equal(source.split(original).length, 2, path + ': ' + original);
  fs.writeFileSync(root + '/' + path, source.replace(original, replacement));
}
replace('src/dom/document_ids.rs', 'constants::{DOCUMENT_NODE, ELEMENT_NODE}', 'constants::{DOCUMENT_NODE, ELEMENT_NODE, ID_ATTRIBUTE_NAME}');
replace('src/dom/document_ids.rs', '    fn document_id_operands(',
  '    /// Read current canonical attributes before lifecycle registration, without a JavaScript string round trip.\n' +
  '    fn current_id_value(&self, element: NodeId) -> Result<Option<Vec<u16>>> {\n' +
  '        let data = self.data.get(&element).ok_or(TreeError::MissingData(element))?;\n' +
  '        Ok(self.attribute_value_for_data(element, data, ID_ATTRIBUTE_NAME)?.map(|value| value.units().collect()))\n    }\n\n' +
  '    pub(super) fn attach_current_document_id(&mut self, document: f64, element: f64) -> Result<()> {\n' +
  '        let (document, element) = self.document_id_operands(document, element)?;\n' +
  '        let value = self.current_id_value(element)?;\n        self.document_ids.attach(document, element, value.as_deref()); Ok(())\n    }\n\n' +
  '    pub(super) fn detach_current_document_id(&mut self, document: f64, element: f64) -> Result<()> {\n' +
  '        let (document, element) = self.document_id_operands(document, element)?;\n' +
  '        let value = self.current_id_value(element)?;\n        self.document_ids.detach(document, element, value.as_deref()); Ok(())\n    }\n\n' +
  '    fn document_id_operands(');
replace('src/dom/tree.rs', '    #[napi]\n    pub fn attach_document_id(',
  '    #[napi]\n    pub fn attach_current_document_id(&mut self, document: f64, element: f64) -> Result<()> {\n' +
  '        self.store.attach_current_document_id(document, element).map_err(to_napi_error)\n    }\n\n' +
  '    #[napi]\n    pub fn detach_current_document_id(&mut self, document: f64, element: f64) -> Result<()> {\n' +
  '        self.store.detach_current_document_id(document, element).map_err(to_napi_error)\n    }\n\n' +
  '    #[napi]\n    pub fn attach_document_id(');
replace('src/dom/native-tree.cjs',
  '  /** @param {object} document - Document implementation. @param {object} element - Attached implementation. @param {string|null} value - Current ID registration. @returns {void} */\n' +
  '  attachDocumentId(document, element, value) { this._arena.attachDocumentId(this._ensure(document), this._ensure(element), value); }',
  '  /** @param {object} document - Document implementation. @param {object} element - Attached implementation. @returns {void} Read and register its current canonical ID in Rust. */\n' +
  '  attachDocumentId(document, element) { this._arena.attachCurrentDocumentId(this._ensure(document), this._ensure(element)); }');
replace('src/dom/native-tree.cjs',
  '  /** @param {object} document - Document implementation. @param {object} element - Detached implementation. @param {string|null} value - Previous ID registration. @returns {void} */\n' +
  '  detachDocumentId(document, element, value) { this._arena.detachDocumentId(this._ensure(document), this._ensure(element), value); }',
  '  /** @param {object} document - Document implementation. @param {object} element - Detached implementation. @returns {void} Read and remove its current canonical ID in Rust. */\n' +
  '  detachDocumentId(document, element) { this._arena.detachCurrentDocumentId(this._ensure(document), this._ensure(element)); }');
replace('types/native.d.cts', '  attachDocumentId(document: number, element: number, value: string | null): void;',
  '  attachCurrentDocumentId(document: number, element: number): void;\n' +
  '  detachCurrentDocumentId(document: number, element: number): void;\n' +
  '  attachDocumentId(document: number, element: number, value: string | null): void;');
let build = fs.readFileSync(root + '/scripts/build.mjs', 'utf8');
const begin = build.indexOf('let elementIdSource = replaceRegion(');
const end = build.indexOf('elementIdSource = substituteOnce(', begin);
assert.ok(begin > 0 && end > begin);
build = build.slice(0, begin) + `let elementIdSource = replaceRegion(await readFile(elementIdPath, 'utf8'), 'function attachId(id, elm, doc) {', 'class ElementImpl extends NodeImpl {', '', substituteOnce);
elementIdSource = substituteOnce(elementIdSource,
  '    const id = this.getAttributeNS(null, "id");\\n    if (id) {\\n      attachId(id, this, this._ownerDocument);\\n    }',
  '    domSymbolTree.attachDocumentId(this._ownerDocument, this);');
elementIdSource = substituteOnce(elementIdSource,
  '    const id = this.getAttributeNS(null, "id");\\n    if (id) {\\n      detachId(id, this, this._ownerDocument);\\n    }',
  '    domSymbolTree.detachDocumentId(this._ownerDocument, this);');
` + build.slice(end);
fs.writeFileSync(root + '/scripts/build.mjs', build);
let source = fs.readFileSync(root + '/src/dom/document_ids.rs', 'utf8');
const close = source.lastIndexOf('\n}'); assert.ok(close > 0);
source = source.slice(0, close) + `
    #[test]
    fn should_read_current_null_namespace_ids_for_lifecycle_registration() {
        let mut store = TreeStore::new(); let document = node(&mut store, DOCUMENT_NODE); let element = node(&mut store, ELEMENT_NODE);
        store.set_data(element, &json!({"kind":1,"name":"entry","attributes":[{"name":"id","namespace":"urn:foreign","value":"foreign"},{"name":"id","value":"chosen"}]}).to_string()).unwrap();
        store.append(document, element).unwrap(); store.attach_current_document_id(document, element).unwrap();
        assert_eq!(store.query_document_element_by_id(document, &units("chosen")).unwrap(), element);
        assert_eq!(store.query_document_element_by_id(document, &units("foreign")).unwrap(), 0.0);
        store.detach_current_document_id(document, element).unwrap();
        assert_eq!(store.document_ids.statistics().entries, 0);
    }

    #[test]
    fn should_read_canonical_attr_values_on_lifecycle_hooks_and_ignore_empty_ids() {
        let mut store = TreeStore::new(); let document = node(&mut store, DOCUMENT_NODE); let element = node(&mut store, ELEMENT_NODE);
        store.append(document, element).unwrap(); store.initialize_attribute_collection(element).unwrap();
        let attribute = store.allocate().unwrap(); store.initialize_attribute(attribute, r#"{"kind":2,"name":"id","value":"chosen"}"#).unwrap();
        store.append_attribute(element, attribute).unwrap(); store.attach_current_document_id(document, element).unwrap();
        assert_eq!(store.query_document_element_by_id(document, &units("chosen")).unwrap(), element);
        store.set_attribute_value(attribute, &units("changed")).unwrap();
        store.change_document_id(document, element, Some(&units("chosen")), Some(&units("changed"))).unwrap();
        store.detach_current_document_id(document, element).unwrap();
        assert_eq!(store.document_ids.statistics().entries, 0);
        store.set_attribute_value(attribute, &[]).unwrap(); store.attach_current_document_id(document, element).unwrap();
        assert_eq!(store.document_ids.statistics().documents, 0);
    }
` + source.slice(close);
fs.writeFileSync(root + '/src/dom/document_ids.rs', source);
console.log(JSON.stringify({ nativeLifecycle: true, addedRustTests: 2 }));
