//! Public Range point/intersection decisions over native topology and pinned node-length semantics.
use super::{
    constants::{COMMENT_NODE, DOCUMENT_TYPE_NODE, PROCESSING_INSTRUCTION_NODE, TEXT_NODE},
    error::{Result, TreeError},
    store::{TreeStore, node_id},
};

#[derive(Debug, PartialEq)]
pub(crate) enum PointRelation {
    Before,
    Inside,
    After,
    DifferentRoot,
    InvalidNodeType,
    InvalidOffset,
    InconsistentRoots,
}

impl TreeStore {
    pub fn range_point_relation(
        &mut self,
        node: f64,
        offset: u32,
        start: f64,
        start_offset: u32,
        end: f64,
        end_offset: u32,
    ) -> Result<PointRelation> {
        let id = node_id(node)?;
        let start_id = node_id(start)?;
        self.links(node_id(end)?)?;
        if self.root_and_depth(id)?.0 != self.root_and_depth(start_id)?.0 {
            return Ok(PointRelation::DifferentRoot);
        }
        let data = self.data.get(&id).ok_or(TreeError::MissingData(id))?;
        if data.kind == DOCUMENT_TYPE_NODE {
            return Ok(PointRelation::InvalidNodeType);
        }
        // jsdom 27 nodeLength omits CDATA; preserve its public offset-validation behavior.
        let length = if matches!(
            data.kind,
            TEXT_NODE | PROCESSING_INSTRUCTION_NODE | COMMENT_NODE
        ) {
            self.character_data(node)?.len() as u64
        } else {
            self.child_count(id)?
        };
        if u64::from(offset) > length {
            return Ok(PointRelation::InvalidOffset);
        }
        if self.compare_boundary_points_position(
            node,
            u64::from(offset),
            start,
            u64::from(start_offset),
        )? == Some(-1)
        {
            return Ok(PointRelation::Before);
        }
        Ok(
            match self.compare_boundary_points_position(
                node,
                u64::from(offset),
                end,
                u64::from(end_offset),
            )? {
                Some(1) => PointRelation::After,
                Some(_) => PointRelation::Inside,
                None => PointRelation::InconsistentRoots,
            },
        )
    }

    /// None preserves the internal same-root diagnostic for an inconsistent Range endpoint pair.
    pub fn range_intersects_node(
        &mut self,
        node: f64,
        start: f64,
        start_offset: u32,
        end: f64,
        end_offset: u32,
    ) -> Result<Option<bool>> {
        let id = node_id(node)?;
        let start_id = node_id(start)?;
        self.links(node_id(end)?)?;
        if self.root_and_depth(id)?.0 != self.root_and_depth(start_id)?.0 {
            return Ok(Some(false));
        }
        let parent = self.links(id)?.parent;
        if parent == 0 {
            return Ok(Some(true));
        }
        let index = self.sibling_index(id)?;
        let before_end = self.compare_boundary_points_position(
            parent as f64,
            index,
            end,
            u64::from(end_offset),
        )?;
        match before_end {
            None => return Ok(None),
            Some(-1) => {}
            Some(_) => return Ok(Some(false)),
        }
        Ok(self
            .compare_boundary_points_position(
                parent as f64,
                index + 1,
                start,
                u64::from(start_offset),
            )?
            .map(|position| position == 1))
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
    fn should_validate_roots_before_node_type_and_offsets_and_preserve_cdata_limits() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":9}"#);
        let other = node(&mut tree, r#"{"kind":9}"#);
        let doctype = node(&mut tree, r#"{"kind":10,"name":"html"}"#);
        let text = node(&mut tree, r#"{"kind":3,"value":[65,55296,66]}"#);
        let cdata = node(&mut tree, r#"{"kind":4,"value":"data"}"#);
        tree.append(root, doctype).unwrap();
        tree.append(root, text).unwrap();
        tree.append(root, cdata).unwrap();
        assert_eq!(
            tree.range_point_relation(doctype, 99, other, 0, other, 0)
                .unwrap(),
            PointRelation::DifferentRoot
        );
        assert_eq!(
            tree.range_point_relation(doctype, 99, root, 0, root, 3)
                .unwrap(),
            PointRelation::InvalidNodeType
        );
        assert_eq!(
            tree.range_point_relation(text, 4, root, 0, root, 3)
                .unwrap(),
            PointRelation::InvalidOffset
        );
        assert_eq!(
            tree.range_point_relation(text, 3, root, 0, root, 3)
                .unwrap(),
            PointRelation::Inside
        );
        assert_eq!(
            tree.range_point_relation(cdata, 1, root, 0, root, 3)
                .unwrap(),
            PointRelation::InvalidOffset
        );
        assert_eq!(
            tree.range_point_relation(cdata, 0, root, 0, root, 3)
                .unwrap(),
            PointRelation::Inside
        );
    }
    #[test]
    fn should_report_point_order_and_intersection_in_current_tree_order() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"root"}"#);
        let first = node(&mut tree, r#"{"kind":3,"value":"first"}"#);
        let last = node(&mut tree, r#"{"kind":3,"value":"last"}"#);
        tree.append(root, first).unwrap();
        tree.append(root, last).unwrap();
        assert_eq!(
            tree.range_point_relation(first, 0, last, 0, last, 4)
                .unwrap(),
            PointRelation::Before
        );
        assert_eq!(
            tree.range_point_relation(last, 0, first, 0, first, 5)
                .unwrap(),
            PointRelation::After
        );
        assert_eq!(
            tree.range_intersects_node(first, last, 0, last, 4).unwrap(),
            Some(false)
        );
        assert_eq!(
            tree.range_intersects_node(last, last, 0, last, 4).unwrap(),
            Some(true)
        );
        assert_eq!(
            tree.range_intersects_node(root, last, 0, last, 4).unwrap(),
            Some(true)
        );
        tree.remove(last).unwrap();
        assert_eq!(
            tree.range_intersects_node(last, first, 0, first, 5)
                .unwrap(),
            Some(false)
        );
        assert_eq!(
            tree.range_point_relation(last, 99, first, 0, first, 5)
                .unwrap(),
            PointRelation::DifferentRoot
        );
    }
    #[test]
    fn should_reject_unallocated_query_nodes_without_activating_reservations() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":9}"#);
        let reserved = tree.reserve_handles().unwrap();
        let before = tree.statistics();
        assert!(
            tree.range_point_relation(reserved, 0, root, 0, root, 0)
                .is_err()
        );
        assert!(
            tree.range_intersects_node(root, root, 0, reserved, 0)
                .is_err()
        );
        let after = tree.statistics();
        assert_eq!(before.allocations, after.allocations);
        assert_eq!(before.reserved_handles, after.reserved_handles);
        assert_eq!(before.mutations, after.mutations);
    }
}
