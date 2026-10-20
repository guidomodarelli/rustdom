//! Live descendant filtering for getElementsBy* over canonical native metadata and attributes.
use super::{
    constants::{CLASS_ATTRIBUTE_NAME, ELEMENT_NODE, HTML_NAMESPACE, QUIRKS_CLASS_CASE_MASK},
    data::{DomString, NodeData},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
    token_list::{TokenSet, html_space},
};

pub(super) enum CollectionFilter<'a> {
    Classes {
        tokens: TokenSet,
        quirks: bool,
    },
    QualifiedName {
        name: &'a [u16],
        html_name: Option<Vec<u16>>,
    },
    Namespace {
        namespace: Option<&'a [u16]>,
        local_name: &'a [u16],
    },
}

fn ascii_lowercase(unit: u16) -> u16 {
    u8::try_from(unit).map_or(unit, |byte| u16::from(byte.to_ascii_lowercase()))
}

fn equals(value: &DomString, expected: &[u16]) -> bool {
    value.units().eq(expected.iter().copied())
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

impl<'a> CollectionFilter<'a> {
    pub fn classes(value: &[u16], quirks: bool) -> Self {
        Self::Classes {
            tokens: TokenSet::parse(value),
            quirks,
        }
    }

    pub fn qualified_name(name: &'a [u16], html_document: bool) -> Self {
        Self::QualifiedName {
            name,
            html_name: html_document.then(|| name.iter().copied().map(ascii_lowercase).collect()),
        }
    }

    pub fn namespace(namespace: Option<&'a [u16]>, local_name: &'a [u16]) -> Self {
        Self::Namespace {
            namespace: namespace.filter(|value| !value.is_empty()),
            local_name,
        }
    }

    fn matches(&self, store: &TreeStore, node: NodeId, data: &NodeData) -> Result<bool> {
        match self {
            Self::Classes { tokens, quirks } => {
                for attribute in store.attribute_views_for_data(node, data) {
                    let attribute = attribute?;
                    if attribute.namespace.is_none()
                        && attribute
                            .name
                            .units()
                            .eq(CLASS_ATTRIBUTE_NAME.encode_utf16())
                    {
                        return Ok(tokens
                            .iter()
                            .all(|token| contains_class(attribute.value, token, *quirks)));
                    }
                }
                Ok(false)
            }
            Self::QualifiedName { name, html_name } => {
                if *name == [u16::from(b'*')] {
                    return Ok(true);
                }
                let Some(local_name) = &data.name else {
                    return Ok(false);
                };
                let html_namespace = data
                    .namespace
                    .as_ref()
                    .is_some_and(|namespace| namespace.units().eq(HTML_NAMESPACE.encode_utf16()));
                let expected = html_name
                    .as_deref()
                    .filter(|_| html_namespace)
                    .unwrap_or(name);
                let prefix = data.prefix.as_ref();
                let qualified_name = prefix
                    .into_iter()
                    .flat_map(DomString::units)
                    .chain(prefix.map(|_| u16::from(b':')))
                    .chain(local_name.units());
                Ok(qualified_name.eq(expected.iter().copied()))
            }
            Self::Namespace {
                namespace,
                local_name,
            } => {
                let namespace_matches = match namespace {
                    Some(expected) if *expected == [u16::from(b'*')] => true,
                    Some(expected) => data
                        .namespace
                        .as_ref()
                        .is_some_and(|actual| equals(actual, expected)),
                    None => data.namespace.is_none(),
                };
                Ok(namespace_matches
                    && (*local_name == [u16::from(b'*')]
                        || data
                            .name
                            .as_ref()
                            .is_some_and(|actual| equals(actual, local_name))))
            }
        }
    }
}

impl TreeStore {
    /// Exclude the root and external trees. Only the returned numeric IDs escape this call.
    pub(super) fn query_collection(
        &self,
        handle: f64,
        filter: CollectionFilter<'_>,
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
                .query_collection(root, CollectionFilter::qualified_name(&units("*"), false))
                .is_err()
        );
    }
}
