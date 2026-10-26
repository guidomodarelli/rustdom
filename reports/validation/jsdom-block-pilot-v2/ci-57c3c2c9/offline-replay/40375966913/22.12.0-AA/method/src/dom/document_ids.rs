//! Registration-ordered Document ID indexes containing only numeric identities and shared UTF-16 keys.
use std::sync::Arc;

use rustc_hash::FxBuildHasher;

use super::{
    compact_storage::{CompactMap, compact_vector},
    constants::{DOCUMENT_NODE, ELEMENT_NODE},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};

type NodeMap<Value> = CompactMap<NodeId, Value, FxBuildHasher>;
type IdKey = Arc<[u16]>;

#[derive(Default)]
struct DocumentIds {
    names: CompactMap<IdKey, Vec<NodeId>>,
}

struct Membership {
    document: NodeId,
    key: IdKey,
}

#[derive(Default)]
pub(crate) struct DocumentIdRegistry {
    documents: NodeMap<DocumentIds>,
    elements: NodeMap<Vec<Membership>>,
}

pub(crate) struct DocumentIdStatistics {
    pub documents: usize,
    pub names: usize,
    pub entries: usize,
    pub elements: usize,
    pub memberships: usize,
    pub key_units: usize,
    pub document_capacity: usize,
    pub element_capacity: usize,
    pub name_capacity: usize,
    pub entry_capacity: usize,
}

impl DocumentIdRegistry {
    fn key(&self, document: NodeId, value: &[u16]) -> IdKey {
        self.documents
            .get(&document)
            .and_then(|index| index.names.get_key_value(value))
            .map(|(key, _)| Arc::clone(key))
            .unwrap_or_else(|| Arc::from(value))
    }

    fn attach_key(&mut self, document: NodeId, element: NodeId, key: IdKey) {
        self.documents
            .entry(document)
            .or_default()
            .names
            .entry(Arc::clone(&key))
            .or_default()
            .push(element);
        let memberships = self.elements.entry(element).or_default();
        if !memberships
            .iter()
            .any(|membership| membership.document == document && membership.key == key)
        {
            memberships.push(Membership { document, key });
        }
    }

    fn detach_member(&mut self, document: NodeId, element: NodeId, key: &[u16]) {
        if let Some(index) = self.documents.get_mut(&document) {
            if let Some(entries) = index.names.get_mut(key) {
                entries.retain(|candidate| *candidate != element);
                compact_vector(entries);
                if entries.is_empty() {
                    index.names.remove(key);
                }
            }
            index.names.compact();
        }
        if let Some(memberships) = self.elements.get_mut(&element) {
            memberships.retain(|membership| {
                membership.document != document || membership.key.as_ref() != key
            });
            compact_vector(memberships);
        }
    }

    fn compact_empty(&mut self, document: NodeId, element: NodeId) {
        if self
            .documents
            .get(&document)
            .is_some_and(|index| index.names.is_empty())
        {
            self.documents.remove(&document);
        }
        if self.elements.get(&element).is_some_and(Vec::is_empty) {
            self.elements.remove(&element);
        }
        if self.documents.is_empty() {
            self.documents.shrink_to_fit();
        } else {
            self.documents.compact();
        }
        if self.elements.is_empty() {
            self.elements.shrink_to_fit();
        } else {
            self.elements.compact();
        }
    }

    pub fn attach(&mut self, document: NodeId, element: NodeId, value: Option<&[u16]>) {
        if let Some(value) = value.filter(|value| !value.is_empty()) {
            let key = self.key(document, value);
            self.attach_key(document, element, key);
        }
    }

    pub fn detach(&mut self, document: NodeId, element: NodeId, value: Option<&[u16]>) {
        if let Some(value) = value.filter(|value| !value.is_empty()) {
            self.detach_member(document, element, value);
            self.compact_empty(document, element);
        }
    }

    /// Same-value writes deliberately remove all occurrences then append one candidate.
    pub fn change(
        &mut self,
        document: NodeId,
        element: NodeId,
        previous: Option<&[u16]>,
        value: Option<&[u16]>,
    ) {
        let next_key = value
            .filter(|value| !value.is_empty())
            .map(|value| self.key(document, value));
        if let Some(previous) = previous.filter(|value| !value.is_empty()) {
            self.detach_member(document, element, previous);
        }
        if let Some(key) = next_key {
            self.attach_key(document, element, key);
        }
        self.compact_empty(document, element);
    }

    pub fn candidates(&self, document: NodeId, value: &[u16]) -> &[NodeId] {
        self.documents
            .get(&document)
            .and_then(|index| index.names.get(value))
            .map(Vec::as_slice)
            .unwrap_or_default()
    }

    /// Finalization removes stale aliases without making the registry a DOM owner.
    pub fn release_node(&mut self, node: NodeId) {
        if let Some(index) = self.documents.remove(&node) {
            for (key, entries) in index.names.iter() {
                for &element in entries {
                    if let Some(memberships) = self.elements.get_mut(&element) {
                        memberships.retain(|membership| {
                            membership.document != node || membership.key != *key
                        });
                        compact_vector(memberships);
                        if memberships.is_empty() {
                            self.elements.remove(&element);
                        }
                    }
                }
            }
        }
        if let Some(memberships) = self.elements.remove(&node) {
            for membership in memberships {
                self.detach_member(membership.document, node, &membership.key);
                self.compact_empty(membership.document, node);
            }
        }
        self.compact_empty(node, node);
    }

    pub fn statistics(&self) -> DocumentIdStatistics {
        DocumentIdStatistics {
            documents: self.documents.len(),
            names: self.documents.values().map(|index| index.names.len()).sum(),
            entries: self
                .documents
                .values()
                .flat_map(|index| index.names.values())
                .map(Vec::len)
                .sum(),
            elements: self.elements.len(),
            memberships: self.elements.values().map(Vec::len).sum(),
            key_units: self
                .documents
                .values()
                .flat_map(|index| index.names.keys())
                .map(|key| key.len())
                .sum(),
            document_capacity: self.documents.capacity(),
            element_capacity: self.elements.capacity(),
            name_capacity: self
                .documents
                .values()
                .map(|index| index.names.capacity())
                .sum(),
            entry_capacity: self
                .documents
                .values()
                .flat_map(|index| index.names.values())
                .map(Vec::capacity)
                .sum(),
        }
    }
}

impl TreeStore {
    fn document_id_operands(&self, document: f64, element: f64) -> Result<(NodeId, NodeId)> {
        let document = node_id(document)?;
        if self.links(document)?.node_kind != Some(DOCUMENT_NODE) {
            return Err(TreeError::NotDocument(document));
        }
        let element = node_id(element)?;
        if self.links(element)?.node_kind != Some(ELEMENT_NODE) {
            return Err(TreeError::NotElement(element));
        }
        Ok((document, element))
    }

    pub(super) fn attach_document_id(
        &mut self,
        document: f64,
        element: f64,
        value: Option<&[u16]>,
    ) -> Result<()> {
        let (document, element) = self.document_id_operands(document, element)?;
        self.document_ids.attach(document, element, value);
        Ok(())
    }

    pub(super) fn detach_document_id(
        &mut self,
        document: f64,
        element: f64,
        value: Option<&[u16]>,
    ) -> Result<()> {
        let (document, element) = self.document_id_operands(document, element)?;
        self.document_ids.detach(document, element, value);
        Ok(())
    }

    pub(super) fn change_document_id(
        &mut self,
        document: f64,
        element: f64,
        previous: Option<&[u16]>,
        value: Option<&[u16]>,
    ) -> Result<()> {
        let (document, element) = self.document_id_operands(document, element)?;
        self.document_ids.change(document, element, previous, value);
        Ok(())
    }

    /// Preserve registration order and check each candidate's live physical root.
    pub(super) fn query_document_element_by_id(&self, document: f64, value: &[u16]) -> Result<f64> {
        let document = node_id(document)?;
        if self.links(document)?.node_kind != Some(DOCUMENT_NODE) {
            return Err(TreeError::NotDocument(document));
        }
        for &element in self.document_ids.candidates(document, value) {
            if self.root_and_depth(element)?.0 == document {
                return Ok(element as f64);
            }
        }
        Ok(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn node(store: &mut TreeStore, kind: u16) -> f64 {
        let handle = store.allocate().unwrap();
        store
            .set_data(handle, &json!({"kind":kind,"name":"entry"}).to_string())
            .unwrap();
        handle
    }
    fn units(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }

    #[test]
    fn should_keep_registration_order_and_remove_all_duplicate_registrations() {
        let mut store = TreeStore::new();
        let document = node(&mut store, DOCUMENT_NODE);
        let first = node(&mut store, ELEMENT_NODE);
        let second = node(&mut store, ELEMENT_NODE);
        store.append(document, first).unwrap();
        store.append(document, second).unwrap();
        let key = units("chosen");
        for element in [first, first, second] {
            store
                .attach_document_id(document, element, Some(&key))
                .unwrap();
        }
        assert_eq!(store.document_ids.statistics().entries, 3);
        assert_eq!(store.document_ids.statistics().memberships, 2);
        assert_eq!(
            store.query_document_element_by_id(document, &key).unwrap(),
            first
        );
        store
            .change_document_id(document, first, Some(&key), Some(&key))
            .unwrap();
        assert_eq!(
            store.query_document_element_by_id(document, &key).unwrap(),
            second
        );
        assert_eq!(store.document_ids.statistics().entries, 2);
        store
            .detach_document_id(document, second, Some(&key))
            .unwrap();
        assert_eq!(
            store.query_document_element_by_id(document, &key).unwrap(),
            first
        );
    }

    #[test]
    fn should_filter_by_current_roots_without_reordering_registered_candidates() {
        let mut store = TreeStore::new();
        let document = node(&mut store, DOCUMENT_NODE);
        let other = node(&mut store, DOCUMENT_NODE);
        let shadow = node(&mut store, 11);
        let first = node(&mut store, ELEMENT_NODE);
        let second = node(&mut store, ELEMENT_NODE);
        store.append(shadow, first).unwrap();
        store.append(document, second).unwrap();
        let key = units("chosen");
        for element in [first, second] {
            store
                .attach_document_id(document, element, Some(&key))
                .unwrap();
        }
        assert_eq!(
            store.query_document_element_by_id(document, &key).unwrap(),
            second
        );
        store.remove(first).unwrap();
        store.append(document, first).unwrap();
        assert_eq!(
            store.query_document_element_by_id(document, &key).unwrap(),
            first
        );
        store.remove(first).unwrap();
        store.append(other, first).unwrap();
        assert_eq!(
            store.query_document_element_by_id(document, &key).unwrap(),
            second
        );
    }

    #[test]
    fn should_preserve_literal_utf16_keys_and_ignore_null_or_empty_registration() {
        let mut store = TreeStore::new();
        let document = node(&mut store, DOCUMENT_NODE);
        let element = node(&mut store, ELEMENT_NODE);
        store.append(document, element).unwrap();
        for value in [None, Some([].as_slice())] {
            store.attach_document_id(document, element, value).unwrap();
        }
        assert_eq!(store.document_ids.statistics().documents, 0);
        for value in [
            units("__proto__"),
            units(" chosen "),
            vec![0xd800, 0, 0xdc00],
        ] {
            store
                .attach_document_id(document, element, Some(&value))
                .unwrap();
            assert_eq!(
                store
                    .query_document_element_by_id(document, &value)
                    .unwrap(),
                element
            );
        }
        assert_eq!(
            store.query_document_element_by_id(document, &[]).unwrap(),
            0.0
        );
        assert_eq!(
            store
                .query_document_element_by_id(document, &[0xfffd, 0, 0xfffd])
                .unwrap(),
            0.0
        );
    }

    #[test]
    fn should_drop_all_aliases_on_element_and_document_release_without_owning_nodes() {
        let mut store = TreeStore::new();
        let document = node(&mut store, DOCUMENT_NODE);
        let other = node(&mut store, DOCUMENT_NODE);
        let element = node(&mut store, ELEMENT_NODE);
        store.append(document, element).unwrap();
        let (key, alias) = (units("ordinary"), units("foreign"));
        for (owner, value) in [(document, &key), (document, &alias), (other, &key)] {
            store
                .attach_document_id(owner, element, Some(value))
                .unwrap();
        }
        store.release(document).unwrap();
        assert_eq!(store.document_ids.statistics().documents, 1);
        assert_eq!(store.document_ids.statistics().memberships, 1);
        let result = element;
        store.release(element).unwrap();
        store.release(other).unwrap();
        let statistics = store.document_ids.statistics();
        assert_eq!(
            (
                statistics.documents,
                statistics.names,
                statistics.entries,
                statistics.elements,
                statistics.key_units
            ),
            (0, 0, 0, 0, 0)
        );
        assert_eq!(
            (statistics.document_capacity, statistics.element_capacity),
            (0, 0)
        );
        assert_eq!(store.statistics().live_nodes, 0.0);
        assert!(result > 0.0);
    }

    #[test]
    fn should_reclaim_churned_names_memberships_and_capacity_with_owners_alive() {
        let mut store = TreeStore::new();
        let document = node(&mut store, DOCUMENT_NODE);
        let element = node(&mut store, ELEMENT_NODE);
        store.append(document, element).unwrap();
        for index in 0..512 {
            let key = units(&format!("key-{index}"));
            store
                .attach_document_id(document, element, Some(&key))
                .unwrap();
        }
        assert_eq!(store.document_ids.statistics().names, 512);
        for index in 0..512 {
            let key = units(&format!("key-{index}"));
            store
                .detach_document_id(document, element, Some(&key))
                .unwrap();
        }
        let statistics = store.document_ids.statistics();
        assert_eq!(
            (
                statistics.documents,
                statistics.names,
                statistics.entries,
                statistics.memberships
            ),
            (0, 0, 0, 0)
        );
        assert_eq!(
            (statistics.document_capacity, statistics.element_capacity),
            (0, 0)
        );
        assert_eq!(store.statistics().live_nodes, 2.0);
    }

    #[test]
    fn should_reject_invalid_or_wrong_kind_operands_before_creating_registry_state() {
        let mut store = TreeStore::new();
        let document = node(&mut store, DOCUMENT_NODE);
        let element = node(&mut store, ELEMENT_NODE);
        let reserved = store.reserve_handles().unwrap();
        let before = store.statistics();
        for invalid in [0.0, -1.0, 0.5, f64::NAN, reserved, element] {
            assert!(store.attach_document_id(invalid, element, None).is_err());
            assert!(store.query_document_element_by_id(invalid, &[]).is_err());
        }
        assert!(
            store
                .attach_document_id(document, document, Some(&units("chosen")))
                .is_err()
        );
        assert_eq!(store.document_ids.statistics().documents, 0);
        assert_eq!(store.statistics().allocations, before.allocations);
        assert_eq!(store.statistics().reserved_handles, before.reserved_handles);
    }
}
