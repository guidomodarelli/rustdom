//! Read-only insertion geometry, split around host mutation hooks to re-read current topology.
use super::{
    constants::{COMMENT_NODE, DOCUMENT_FRAGMENT_NODE, PROCESSING_INSTRUCTION_NODE, TEXT_NODE},
    error::{Result, TreeError},
    range_state::BoundaryPoint,
    store::{NodeId, TreeStore, node_id},
};

#[derive(Debug, PartialEq)]
pub(crate) struct InsertionPlan {
    pub start: BoundaryPoint,
    pub parent: NodeId,
    pub reference: NodeId,
    pub split_text: bool,
}

impl TreeStore {
    /// None is the original Invalid start node rejection; all handles must already be allocated.
    pub fn range_insertion_plan(
        &self,
        start: BoundaryPoint,
        end: BoundaryPoint,
        node: f64,
    ) -> Result<Option<InsertionPlan>> {
        let node = node_id(node)?;
        let start_links = self.links(start.node)?;
        self.links(end.node)?;
        self.links(node)?;
        let kind = self
            .data
            .get(&start.node)
            .ok_or(TreeError::MissingData(start.node))?
            .kind;
        let split_text = kind == TEXT_NODE;
        if matches!(kind, PROCESSING_INSTRUCTION_NODE | COMMENT_NODE)
            || (split_text && start_links.parent == 0)
            || node == start.node
        {
            return Ok(None);
        }
        // childrenToArray()[offset] only finds nonnegative integral indexes, including -0.
        let mut reference = 0;
        if split_text {
            reference = start.node;
        } else if start.offset >= 0.0
            && start.offset.fract() == 0.0
            && start.offset < self.child_count(start.node)? as f64
        {
            reference = start_links.first;
            for _ in 0..start.offset as u64 {
                reference = self.links(reference)?.next;
            }
        }
        let parent = if reference == 0 {
            start.node
        } else {
            self.links(reference)?.parent
        };
        Ok(Some(InsertionPlan {
            start,
            parent,
            reference,
            split_text,
        }))
    }

    /// Called after splitting/removing nodes and immediately before insertBefore, never cached early.
    pub fn range_insertion_offset(
        &mut self,
        node: f64,
        parent: f64,
        reference: f64,
    ) -> Result<f64> {
        let node = node_id(node)?;
        let parent = node_id(parent)?;
        self.links(node)?;
        self.links(parent)?;
        let reference = if reference == 0.0 {
            None
        } else {
            let reference = node_id(reference)?;
            self.links(reference)?;
            Some(reference)
        };
        let offset = match reference {
            Some(reference) => self.sibling_index(reference)?,
            None => self.range_node_length(parent)?,
        };
        let kind = self
            .data
            .get(&node)
            .ok_or(TreeError::MissingData(node))?
            .kind;
        let count = if kind == DOCUMENT_FRAGMENT_NODE {
            self.range_node_length(node)?
        } else {
            1
        };
        Ok(offset as f64 + count as f64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn node(tree: &mut TreeStore, kind: u16) -> u64 {
        let id = tree.allocate().unwrap();
        tree.set_data(
            id,
            &format!(r#"{{"kind":{kind},"name":"node","value":"text"}}"#),
        )
        .unwrap();
        id as u64
    }
    fn point(node: u64, offset: f64) -> BoundaryPoint {
        BoundaryPoint { node, offset }
    }

    #[test]
    fn should_select_text_parent_or_indexed_child_and_preserve_non_index_offsets() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, 1);
        let text = node(&mut tree, TEXT_NODE);
        let tail = node(&mut tree, 1);
        let inserted = node(&mut tree, 1);
        tree.append(root as f64, text as f64).unwrap();
        tree.append(root as f64, tail as f64).unwrap();
        let text_plan = tree
            .range_insertion_plan(point(text, 2.0), point(root, 2.0), inserted as f64)
            .unwrap()
            .unwrap();
        assert_eq!(text_plan.parent, root);
        assert_eq!(text_plan.reference, text);
        assert!(text_plan.split_text);
        assert_eq!(text_plan.start.offset, 2.0);
        for (offset, expected) in [
            (0.0, text),
            (-0.0, text),
            (1.0, tail),
            (2.0, 0),
            (-1.0, 0),
            (0.5, 0),
            (f64::NAN, 0),
            (f64::INFINITY, 0),
        ] {
            let plan = tree
                .range_insertion_plan(point(root, offset), point(root, 2.0), inserted as f64)
                .unwrap()
                .unwrap();
            assert_eq!(plan.parent, root);
            assert_eq!(plan.reference, expected);
            assert!(!plan.split_text);
        }
    }

    #[test]
    fn should_reject_invalid_starts_but_defer_hierarchy_rules_to_the_existing_driver() {
        let mut tree = TreeStore::new();
        let inserted = node(&mut tree, 1);
        for kind in [TEXT_NODE, COMMENT_NODE, PROCESSING_INSTRUCTION_NODE] {
            let start = node(&mut tree, kind);
            assert_eq!(
                tree.range_insertion_plan(point(start, 0.0), point(start, 0.0), inserted as f64)
                    .unwrap(),
                None
            );
        }
        for kind in [1, 2, 4, 9, 10, 11] {
            let start = node(&mut tree, kind);
            assert!(
                tree.range_insertion_plan(point(start, 0.0), point(start, 0.0), inserted as f64)
                    .unwrap()
                    .is_some()
            );
            assert_eq!(
                tree.range_insertion_plan(point(start, 0.0), point(start, 0.0), start as f64)
                    .unwrap(),
                None
            );
        }
    }

    #[test]
    fn should_calculate_offset_from_current_reference_and_fragment_after_mutation() {
        let mut tree = TreeStore::new();
        let parent = node(&mut tree, 1);
        let first = node(&mut tree, 1);
        let reference = node(&mut tree, 1);
        let fragment = node(&mut tree, DOCUMENT_FRAGMENT_NODE);
        let child = node(&mut tree, 1);
        tree.append(parent as f64, first as f64).unwrap();
        tree.append(parent as f64, reference as f64).unwrap();
        assert_eq!(
            tree.range_insertion_offset(fragment as f64, parent as f64, reference as f64)
                .unwrap(),
            1.0
        );
        tree.remove(first as f64).unwrap();
        tree.append(fragment as f64, first as f64).unwrap();
        tree.append(fragment as f64, child as f64).unwrap();
        assert_eq!(
            tree.range_insertion_offset(fragment as f64, parent as f64, reference as f64)
                .unwrap(),
            2.0
        );
        assert_eq!(
            tree.range_insertion_offset(fragment as f64, parent as f64, 0.0)
                .unwrap(),
            3.0
        );
        assert_eq!(
            tree.range_insertion_offset(first as f64, parent as f64, 0.0)
                .unwrap(),
            2.0
        );
    }

    #[test]
    fn should_reject_reserved_handles_before_decisions_without_allocating_or_mutating() {
        let mut tree = TreeStore::new();
        let start = node(&mut tree, COMMENT_NODE);
        let inserted = node(&mut tree, 1);
        let reserved = tree.reserve_handles().unwrap() as u64;
        let before = tree.statistics();
        for (start, end, inserted) in [
            (reserved, start, inserted),
            (start, reserved, inserted),
            (start, start, reserved),
        ] {
            assert!(
                tree.range_insertion_plan(point(start, 0.0), point(end, 0.0), inserted as f64)
                    .is_err()
            );
        }
        for (inserted, parent, reference) in [
            (reserved, start, 0),
            (inserted, reserved, 0),
            (inserted, start, reserved),
        ] {
            assert!(
                tree.range_insertion_offset(inserted as f64, parent as f64, reference as f64)
                    .is_err()
            );
        }
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        assert_eq!(tree.statistics().mutations, before.mutations);
    }
}
