//! Read-only deleteContents planning; host mutation hooks execute after the snapshot returns.
use super::{
    constants::{COMMENT_NODE, PROCESSING_INSTRUCTION_NODE, TEXT_NODE},
    error::{Result, TreeError},
    range_state::BoundaryPoint,
    store::{NodeId, TreeStore},
};

#[derive(Debug, PartialEq)]
pub(crate) enum DeletionKind {
    Empty,
    CharacterData,
    Tree,
    InconsistentRoots,
}

#[derive(Debug)]
pub(crate) struct DeletionPlan {
    pub kind: DeletionKind,
    pub start: BoundaryPoint,
    pub end: BoundaryPoint,
    pub start_count: f64,
    pub start_character: bool,
    pub end_character: bool,
    pub nodes: Vec<NodeId>,
    pub collapse: BoundaryPoint,
}

impl TreeStore {
    pub fn range_deletion_plan(
        &mut self,
        start: BoundaryPoint,
        end: BoundaryPoint,
    ) -> Result<DeletionPlan> {
        self.links(start.node)?;
        self.links(end.node)?;
        let mut plan = DeletionPlan {
            kind: DeletionKind::Empty,
            start,
            end,
            start_count: 0.0,
            start_character: false,
            end_character: false,
            nodes: Vec::new(),
            collapse: start,
        };
        if start.node == end.node && start.offset == end.offset {
            return Ok(plan);
        }
        let start_kind = self
            .data
            .get(&start.node)
            .ok_or(TreeError::MissingData(start.node))?
            .kind;
        let end_kind = self
            .data
            .get(&end.node)
            .ok_or(TreeError::MissingData(end.node))?
            .kind;
        plan.start_character = matches!(
            start_kind,
            TEXT_NODE | PROCESSING_INSTRUCTION_NODE | COMMENT_NODE
        );
        plan.end_character = matches!(
            end_kind,
            TEXT_NODE | PROCESSING_INSTRUCTION_NODE | COMMENT_NODE
        );
        if start.node == end.node && plan.start_character {
            plan.kind = DeletionKind::CharacterData;
            plan.start_count = end.offset - start.offset;
            return Ok(plan);
        }
        plan.kind = DeletionKind::Tree;
        let stop = self.after_subtree(end.node)?;
        let mut current = start.node;
        while current != 0 && current != stop {
            let contained = self.range_contains_node(current, start, end)?;
            if contained.is_none() {
                plan.kind = DeletionKind::InconsistentRoots;
                return Ok(plan);
            }
            if contained == Some(true) {
                let parent = self.links(current)?.parent;
                let parent_contained = if parent == 0 {
                    Some(false)
                } else {
                    self.range_contains_node(parent, start, end)?
                };
                match parent_contained {
                    None => {
                        plan.kind = DeletionKind::InconsistentRoots;
                        return Ok(plan);
                    }
                    Some(false) => {
                        plan.nodes.push(current);
                        // Every descendant is covered by this outermost removal; none can be an endpoint.
                        current = self.after_subtree(current)?;
                        continue;
                    }
                    Some(true) => {}
                }
            }
            current = self.following_node(current)?;
        }
        let Some(collapse) = self.range_collapse_point(start, end)? else {
            plan.kind = DeletionKind::InconsistentRoots;
            return Ok(plan);
        };
        plan.collapse = collapse;
        if plan.start_character {
            plan.start_count = self.range_node_length(start.node)? as f64 - start.offset;
        }
        Ok(plan)
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
    fn should_plan_same_character_data_slices_without_mutating_the_data() {
        let mut tree = TreeStore::new();
        for kind in [3, 7, 8] {
            let text = node(
                &mut tree,
                &format!(r#"{{"kind":{kind},"name":"target","value":"abcdef"}}"#),
            );
            let plan = tree
                .range_deletion_plan(point(text, 1.5), point(text, 5.1))
                .unwrap();
            assert_eq!(plan.kind, DeletionKind::CharacterData);
            assert_eq!(plan.start_count, 5.1 - 1.5);
            assert_eq!(tree.character_data(text as f64).unwrap().len(), 6);
            tree.release(text as f64).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }
    #[test]
    fn should_capture_only_outermost_removals_and_the_original_collapse_position() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"main"}"#);
        let first = node(&mut tree, r#"{"kind":3,"value":"abc"}"#);
        let middle = node(&mut tree, r#"{"kind":1,"name":"span"}"#);
        let child = node(&mut tree, r#"{"kind":3,"value":"def"}"#);
        let last = node(&mut tree, r#"{"kind":3,"value":"ghi"}"#);
        tree.append(root as f64, first as f64).unwrap();
        tree.append(root as f64, middle as f64).unwrap();
        tree.append(middle as f64, child as f64).unwrap();
        tree.append(root as f64, last as f64).unwrap();
        let before = tree.statistics();
        let plan = tree
            .range_deletion_plan(point(first, 1.0), point(last, 2.0))
            .unwrap();
        assert_eq!(plan.kind, DeletionKind::Tree);
        assert_eq!(plan.nodes, vec![middle]);
        assert_eq!(plan.collapse, point(root, 1.0));
        assert_eq!(plan.start_count, 2.0);
        assert!(plan.start_character && plan.end_character);
        assert_eq!(tree.statistics().mutations, before.mutations);
        let selected = tree
            .range_deletion_plan(point(root, 1.0), point(root, 3.0))
            .unwrap();
        assert_eq!(selected.nodes, vec![middle, last]);
        assert_eq!(selected.collapse, point(root, 1.0));
        assert!(!selected.start_character && !selected.end_character);
    }
    #[test]
    fn should_preserve_cdata_exclusion_and_reject_unallocated_endpoints_without_activation() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"root"}"#);
        let cdata = node(&mut tree, r#"{"kind":4,"value":"value"}"#);
        tree.append(root as f64, cdata as f64).unwrap();
        assert_eq!(
            tree.range_deletion_plan(point(cdata, 0.0), point(cdata, 0.0))
                .unwrap()
                .kind,
            DeletionKind::Empty
        );
        let plan = tree
            .range_deletion_plan(point(root, 0.0), point(root, 1.0))
            .unwrap();
        assert_eq!(plan.nodes, vec![cdata]);
        assert!(!plan.start_character);
        let reserved = tree.reserve_handles().unwrap() as NodeId;
        let before = tree.statistics();
        assert!(
            tree.range_deletion_plan(point(reserved, 0.0), point(root, 1.0))
                .is_err()
        );
        assert!(
            tree.range_deletion_plan(point(root, 0.0), point(reserved, 1.0))
                .is_err()
        );
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
    }
}
