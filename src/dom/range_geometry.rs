//! Shared Range containment and collapse geometry over native topology.
use super::{
    error::Result,
    range_state::{BoundaryPoint, query_offset},
    store::{NodeId, TreeStore},
};

impl TreeStore {
    pub(super) fn range_contains_node(
        &mut self,
        node: NodeId,
        start: BoundaryPoint,
        end: BoundaryPoint,
    ) -> Result<Option<bool>> {
        match self.compare_boundary_points_position(
            node as f64,
            0,
            start.node as f64,
            u64::from(query_offset(start.offset)),
        )? {
            None => return Ok(None),
            Some(1) => {}
            Some(_) => return Ok(Some(false)),
        }
        let length = self.range_node_length(node)?;
        Ok(self
            .compare_boundary_points_position(
                node as f64,
                length,
                end.node as f64,
                u64::from(query_offset(end.offset)),
            )?
            .map(|position| position == -1))
    }
    /// The caller has already established that ancestor strictly contains descendant.
    pub(super) fn child_below(&self, ancestor: NodeId, mut descendant: NodeId) -> Result<NodeId> {
        loop {
            let parent = self.links(descendant)?.parent;
            if parent == ancestor {
                return Ok(descendant);
            }
            if parent == 0 {
                return Ok(0);
            }
            descendant = parent;
        }
    }
    pub(super) fn range_collapse_point(
        &mut self,
        start: BoundaryPoint,
        end: BoundaryPoint,
    ) -> Result<Option<BoundaryPoint>> {
        let common = self.common_ancestor(start.node as f64, end.node as f64)?;
        if common == 0 {
            return Ok(None);
        }
        if common == start.node {
            return Ok(Some(start));
        }
        let first = self.child_below(common, start.node)?;
        Ok(Some(BoundaryPoint {
            node: common,
            offset: (self.sibling_index(first)? + 1) as f64,
        }))
    }
}
