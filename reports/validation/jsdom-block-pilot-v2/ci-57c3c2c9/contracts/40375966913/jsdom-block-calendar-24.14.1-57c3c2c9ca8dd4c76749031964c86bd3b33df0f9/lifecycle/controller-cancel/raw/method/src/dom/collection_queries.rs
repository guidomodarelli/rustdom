//! Live descendant filtering for getElementsBy* over canonical native metadata and attributes.
use super::{
    constants::{
        CLASS_ATTRIBUTE_NAME, ELEMENT_NODE, HTML_NAMESPACE, NAME_ATTRIBUTE_NAME,
        QUIRKS_CLASS_CASE_MASK,
    },
    data::{DomString, NodeData},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
    token_list::{TokenSet, html_space},
};

pub(super) enum CollectionFilter {
    Classes {
        tokens: TokenSet,
        quirks: bool,
    },
    QualifiedName {
        name: DomString,
        html_name: Option<DomString>,
    },
    Namespace {
        namespace: Option<DomString>,
        local_name: DomString,
    },
    NameAttribute {
        value: DomString,
    },
}

fn ascii_lowercase(unit: u16) -> u16 {
    u8::try_from(unit).map_or(unit, |byte| u16::from(byte.to_ascii_lowercase()))
}

/// Match a single token without copying each element's class value or allocating a token set.
fn contains_class(value: &DomString, expected: &[u16], quirks: bool) -> bool {
    let mut position = 0;
    let mut matches = true;
    for unit in value.units().chain(std::iter::once(u16::from(b' '))) {
        if html_space(unit) {
            if matches && position == expected.len() && position != 0 {
                return true;
            }
            position = 0;
            matches = true;
        } else {
            matches &= expected.get(position).is_some_and(|expected| {
                if quirks {
                    (unit | QUIRKS_CLASS_CASE_MASK) == (*expected | QUIRKS_CLASS_CASE_MASK)
                } else {
                    unit == *expected
                }
            });
            position += 1;
        }
    }
    false
}

impl CollectionFilter {
    pub fn name_attribute(value: &[u16]) -> Self {
        Self::NameAttribute {
            value: DomString::from_units(value),
        }
    }

    pub fn classes(value: &[u16], quirks: bool) -> Self {
        Self::Classes {
            tokens: TokenSet::parse(value),
            quirks,
        }
    }

    pub fn qualified_name(name: &[u16], html_document: bool) -> Self {
        Self::QualifiedName {
            name: DomString::from_units(name),
            html_name: html_document.then(|| {
                DomString::from_units(
                    &name
                        .iter()
                        .copied()
                        .map(ascii_lowercase)
                        .collect::<Vec<_>>(),
                )
            }),
        }
    }

    pub fn namespace(namespace: Option<&[u16]>, local_name: &[u16]) -> Self {
        Self::Namespace {
            namespace: namespace
                .filter(|value| !value.is_empty())
                .map(DomString::from_units),
            local_name: DomString::from_units(local_name),
        }
    }

    fn matches(&self, store: &TreeStore, node: NodeId, data: &NodeData) -> Result<bool> {
        match self {
            Self::NameAttribute { value } => Ok(store
                .attribute_value_for_data(node, data, NAME_ATTRIBUTE_NAME)?
                .is_some_and(|actual| actual.code_units_equal(value))),
            Self::Classes { tokens, quirks } => Ok(store
                .attribute_value_for_data(node, data, CLASS_ATTRIBUTE_NAME)?
                .is_some_and(|actual| {
                    tokens
                        .iter()
                        .all(|token| contains_class(actual, token, *quirks))
                })),
            Self::QualifiedName { name, html_name } => {
                if name.code_units_equal_str("*") {
                    return Ok(true);
                }
                let Some(local_name) = &data.name else {
                    return Ok(false);
                };
                let html_namespace = data
                    .namespace
                    .as_ref()
                    .is_some_and(|namespace| namespace.code_units_equal_str(HTML_NAMESPACE));
                let expected = html_name
                    .as_ref()
                    .filter(|_| html_namespace)
                    .unwrap_or(name);
                let prefix = data.prefix.as_ref();
                if prefix.is_none() {
                    return Ok(local_name.code_units_equal(expected));
                }
                let qualified_name = prefix
                    .into_iter()
                    .flat_map(DomString::units)
                    .chain(prefix.map(|_| u16::from(b':')))
                    .chain(local_name.units());
                Ok(qualified_name.eq(expected.units()))
            }
            Self::Namespace {
                namespace,
                local_name,
            } => {
                let namespace_matches = match namespace {
                    Some(expected) if expected.code_units_equal_str("*") => true,
                    Some(expected) => data
                        .namespace
                        .as_ref()
                        .is_some_and(|actual| actual.code_units_equal(expected)),
                    None => data.namespace.is_none(),
                };
                Ok(namespace_matches
                    && (local_name.code_units_equal_str("*")
                        || data
                            .name
                            .as_ref()
                            .is_some_and(|actual| actual.code_units_equal(local_name))))
            }
        }
    }
}

impl TreeStore {
    /// Exclude the root and external trees. Only the returned numeric IDs escape this call.
    pub(super) fn query_collection(
        &self,
        handle: f64,
        filter: CollectionFilter,
    ) -> Result<Vec<f64>> {
        let root = node_id(handle)?;
        let mut current = self.links(root)?.first;
        if matches!(&filter, CollectionFilter::Classes { tokens, .. } if tokens.len() == 0) {
            return Ok(Vec::new());
        }
        let mut result = Vec::new();
        while current != 0 {
            let data = self
                .data
                .get(&current)
                .ok_or(TreeError::MissingData(current))?;
            if data.kind == ELEMENT_NODE && filter.matches(self, current, data)? {
                result.push(current as f64);
            }
            current = self.following_within(current, root)?;
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn node(store: &mut TreeStore, data: serde_json::Value) -> f64 {
        let handle = store.allocate().unwrap();
        store.set_data(handle, &data.to_string()).unwrap();
        handle
    }

    fn units(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }

    #[test]
    fn should_match_exact_name_attributes_on_all_element_namespaces() {
        let mut store = TreeStore::new();
        let root = node(
            &mut store,
            json!({"kind":1,"name":"root","attributes":[{"name":"name","value":"chosen"}]}),
        );
        let mut expected = Vec::new();
        for namespace in [Some(HTML_NAMESPACE), Some("urn:xml"), None] {
            let child = node(
                &mut store,
                json!({"kind":1,"name":"entry","namespace":namespace,"attributes":[{"name":"name","value":"chosen"}]}),
            );
            store.append(root, child).unwrap();
            expected.push(child);
        }
        for attributes in [
            json!([{"name":"name","namespace":"urn:attributes","value":"chosen"}]),
            json!([{"name":"NAME","value":"chosen"}]),
            json!([{"name":"name","value":"Chosen"}]),
        ] {
            let excluded = node(
                &mut store,
                json!({"kind":1,"name":"entry","attributes":attributes}),
            );
            store.append(root, excluded).unwrap();
        }
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::name_attribute(&units("chosen")))
                .unwrap(),
            expected
        );
    }

    #[test]
    fn should_distinguish_empty_literal_wildcard_and_lossless_utf16_name_values() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":9}));
        let missing = node(&mut store, json!({"kind":1,"name":"entry"}));
        store.append(root, missing).unwrap();
        for value in [
            vec![],
            units("*"),
            units(" chosen "),
            vec![0xd800, 0, 0xdc00],
        ] {
            let child = node(
                &mut store,
                json!({"kind":1,"name":"entry","attributes":[{"name":"name","value":value}]}),
            );
            store.append(root, child).unwrap();
            assert_eq!(
                store
                    .query_collection(root, CollectionFilter::name_attribute(&value))
                    .unwrap(),
                [child]
            );
        }
        assert!(
            store
                .query_collection(root, CollectionFilter::name_attribute(&[0xfffd, 0, 0xfffd]))
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn should_read_live_canonical_name_attributes_and_physical_order() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":9}));
        let first = node(&mut store, json!({"kind":1,"name":"entry"}));
        let second = node(
            &mut store,
            json!({"kind":1,"name":"entry","attributes":[{"name":"name","value":"chosen"}]}),
        );
        store.append(root, first).unwrap();
        store.append(root, second).unwrap();
        store.initialize_attribute_collection(first).unwrap();
        let attribute = store.allocate().unwrap();
        store
            .initialize_attribute(attribute, r#"{"kind":2,"name":"name","value":"chosen"}"#)
            .unwrap();
        store.append_attribute(first, attribute).unwrap();
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::name_attribute(&units("chosen")))
                .unwrap(),
            [first, second]
        );
        store.remove(first).unwrap();
        store.append(root, first).unwrap();
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::name_attribute(&units("chosen")))
                .unwrap(),
            [second, first]
        );
        store
            .set_attribute_value(attribute, &units("changed"))
            .unwrap();
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::name_attribute(&units("chosen")))
                .unwrap(),
            [second]
        );
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::name_attribute(&units("changed")))
                .unwrap(),
            [first]
        );
        store.remove_attribute(first, attribute).unwrap();
        assert!(
            store
                .query_collection(root, CollectionFilter::name_attribute(&units("changed")))
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn should_release_name_query_owners_with_numeric_results_held() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":9}));
        let mut children = Vec::new();
        for index in 0..128 {
            let value = if index % 4 == 0 { "chosen" } else { "other" };
            let child = node(
                &mut store,
                json!({"kind":1,"name":"entry","attributes":[{"name":"name","value":value}]}),
            );
            store.append(root, child).unwrap();
            children.push(child);
        }
        let result = store
            .query_collection(root, CollectionFilter::name_attribute(&units("chosen")))
            .unwrap();
        assert_eq!(result.len(), 32);
        for child in children {
            store.release(child).unwrap();
        }
        store.release(root).unwrap();
        assert_eq!(store.statistics().live_nodes, 0.0);
        assert_eq!(store.statistics().data_nodes, 0.0);
        assert_eq!(result.len(), 32);
    }

    #[test]
    fn should_filter_qualified_names_by_captured_html_mode_and_namespace() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":1,"name":"div"}));
        let html = node(
            &mut store,
            json!({"kind":1,"name":"mixed","namespace":HTML_NAMESPACE,"prefix":"p"}),
        );
        let xml = node(
            &mut store,
            json!({"kind":1,"name":"MiXeD","namespace":"urn:xml","prefix":"p"}),
        );
        let text = node(&mut store, json!({"kind":3,"value":"excluded"}));
        store.append(root, html).unwrap();
        store.append(html, xml).unwrap();
        store.append(root, text).unwrap();
        assert_eq!(
            store
                .query_collection(
                    root,
                    CollectionFilter::qualified_name(&units("P:MIXED"), true)
                )
                .unwrap(),
            vec![html]
        );
        assert_eq!(
            store
                .query_collection(
                    root,
                    CollectionFilter::qualified_name(&units("p:MiXeD"), true)
                )
                .unwrap(),
            vec![html, xml]
        );
        assert_eq!(
            store
                .query_collection(
                    root,
                    CollectionFilter::qualified_name(&units("p:MiXeD"), false)
                )
                .unwrap(),
            vec![xml]
        );
        assert!(
            store
                .query_collection(root, CollectionFilter::qualified_name(&units("div"), true))
                .unwrap()
                .is_empty()
        );
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::qualified_name(&units("*"), false))
                .unwrap(),
            vec![html, xml]
        );
    }

    #[test]
    fn should_preserve_namespace_wildcards_and_null_namespace_normalization() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":9}));
        let plain = node(&mut store, json!({"kind":1,"name":"MiXeD"}));
        let namespaced = node(
            &mut store,
            json!({"kind":1,"name":"MiXeD","namespace":"urn:xml","prefix":"p"}),
        );
        let literal_empty = node(&mut store, json!({"kind":1,"name":"MiXeD","namespace":""}));
        for child in [plain, namespaced, literal_empty] {
            store.append(root, child).unwrap();
        }
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::namespace(None, &units("MiXeD")))
                .unwrap(),
            vec![plain]
        );
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::namespace(Some(&[]), &units("*")))
                .unwrap(),
            vec![plain]
        );
        assert_eq!(
            store
                .query_collection(
                    root,
                    CollectionFilter::namespace(Some(&units("*")), &units("MiXeD"))
                )
                .unwrap(),
            vec![plain, namespaced, literal_empty]
        );
        assert_eq!(
            store
                .query_collection(
                    root,
                    CollectionFilter::namespace(Some(&units("urn:xml")), &units("*"))
                )
                .unwrap(),
            vec![namespaced]
        );
        assert!(
            store
                .query_collection(
                    root,
                    CollectionFilter::namespace(Some(&units("*")), &units("mixed"))
                )
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn should_match_classes_with_ascii_whitespace_and_pinned_quirks_folding() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":9}));
        let child = node(
            &mut store,
            json!({"kind":1,"name":"p","attributes":[{"name":"class","value":"Alpha\tbeta\n one\u{000b}two é K"}]}),
        );
        store.append(root, child).unwrap();
        for (query, quirks, matches) in [
            ("Alpha beta", false, true),
            ("alpha BETA", false, false),
            ("alpha BETA", true, true),
            ("beta Alpha Alpha", false, true),
            ("one\u{000b}two", false, true),
            ("one two", false, false),
            ("É", true, true),
            ("k", true, false),
            ("", false, false),
            ("\t\n\u{000c}\r ", true, false),
        ] {
            let actual = store
                .query_collection(root, CollectionFilter::classes(&units(query), quirks))
                .unwrap();
            assert_eq!(
                actual,
                if matches { vec![child] } else { vec![] },
                "{query:?}/{quirks}"
            );
        }
    }

    #[test]
    fn should_keep_surrogates_and_nul_lossless_without_a_selector_fallback() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":9}));
        let child = node(
            &mut store,
            json!({"kind":1,"name":[0xd800],"namespace":[0xdc00],
            "attributes":[{"name":"class","value":[0xd800,32,0,32,0xdc00]}]}),
        );
        store.append(root, child).unwrap();
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::qualified_name(&[0xd800], true))
                .unwrap(),
            vec![child]
        );
        assert_eq!(
            store
                .query_collection(
                    root,
                    CollectionFilter::namespace(Some(&[0xdc00]), &[0xd800])
                )
                .unwrap(),
            vec![child]
        );
        for token in [[0xd800], [0], [0xdc00]] {
            assert_eq!(
                store
                    .query_collection(root, CollectionFilter::classes(&token, true))
                    .unwrap(),
                vec![child]
            );
        }
        assert!(
            store
                .query_collection(root, CollectionFilter::classes(&[0xfffd], false))
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn should_preserve_isolated_non_ascii_quirks_equivalence_without_folding_standard_mode() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":9}));
        let child = node(&mut store, json!({"kind":1,"name":"i"}));
        store.append(root, child).unwrap();
        for (actual, query) in [
            (0x00c9, 0x00e9),
            (0x005b, 0x007b),
            (0x0040, 0x0060),
            (0x0100, 0x0120),
            (0xd800, 0xd820),
            (0xdc00, 0xdc20),
        ] {
            store
                .set_data(
                    child,
                    &json!({"kind":1,"name":"i","attributes":[{"name":"class","value":[actual]}]})
                        .to_string(),
                )
                .unwrap();
            assert_eq!(
                store
                    .query_collection(root, CollectionFilter::classes(&[query], true))
                    .unwrap(),
                vec![child]
            );
            assert!(
                store
                    .query_collection(root, CollectionFilter::classes(&[query], false))
                    .unwrap()
                    .is_empty()
            );
        }
    }

    #[test]
    fn should_read_canonical_attributes_and_live_bounded_tree_order() {
        let mut store = TreeStore::new();
        let outer = node(&mut store, json!({"kind":9}));
        let root = node(&mut store, json!({"kind":1,"name":"p"}));
        let first = node(&mut store, json!({"kind":1,"name":"p"}));
        let second = node(&mut store, json!({"kind":1,"name":"p"}));
        let external = node(&mut store, json!({"kind":1,"name":"p"}));
        store.append(outer, root).unwrap();
        store.append(root, first).unwrap();
        store.append(root, second).unwrap();
        store.append(outer, external).unwrap();
        store.initialize_attribute_collection(first).unwrap();
        let attribute = store.allocate().unwrap();
        store
            .initialize_attribute(attribute, r#"{"kind":2,"name":"class","value":"first"}"#)
            .unwrap();
        store.append_attribute(first, attribute).unwrap();
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::classes(&units("first"), false))
                .unwrap(),
            vec![first]
        );
        store
            .set_attribute_value(attribute, &units("changed"))
            .unwrap();
        assert!(
            store
                .query_collection(root, CollectionFilter::classes(&units("first"), false))
                .unwrap()
                .is_empty()
        );
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::classes(&units("changed"), false))
                .unwrap(),
            vec![first]
        );
        store.remove(first).unwrap();
        store.append(root, first).unwrap();
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::qualified_name(&units("*"), false))
                .unwrap(),
            vec![second, first]
        );
        store.remove(first).unwrap();
        assert_eq!(
            store
                .query_collection(root, CollectionFilter::qualified_name(&units("*"), false))
                .unwrap(),
            vec![second]
        );
    }

    #[test]
    fn should_reject_missing_metadata_and_invalid_handles_without_activation() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":9}));
        let reserved = store.reserve_handles().unwrap();
        let before = store.statistics();
        for invalid in [0.0, -1.0, 0.5, f64::NAN, reserved] {
            assert!(
                store
                    .query_collection(invalid, CollectionFilter::name_attribute(&units("chosen")))
                    .is_err()
            );
            assert!(
                store
                    .query_collection(
                        invalid,
                        CollectionFilter::qualified_name(&units("*"), false)
                    )
                    .is_err()
            );
        }
        assert_eq!(store.statistics().allocations, before.allocations);
        assert_eq!(store.statistics().reserved_handles, before.reserved_handles);
        let missing = store.allocate().unwrap();
        store.append(root, missing).unwrap();
        assert!(
            store
                .query_collection(root, CollectionFilter::name_attribute(&units("chosen")))
                .is_err()
        );
        assert!(
            store
                .query_collection(root, CollectionFilter::qualified_name(&units("*"), false))
                .is_err()
        );
    }
}
