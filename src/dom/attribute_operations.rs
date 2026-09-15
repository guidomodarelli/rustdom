//! DOM attribute lookup and mutation orchestration over canonical native records.
use std::collections::HashSet;

use super::{
    attribute_index::AttributeDelta,
    attributes::AttributeField,
    constants::{ELEMENT_NODE, HTML_NAMESPACE},
    data::{DomString, NodeData},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
    unicode_case::UnicodeCaseMapping,
};

impl TreeStore {
    /// Use the host's case data rather than silently inheriting a newer Rust Unicode table.
    pub fn set_unicode_version(&mut self, version: &str) -> Result<()> {
        self.unicode_case = UnicodeCaseMapping::for_version(version)?;
        Ok(())
    }
    /// Select a bundled profile, leaving the active profile intact when unavailable.
    pub fn try_set_unicode_version(&mut self, version: &str) -> bool {
        if let Ok(profile) = UnicodeCaseMapping::for_version(version) {
            self.unicode_case = profile;
            true
        } else {
            false
        }
    }
    /// Decode the host buffer atomically; the Node-API adapter excludes shared backing memory.
    pub fn set_host_unicode_case_buffer(&mut self, bytes: &[u8]) -> Result<()> {
        self.unicode_case = UnicodeCaseMapping::from_host_buffer(bytes)?;
        Ok(())
    }
    fn element(&self, id: NodeId) -> Result<&NodeData> {
        self.data
            .get(&id)
            .filter(|data| data.kind == ELEMENT_NODE)
            .ok_or(TreeError::NotElement(id))
    }
    /// Initialize canonical ownership without silently replacing snapshot-only attributes.
    pub fn initialize_attribute_collection(&mut self, handle: f64) -> Result<()> {
        self.initialize_attribute_collection_id(node_id(handle)?)
    }
    /// Shared snapshot boundary; target-type restrictions remain with each operation.
    fn validate_attribute_snapshot(&self, id: NodeId, data: &NodeData) -> Result<()> {
        if !data.attributes.is_empty() && !self.attribute_collections.elements.contains_key(&id) {
            return Err(TreeError::NonEmptyAttributeSnapshot(id));
        }
        Ok(())
    }
    /// All implicit collection creation commits only after its caller validates Attr/owner inputs.
    fn initialize_attribute_collection_id(&mut self, id: NodeId) -> Result<()> {
        if let Some(data) = self.data.get(&id) {
            if data.kind != ELEMENT_NODE {
                return Err(TreeError::NotElement(id));
            }
            self.validate_attribute_snapshot(id, data)?;
        }
        self.activate(id)?;
        self.attribute_collections.initialize(id);
        Ok(())
    }
    fn attribute_key(&self, id: NodeId) -> Result<Vec<u16>> {
        Ok(self
            .attribute_field(id as f64, AttributeField::QualifiedName)?
            .expect("validated Attr name"))
    }
    /// Keep the observable owner-update count without duplicating its canonical payloads.
    pub(crate) fn record_attribute_change(&mut self, element: NodeId) {
        if self.data.contains_key(&element) {
            self.data_updates += 1;
        }
    }
    /// Update element metadata without replacing its canonical Attr collection.
    pub fn set_element_metadata(&mut self, handle: f64, data: NodeData) -> Result<()> {
        let id = node_id(handle)?;
        if data.kind != ELEMENT_NODE {
            return Err(TreeError::NotElement(id));
        }
        if let Some(previous) = self.data.get(&id) {
            self.validate_attribute_snapshot(id, previous)?;
        }
        self.replace_data(handle, data)
    }
    pub fn attribute_ids(&self, handle: f64) -> Result<Vec<f64>> {
        let id = node_id(handle)?;
        self.links(id)?;
        Ok(self
            .attribute_collections
            .elements
            .get(&id)
            .map(|index| index.ordered.iter().map(|&id| id as f64).collect())
            .unwrap_or_default())
    }
    pub fn attribute_count(&self, handle: f64) -> Result<usize> {
        let id = node_id(handle)?;
        self.links(id)?;
        Ok(self
            .attribute_collections
            .elements
            .get(&id)
            .map_or(0, |index| index.ordered.len()))
    }
    pub fn attribute_at(&self, handle: f64, position: u32) -> Result<f64> {
        let id = node_id(handle)?;
        self.links(id)?;
        Ok(self
            .attribute_collections
            .elements
            .get(&id)
            .and_then(|index| index.ordered.get(position as usize))
            .copied()
            .unwrap_or(0) as f64)
    }
    pub fn attribute_owner(&self, handle: f64) -> Result<f64> {
        let id = node_id(handle)?;
        self.attribute(id)?;
        Ok(self
            .attribute_collections
            .owners
            .get(&id)
            .copied()
            .unwrap_or(0) as f64)
    }
    /// Constructor compatibility for an owner supplied before collection insertion.
    pub fn initialize_attribute_owner(
        &mut self,
        attribute: f64,
        element: Option<f64>,
    ) -> Result<()> {
        let id = node_id(attribute)?;
        self.attribute(id)?;
        if self.attribute_collections.has_references(id) {
            return Err(TreeError::AttributeInUse(id));
        }
        if let Some(element) = element {
            let element = node_id(element)?;
            self.element(element)?;
            self.initialize_attribute_collection_id(element)?;
            self.attribute_collections.set_initial_owner(id, element);
        }
        Ok(())
    }
    pub fn contains_attribute(&self, element: f64, attribute: f64) -> Result<bool> {
        let element = node_id(element)?;
        let attribute = node_id(attribute)?;
        self.links(element)?;
        Ok(self
            .attribute_collections
            .elements
            .get(&element)
            .is_some_and(|index| index.ordered.contains(&attribute)))
    }
    pub fn attribute_by_name(
        &self,
        element: f64,
        name: &[u16],
        html_document: bool,
    ) -> Result<f64> {
        let element = node_id(element)?;
        let data = self.element(element)?;
        let folded;
        let name = if html_document
            && data.namespace.as_ref().and_then(DomString::as_str) == Some(HTML_NAMESPACE)
        {
            folded = name
                .iter()
                .map(|&unit| {
                    if (65..=90).contains(&unit) {
                        unit + 32
                    } else {
                        unit
                    }
                })
                .collect::<Vec<_>>();
            &folded
        } else {
            name
        };
        Ok(self
            .attribute_collections
            .elements
            .get(&element)
            .and_then(|index| index.names.get(name))
            .and_then(|entry| entry.first())
            .copied()
            .unwrap_or(0) as f64)
    }
    pub fn attribute_by_namespace(
        &self,
        element: f64,
        namespace: Option<&[u16]>,
        name: &[u16],
    ) -> Result<f64> {
        let element = node_id(element)?;
        self.element(element)?;
        let Some(index) = self.attribute_collections.elements.get(&element) else {
            return Ok(0.0);
        };
        for &id in &index.ordered {
            let data = self.attribute(id)?;
            let namespace_matches = match (&data.namespace, namespace) {
                (None, None) => true,
                (Some(actual), Some(expected)) => actual.units().eq(expected.iter().copied()),
                _ => false,
            };
            if namespace_matches
                && data
                    .name
                    .as_ref()
                    .expect("Attr name")
                    .units()
                    .eq(name.iter().copied())
            {
                return Ok(id as f64);
            }
        }
        Ok(0.0)
    }
    pub fn attribute_names(
        &self,
        element: f64,
        supported: bool,
        html_document: bool,
    ) -> Result<Vec<Vec<u16>>> {
        let id = node_id(element)?;
        let data = self.element(id)?;
        let filter_uppercase = supported
            && html_document
            && data.namespace.as_ref().and_then(DomString::as_str) == Some(HTML_NAMESPACE);
        let Some(index) = self.attribute_collections.elements.get(&id) else {
            return Ok(Vec::new());
        };
        let mut names = Vec::with_capacity(index.ordered.len());
        for &attribute in &index.ordered {
            let name = self.attribute_key(attribute)?;
            if filter_uppercase
                && std::char::decode_utf16(name.iter().copied()).any(|character| {
                    character
                        .is_ok_and(|character| self.unicode_case.changes_when_lowercased(character))
                })
            {
                continue;
            }
            names.push(name);
        }
        if supported {
            // Borrow the completed output so deduplication never clones its UTF-16 payloads.
            // RandomState protects caller-controlled names; retention preserves first-seen order.
            let retained: Vec<bool> = {
                let mut seen = HashSet::with_capacity(names.len());
                names
                    .iter()
                    .map(|name| seen.insert(name.as_slice()))
                    .collect()
            };
            let mut retained = retained.into_iter();
            names.retain(|_| retained.next().expect("one decision per attribute name"));
        }
        Ok(names)
    }
    fn validate_attribute_insertion(&self, element: NodeId, attribute: NodeId) -> Result<()> {
        self.element(element)?;
        self.attribute(attribute)?;
        if self
            .attribute_collections
            .owners
            .get(&attribute)
            .is_some_and(|&owner| owner != element)
        {
            return Err(TreeError::AttributeInUse(attribute));
        }
        Ok(())
    }
    pub fn append_attribute(&mut self, element: f64, attribute: f64) -> Result<AttributeDelta> {
        let element_id = node_id(element)?;
        let attribute_id = node_id(attribute)?;
        self.validate_attribute_insertion(element_id, attribute_id)?;
        if self.contains_attribute(element, attribute)? {
            return Err(TreeError::AttributeInUse(attribute_id));
        }
        let name = self.attribute_key(attribute_id)?;
        self.initialize_attribute_collection_id(element_id)?;
        let delta = self
            .attribute_collections
            .append(element_id, attribute_id, name);
        self.record_attribute_change(element_id);
        Ok(delta)
    }
    /// Select append/replace/no-op in native code, including the in-use guard.
    pub fn set_attribute(&mut self, element: f64, attribute: f64) -> Result<AttributeDelta> {
        let element_id = node_id(element)?;
        let attribute_id = node_id(attribute)?;
        self.validate_attribute_insertion(element_id, attribute_id)?;
        let data = self.attribute(attribute_id)?;
        let namespace = data
            .namespace
            .as_ref()
            .map(|value| value.units().collect::<Vec<_>>());
        let name = data
            .name
            .as_ref()
            .expect("Attr name")
            .units()
            .collect::<Vec<_>>();
        let previous = self.attribute_by_namespace(element, namespace.as_deref(), &name)?;
        if previous == attribute {
            return Ok(AttributeDelta {
                previous: attribute_id,
                ..AttributeDelta::default()
            });
        }
        if previous == 0.0 {
            self.append_attribute(element, attribute)
        } else {
            self.replace_attribute(element, previous, attribute)
        }
    }
    pub fn remove_attribute(&mut self, element: f64, attribute: f64) -> Result<AttributeDelta> {
        let element = node_id(element)?;
        let attribute = node_id(attribute)?;
        self.element(element)?;
        let name = self.attribute_key(attribute)?;
        self.initialize_attribute_collection_id(element)?;
        let delta = self.attribute_collections.remove(element, attribute, &name);
        if delta.changed {
            self.record_attribute_change(element);
        }
        Ok(delta)
    }
    pub fn replace_attribute(
        &mut self,
        element: f64,
        old: f64,
        new: f64,
    ) -> Result<AttributeDelta> {
        let element = node_id(element)?;
        let old = node_id(old)?;
        let new = node_id(new)?;
        self.validate_attribute_insertion(element, new)?;
        self.attribute(old)?;
        if old != new
            && self
                .attribute_collections
                .elements
                .get(&element)
                .is_some_and(|index| index.ordered.contains(&new))
        {
            return Err(TreeError::AttributeInUse(new));
        }
        let name = self.attribute_key(new)?;
        self.initialize_attribute_collection_id(element)?;
        let delta = self.attribute_collections.replace(element, old, new, name);
        if delta.changed {
            self.record_attribute_change(element);
        }
        Ok(delta)
    }
    pub(crate) fn release_attribute_references(&mut self, id: NodeId) -> Result<()> {
        // Only indexed/owned Attrs need a qualified key. Raw unindexed snapshots may
        // lack a name and must still be releasable, just like nodes without metadata.
        let name = if self.attribute_collections.has_references(id) {
            Some(self.attribute_key(id)?)
        } else {
            None
        };
        let affected = self.attribute_collections.release_node(id, name.as_deref());
        for element in affected {
            self.record_attribute_change(element);
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "attribute_transition_tests.rs"]
mod transition_tests;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_reject_nonempty_snapshot_collection_initialization_atomically() {
        let mut tree = TreeStore::new();
        let element = tree.allocate().unwrap();
        tree.set_data(element, r#"{"kind":1,"name":"div","namespace":"http://www.w3.org/1999/xhtml","attributes":[{"name":"id","value":"retained"}]}"#).unwrap();
        let before = tree.statistics();
        for _ in 0..32 {
            assert!(
                matches!(tree.initialize_attribute_collection(element), Err(TreeError::NonEmptyAttributeSnapshot(id)) if id == element as u64)
            );
        }
        let after = tree.statistics();
        assert_eq!(after.live_nodes, before.live_nodes);
        assert_eq!(after.allocations, before.allocations);
        assert_eq!(after.reserved_handles, before.reserved_handles);
        assert_eq!(after.attribute_collections, before.attribute_collections);
        assert_eq!(after.data_updates, before.data_updates);
        assert_eq!(after.mutations, before.mutations);
        assert_eq!(after.serializations, before.serializations);
        assert!(tree.attribute_ids(element).unwrap().is_empty());
        assert_eq!(
            String::from_utf16(&tree.serialize_html(element, true, false).unwrap()).unwrap(),
            "<div id=\"retained\"></div>"
        );
        tree.release(element).unwrap();
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_preserve_early_empty_and_idempotent_canonical_initialization() {
        let mut tree = TreeStore::new();
        let first = tree.reserve_handles().unwrap();
        tree.initialize_attribute_collection(first).unwrap();
        assert_eq!(tree.statistics().allocations, 1.0);
        let metadata = || NodeData {
            kind: ELEMENT_NODE,
            name: Some(DomString::Text("div".into())),
            namespace: Some(DomString::Text(HTML_NAMESPACE.into())),
            ..NodeData::default()
        };
        tree.set_element_metadata(first, metadata()).unwrap();
        let second = first + 1.0;
        tree.replace_snapshot(second, metadata()).unwrap();
        tree.initialize_attribute_collection(second).unwrap();
        let attribute = first + 2.0;
        tree.initialize_attribute(attribute, r#"{"kind":2,"name":"id","value":"retained"}"#)
            .unwrap();
        tree.append_attribute(first, attribute).unwrap();
        let before = tree.statistics();
        tree.initialize_attribute_collection(first).unwrap();
        assert_eq!(
            tree.statistics().attribute_collections,
            before.attribute_collections
        );
        assert_eq!(tree.statistics().data_updates, before.data_updates);
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.attribute_ids(first).unwrap(), vec![attribute]);
        assert_eq!(tree.attribute_owner(attribute).unwrap(), first);
        for offset in 0..super::super::store::HANDLE_BATCH_SIZE {
            tree.release(first + offset as f64).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert_eq!(tree.statistics().attribute_collections, 0.0);
    }

    #[test]
    fn should_reject_non_element_metadata_before_creating_an_attribute_collection() {
        let mut tree = TreeStore::new();
        let handle = tree.allocate().unwrap();
        tree.set_data(handle, r#"{"kind":3,"value":"retained"}"#)
            .unwrap();
        let before = tree.statistics();
        assert!(
            matches!(tree.initialize_attribute_collection(handle), Err(TreeError::NotElement(id)) if id == handle as u64)
        );
        assert_eq!(
            tree.statistics().attribute_collections,
            before.attribute_collections
        );
        assert_eq!(tree.statistics().data_updates, before.data_updates);
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(
            tree.character_data(handle).unwrap(),
            "retained".encode_utf16().collect::<Vec<_>>()
        );
    }

    #[test]
    fn should_preserve_first_seen_names_across_large_namespace_duplicate_collections() {
        let mut tree = TreeStore::new();
        let element = tree.allocate().unwrap();
        tree.initialize_attribute_collection(element).unwrap();
        tree.set_element_metadata(
            element,
            serde_json::from_str(
                r#"{"kind":1,"name":"div","namespace":"http://www.w3.org/1999/xhtml"}"#,
            )
            .unwrap(),
        )
        .unwrap();
        let mut handles = Vec::new();
        let mut all_names = Vec::new();
        let mut supported_names = Vec::new();
        for namespace in ["urn:first", "urn:second"] {
            for index in 0..512 {
                let name = if index % 11 == 0 {
                    format!("UPPER-{index}")
                } else {
                    format!("name-{index}")
                };
                let qualified_name: Vec<_> = format!("p:{name}").encode_utf16().collect();
                if namespace == "urn:first" && index % 11 != 0 {
                    supported_names.push(qualified_name.clone());
                }
                all_names.push(qualified_name);
                let attribute = tree.allocate().unwrap();
                handles.push(attribute);
                tree.initialize_attribute(
                    attribute,
                    &serde_json::json!({ "kind": 2,
                    "name": name, "prefix": "p", "namespace": namespace, "value": "" })
                    .to_string(),
                )
                .unwrap();
                tree.append_attribute(element, attribute).unwrap();
            }
        }
        let before = tree.statistics();
        for _ in 0..12 {
            assert_eq!(
                tree.attribute_names(element, true, true).unwrap(),
                supported_names
            );
            assert_eq!(
                tree.attribute_names(element, false, true).unwrap(),
                all_names
            );
            assert_eq!(
                tree.attribute_names(element, true, false).unwrap(),
                all_names[..512]
            );
        }
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().data_updates, before.data_updates);
        assert_eq!(
            tree.statistics().attribute_holders,
            before.attribute_holders
        );
        tree.release(element).unwrap();
        for attribute in handles {
            tree.release(attribute).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert_eq!(tree.statistics().attribute_holders, 0.0);
    }

    #[test]
    fn should_use_host_unicode_tables_for_supported_attribute_names() {
        let mut tree = TreeStore::new();
        let element = tree.allocate().unwrap();
        tree.initialize_attribute_collection(element).unwrap();
        tree.set_element_metadata(
            element,
            serde_json::from_str(
                r#"{"kind":1,"name":"div","namespace":"http://www.w3.org/1999/xhtml"}"#,
            )
            .unwrap(),
        )
        .unwrap();
        // A7CB acquired lowercase in Unicode 16; A7CE acquired it in Unicode 17.
        // Sharp s and ligatures have explicit identity lowercase table entries.
        let names = ["lower", "UPPER", "ß", "ﬀ", "İ", "\u{a7cb}", "\u{a7ce}"];
        for name in names {
            let attribute = tree.allocate().unwrap();
            tree.initialize_attribute(
                attribute,
                &serde_json::json!({ "kind": 2, "name": name, "value": "case" }).to_string(),
            )
            .unwrap();
            tree.append_attribute(element, attribute).unwrap();
        }
        let all_names: Vec<Vec<u16>> = names
            .iter()
            .map(|name| name.encode_utf16().collect())
            .collect();
        for (version, expected) in [
            ("15.1", vec!["lower", "ß", "ﬀ", "\u{a7cb}", "\u{a7ce}"]),
            ("16.0", vec!["lower", "ß", "ﬀ", "\u{a7ce}"]),
            ("17.0", vec!["lower", "ß", "ﬀ"]),
        ] {
            tree.set_unicode_version(version).unwrap();
            let expected: Vec<Vec<u16>> = expected
                .iter()
                .map(|name| name.encode_utf16().collect())
                .collect();
            assert_eq!(
                tree.attribute_names(element, true, true).unwrap(),
                expected,
                "Unicode {version}"
            );
            assert_eq!(
                tree.attribute_names(element, false, true).unwrap(),
                all_names
            );
            assert_eq!(
                tree.attribute_names(element, true, false).unwrap(),
                all_names
            );
            // A rejected host version must leave the previous behavior intact.
            assert!(tree.set_unicode_version("unsupported").is_err());
            assert_eq!(tree.attribute_names(element, true, true).unwrap(), expected);
        }
    }

    #[test]
    fn should_copy_host_case_changes_and_reject_invalid_profiles_atomically() {
        let mut tree = TreeStore::new();
        let element = tree.allocate().unwrap();
        tree.set_data(
            element,
            r#"{"kind":1,"name":"div","namespace":"http://www.w3.org/1999/xhtml"}"#,
        )
        .unwrap();
        tree.initialize_attribute_collection(element).unwrap();
        for name in ["A", "a", "ß", "\u{a7cb}"] {
            let attribute = tree.allocate().unwrap();
            tree.initialize_attribute(
                attribute,
                &serde_json::json!({ "kind": 2, "name": name, "value": "case" }).to_string(),
            )
            .unwrap();
            tree.append_attribute(element, attribute).unwrap();
        }

        let mut changes: Vec<u8> = [u32::from('A'), 0xa7cb]
            .into_iter()
            .flat_map(u32::to_ne_bytes)
            .collect();
        tree.set_host_unicode_case_buffer(&changes).unwrap();
        changes.fill(0);
        let expected = vec![vec![u16::from(b'a')], vec![0xdf]];
        assert_eq!(tree.attribute_names(element, true, true).unwrap(), expected);
        for invalid in [vec![0xd800_u32], vec![0x110000], vec![65, 65], vec![66, 65]] {
            let bytes: Vec<u8> = invalid.into_iter().flat_map(u32::to_ne_bytes).collect();
            assert!(matches!(
                tree.set_host_unicode_case_buffer(&bytes),
                Err(TreeError::InvalidUnicodeCaseChanges)
            ));
            assert_eq!(tree.attribute_names(element, true, true).unwrap(), expected);
        }
        assert!(!tree.try_set_unicode_version("unbundled-test-profile"));
        assert_eq!(tree.attribute_names(element, true, true).unwrap(), expected);
        assert!(tree.try_set_unicode_version("15.1"));
        assert_eq!(
            tree.attribute_names(element, true, true).unwrap(),
            vec![vec![u16::from(b'a')], vec![0xdf], vec![0xa7cb]]
        );
    }
}
