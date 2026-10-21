//! Owned canonical Attr data crosses a factory boundary without borrowing or retaining its forest.
use super::{
    constants::ATTRIBUTE_NODE,
    data::{AttributeData, NodeData},
    error::{Result, TreeError},
    store::{TreeStore, node_id},
};

/// An immutable value snapshot, deliberately excluding handles, ownership and unrelated node data.
pub(crate) struct AttributeCopyData(pub(super) AttributeData);

impl AttributeCopyData {
    /// Owned string capacities, excluding allocator metadata and the enclosing wrapper.
    pub(super) fn heap_capacity_bytes(&self) -> usize {
        use super::data::DomString;
        let capacity = |value: &DomString| match value {
            DomString::Text(value) => value.capacity(),
            DomString::Utf16(value) => value.capacity().saturating_mul(size_of::<u16>()),
            DomString::Undefined => 0,
        };
        [&self.0.name, &self.0.value]
            .into_iter()
            .chain(self.0.namespace.iter())
            .chain(self.0.prefix.iter())
            .fold(0usize, |bytes, value| bytes.saturating_add(capacity(value)))
    }
}

impl TreeStore {
    pub(crate) fn prepare_attribute_copy(&self, source: f64) -> Result<AttributeCopyData> {
        let source = self.attribute(node_id(source)?)?;
        Ok(AttributeCopyData(AttributeData {
            name: source
                .name
                .as_ref()
                .expect("canonical Attr has a name")
                .clone(),
            namespace: source.namespace.clone(),
            prefix: source.prefix.clone(),
            value: source.value.clone(),
        }))
    }

    /// Commit a prepared copy into a fresh destination; all validation precedes activation.
    pub(crate) fn initialize_attribute_copy(
        &mut self,
        destination: f64,
        copy: &AttributeCopyData,
    ) -> Result<()> {
        let id = node_id(destination)?;
        let links = self.links_or_reserved(id)?;
        if self.data.contains_key(&id)
            || links.parent != 0
            || links.previous != 0
            || links.next != 0
            || links.first != 0
            || links.last != 0
            || self.attribute_collections.elements.contains_key(&id)
        {
            return Err(TreeError::AttributeCopyDestinationNotEmpty(id));
        }
        self.replace_data(
            destination,
            NodeData {
                kind: ATTRIBUTE_NODE,
                name: Some(copy.0.name.clone()),
                namespace: copy.0.namespace.clone(),
                prefix: copy.0.prefix.clone(),
                value: copy.0.value.clone(),
                ..NodeData::default()
            },
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dom::{attributes::AttributeField, data::DomString};

    #[test]
    fn should_measure_owned_string_capacity_without_unrelated_storage() {
        let mut value = String::with_capacity(64);
        value.push('v');
        let mut prefix = Vec::with_capacity(8);
        prefix.push(0xd800);
        let copy = AttributeCopyData(AttributeData {
            name: DomString::Text("id".into()),
            namespace: None,
            prefix: Some(DomString::Utf16(prefix)),
            value: DomString::Text(value),
        });
        assert_eq!(copy.heap_capacity_bytes(), 82);
    }

    fn attribute(tree: &mut TreeStore) -> f64 {
        let handle = tree.allocate().unwrap();
        tree.initialize_attribute(handle,
            r#"{"kind":2,"name":[107,55296],"namespace":[117,0,56320],"prefix":"","value":[65,0,55296,56320,55358,56704]}"#).unwrap();
        handle
    }

    fn state(tree: &TreeStore) -> Vec<f64> {
        let statistics = tree.statistics();
        vec![
            statistics.live_nodes,
            statistics.allocations,
            statistics.releases,
            statistics.data_nodes,
            statistics.data_updates,
            statistics.reserved_handles,
            statistics.attribute_collections,
            statistics.attribute_owners,
            statistics.attribute_holders,
        ]
    }

    #[test]
    fn should_own_original_data_after_source_mutation_release_and_forest_drop() {
        let copy = {
            let mut source = TreeStore::new();
            let handle = attribute(&mut source);
            let copy = source.prepare_attribute_copy(handle).unwrap();
            source.set_attribute_value(handle, &[66]).unwrap();
            source.release(handle).unwrap();
            copy
        };
        let mut destination = TreeStore::new();
        let first = destination.allocate().unwrap();
        let second = destination.reserve_handles().unwrap();
        destination.initialize_attribute_copy(first, &copy).unwrap();
        destination
            .initialize_attribute_copy(second, &copy)
            .unwrap();
        for handle in [first, second] {
            assert_eq!(
                destination
                    .attribute_field(handle, AttributeField::Value)
                    .unwrap(),
                Some(vec![65, 0, 55296, 56320, 55358, 56704])
            );
            assert_eq!(
                destination
                    .attribute_field(handle, AttributeField::QualifiedName)
                    .unwrap(),
                Some(vec![58, 107, 55296])
            );
            assert_eq!(destination.attribute_owner(handle).unwrap(), 0.0);
        }
        destination.set_attribute_value(first, &[67]).unwrap();
        assert_eq!(
            destination
                .attribute_field(second, AttributeField::Value)
                .unwrap()
                .unwrap()[0],
            65
        );
        for handle in [first, second] {
            destination.release(handle).unwrap();
        }
        assert_eq!(destination.statistics().live_nodes, 0.0);
        assert_eq!(destination.statistics().data_nodes, 0.0);
    }

    #[test]
    fn should_reject_existing_or_linked_destinations_without_modifying_either_tree() {
        let mut tree = TreeStore::new();
        let source = attribute(&mut tree);
        let copy = tree.prepare_attribute_copy(source).unwrap();
        let parent = tree.allocate().unwrap();
        let child = tree.allocate().unwrap();
        tree.append(parent, child).unwrap();
        let element = tree.allocate().unwrap();
        tree.initialize_attribute_collection(element).unwrap();
        for destination in [source, parent, child, element, 0.0, 1.5, 999999.0, f64::NAN] {
            let before = state(&tree);
            assert!(tree.initialize_attribute_copy(destination, &copy).is_err());
            assert_eq!(state(&tree), before);
        }
        let fresh = tree.reserve_handles().unwrap();
        tree.initialize_attribute_copy(fresh, &copy).unwrap();
        assert_eq!(tree.attribute_owner(fresh).unwrap(), 0.0);
    }

    #[test]
    fn should_prepare_only_valid_attributes_without_activating_reserved_sources() {
        let mut tree = TreeStore::new();
        let allocated = tree.allocate().unwrap();
        let reserved = tree.reserve_handles().unwrap();
        tree.replace_data(
            allocated,
            NodeData {
                kind: 3,
                ..NodeData::default()
            },
        )
        .unwrap();
        for source in [allocated, reserved, 0.0, 0.5, 999999.0, f64::INFINITY] {
            let before = state(&tree);
            assert!(tree.prepare_attribute_copy(source).is_err());
            assert_eq!(state(&tree), before);
        }
    }

    #[test]
    fn should_copy_only_attribute_fields_without_structural_handles_or_snapshot_capacity() {
        let mut source = TreeStore::new();
        let attribute = source.allocate().unwrap();
        let unrelated = source.reserve_handles().unwrap();
        source
            .replace_data(
                attribute,
                NodeData {
                    kind: ATTRIBUTE_NODE,
                    name: Some(DomString::Text("id".into())),
                    template_content: unrelated,
                    is_value: Some(DomString::Text("unrelated".into())),
                    attributes: vec![AttributeData {
                        name: DomString::Text("snapshot".into()),
                        namespace: None,
                        prefix: None,
                        value: DomString::Text("unrelated".into()),
                    }],
                    ..NodeData::default()
                },
            )
            .unwrap();
        let copy = source.prepare_attribute_copy(attribute).unwrap();
        let mut destination = TreeStore::new();
        let target = destination.reserve_handles().unwrap();
        destination
            .initialize_attribute_copy(target, &copy)
            .unwrap();
        let data = destination.attribute(node_id(target).unwrap()).unwrap();
        assert_eq!(data.template_content, 0.0);
        assert!(data.attributes.is_empty());
        assert_eq!(data.attributes.capacity(), 0);
        assert!(data.is_value.is_none());
        assert!(data.doctype.is_none());
        assert_eq!(destination.statistics().live_nodes, 1.0);
    }
}
