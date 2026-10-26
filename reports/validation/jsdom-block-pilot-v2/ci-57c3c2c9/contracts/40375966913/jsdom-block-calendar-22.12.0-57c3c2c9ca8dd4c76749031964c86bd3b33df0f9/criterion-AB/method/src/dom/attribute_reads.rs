//! Element value and presence reads borrow canonical Attr data without creating a wrapper or cache.
use super::{data::DomString, error::Result, store::TreeStore};

impl TreeStore {
    /// Qualified names use the same legacy alias index and HTML ASCII folding as getAttributeNode.
    pub fn attribute_value_by_name(
        &self,
        element: f64,
        name: &[u16],
        html_document: bool,
    ) -> Result<Option<&DomString>> {
        self.attribute_by_name_id(element, name, html_document)?
            .map(|attribute| self.attribute(attribute).map(|data| &data.value))
            .transpose()
    }

    /// Public namespace reads normalize only an empty namespace; local names remain exact UTF-16.
    pub fn attribute_value_by_namespace(
        &self,
        element: f64,
        namespace: Option<&[u16]>,
        name: &[u16],
    ) -> Result<Option<&DomString>> {
        self.attribute_by_namespace_id(element, namespace.filter(|units| !units.is_empty()), name)?
            .map(|attribute| self.attribute(attribute).map(|data| &data.value))
            .transpose()
    }

    pub fn has_attribute_by_name(
        &self,
        element: f64,
        name: &[u16],
        html_document: bool,
    ) -> Result<bool> {
        self.attribute_by_name_id(element, name, html_document)
            .map(|attribute| attribute.is_some())
    }

    pub fn has_attribute_by_namespace(
        &self,
        element: f64,
        namespace: Option<&[u16]>,
        name: &[u16],
    ) -> Result<bool> {
        self.attribute_by_namespace_id(element, namespace.filter(|units| !units.is_empty()), name)
            .map(|attribute| attribute.is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dom::{constants::HTML_NAMESPACE, data::NodeData, error::TreeError};

    fn units(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }

    fn element(tree: &mut TreeStore, namespace: &str) -> f64 {
        let handle = tree.allocate().unwrap();
        tree.set_element_metadata(
            handle,
            NodeData {
                kind: 1,
                name: Some(DomString::Text("entry".into())),
                namespace: Some(DomString::Text(namespace.into())),
                ..NodeData::default()
            },
        )
        .unwrap();
        tree.initialize_attribute_collection(handle).unwrap();
        handle
    }

    fn attribute(tree: &mut TreeStore, element: f64, encoded: &str) -> f64 {
        let handle = tree.allocate().unwrap();
        tree.initialize_attribute(handle, encoded).unwrap();
        tree.append_attribute(element, handle).unwrap();
        handle
    }

    #[test]
    fn should_fold_only_ascii_names_on_html_elements_in_html_documents() {
        let mut tree = TreeStore::new();
        for namespace in [HTML_NAMESPACE, "urn:foreign"] {
            let owner = element(&mut tree, namespace);
            attribute(
                &mut tree,
                owner,
                r#"{"kind":2,"name":"DATA","value":"upper"}"#,
            );
            attribute(
                &mut tree,
                owner,
                r#"{"kind":2,"name":"data","value":"lower"}"#,
            );
            attribute(
                &mut tree,
                owner,
                r#"{"kind":2,"name":"Ä","value":"non-ascii"}"#,
            );
            for html in [false, true] {
                let expected = if html && namespace == HTML_NAMESPACE {
                    "lower"
                } else {
                    "upper"
                };
                assert_eq!(
                    tree.attribute_value_by_name(owner, &units("DATA"), html)
                        .unwrap()
                        .unwrap()
                        .as_str(),
                    Some(expected)
                );
                assert_eq!(
                    tree.has_attribute_by_name(owner, &units("DaTa"), html)
                        .unwrap(),
                    html && namespace == HTML_NAMESPACE
                );
                assert!(
                    !tree
                        .has_attribute_by_name(owner, &units("ä"), html)
                        .unwrap()
                );
                assert!(
                    tree.has_attribute_by_name(owner, &units("Ä"), html)
                        .unwrap()
                );
            }
        }
    }

    #[test]
    fn should_preserve_alias_values_after_replacement_removal_and_owner_transfer() {
        let mut tree = TreeStore::new();
        let owner = element(&mut tree, HTML_NAMESPACE);
        let other = element(&mut tree, "urn:other");
        let first = attribute(
            &mut tree,
            owner,
            r#"{"kind":2,"name":"key","prefix":"p","namespace":"urn:one","value":"first"}"#,
        );
        let replacement = tree.allocate().unwrap();
        tree.initialize_attribute(
            replacement,
            r#"{"kind":2,"name":"key","prefix":"q","namespace":"urn:one","value":"replacement"}"#,
        )
        .unwrap();
        tree.set_attribute(owner, replacement).unwrap();
        tree.remove_attribute(owner, replacement).unwrap();
        tree.set_attribute(other, first).unwrap();
        tree.set_attribute_value(first, &units("moved")).unwrap();
        assert_eq!(
            tree.attribute_value_by_name(owner, &units("p:key"), false)
                .unwrap()
                .unwrap()
                .as_str(),
            Some("moved")
        );
        assert!(
            tree.has_attribute_by_name(owner, &units("p:key"), false)
                .unwrap()
        );
        assert!(
            tree.attribute_value_by_namespace(owner, Some(&units("urn:one")), &units("key"))
                .unwrap()
                .is_none()
        );
        tree.release(first).unwrap();
        assert!(
            !tree
                .has_attribute_by_name(owner, &units("p:key"), false)
                .unwrap()
        );
    }

    #[test]
    fn should_distinguish_absence_from_empty_values_and_normalize_empty_namespace() {
        let mut tree = TreeStore::new();
        let owner = element(&mut tree, HTML_NAMESPACE);
        attribute(&mut tree, owner, r#"{"kind":2,"name":"key","value":""}"#);
        attribute(
            &mut tree,
            owner,
            r#"{"kind":2,"name":"key","prefix":"p","namespace":"urn:one","value":"foreign"}"#,
        );
        for namespace in [None, Some(&[][..])] {
            assert_eq!(
                tree.attribute_value_by_namespace(owner, namespace, &units("key"))
                    .unwrap()
                    .unwrap()
                    .as_str(),
                Some("")
            );
            assert!(
                tree.has_attribute_by_namespace(owner, namespace, &units("key"))
                    .unwrap()
            );
            assert!(
                tree.attribute_value_by_namespace(owner, namespace, &units("missing"))
                    .unwrap()
                    .is_none()
            );
        }
        assert_eq!(
            tree.attribute_by_namespace(owner, Some(&[]), &units("key"))
                .unwrap(),
            0.0
        );
        assert_eq!(
            tree.attribute_value_by_namespace(owner, Some(&units("urn:one")), &units("key"))
                .unwrap()
                .unwrap()
                .as_str(),
            Some("foreign")
        );
        assert!(
            !tree
                .has_attribute_by_namespace(owner, Some(&units("urn:one")), &units("p:key"))
                .unwrap()
        );
    }

    #[test]
    fn should_borrow_current_lossless_payloads_without_retaining_released_nodes() {
        let mut tree = TreeStore::new();
        let owner = element(&mut tree, HTML_NAMESPACE);
        let handle = attribute(
            &mut tree,
            owner,
            r#"{"kind":2,"name":"key","namespace":[117,114,110,58,0,55296],"value":"initial"}"#,
        );
        let namespace = [117, 114, 110, 58, 0, 55296];
        for value in [vec![], vec![0, 55296, 56320, 55297], vec![55296; 4096]] {
            tree.set_attribute_value(handle, &value).unwrap();
            assert_eq!(
                tree.attribute_value_by_name(owner, &units("key"), false)
                    .unwrap()
                    .unwrap()
                    .units()
                    .collect::<Vec<_>>(),
                value
            );
            assert_eq!(
                tree.attribute_value_by_namespace(owner, Some(&namespace), &units("key"))
                    .unwrap()
                    .unwrap()
                    .units()
                    .collect::<Vec<_>>(),
                value
            );
        }
        tree.release(owner).unwrap();
        tree.release(handle).unwrap();
        let statistics = tree.statistics();
        assert_eq!(statistics.live_nodes, 0.0);
        assert_eq!(statistics.attribute_collections, 0.0);
        assert_eq!(statistics.attribute_owners, 0.0);
        assert_eq!(statistics.attribute_holders, 0.0);
    }

    #[test]
    fn should_reject_invalid_handles_and_node_kinds_without_mutation() {
        let mut tree = TreeStore::new();
        let text = tree.allocate().unwrap();
        tree.set_data(text, r#"{"kind":3,"value":"retained"}"#)
            .unwrap();
        let before = tree.statistics();
        for handle in [f64::NAN, 0.0, -1.0, 1.5] {
            assert!(matches!(
                tree.attribute_value_by_name(handle, &units("key"), false),
                Err(TreeError::InvalidHandle)
            ));
            assert!(matches!(
                tree.has_attribute_by_namespace(handle, None, &units("key")),
                Err(TreeError::InvalidHandle)
            ));
        }
        assert!(matches!(
            tree.attribute_value_by_namespace(text, None, &units("key")),
            Err(TreeError::NotElement(_))
        ));
        assert!(matches!(
            tree.has_attribute_by_name(text, &units("key"), false),
            Err(TreeError::NotElement(_))
        ));
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().data_updates, before.data_updates);
        assert_eq!(
            tree.statistics().attribute_collections,
            before.attribute_collections
        );
    }

    #[test]
    fn should_keep_snapshot_only_lookup_contract_without_creating_collections() {
        let mut tree = TreeStore::new();
        let owner = tree.allocate().unwrap();
        tree.set_data(
            owner,
            r#"{"kind":1,"name":"entry","attributes":[{"name":"key","value":"snapshot"}]}"#,
        )
        .unwrap();
        assert!(
            tree.attribute_value_by_name(owner, &units("key"), false)
                .unwrap()
                .is_none()
        );
        assert!(
            !tree
                .has_attribute_by_namespace(owner, None, &units("key"))
                .unwrap()
        );
        assert_eq!(tree.statistics().attribute_collections, 0.0);
        assert_eq!(
            tree.serialize_html(owner, true, false).unwrap(),
            units("<entry key=\"snapshot\"></entry>")
        );
    }
}
