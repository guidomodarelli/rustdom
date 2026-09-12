//! Boundary-point ordering from native topology, without scanning every following node.
use super::{
    error::Result,
    store::{TreeStore, node_id},
};

impl TreeStore {
    /// Offsets are compared as provided; public Range methods retain their own validation.
    /// None reports distinct tree roots, allowing the binding to preserve jsdom's diagnostic.
    pub fn compare_boundary_points_position(
        &mut self,
        left: f64,
        left_offset: u64,
        right: f64,
        right_offset: u64,
    ) -> Result<Option<i32>> {
        let mut left = node_id(left)?;
        let mut right = node_id(right)?;
        let (left_root, mut left_depth) = self.root_and_depth(left)?;
        let (right_root, mut right_depth) = self.root_and_depth(right)?;
        if left_root != right_root {
            return Ok(None);
        }
        if left == right {
            return Ok(Some(if left_offset == right_offset {
                0
            } else if left_offset < right_offset {
                -1
            } else {
                1
            }));
        }
        while left_depth > right_depth {
            let parent = self.links(left)?.parent;
            if parent == right {
                return Ok(Some(if self.sibling_index(left)? < right_offset {
                    -1
                } else {
                    1
                }));
            }
            left = parent;
            left_depth -= 1;
        }
        while right_depth > left_depth {
            let parent = self.links(right)?.parent;
            if parent == left {
                return Ok(Some(if self.sibling_index(right)? < left_offset {
                    1
                } else {
                    -1
                }));
            }
            right = parent;
            right_depth -= 1;
        }
        loop {
            let left_parent = self.links(left)?.parent;
            let right_parent = self.links(right)?.parent;
            if left_parent == right_parent {
                break;
            }
            left = left_parent;
            right = right_parent;
        }
        Ok(Some(
            if self.sibling_index(left)? < self.sibling_index(right)? {
                -1
            } else {
                1
            },
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_order_same_nodes_ancestors_and_separate_branches_at_child_boundaries() {
        let mut tree = TreeStore::new();
        let root = tree.allocate().unwrap();
        let first = tree.allocate().unwrap();
        let branch = tree.allocate().unwrap();
        let deep = tree.allocate().unwrap();
        tree.append(root, first).unwrap();
        tree.append(root, branch).unwrap();
        tree.append(branch, deep).unwrap();
        let points = [
            (root, 0),
            (first, 0),
            (first, 1),
            (root, 1),
            (branch, 0),
            (deep, 0),
            (deep, 9),
            (branch, 1),
            (root, 2),
        ];
        for (left_index, &(left, left_offset)) in points.iter().enumerate() {
            for (right_index, &(right, right_offset)) in points.iter().enumerate() {
                let expected = if left_index == right_index {
                    0
                } else if left_index < right_index {
                    -1
                } else {
                    1
                };
                assert_eq!(
                    tree.compare_boundary_points_position(left, left_offset, right, right_offset)
                        .unwrap(),
                    Some(expected)
                );
            }
        }
        assert_eq!(
            tree.compare_boundary_points_position(root, u64::from(u32::MAX), deep, 0)
                .unwrap(),
            Some(1)
        );
    }

    #[test]
    fn should_follow_live_moves_and_keep_attribute_ownership_outside_tree_ancestry() {
        let mut tree = TreeStore::new();
        let root = tree.allocate().unwrap();
        tree.set_data(root, r#"{"kind":1,"name":"root"}"#).unwrap();
        tree.initialize_attribute_collection(root).unwrap();
        let attribute = tree.allocate().unwrap();
        tree.initialize_attribute(attribute, r#"{"kind":2,"name":"id","value":"value"}"#)
            .unwrap();
        tree.append_attribute(root, attribute).unwrap();
        assert_eq!(
            tree.compare_boundary_points_position(root, 0, attribute, 0)
                .unwrap(),
            None
        );
        assert_eq!(
            tree.compare_boundary_points_position(attribute, 0, attribute, 0)
                .unwrap(),
            Some(0)
        );
        let first = tree.allocate().unwrap();
        let last = tree.allocate().unwrap();
        tree.append(root, first).unwrap();
        tree.append(root, last).unwrap();
        assert_eq!(
            tree.compare_boundary_points_position(first, 0, last, 0)
                .unwrap(),
            Some(-1)
        );
        tree.remove(last).unwrap();
        assert_eq!(
            tree.compare_boundary_points_position(first, 0, last, 0)
                .unwrap(),
            None
        );
        tree.prepend(root, last).unwrap();
        assert_eq!(
            tree.compare_boundary_points_position(first, 0, last, 0)
                .unwrap(),
            Some(1)
        );
        for handle in [attribute, first, last, root] {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_reject_invalid_handles_without_activating_reservations() {
        let mut tree = TreeStore::new();
        let reserved = tree.reserve_handles().unwrap();
        let root = tree.allocate().unwrap();
        let before = tree.statistics();
        for handle in [reserved, 0.0, -1.0, f64::NAN, 1.5] {
            assert!(
                tree.compare_boundary_points_position(root, 0, handle, 0)
                    .is_err()
            );
        }
        let after = tree.statistics();
        assert_eq!(before.allocations, after.allocations);
        assert_eq!(before.reserved_handles, after.reserved_handles);
        assert_eq!(before.mutations, after.mutations);
        tree.release(root).unwrap();
    }
}
