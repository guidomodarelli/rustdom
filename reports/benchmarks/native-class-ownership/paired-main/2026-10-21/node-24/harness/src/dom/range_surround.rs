//! surroundContents preflight over the two ancestor paths, without scanning the whole subtree.
use super::{
    constants::{DOCUMENT_FRAGMENT_NODE, DOCUMENT_NODE, DOCUMENT_TYPE_NODE, TEXT_NODE},
    error::{Result, TreeError},
    range_state::BoundaryPoint,
    store::{TreeStore, node_id},
};

#[derive(Debug, PartialEq)]
pub(crate) enum SurroundStatus {
    Ready,
    PartialNonText,
    InvalidParentType,
    InconsistentRoots,
}

impl TreeStore {
    pub fn range_surround_status(
        &self,
        start: BoundaryPoint,
        end: BoundaryPoint,
        parent: f64,
    ) -> Result<SurroundStatus> {
        let parent = node_id(parent)?;
        self.links(start.node)?;
        self.links(end.node)?;
        self.links(parent)?;
        let common = self.common_ancestor(start.node as f64, end.node as f64)?;
        if common == 0 {
            return Ok(SurroundStatus::InconsistentRoots);
        }
        // Exactly the ancestors below the LCA contain one endpoint but not the other.
        for endpoint in [start.node, end.node] {
            let mut node = endpoint;
            while node != common {
                if self
                    .data
                    .get(&node)
                    .ok_or(TreeError::MissingData(node))?
                    .kind
                    != TEXT_NODE
                {
                    return Ok(SurroundStatus::PartialNonText);
                }
                node = self.links(node)?.parent;
            }
        }
        let kind = self
            .data
            .get(&parent)
            .ok_or(TreeError::MissingData(parent))?
            .kind;
        Ok(
            if matches!(
                kind,
                DOCUMENT_NODE | DOCUMENT_TYPE_NODE | DOCUMENT_FRAGMENT_NODE
            ) {
                SurroundStatus::InvalidParentType
            } else {
                SurroundStatus::Ready
            },
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn node(tree: &mut TreeStore, metadata: &str) -> u64 {
        let id = tree.allocate().unwrap();
        tree.set_data(id, metadata).unwrap();
        id as u64
    }
    fn point(node: u64) -> BoundaryPoint {
        BoundaryPoint { node, offset: 0.0 }
    }
    #[test]
    fn should_reject_partial_non_text_before_invalid_parent_type_and_allow_whole_elements() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"main"}"#);
        let branch = node(&mut tree, r#"{"kind":1,"name":"b"}"#);
        let text = node(&mut tree, r#"{"kind":3,"value":"text"}"#);
        let end = node(&mut tree, r#"{"kind":3,"value":"end"}"#);
        let fragment = node(&mut tree, r#"{"kind":11}"#);
        tree.append(root as f64, branch as f64).unwrap();
        tree.append(branch as f64, text as f64).unwrap();
        tree.append(root as f64, end as f64).unwrap();
        assert_eq!(
            tree.range_surround_status(point(text), point(end), fragment as f64)
                .unwrap(),
            SurroundStatus::PartialNonText
        );
        assert_eq!(
            tree.range_surround_status(point(root), point(root), fragment as f64)
                .unwrap(),
            SurroundStatus::InvalidParentType
        );
        assert_eq!(
            tree.range_surround_status(point(root), point(root), branch as f64)
                .unwrap(),
            SurroundStatus::Ready
        );
    }
    #[test]
    fn should_preserve_exclusive_text_rules_and_defer_later_parent_hierarchy_errors() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"root"}"#);
        let text = node(&mut tree, r#"{"kind":3,"value":"text"}"#);
        let cdata = node(&mut tree, r#"{"kind":4,"value":"data"}"#);
        tree.append(root as f64, text as f64).unwrap();
        tree.append(root as f64, cdata as f64).unwrap();
        assert_eq!(
            tree.range_surround_status(point(text), point(root), text as f64)
                .unwrap(),
            SurroundStatus::Ready
        );
        assert_eq!(
            tree.range_surround_status(point(cdata), point(root), text as f64)
                .unwrap(),
            SurroundStatus::PartialNonText
        );
        for kind in [2, 3, 4, 7, 8] {
            let parent = node(
                &mut tree,
                &format!(r#"{{"kind":{kind},"name":"node","value":"data"}}"#),
            );
            assert_eq!(
                tree.range_surround_status(point(root), point(root), parent as f64)
                    .unwrap(),
                SurroundStatus::Ready
            );
        }
    }
    #[test]
    fn should_reject_unallocated_handles_without_consuming_reservations_and_report_distinct_roots()
    {
        let mut tree = TreeStore::new();
        let first = tree.allocate().unwrap() as u64;
        let second = tree.allocate().unwrap() as u64;
        let parent = node(&mut tree, r#"{"kind":1,"name":"parent"}"#);
        assert_eq!(
            tree.range_surround_status(point(first), point(second), parent as f64)
                .unwrap(),
            SurroundStatus::InconsistentRoots
        );
        let reserved = tree.reserve_handles().unwrap() as u64;
        let before = tree.statistics();
        assert!(
            tree.range_surround_status(point(reserved), point(first), parent as f64)
                .is_err()
        );
        assert!(
            tree.range_surround_status(point(first), point(reserved), parent as f64)
                .is_err()
        );
        assert!(
            tree.range_surround_status(point(first), point(first), reserved as f64)
                .is_err()
        );
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
    }
}
