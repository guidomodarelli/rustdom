//! Generic DOM tree helpers over the authoritative native topology.
use super::{
    error::Result,
    store::{TreeStore, node_id},
};

impl TreeStore {
    pub fn node_root(&self, handle: f64) -> Result<f64> {
        Ok(self.root_and_depth(node_id(handle)?)?.0 as f64)
    }
    /// Preserve pinned DOM nodeLength, including its deliberate exclusion of CDATA data length.
    pub fn node_length(&self, handle: f64) -> Result<f64> {
        let id = node_id(handle)?;
        self.links(id)?;
        Ok(self.range_node_length(id)? as f64)
    }
    /// Strict preorder following; separate roots and Attr ownership never create a tree relationship.
    pub fn is_following(&mut self, node: f64, reference: f64) -> Result<bool> {
        Ok(self.compare_boundary_points_position(reference, 0, node, 0)? == Some(-1))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn node(tree: &mut TreeStore, data: &str) -> f64 {
        let id = tree.allocate().unwrap();
        tree.set_data(id, data).unwrap();
        id
    }
    #[test]
    fn should_follow_current_tree_roots_and_order_after_moves() {
        let mut tree = TreeStore::new();
        let root = tree.allocate().unwrap();
        let branch = tree.allocate().unwrap();
        let child = tree.allocate().unwrap();
        let sibling = tree.allocate().unwrap();
        let detached = tree.allocate().unwrap();
        tree.append(root, branch).unwrap();
        tree.append(branch, child).unwrap();
        tree.append(root, sibling).unwrap();
        assert_eq!(tree.node_root(child).unwrap(), root);
        for (node, reference, expected) in [
            (root, root, false),
            (child, branch, true),
            (branch, child, false),
            (sibling, child, true),
            (child, sibling, false),
            (child, detached, false),
        ] {
            assert_eq!(tree.is_following(node, reference).unwrap(), expected);
        }
        tree.remove(branch).unwrap();
        tree.append(detached, branch).unwrap();
        assert_eq!(tree.node_root(child).unwrap(), detached);
        assert!(!tree.is_following(child, sibling).unwrap());
        assert!(tree.contains_node(detached, child).unwrap());
    }
    #[test]
    fn should_preserve_utf16_and_non_character_length_rules() {
        let mut tree = TreeStore::new();
        for (kind, length) in [(3, 4.0), (7, 4.0), (8, 4.0), (4, 0.0), (10, 0.0), (2, 0.0)] {
            let id = node(
                &mut tree,
                &format!(r#"{{"kind":{kind},"value":[65,55358,56704,55296]}}"#),
            );
            assert_eq!(tree.node_length(id).unwrap(), length);
        }
        let fragment = node(&mut tree, r#"{"kind":11}"#);
        let child = node(&mut tree, r#"{"kind":1,"name":"p"}"#);
        tree.append(fragment, child).unwrap();
        assert_eq!(tree.node_length(fragment).unwrap(), 1.0);
        tree.remove(child).unwrap();
        assert_eq!(tree.node_length(fragment).unwrap(), 0.0);
    }
    #[test]
    fn should_reject_reserved_and_invalid_handles_without_materialization() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":9}"#);
        let reserved = tree.reserve_handles().unwrap();
        let before = tree.statistics();
        for invalid in [0.0, -1.0, 0.5, f64::NAN, reserved] {
            assert!(tree.node_root(invalid).is_err());
            assert!(tree.node_length(invalid).is_err());
            assert!(tree.is_following(invalid, root).is_err());
            assert!(tree.is_following(root, invalid).is_err());
        }
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
    }
}
