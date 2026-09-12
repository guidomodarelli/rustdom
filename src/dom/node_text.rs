//! Node text reads and write decisions over live native data and topology.
use super::{
    constants::{
        ATTRIBUTE_NODE, CDATA_SECTION_NODE, DOCUMENT_FRAGMENT_NODE, ELEMENT_NODE, TEXT_NODE,
        is_character_data,
    },
    data::DomString,
    error::{Result, TreeError},
    store::{TreeStore, node_id},
};

pub(crate) enum NodeText<'a> {
    Value(&'a DomString),
    Descendants(Vec<u16>),
}

/// The host performs the selected effect only after the native tree borrow ends.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum TextWriteAction {
    Ignore,
    Attribute,
    CharacterData,
    ReplaceChildren,
}

impl TreeStore {
    /// Select the complete Node text setter effect without changing data or topology.
    pub fn text_write_action(&self, handle: f64, text_content: bool) -> Result<TextWriteAction> {
        let id = node_id(handle)?;
        self.links(id)?;
        let kind = self.data.get(&id).ok_or(TreeError::MissingData(id))?.kind;
        Ok(if kind == ATTRIBUTE_NODE {
            TextWriteAction::Attribute
        } else if is_character_data(kind) {
            TextWriteAction::CharacterData
        } else if text_content && matches!(kind, ELEMENT_NODE | DOCUMENT_FRAGMENT_NODE) {
            TextWriteAction::ReplaceChildren
        } else {
            TextWriteAction::Ignore
        })
    }

    pub fn node_value(&self, handle: f64) -> Result<Option<&DomString>> {
        let id = node_id(handle)?;
        let data = self.data.get(&id).ok_or(TreeError::MissingData(id))?;
        Ok((data.kind == ATTRIBUTE_NODE || is_character_data(data.kind)).then_some(&data.value))
    }

    pub fn text_content(&self, handle: f64) -> Result<Option<NodeText<'_>>> {
        let root = node_id(handle)?;
        let data = self.data.get(&root).ok_or(TreeError::MissingData(root))?;
        if !matches!(data.kind, ELEMENT_NODE | DOCUMENT_FRAGMENT_NODE) {
            return Ok(
                (data.kind == ATTRIBUTE_NODE || is_character_data(data.kind))
                    .then_some(NodeText::Value(&data.value)),
            );
        }
        let mut output = Vec::new();
        let mut current = self.links(root)?.first;
        while current != 0 {
            let data = self
                .data
                .get(&current)
                .ok_or(TreeError::MissingData(current))?;
            if matches!(data.kind, TEXT_NODE | CDATA_SECTION_NODE) {
                match &data.value {
                    DomString::Utf16(units) => output.extend_from_slice(units),
                    DomString::Text(text) => output.extend(text.encode_utf16()),
                }
            }
            let mut links = self.links(current)?;
            if links.first != 0 {
                current = links.first;
                continue;
            }
            // Walk upward only as far as the requested root, without a stack of node handles.
            loop {
                if links.next != 0 {
                    current = links.next;
                    break;
                }
                current = links.parent;
                if current == root {
                    current = 0;
                    break;
                }
                links = self.links(current)?;
            }
        }
        Ok(Some(NodeText::Descendants(output)))
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
    fn observed(result: Result<Option<NodeText<'_>>>) -> Option<Vec<u16>> {
        result.unwrap().map(|value| match value {
            NodeText::Value(value) => value.units().collect(),
            NodeText::Descendants(value) => value,
        })
    }

    #[test]
    fn should_read_each_node_kind_without_losing_utf16_units() {
        let mut tree = TreeStore::new();
        for kind in [1, 2, 3, 4, 7, 8, 9, 10, 11] {
            let handle = node(
                &mut tree,
                &format!(r#"{{"kind":{kind},"name":"node","value":[65,0,55296,55358,56704]}}"#),
            );
            let has_value = matches!(kind, 2 | 3 | 4 | 7 | 8);
            let expected = has_value.then_some(vec![65, 0, 55296, 55358, 56704]);
            assert_eq!(
                tree.node_value(handle)
                    .unwrap()
                    .map(|value| value.units().collect::<Vec<_>>()),
                expected
            );
            let text = if matches!(kind, 1 | 11) {
                Some(vec![])
            } else {
                expected
            };
            assert_eq!(observed(tree.text_content(handle)), text);
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }

    #[test]
    fn should_select_text_write_effects_without_mutation_for_every_node_kind() {
        let mut tree = TreeStore::new();
        for kind in [0, 1, 2, 3, 4, 7, 8, 9, 10, 11] {
            let handle = node(
                &mut tree,
                &format!(r#"{{"kind":{kind},"name":"node","value":"initial"}}"#),
            );
            for text_content in [false, true] {
                let expected = match kind {
                    2 => TextWriteAction::Attribute,
                    3 | 4 | 7 | 8 => TextWriteAction::CharacterData,
                    1 | 11 if text_content => TextWriteAction::ReplaceChildren,
                    _ => TextWriteAction::Ignore,
                };
                let before = tree.statistics();
                assert_eq!(
                    tree.text_write_action(handle, text_content).unwrap(),
                    expected
                );
                assert_eq!(tree.statistics().mutations, before.mutations);
                assert_eq!(tree.statistics().data_updates, before.data_updates);
            }
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_reject_unallocated_or_untyped_text_writes_without_consuming_reservations() {
        let mut tree = TreeStore::new();
        let reserved = tree.reserve_handles().unwrap();
        let untyped = tree.allocate().unwrap();
        let before = tree.statistics();
        for invalid in [0.0, -1.0, f64::NAN, 0.5, reserved, untyped] {
            for text_content in [false, true] {
                assert!(tree.text_write_action(invalid, text_content).is_err());
            }
        }
        let after = tree.statistics();
        assert_eq!(after.allocations, before.allocations);
        assert_eq!(after.reserved_handles, before.reserved_handles);
        assert_eq!(after.mutations, before.mutations);
        assert_eq!(after.data_updates, before.data_updates);
    }

    #[test]
    fn should_aggregate_only_descendant_text_in_current_tree_order() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"root"}"#);
        let first = node(&mut tree, r#"{"kind":3,"value":"before"}"#);
        let group = node(&mut tree, r#"{"kind":1,"name":"group"}"#);
        let cdata = node(&mut tree, r#"{"kind":4,"value":[55296]}"#);
        let comment = node(&mut tree, r#"{"kind":8,"value":"ignored"}"#);
        let fragment = node(&mut tree, r#"{"kind":11}"#);
        let outside = node(&mut tree, r#"{"kind":3,"value":"outside"}"#);
        tree.append(root, first).unwrap();
        tree.append(root, group).unwrap();
        tree.append(group, cdata).unwrap();
        tree.append(group, comment).unwrap();
        tree.append(fragment, outside).unwrap();
        assert_eq!(
            observed(tree.text_content(root)),
            Some(["before".encode_utf16().collect::<Vec<_>>(), vec![55296]].concat())
        );
        tree.remove(first).unwrap();
        tree.append(group, first).unwrap();
        tree.replace_character_data(first, 0, 6, &[66, 0]).unwrap();
        assert_eq!(observed(tree.text_content(root)), Some(vec![55296, 66, 0]));
        assert_eq!(
            observed(tree.text_content(fragment)),
            Some("outside".encode_utf16().collect())
        );
        for handle in [outside, fragment, comment, cdata, first, group, root] {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_reject_missing_data_without_consuming_reserved_handles_or_mutating_the_tree() {
        let mut tree = TreeStore::new();
        let reserved = tree.reserve_handles().unwrap();
        let root = node(&mut tree, r#"{"kind":1,"name":"root"}"#);
        let child = tree.allocate().unwrap();
        tree.append(root, child).unwrap();
        let before = tree.statistics();
        assert!(tree.node_value(reserved).is_err());
        assert!(tree.text_content(reserved).is_err());
        assert!(tree.text_content(root).is_err());
        let after = tree.statistics();
        assert_eq!(after.allocations, before.allocations);
        assert_eq!(after.reserved_handles, before.reserved_handles);
        assert_eq!(after.mutations, before.mutations);
        assert_eq!(after.data_updates, before.data_updates);
        tree.release(child).unwrap();
        tree.release(root).unwrap();
    }
}
