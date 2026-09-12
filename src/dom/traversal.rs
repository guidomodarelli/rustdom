//! Shared iterative traversal over native links, without retaining a stack of node handles.
use super::{
    error::Result,
    store::{NodeId, TreeStore},
};

impl TreeStore {
    pub(super) fn after_subtree(&self, mut node: NodeId) -> Result<NodeId> {
        while node != 0 {
            let links = self.links(node)?;
            if links.next != 0 {
                return Ok(links.next);
            }
            node = links.parent;
        }
        Ok(0)
    }
    pub(super) fn following_node(&self, node: NodeId) -> Result<NodeId> {
        let first = self.links(node)?.first;
        if first != 0 {
            Ok(first)
        } else {
            self.after_subtree(node)
        }
    }
}
