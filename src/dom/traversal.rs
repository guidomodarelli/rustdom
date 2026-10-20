//! Shared iterative traversal over native links, without retaining a stack of node handles.
use super::{
    error::Result,
    store::{NodeId, TreeStore},
};

impl TreeStore {
    /// Return the following node in a bounded preorder without entering an external sibling tree.
    pub(super) fn following_within(&self, node: NodeId, root: NodeId) -> Result<NodeId> {
        let first = self.links(node)?.first;
        if first != 0 {
            return Ok(first);
        }
        let mut current = node;
        while current != 0 && current != root {
            let links = self.links(current)?;
            if links.next != 0 {
                return Ok(links.next);
            }
            current = links.parent;
        }
        Ok(0)
    }

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
