//! Public Range comparison dispatch and root validation over canonical endpoint inputs.
use super::{
    error::Result,
    store::{TreeStore, node_id},
};

#[derive(Debug, PartialEq)]
pub(crate) enum RangeComparison {
    Before,
    Equal,
    After,
    UnsupportedMethod,
    DifferentRoot,
    InconsistentRoots,
}

impl TreeStore {
    pub fn compare_ranges(
        &mut self,
        how: u32,
        current: ((f64, u32), (f64, u32)),
        source: ((f64, u32), (f64, u32)),
    ) -> Result<RangeComparison> {
        // Native callers must supply allocated topology, even for an otherwise rejected mode.
        for handle in [current.0.0, current.1.0, source.0.0, source.1.0] {
            self.links(node_id(handle)?)?;
        }
        if how > 3 {
            return Ok(RangeComparison::UnsupportedMethod);
        }
        if self.root_and_depth(node_id(current.0.0)?)?.0
            != self.root_and_depth(node_id(source.0.0)?)?.0
        {
            return Ok(RangeComparison::DifferentRoot);
        }
        let (left, right) = match how {
            0 => (current.0, source.0),
            1 => (current.1, source.0),
            2 => (current.1, source.1),
            _ => (current.0, source.1),
        };
        Ok(
            match self.compare_boundary_points_position(
                left.0,
                u64::from(left.1),
                right.0,
                u64::from(right.1),
            )? {
                Some(-1) => RangeComparison::Before,
                Some(1) => RangeComparison::After,
                Some(_) => RangeComparison::Equal,
                None => RangeComparison::InconsistentRoots,
            },
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_select_the_pinned_pair_for_each_comparison_method() {
        let mut tree = TreeStore::new();
        let node = tree.allocate().unwrap();
        let current = ((node, 1), (node, 5));
        let source = ((node, 3), (node, 7));
        for (how, expected) in [
            (0, RangeComparison::Before),
            (1, RangeComparison::After),
            (2, RangeComparison::Before),
            (3, RangeComparison::Before),
        ] {
            assert_eq!(tree.compare_ranges(how, current, source).unwrap(), expected);
        }
        assert_eq!(
            tree.compare_ranges(0, current, current).unwrap(),
            RangeComparison::Equal
        );
    }
    #[test]
    fn should_validate_method_before_roots_and_preserve_selected_inconsistent_root_errors() {
        let mut tree = TreeStore::new();
        let first = tree.allocate().unwrap();
        let second = tree.allocate().unwrap();
        let current = ((first, 0), (first, 1));
        let source = ((second, 0), (second, 1));
        assert_eq!(
            tree.compare_ranges(99, current, source).unwrap(),
            RangeComparison::UnsupportedMethod
        );
        assert_eq!(
            tree.compare_ranges(0, current, source).unwrap(),
            RangeComparison::DifferentRoot
        );
        let inconsistent = ((first, 0), (second, 1));
        assert_eq!(
            tree.compare_ranges(0, current, inconsistent).unwrap(),
            RangeComparison::Equal
        );
        assert_eq!(
            tree.compare_ranges(2, current, inconsistent).unwrap(),
            RangeComparison::InconsistentRoots
        );
    }
    #[test]
    fn should_reject_each_unallocated_boundary_before_returning_a_comparison() {
        let mut tree = TreeStore::new();
        let node = tree.allocate().unwrap();
        let reserved = tree.reserve_handles().unwrap();
        for how in [0, 1, 2, 3, 99] {
            for index in 0..4 {
                let mut handles = [node; 4];
                handles[index] = reserved;
                assert!(
                    tree.compare_ranges(
                        how,
                        ((handles[0], 0), (handles[1], 1)),
                        ((handles[2], 0), (handles[3], 1))
                    )
                    .is_err()
                );
            }
        }
        assert_eq!(tree.statistics().live_nodes, 1.0);
        assert_eq!(tree.statistics().allocations, 1.0);
    }
}
