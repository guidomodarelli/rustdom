//! Selection snapshots shared by cloneContents and extractContents before their mutation/creation hooks.
use super::{
    constants::DOCUMENT_TYPE_NODE,
    error::{Result, TreeError},
    range_state::BoundaryPoint,
    store::{NodeId, TreeStore},
};

pub(crate) struct ContentSelection {
    pub common: NodeId,
    pub first_partial: NodeId,
    pub last_partial: NodeId,
    pub contained: Vec<NodeId>,
    pub has_doctype: bool,
    pub collapse: BoundaryPoint,
}

impl TreeStore {
    pub fn range_content_selection(
        &mut self,
        start: BoundaryPoint,
        end: BoundaryPoint,
    ) -> Result<Option<ContentSelection>> {
        self.links(start.node)?;
        self.links(end.node)?;
        let common = self.common_ancestor(start.node as f64, end.node as f64)?;
        if common == 0 {
            return Ok(None);
        }
        let first_partial = if common == start.node {
            0
        } else {
            self.child_below(common, start.node)?
        };
        let last_partial = if common == end.node {
            0
        } else {
            self.child_below(common, end.node)?
        };
        let mut contained = Vec::new();
        let mut has_doctype = false;
        let mut child = self.links(common)?.first;
        while child != 0 {
            match self.range_contains_node(child, start, end)? {
                None => return Ok(None),
                Some(true) => {
                    contained.push(child);
                    has_doctype |= self
                        .data
                        .get(&child)
                        .ok_or(TreeError::MissingData(child))?
                        .kind
                        == DOCUMENT_TYPE_NODE;
                }
                Some(false) => {}
            }
            child = self.links(child)?.next;
        }
        let collapse = if first_partial == 0 {
            start
        } else {
            BoundaryPoint {
                node: common,
                offset: (self.sibling_index(first_partial)? + 1) as f64,
            }
        };
        Ok(Some(ContentSelection {
            common,
            first_partial,
            last_partial,
            contained,
            has_doctype,
            collapse,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn node(tree: &mut TreeStore, metadata: &str) -> NodeId {
        let handle = tree.allocate().unwrap();
        tree.set_data(handle, metadata).unwrap();
        handle as NodeId
    }
    fn point(node: NodeId, offset: f64) -> BoundaryPoint {
        BoundaryPoint { node, offset }
    }
    #[test]
    fn should_select_partial_branches_and_contained_siblings_without_mutation() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"root"}"#);
        let first = node(&mut tree, r#"{"kind":1,"name":"first"}"#);
        let text = node(&mut tree, r#"{"kind":3,"value":"text"}"#);
        let middle = node(&mut tree, r#"{"kind":1,"name":"middle"}"#);
        let last = node(&mut tree, r#"{"kind":3,"value":"last"}"#);
        for child in [first, middle, last] {
            tree.append(root as f64, child as f64).unwrap();
        }
        tree.append(first as f64, text as f64).unwrap();
        let before = tree.statistics();
        let plan = tree
            .range_content_selection(point(text, 1.0), point(last, 2.0))
            .unwrap()
            .unwrap();
        assert_eq!(plan.common, root);
        assert_eq!(plan.first_partial, first);
        assert_eq!(plan.last_partial, last);
        assert_eq!(plan.contained, vec![middle]);
        assert!(!plan.has_doctype);
        assert_eq!(plan.collapse, point(root, 1.0));
        assert_eq!(tree.statistics().mutations, before.mutations);
        let plan = tree
            .range_content_selection(point(root, 1.0), point(last, 2.0))
            .unwrap()
            .unwrap();
        assert_eq!(plan.first_partial, 0);
        assert_eq!(plan.last_partial, last);
        assert_eq!(plan.contained, vec![middle]);
    }
    #[test]
    fn should_report_doctypes_and_preserve_character_data_lengths_and_empty_selections() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":9}"#);
        let doctype = node(&mut tree, r#"{"kind":10,"name":"html"}"#);
        let child = node(&mut tree, r#"{"kind":1,"name":"html"}"#);
        tree.append(root as f64, doctype as f64).unwrap();
        tree.append(root as f64, child as f64).unwrap();
        let plan = tree
            .range_content_selection(point(root, 0.0), point(root, 2.0))
            .unwrap()
            .unwrap();
        assert_eq!(plan.contained, vec![doctype, child]);
        assert!(plan.has_doctype);
        assert_eq!(plan.first_partial, 0);
        assert_eq!(plan.last_partial, 0);
        let empty = tree
            .range_content_selection(point(root, 1.0), point(root, 1.0))
            .unwrap()
            .unwrap();
        assert!(empty.contained.is_empty());
        assert!(!empty.has_doctype);
    }
    #[test]
    fn should_reject_unallocated_endpoints_and_report_distinct_roots_without_activating_handles() {
        let mut tree = TreeStore::new();
        let first = tree.allocate().unwrap() as NodeId;
        let second = tree.allocate().unwrap() as NodeId;
        assert!(
            tree.range_content_selection(point(first, 0.0), point(second, 0.0))
                .unwrap()
                .is_none()
        );
        let reserved = tree.reserve_handles().unwrap() as NodeId;
        let before = tree.statistics();
        assert!(
            tree.range_content_selection(point(reserved, 0.0), point(first, 0.0))
                .is_err()
        );
        assert!(
            tree.range_content_selection(point(first, 0.0), point(reserved, 0.0))
                .is_err()
        );
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
    }
}
