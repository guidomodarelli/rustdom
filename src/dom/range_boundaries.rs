//! Read-only Range boundary decisions; host bindings apply the returned live-reference updates.
use super::{
    constants::{COMMENT_NODE, DOCUMENT_TYPE_NODE, PROCESSING_INSTRUCTION_NODE, TEXT_NODE},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};

#[derive(Clone, Copy, Debug)]
pub(crate) enum BoundaryMode {
    Start,
    End,
    StartBefore,
    StartAfter,
    EndBefore,
    EndAfter,
    SelectNode,
    SelectContents,
}

#[derive(Debug, PartialEq)]
pub(crate) enum BoundaryPlan {
    Start {
        node: NodeId,
        offset: u64,
    },
    End {
        node: NodeId,
        offset: u64,
    },
    Both {
        node: NodeId,
        start: u64,
        end: u64,
        start_first: bool,
    },
    InvalidNodeType,
    InvalidOffset,
    NoParent,
    InconsistentRoots,
}

impl TreeStore {
    /// Pinned jsdom nodeLength deliberately excludes CDATA from CharacterData lengths.
    pub(super) fn range_node_length(&self, id: NodeId) -> Result<u64> {
        let data = self.data.get(&id).ok_or(TreeError::MissingData(id))?;
        match data.kind {
            DOCUMENT_TYPE_NODE => Ok(0),
            TEXT_NODE | PROCESSING_INSTRUCTION_NODE | COMMENT_NODE => {
                Ok(self.character_data(id as f64)?.len() as u64)
            }
            _ => self.child_count(id),
        }
    }

    pub fn range_boundary_plan(
        &mut self,
        mode: BoundaryMode,
        handle: f64,
        offset: u32,
        start: (f64, u64),
        end: (f64, u64),
    ) -> Result<BoundaryPlan> {
        let mut node = node_id(handle)?;
        let mut offset = u64::from(offset);
        let links = self.links(node)?;
        if matches!(mode, BoundaryMode::SelectNode) {
            if links.parent == 0 {
                return Ok(BoundaryPlan::NoParent);
            }
            let index = self.sibling_index(node)?;
            return Ok(BoundaryPlan::Both {
                node: links.parent,
                start: index,
                end: index + 1,
                start_first: true,
            });
        }
        if matches!(
            mode,
            BoundaryMode::StartBefore
                | BoundaryMode::StartAfter
                | BoundaryMode::EndBefore
                | BoundaryMode::EndAfter
        ) {
            if links.parent == 0 {
                return Ok(BoundaryPlan::NoParent);
            }
            offset = self.sibling_index(node)?
                + u64::from(matches!(
                    mode,
                    BoundaryMode::StartAfter | BoundaryMode::EndAfter
                ));
            node = links.parent;
        }
        if self
            .data
            .get(&node)
            .ok_or(TreeError::MissingData(node))?
            .kind
            == DOCUMENT_TYPE_NODE
        {
            return Ok(BoundaryPlan::InvalidNodeType);
        }
        let length = self.range_node_length(node)?;
        if matches!(mode, BoundaryMode::SelectContents) {
            return Ok(BoundaryPlan::Both {
                node,
                start: 0,
                end: length,
                start_first: true,
            });
        }
        if offset > length {
            return Ok(BoundaryPlan::InvalidOffset);
        }
        let sets_start = matches!(
            mode,
            BoundaryMode::Start | BoundaryMode::StartBefore | BoundaryMode::StartAfter
        );
        let different_root =
            self.root_and_depth(node)?.0 != self.root_and_depth(node_id(start.0)?)?.0;
        let collapse = if different_root {
            true
        } else {
            let other = if sets_start { end } else { start };
            match self.compare_boundary_points_position(node as f64, offset, other.0, other.1)? {
                Some(position) => position == if sets_start { 1 } else { -1 },
                None => return Ok(BoundaryPlan::InconsistentRoots),
            }
        };
        Ok(if collapse {
            BoundaryPlan::Both {
                node,
                start: offset,
                end: offset,
                start_first: !sets_start,
            }
        } else if sets_start {
            BoundaryPlan::Start { node, offset }
        } else {
            BoundaryPlan::End { node, offset }
        })
    }

    /// Returns zero for distinct roots. Only numeric handles are held during the traversal.
    pub fn common_ancestor(&self, left: f64, right: f64) -> Result<NodeId> {
        let mut left = node_id(left)?;
        let mut right = node_id(right)?;
        let (left_root, mut left_depth) = self.root_and_depth(left)?;
        let (right_root, mut right_depth) = self.root_and_depth(right)?;
        if left_root != right_root {
            return Ok(0);
        }
        while left_depth > right_depth {
            left = self.links(left)?.parent;
            left_depth -= 1;
        }
        while right_depth > left_depth {
            right = self.links(right)?.parent;
            right_depth -= 1;
        }
        while left != right {
            left = self.links(left)?.parent;
            right = self.links(right)?.parent;
        }
        Ok(left)
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
    fn should_preserve_update_order_when_crossing_endpoints_or_changing_roots() {
        let mut tree = TreeStore::new();
        let text = node(&mut tree, r#"{"kind":3,"value":"abcdef"}"#);
        let other = node(&mut tree, r#"{"kind":3,"value":"other"}"#);
        assert_eq!(
            tree.range_boundary_plan(BoundaryMode::Start, text, 3, (text, 1), (text, 4))
                .unwrap(),
            BoundaryPlan::Start {
                node: text as NodeId,
                offset: 3
            }
        );
        assert_eq!(
            tree.range_boundary_plan(BoundaryMode::Start, text, 5, (text, 1), (text, 4))
                .unwrap(),
            BoundaryPlan::Both {
                node: text as NodeId,
                start: 5,
                end: 5,
                start_first: false
            }
        );
        assert_eq!(
            tree.range_boundary_plan(BoundaryMode::End, text, 0, (text, 1), (text, 4))
                .unwrap(),
            BoundaryPlan::Both {
                node: text as NodeId,
                start: 0,
                end: 0,
                start_first: true
            }
        );
        assert_eq!(
            tree.range_boundary_plan(BoundaryMode::End, text, 2, (text, 1), (text, 4))
                .unwrap(),
            BoundaryPlan::End {
                node: text as NodeId,
                offset: 2
            }
        );
        assert_eq!(
            tree.range_boundary_plan(BoundaryMode::Start, other, 2, (text, 1), (text, 4))
                .unwrap(),
            BoundaryPlan::Both {
                node: other as NodeId,
                start: 2,
                end: 2,
                start_first: false
            }
        );
    }
    #[test]
    fn should_resolve_relative_boundaries_and_selections_after_sibling_changes() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"root"}"#);
        let first = node(&mut tree, r#"{"kind":3,"value":"first"}"#);
        let last = node(&mut tree, r#"{"kind":3,"value":"last"}"#);
        tree.append(root, first).unwrap();
        tree.append(root, last).unwrap();
        for (mode, offset, starts) in [
            (BoundaryMode::StartBefore, 1, true),
            (BoundaryMode::StartAfter, 2, true),
            (BoundaryMode::EndBefore, 1, false),
            (BoundaryMode::EndAfter, 2, false),
        ] {
            let expected = if starts {
                BoundaryPlan::Start {
                    node: root as NodeId,
                    offset,
                }
            } else {
                BoundaryPlan::End {
                    node: root as NodeId,
                    offset,
                }
            };
            assert_eq!(
                tree.range_boundary_plan(mode, last, 99, (root, 0), (root, 2))
                    .unwrap(),
                expected
            );
        }
        tree.remove(first).unwrap();
        assert_eq!(
            tree.range_boundary_plan(BoundaryMode::SelectNode, last, 99, (root, 0), (root, 1))
                .unwrap(),
            BoundaryPlan::Both {
                node: root as NodeId,
                start: 0,
                end: 1,
                start_first: true
            }
        );
        assert_eq!(
            tree.range_boundary_plan(BoundaryMode::SelectContents, last, 99, (root, 0), (root, 1))
                .unwrap(),
            BoundaryPlan::Both {
                node: last as NodeId,
                start: 0,
                end: 4,
                start_first: true
            }
        );
        assert_eq!(
            tree.range_boundary_plan(BoundaryMode::SelectNode, first, 0, (root, 0), (root, 1))
                .unwrap(),
            BoundaryPlan::NoParent
        );
    }
    #[test]
    fn should_reject_invalid_boundaries_before_root_decisions_without_mutation() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":9}"#);
        let doctype = node(&mut tree, r#"{"kind":10,"name":"html"}"#);
        let cdata = node(&mut tree, r#"{"kind":4,"value":"data"}"#);
        let before = tree.statistics();
        assert_eq!(
            tree.range_boundary_plan(BoundaryMode::Start, doctype, 99, (root, 0), (root, 0))
                .unwrap(),
            BoundaryPlan::InvalidNodeType
        );
        assert_eq!(
            tree.range_boundary_plan(
                BoundaryMode::SelectContents,
                doctype,
                0,
                (root, 0),
                (root, 0)
            )
            .unwrap(),
            BoundaryPlan::InvalidNodeType
        );
        assert_eq!(
            tree.range_boundary_plan(BoundaryMode::End, cdata, 1, (root, 0), (root, 0))
                .unwrap(),
            BoundaryPlan::InvalidOffset
        );
        let after = tree.statistics();
        assert_eq!(before.mutations, after.mutations);
        assert_eq!(before.data_updates, after.data_updates);
        let reserved = tree.reserve_handles().unwrap();
        let before = tree.statistics();
        assert!(
            tree.range_boundary_plan(BoundaryMode::Start, reserved, 0, (root, 0), (root, 0))
                .is_err()
        );
        assert_eq!(before.allocations, tree.statistics().allocations);
        assert_eq!(before.reserved_handles, tree.statistics().reserved_handles);
    }
    #[test]
    fn should_find_inclusive_common_ancestors_without_crossing_roots_or_retaining_nodes() {
        let mut tree = TreeStore::new();
        let root = tree.allocate().unwrap();
        let foreign = tree.allocate().unwrap();
        let mut handles = vec![root];
        for _ in 0..512 {
            let child = tree.allocate().unwrap();
            tree.append(*handles.last().unwrap(), child).unwrap();
            handles.push(child);
        }
        let leaf = *handles.last().unwrap();
        assert_eq!(tree.common_ancestor(root, leaf).unwrap(), root as NodeId);
        assert_eq!(
            tree.common_ancestor(leaf, handles[200]).unwrap(),
            handles[200] as NodeId
        );
        assert_eq!(tree.common_ancestor(leaf, foreign).unwrap(), 0);
        let sibling = tree.allocate().unwrap();
        tree.append(root, sibling).unwrap();
        assert_eq!(tree.common_ancestor(sibling, leaf).unwrap(), root as NodeId);
        for handle in handles.into_iter().rev().chain([sibling, foreign]) {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }
}
