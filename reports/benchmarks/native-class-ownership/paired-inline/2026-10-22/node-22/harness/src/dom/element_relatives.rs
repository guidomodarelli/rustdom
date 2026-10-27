//! Physical Element children and siblings over the canonical live topology.
use super::{
    constants::ELEMENT_NODE,
    error::Result,
    store::{TreeStore, node_id},
};

#[derive(Clone, Copy)]
pub(super) enum ElementRelation {
    FirstChild,
    LastChild,
    NextSibling,
    PreviousSibling,
}

impl TreeStore {
    /// Collect only immediate Element children; numbers do not add native DOM owners.
    pub(super) fn query_element_children(&self, handle: f64) -> Result<Vec<f64>> {
        let root = node_id(handle)?;
        let mut current = self.links(root)?.first;
        let mut result = Vec::new();
        while current != 0 {
            let links = self.links(current)?;
            if links.node_kind == Some(ELEMENT_NODE) {
                result.push(current as f64);
            }
            current = links.next;
        }
        Ok(result)
    }

    /// Follow a single physical sibling chain, never entering descendants, hosts or template contents.
    pub(super) fn element_relative(&self, handle: f64, relation: ElementRelation) -> Result<f64> {
        let root = node_id(handle)?;
        let links = self.links(root)?;
        let (mut current, reverse) = match relation {
            ElementRelation::FirstChild => (links.first, false),
            ElementRelation::LastChild => (links.last, true),
            ElementRelation::NextSibling => (links.next, false),
            ElementRelation::PreviousSibling => (links.previous, true),
        };
        while current != 0 {
            let links = self.links(current)?;
            if links.node_kind == Some(ELEMENT_NODE) {
                return Ok(current as f64);
            }
            current = if reverse { links.previous } else { links.next };
        }
        Ok(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dom::constants::{
        CDATA_SECTION_NODE, COMMENT_NODE, DOCUMENT_FRAGMENT_NODE, DOCUMENT_NODE,
        DOCUMENT_TYPE_NODE, PROCESSING_INSTRUCTION_NODE, TEXT_NODE,
    };

    fn node(store: &mut TreeStore, kind: u16) -> f64 {
        let handle = store.allocate().unwrap();
        store
            .set_data(
                handle,
                &format!(r#"{{"kind":{kind},"name":"entry","value":"text"}}"#),
            )
            .unwrap();
        handle
    }

    #[test]
    fn should_filter_immediate_children_and_skip_every_other_node_kind() {
        let mut store = TreeStore::new();
        let root = node(&mut store, DOCUMENT_NODE);
        let mut children = Vec::new();
        for kind in [
            DOCUMENT_TYPE_NODE,
            COMMENT_NODE,
            ELEMENT_NODE,
            TEXT_NODE,
            CDATA_SECTION_NODE,
            PROCESSING_INSTRUCTION_NODE,
            ELEMENT_NODE,
            COMMENT_NODE,
        ] {
            let child = node(&mut store, kind);
            store.append(root, child).unwrap();
            children.push(child);
        }
        let nested = node(&mut store, ELEMENT_NODE);
        store.append(children[2], nested).unwrap();
        assert_eq!(
            store.query_element_children(root).unwrap(),
            [children[2], children[6]]
        );
        assert_eq!(
            store
                .element_relative(root, ElementRelation::FirstChild)
                .unwrap(),
            children[2]
        );
        assert_eq!(
            store
                .element_relative(root, ElementRelation::LastChild)
                .unwrap(),
            children[6]
        );
        for (index, &child) in children.iter().enumerate() {
            let previous = if index > 2 { children[2] } else { 0.0 };
            let previous = if index > 6 { children[6] } else { previous };
            let next = if index < 2 {
                children[2]
            } else if index < 6 {
                children[6]
            } else {
                0.0
            };
            assert_eq!(
                store
                    .element_relative(child, ElementRelation::PreviousSibling)
                    .unwrap(),
                previous
            );
            assert_eq!(
                store
                    .element_relative(child, ElementRelation::NextSibling)
                    .unwrap(),
                next
            );
        }
    }

    #[test]
    fn should_read_live_links_after_reordering_reparenting_and_removal() {
        let mut store = TreeStore::new();
        let root = node(&mut store, DOCUMENT_FRAGMENT_NODE);
        let other = node(&mut store, DOCUMENT_FRAGMENT_NODE);
        let first = node(&mut store, ELEMENT_NODE);
        let second = node(&mut store, ELEMENT_NODE);
        store.append(root, first).unwrap();
        store.append(root, second).unwrap();
        store.remove(first).unwrap();
        store.append(root, first).unwrap();
        assert_eq!(store.query_element_children(root).unwrap(), [second, first]);
        store.remove(second).unwrap();
        store.append(other, second).unwrap();
        assert_eq!(store.query_element_children(root).unwrap(), [first]);
        assert_eq!(
            store
                .element_relative(first, ElementRelation::PreviousSibling)
                .unwrap(),
            0.0
        );
        assert_eq!(
            store
                .element_relative(first, ElementRelation::NextSibling)
                .unwrap(),
            0.0
        );
        assert_eq!(store.query_element_children(other).unwrap(), [second]);
        store.remove(first).unwrap();
        assert!(store.query_element_children(root).unwrap().is_empty());
        assert_eq!(
            store
                .element_relative(root, ElementRelation::LastChild)
                .unwrap(),
            0.0
        );
    }

    #[test]
    fn should_follow_committed_metadata_kinds_and_leave_untyped_nodes_out() {
        let mut store = TreeStore::new();
        let root = node(&mut store, DOCUMENT_FRAGMENT_NODE);
        let child = store.allocate().unwrap();
        store.append(root, child).unwrap();
        assert!(store.query_element_children(root).unwrap().is_empty());
        store
            .set_data(child, r#"{"kind":1,"name":"element"}"#)
            .unwrap();
        assert_eq!(store.query_element_children(root).unwrap(), [child]);
        store
            .set_data(child, r#"{"kind":8,"value":"comment"}"#)
            .unwrap();
        assert!(store.query_element_children(root).unwrap().is_empty());
        assert_eq!(
            store
                .element_relative(root, ElementRelation::FirstChild)
                .unwrap(),
            0.0
        );
    }

    #[test]
    fn should_stop_at_the_parent_boundary_without_entering_external_sibling_trees() {
        let mut store = TreeStore::new();
        let root = node(&mut store, DOCUMENT_FRAGMENT_NODE);
        let parent = node(&mut store, ELEMENT_NODE);
        let external = node(&mut store, ELEMENT_NODE);
        let text = node(&mut store, TEXT_NODE);
        store.append(root, parent).unwrap();
        store.append(root, external).unwrap();
        store.append(parent, text).unwrap();
        assert!(store.query_element_children(parent).unwrap().is_empty());
        assert_eq!(
            store
                .element_relative(parent, ElementRelation::FirstChild)
                .unwrap(),
            0.0
        );
        assert_eq!(
            store
                .element_relative(text, ElementRelation::NextSibling)
                .unwrap(),
            0.0
        );
        assert_eq!(
            store
                .element_relative(parent, ElementRelation::NextSibling)
                .unwrap(),
            external
        );
    }

    #[test]
    fn should_reject_invalid_reserved_and_released_handles_without_activating_records() {
        let mut store = TreeStore::new();
        let reserved = store.reserve_handles().unwrap();
        let released = node(&mut store, ELEMENT_NODE);
        store.release(released).unwrap();
        let before = store.statistics();
        for invalid in [0.0, -1.0, 0.5, f64::NAN, f64::INFINITY, reserved, released] {
            assert!(store.query_element_children(invalid).is_err());
            for relation in [
                ElementRelation::FirstChild,
                ElementRelation::LastChild,
                ElementRelation::NextSibling,
                ElementRelation::PreviousSibling,
            ] {
                assert!(store.element_relative(invalid, relation).is_err());
            }
        }
        assert_eq!(store.statistics().allocations, before.allocations);
        assert_eq!(store.statistics().reserved_handles, before.reserved_handles);
    }

    #[test]
    fn should_walk_long_chains_iteratively_and_release_nodes_with_result_ids_held() {
        let mut store = TreeStore::new();
        let root = node(&mut store, DOCUMENT_FRAGMENT_NODE);
        let mut children = Vec::new();
        for _ in 0..4096 {
            let child = node(&mut store, TEXT_NODE);
            store.append(root, child).unwrap();
            children.push(child);
        }
        let element = node(&mut store, ELEMENT_NODE);
        store.append(root, element).unwrap();
        let result = store.query_element_children(root).unwrap();
        assert_eq!(result, [element]);
        assert_eq!(
            store
                .element_relative(root, ElementRelation::FirstChild)
                .unwrap(),
            element
        );
        assert_eq!(
            store
                .element_relative(children[0], ElementRelation::NextSibling)
                .unwrap(),
            element
        );
        for child in children {
            store.release(child).unwrap();
        }
        store.release(element).unwrap();
        store.release(root).unwrap();
        assert_eq!(store.statistics().live_nodes, 0.0);
        assert_eq!(store.statistics().data_nodes, 0.0);
        assert_eq!(result, [element]);
    }
}
