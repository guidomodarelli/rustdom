//! Iterative node comparison over canonical native data and topology.
use super::{
    constants::{
        ATTRIBUTE_NODE, COMMENT_NODE, DOCUMENT_TYPE_NODE, ELEMENT_NODE,
        PROCESSING_INSTRUCTION_NODE, TEXT_NODE,
    },
    data::{DomString, NodeData},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};
use std::{
    collections::HashSet,
    hash::{Hash, Hasher},
};

const DISCONNECTED: u16 = 1;
const PRECEDING: u16 = 2;
const FOLLOWING: u16 = 4;
const CONTAINS: u16 = 8;
const CONTAINED_BY: u16 = 16;
const IMPLEMENTATION_SPECIFIC: u16 = 32;

fn same_string(left: &DomString, right: &DomString) -> bool {
    match (left, right) {
        (DomString::Text(left), DomString::Text(right)) => left == right,
        _ => left.units().eq(right.units()),
    }
}

fn same_optional_string(left: Option<&DomString>, right: Option<&DomString>) -> bool {
    match (left, right) {
        (Some(left), Some(right)) => same_string(left, right),
        (None, None) => true,
        _ => false,
    }
}

/// Borrowed semantic key avoids copying attribute values when comparing unordered lists.
struct AttributeKey<'a> {
    namespace: Option<&'a DomString>,
    name: &'a DomString,
    value: &'a DomString,
}
impl PartialEq for AttributeKey<'_> {
    fn eq(&self, other: &Self) -> bool {
        same_optional_string(self.namespace, other.namespace)
            && same_string(self.name, other.name)
            && same_string(self.value, other.value)
    }
}
impl Eq for AttributeKey<'_> {}

fn hash_string<H: Hasher>(value: &DomString, state: &mut H) {
    let mut length = 0usize;
    for unit in value.units() {
        unit.hash(state);
        length += 1;
    }
    length.hash(state);
}
impl Hash for AttributeKey<'_> {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.namespace.is_some().hash(state);
        if let Some(namespace) = self.namespace {
            hash_string(namespace, state);
        }
        hash_string(self.name, state);
        hash_string(self.value, state);
    }
}

impl TreeStore {
    fn comparison_data(&self, id: NodeId) -> Result<&NodeData> {
        self.data.get(&id).ok_or(TreeError::MissingData(id))
    }

    fn comparison_attributes<'a>(
        &'a self,
        id: NodeId,
        data: &'a NodeData,
    ) -> Result<Vec<AttributeKey<'a>>> {
        if let Some(collection) = self.attribute_collections.elements.get(&id) {
            collection
                .ordered
                .iter()
                .map(|attribute| {
                    let data = self.comparison_data(*attribute)?;
                    Ok(AttributeKey {
                        namespace: data.namespace.as_ref(),
                        name: data
                            .name
                            .as_ref()
                            .ok_or(TreeError::MissingData(*attribute))?,
                        value: &data.value,
                    })
                })
                .collect()
        } else {
            Ok(data
                .attributes
                .iter()
                .map(|attribute| AttributeKey {
                    namespace: attribute.namespace.as_ref(),
                    name: &attribute.name,
                    value: &attribute.value,
                })
                .collect())
        }
    }

    fn equal_node_data(&self, left_id: NodeId, right_id: NodeId) -> Result<bool> {
        let left = self.comparison_data(left_id)?;
        let right = self.comparison_data(right_id)?;
        if left.kind != right.kind {
            return Ok(false);
        }
        let same_name = || same_optional_string(left.name.as_ref(), right.name.as_ref());
        let same_namespace =
            || same_optional_string(left.namespace.as_ref(), right.namespace.as_ref());
        Ok(match left.kind {
            DOCUMENT_TYPE_NODE => {
                same_name()
                    && match (&left.doctype, &right.doctype) {
                        (Some(left), Some(right)) => {
                            same_string(&left.public_id, &right.public_id)
                                && same_string(&left.system_id, &right.system_id)
                        }
                        (Some(identifiers), None) | (None, Some(identifiers)) => {
                            identifiers.public_id.is_empty() && identifiers.system_id.is_empty()
                        }
                        (None, None) => true,
                    }
            }
            ELEMENT_NODE => {
                if !same_name()
                    || !same_namespace()
                    || !same_optional_string(left.prefix.as_ref(), right.prefix.as_ref())
                {
                    return Ok(false);
                }
                let left_attributes = self.comparison_attributes(left_id, left)?;
                let right_attributes = self.comparison_attributes(right_id, right)?;
                if left_attributes.len() != right_attributes.len() {
                    return Ok(false);
                }
                if left_attributes.is_empty() {
                    return Ok(true);
                }
                let right_attributes: HashSet<_> = right_attributes.into_iter().collect();
                left_attributes
                    .iter()
                    .all(|attribute| right_attributes.contains(attribute))
            }
            ATTRIBUTE_NODE => {
                same_name() && same_namespace() && same_string(&left.value, &right.value)
            }
            PROCESSING_INSTRUCTION_NODE => same_name() && same_string(&left.value, &right.value),
            TEXT_NODE | COMMENT_NODE => same_string(&left.value, &right.value),
            // Pinned jsdom 27 does not compare CDATA contents, shadow roots or template contents here.
            _ => true,
        })
    }

    /// Compare ordinary child topology iteratively; no stack frame or retained cache per descendant.
    pub fn equal_node(&self, left: f64, right: f64) -> Result<bool> {
        let left = node_id(left)?;
        let right = node_id(right)?;
        self.links(left)?;
        self.links(right)?;
        let mut pending = vec![(left, right)];
        while let Some((left, right)) = pending.pop() {
            if left == right {
                continue;
            }
            if !self.equal_node_data(left, right)? {
                return Ok(false);
            }
            let mut left_child = self.links(left)?.first;
            let mut right_child = self.links(right)?.first;
            while left_child != 0 && right_child != 0 {
                pending.push((left_child, right_child));
                left_child = self.links(left_child)?.next;
                right_child = self.links(right_child)?.next;
            }
            if left_child != right_child {
                return Ok(false);
            }
        }
        Ok(true)
    }

    /// Inclusive ancestry follows parent links only: Attr ownership and shadow hosts are distinct.
    pub fn contains_node(&self, ancestor: f64, descendant: f64) -> Result<bool> {
        let ancestor = node_id(ancestor)?;
        let mut descendant = node_id(descendant)?;
        self.links(ancestor)?;
        while descendant != 0 {
            if ancestor == descendant {
                return Ok(true);
            }
            descendant = self.links(descendant)?.parent;
        }
        Ok(false)
    }

    pub(super) fn root_and_depth(&self, mut id: NodeId) -> Result<(NodeId, usize)> {
        let mut root = 0;
        let mut depth = 0;
        while id != 0 {
            root = id;
            depth += 1;
            id = self.links(id)?.parent;
        }
        Ok((root, depth))
    }

    fn compare_tree_position(&mut self, mut left: NodeId, mut right: NodeId) -> Result<u16> {
        if left == right {
            return Ok(0);
        }
        if left == 0 || right == 0 {
            return Ok(DISCONNECTED | IMPLEMENTATION_SPECIFIC | FOLLOWING);
        }
        let left_parent = self.links(left)?.parent;
        if left_parent != 0 && left_parent == self.links(right)?.parent {
            return self.sibling_position(left, right);
        }
        let (left_root, mut left_depth) = self.root_and_depth(left)?;
        let (right_root, mut right_depth) = self.root_and_depth(right)?;
        if left_root == 0 || left_root != right_root {
            return Ok(DISCONNECTED | IMPLEMENTATION_SPECIFIC | FOLLOWING);
        }
        while left_depth > right_depth {
            left = self.links(left)?.parent;
            left_depth -= 1;
            if left == right {
                return Ok(CONTAINS | PRECEDING);
            }
        }
        while right_depth > left_depth {
            right = self.links(right)?.parent;
            right_depth -= 1;
            if right == left {
                return Ok(CONTAINED_BY | FOLLOWING);
            }
        }
        loop {
            let left_parent = self.links(left)?.parent;
            let right_parent = self.links(right)?.parent;
            if left_parent == right_parent {
                break;
            }
            left = left_parent;
            right = right_parent;
        }
        self.sibling_position(left, right)
    }

    fn sibling_position(&mut self, left: NodeId, right: NodeId) -> Result<u16> {
        Ok(if self.sibling_index(right)? < self.sibling_index(left)? {
            PRECEDING
        } else {
            FOLLOWING
        })
    }

    /// Reproduce jsdom 27's Attr comparison ordering, including its observable identity quirks.
    pub fn compare_document_position(&mut self, left: f64, right: f64) -> Result<u16> {
        let left = node_id(left)?;
        let right = node_id(right)?;
        let left_attribute = self.comparison_data(left)?.kind == ATTRIBUTE_NODE;
        let right_attribute = self.comparison_data(right)?.kind == ATTRIBUTE_NODE;
        let left_node = if left_attribute {
            self.attribute_collections
                .owners
                .get(&left)
                .copied()
                .unwrap_or(0)
        } else {
            left
        };
        let right_node = if right_attribute {
            self.attribute_collections
                .owners
                .get(&right)
                .copied()
                .unwrap_or(0)
        } else {
            right
        };
        if left_attribute
            && right_attribute
            && left_node != 0
            && left_node == right_node
            && let Some(collection) = self.attribute_collections.elements.get(&left_node)
        {
            for &attribute in &collection.ordered {
                if self.equal_node_data(attribute, right)? {
                    return Ok(IMPLEMENTATION_SPECIFIC | PRECEDING);
                }
                if self.equal_node_data(attribute, left)? {
                    return Ok(IMPLEMENTATION_SPECIFIC | FOLLOWING);
                }
            }
        }
        self.compare_tree_position(left_node, right_node)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(tree: &mut TreeStore, metadata: &str) -> f64 {
        let handle = tree.allocate().unwrap();
        tree.set_data(handle, metadata).unwrap();
        handle
    }

    #[test]
    fn should_compare_positions_and_containment_after_moves_and_releases() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":9}"#);
        let left = node(&mut tree, r#"{"kind":1,"name":"left"}"#);
        let right = node(&mut tree, r#"{"kind":1,"name":"right"}"#);
        let text = node(&mut tree, r#"{"kind":3,"value":"text"}"#);
        tree.append(root, left).unwrap();
        tree.append(root, right).unwrap();
        tree.append(left, text).unwrap();
        assert_eq!(
            tree.compare_document_position(left, right).unwrap(),
            FOLLOWING
        );
        assert_eq!(
            tree.compare_document_position(text, root).unwrap(),
            CONTAINS | PRECEDING
        );
        assert_eq!(
            tree.compare_document_position(root, text).unwrap(),
            CONTAINED_BY | FOLLOWING
        );
        assert!(tree.contains_node(left, text).unwrap());
        tree.remove(text).unwrap();
        tree.append(right, text).unwrap();
        assert!(!tree.contains_node(left, text).unwrap());
        assert!(tree.contains_node(right, text).unwrap());
        tree.release(right).unwrap();
        assert_eq!(
            tree.compare_document_position(root, text).unwrap(),
            DISCONNECTED | IMPLEMENTATION_SPECIFIC | FOLLOWING
        );
        assert!(tree.compare_document_position(root, right).is_err());
    }

    #[test]
    fn should_compare_unordered_attributes_without_using_namespace_prefixes() {
        let mut tree = TreeStore::new();
        let left = node(
            &mut tree,
            r#"{"kind":1,"name":"item","attributes":[{"name":"key","namespace":"urn:a","prefix":"a","value":"value"},{"name":"plain","namespace":null,"prefix":null,"value":"text"}]}"#,
        );
        let right = node(
            &mut tree,
            r#"{"kind":1,"name":"item","attributes":[{"name":"plain","namespace":null,"prefix":null,"value":"text"},{"name":"key","namespace":"urn:a","prefix":"b","value":"value"}]}"#,
        );
        assert!(tree.equal_node(left, right).unwrap());
        let changed = node(
            &mut tree,
            r#"{"kind":1,"name":"item","attributes":[{"name":"plain","namespace":null,"prefix":null,"value":"text"},{"name":"key","namespace":"urn:a","prefix":"b","value":"changed"}]}"#,
        );
        assert!(!tree.equal_node(left, changed).unwrap());
    }

    #[test]
    fn should_preserve_utf16_equality_across_storage_representations() {
        let mut tree = TreeStore::new();
        let left = node(&mut tree, r#"{"kind":2,"name":"key","value":"value"}"#);
        let right = node(
            &mut tree,
            r#"{"kind":2,"name":[107,101,121],"value":[118,97,108,117,101]}"#,
        );
        assert!(tree.equal_node(left, right).unwrap());
        let high = node(&mut tree, r#"{"kind":3,"value":[55296]}"#);
        let low = node(&mut tree, r#"{"kind":3,"value":[56320]}"#);
        assert!(!tree.equal_node(high, low).unwrap());
        let cdata_left = node(&mut tree, r#"{"kind":4,"value":"one"}"#);
        let cdata_right = node(&mut tree, r#"{"kind":4,"value":"different"}"#);
        assert!(tree.equal_node(cdata_left, cdata_right).unwrap());
    }

    #[test]
    fn should_preserve_attached_and_detached_attribute_position_contracts() {
        let mut tree = TreeStore::new();
        let element = node(&mut tree, r#"{"kind":1,"name":"item"}"#);
        tree.initialize_attribute_collection(element).unwrap();
        let first = node(&mut tree, r#"{"kind":2,"name":"a","value":"one"}"#);
        let second = node(&mut tree, r#"{"kind":2,"name":"b","value":"two"}"#);
        tree.set_attribute(element, first).unwrap();
        tree.set_attribute(element, second).unwrap();
        assert_eq!(
            tree.compare_document_position(first, first).unwrap(),
            IMPLEMENTATION_SPECIFIC | PRECEDING
        );
        assert_eq!(
            tree.compare_document_position(first, second).unwrap(),
            IMPLEMENTATION_SPECIFIC | FOLLOWING
        );
        assert_eq!(tree.compare_document_position(element, first).unwrap(), 0);
        assert!(!tree.contains_node(element, first).unwrap());
        tree.remove_attribute(element, first).unwrap();
        tree.remove_attribute(element, second).unwrap();
        assert_eq!(tree.compare_document_position(first, second).unwrap(), 0);
    }

    #[test]
    fn should_compare_deep_trees_iteratively_without_persistent_allocations() {
        let mut tree = TreeStore::new();
        let left = node(&mut tree, r#"{"kind":11}"#);
        let right = node(&mut tree, r#"{"kind":11}"#);
        let mut parents = [left, right];
        let mut allocated = vec![left, right];
        for _ in 0..2000 {
            for parent in &mut parents {
                let child = node(&mut tree, r#"{"kind":1,"name":"deep"}"#);
                tree.append(*parent, child).unwrap();
                *parent = child;
                allocated.push(child);
            }
        }
        assert!(tree.equal_node(left, right).unwrap());
        assert!(tree.contains_node(left, parents[0]).unwrap());
        for handle in allocated {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }
}
