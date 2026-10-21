'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [root, primary] = process.argv.slice(2);
const testPath = root + '/tests/id-lookups.spec.cjs';
let tests = fs.readFileSync(testPath, 'utf8');
const marker = "  compare('bound lookup to current light-tree scope despite shadow template and external IDs'";
assert.equal(tests.split(marker).length, 2);
tests = tests.replace(marker, `  compare('preserve unprefixed foreign-namespace aliases through detach and reattach', mode, realm, kind, ({ document, root, scope }) => {
    const target = entry(document, 'alias-target', 'ordinary'); root.append(target);
    const namespace = TEST_NAMESPACE + ':bare';
    const keys = ['ordinary', 'foreign', 'changed', 'detached'];
    const snapshot = () => keys.map((value) => lookup(scope, value));
    const results = [snapshot()];
    target.setAttributeNS(namespace, 'id', 'foreign'); results.push(snapshot());
    target.getAttributeNodeNS(namespace, 'id').value = 'changed'; results.push(snapshot());
    target.remove(); results.push(snapshot());
    target.setAttributeNS(namespace, 'id', 'detached'); results.push(snapshot());
    root.append(target); results.push(snapshot());
    target.removeAttributeNS(namespace, 'id'); results.push(snapshot());
    return results;
  });
` + marker);
fs.writeFileSync(testPath, tests);
fs.mkdirSync(root + '/baseline-engine/tests', { recursive: true });
fs.writeFileSync(root + '/baseline-engine/tests/id-lookups.spec.cjs', tests);
fs.writeFileSync(root + '/reports/validation/id-lookups/baseline-enhanced.spec.cjs', tests);
fs.writeFileSync(primary + '/.cache/id-lookups-enhanced.spec.cjs', tests);
fs.appendFileSync(testPath, `
for (const realm of ['default', 'vm']) test(\`should execute Document and SVG ID lookup through native state in \${realm}\`, () => {
  const runtime = engines.rustdom;
  const { window } = new runtime.JSDOM('<!doctype html><body>', realm === 'vm' ? { runScripts: 'outside-only' } : {});
  try {
    const document = window.document;
    const beforeIndex = runtime.getNativeTreeStatistics().documentIds;
    const target = entry(document, 'target', 'chosen', TEST_NAMESPACE); document.body.append(target);
    target.setAttributeNS(TEST_NAMESPACE + ':bare', 'id', 'alias');
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg'); svg.id = 'self';
    const empty = entry(document, 'empty', '', SVG_NAMESPACE); svg.append(empty); document.body.append(svg);
    const registered = runtime.getNativeTreeStatistics().documentIds;
    assert.equal(registered.documents - beforeIndex.documents, 1);
    assert.equal(registered.names - beforeIndex.names, 3);
    assert.equal(registered.entries - beforeIndex.entries, 3);
    assert.equal(registered.elements - beforeIndex.elements, 2);
    assert.equal(registered.memberships - beforeIndex.memberships, 3);
    const before = runtime.getNativeTreeStatistics().nativeCollectionQueries;
    assert.equal(document.getElementById('chosen'), target);
    assert.equal(document.getElementById('alias'), target);
    assert.equal(document.getElementById('missing'), null);
    assert.equal(document.getElementById(''), null);
    assert.equal(svg.getElementById('self'), svg);
    assert.equal(svg.getElementById(''), empty);
    assert.equal(runtime.getNativeTreeStatistics().nativeCollectionQueries - before, 6);
  } finally { window.close(); }
});
`);
let source = fs.readFileSync(root + '/src/dom/element_id.rs', 'utf8');
const end = source.lastIndexOf('\n}'); assert.ok(end > 0);
source = source.slice(0, end) + `
    #[test]
    fn should_include_svg_root_and_accept_only_explicit_empty_ids() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":1,"name":"svg"}));
        assert_eq!(store.query_svg_element_by_id(root, &[]).unwrap(), 0.0);
        let child = node(&mut store, json!({"kind":1,"name":"g","attributes":[{"name":"id","value":"self"}]}));
        store.append(root, child).unwrap();
        store.set_data(root, &json!({"kind":1,"name":"svg","attributes":[{"name":"id","value":"self"}]}).to_string()).unwrap();
        assert_eq!(store.query_svg_element_by_id(root, &units("self")).unwrap(), root);
        assert_eq!(store.query_element_by_id(root, &units("self")).unwrap(), child);
        store.set_data(root, &json!({"kind":1,"name":"svg","attributes":[{"name":"id","value":""}]}).to_string()).unwrap();
        assert_eq!(store.query_svg_element_by_id(root, &[]).unwrap(), root);
        assert_eq!(store.query_element_by_id(root, &[]).unwrap(), 0.0);
    }

    #[test]
    fn should_bound_inclusive_lookup_and_validate_empty_queries_without_activation() {
        let mut store = TreeStore::new();
        let outer = node(&mut store, json!({"kind":11}));
        let root = node(&mut store, json!({"kind":1,"name":"svg"}));
        let external = node(&mut store, json!({"kind":1,"name":"g","attributes":[{"name":"id","value":"outside"}]}));
        store.append(outer, root).unwrap(); store.append(outer, external).unwrap();
        assert_eq!(store.query_svg_element_by_id(root, &units("outside")).unwrap(), 0.0);
        let reserved = store.reserve_handles().unwrap(); let before = store.statistics();
        for invalid in [0.0, -1.0, 0.5, f64::NAN, reserved] {
            assert!(store.query_svg_element_by_id(invalid, &[]).is_err());
        }
        assert_eq!(store.statistics().allocations, before.allocations);
        assert_eq!(store.statistics().reserved_handles, before.reserved_handles);
    }
` + source.slice(end);
fs.writeFileSync(root + '/src/dom/element_id.rs', source);
let build = fs.readFileSync(root + '/scripts/build.mjs', 'utf8');
const writeDocument = 'await writeFile(documentIdPath, documentIdSource);';
assert.equal(build.split(writeDocument).length, 2);
build = build.replace(writeDocument,
  'documentIdSource = substituteOnce(documentIdSource, \'  // This is implemented separately for Document (which has a _ids cache) and DocumentFragment (which does not).\',\n' +
  '  \'  // Document preserves native registration order; fragments use physical tree order.\');\n' + writeDocument);
fs.writeFileSync(root + '/scripts/build.mjs', build);
console.log(JSON.stringify({ publicBaselineTests: 90, focusedTests: 92, addedSvgRustTests: 2 }));
