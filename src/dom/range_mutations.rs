//! Ordered live Range adjustments from endpoint snapshots; host ownership changes follow the plan.
use super::{
    error::Result,
    range_state::{BoundaryPoint, RangeState},
    store::NodeId,
};

#[derive(Debug, PartialEq)]
pub(crate) struct RangeUpdate {
    pub start: bool,
    pub point: BoundaryPoint,
}

pub(super) const START_MOVED: u32 = 1;
pub(super) const END_MOVED: u32 = 2;

pub(crate) enum TreeMutation {
    SplitText {
        source: NodeId,
        target: NodeId,
        offset: f64,
    },
    SplitParent {
        parent: NodeId,
        index: f64,
    },
    Insert {
        parent: NodeId,
        index: f64,
        count: f64,
    },
    RemoveDescendant {
        source: NodeId,
        parent: NodeId,
        index: f64,
    },
    RemoveParent {
        parent: NodeId,
        index: f64,
    },
    NormalizeText {
        source: NodeId,
        target: NodeId,
        length: f64,
    },
    NormalizeParent {
        parent: NodeId,
        target: NodeId,
        index: f64,
        length: f64,
    },
}

impl RangeState {
    /// Numeric updates are complete before the host applies the returned ownership-move bits.
    pub fn apply_mutation_updates(&mut self, updates: Vec<RangeUpdate>) -> Result<u32> {
        let (start, end) = self.points()?;
        let mut moved = 0;
        for update in updates {
            let original = if update.start { start } else { end };
            if original.node != update.point.node {
                moved |= if update.start { START_MOVED } else { END_MOVED };
            }
            self.apply_point(update.start, update.point);
        }
        Ok(moved)
    }
    /// Retain the original start/end snapshot ordering, including end-before-start when needed.
    pub fn character_data_plan(
        &self,
        node: NodeId,
        offset: f64,
        count: f64,
        inserted_length: f64,
    ) -> Result<Vec<RangeUpdate>> {
        let (start, end) = self.points()?;
        let endpoints = [(true, start), (false, end)];
        let mut updates = Vec::new();
        for (start, point) in endpoints {
            if point.node == node && point.offset > offset && point.offset <= offset + count {
                updates.push(RangeUpdate {
                    start,
                    point: BoundaryPoint { node, offset },
                });
            }
        }
        for (start, point) in endpoints {
            if point.node == node && point.offset > offset + count {
                updates.push(RangeUpdate {
                    start,
                    point: BoundaryPoint {
                        node,
                        offset: point.offset + inserted_length - count,
                    },
                });
            }
        }
        Ok(updates)
    }

    pub fn tree_mutation_plan(&self, mutation: TreeMutation) -> Result<Vec<RangeUpdate>> {
        let (start, end) = self.points()?;
        let mut updates = Vec::new();
        for (start, point) in [(true, start), (false, end)] {
            let replacement = match mutation {
                TreeMutation::SplitText {
                    source,
                    target,
                    offset,
                } => (point.node == source && point.offset > offset)
                    .then_some((target, point.offset - offset)),
                TreeMutation::SplitParent { parent, index } => (point.node == parent
                    && point.offset == index + 1.0)
                    .then_some((parent, point.offset + 1.0)),
                // Pinned jsdom adjusts both offsets from the parent's live-range set, even when one endpoint is elsewhere.
                TreeMutation::Insert {
                    parent,
                    index,
                    count,
                } => (point.offset > index).then_some((parent, point.offset + count)),
                TreeMutation::RemoveDescendant {
                    source,
                    parent,
                    index,
                } => (point.node == source).then_some((parent, index)),
                TreeMutation::RemoveParent { parent, index } => (point.node == parent
                    && point.offset > index)
                    .then_some((parent, point.offset - 1.0)),
                TreeMutation::NormalizeText {
                    source,
                    target,
                    length,
                } => (point.node == source).then_some((target, point.offset + length)),
                TreeMutation::NormalizeParent {
                    parent,
                    target,
                    index,
                    length,
                } => (point.node == parent && point.offset == index).then_some((target, length)),
            };
            if let Some((node, offset)) = replacement {
                updates.push(RangeUpdate {
                    start,
                    point: BoundaryPoint { node, offset },
                });
            }
        }
        Ok(updates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn range_state(start: (f64, f64), end: (f64, f64)) -> RangeState {
        let mut state = RangeState::default();
        state.set_start(start.0, start.1).unwrap();
        state.set_end(end.0, end.1).unwrap();
        state
    }
    fn update(start: bool, node: NodeId, offset: f64) -> RangeUpdate {
        RangeUpdate {
            start,
            point: BoundaryPoint { node, offset },
        }
    }
    #[test]
    fn should_preserve_character_data_snapshot_update_order_and_leave_other_nodes_unchanged() {
        let state = range_state((1.0, 8.0), (1.0, 3.0));
        assert_eq!(
            state.character_data_plan(1, 2.0, 3.0, 1.0).unwrap(),
            vec![update(false, 1, 2.0), update(true, 1, 6.0)]
        );
        assert_eq!(state.points().unwrap().0.offset, 8.0);
        assert!(
            state
                .character_data_plan(2, 0.0, 20.0, 1.0)
                .unwrap()
                .is_empty()
        );
        let bounds = range_state((1.0, 2.0), (1.0, 5.0));
        assert_eq!(
            bounds.character_data_plan(1, 2.0, 3.0, 1.0).unwrap(),
            vec![update(false, 1, 2.0)]
        );
        assert_eq!(
            bounds.character_data_plan(1, 2.0, 0.0, 4.0).unwrap(),
            vec![update(false, 1, 9.0)]
        );
    }
    #[test]
    fn should_plan_split_and_normalization_moves_without_changing_native_state() {
        let state = range_state((1.0, 3.0), (2.0, 2.0));
        assert_eq!(
            state
                .tree_mutation_plan(TreeMutation::SplitText {
                    source: 1,
                    target: 3,
                    offset: 1.0
                })
                .unwrap(),
            vec![update(true, 3, 2.0)]
        );
        assert_eq!(
            state
                .tree_mutation_plan(TreeMutation::SplitParent {
                    parent: 2,
                    index: 1.0
                })
                .unwrap(),
            vec![update(false, 2, 3.0)]
        );
        assert_eq!(
            state
                .tree_mutation_plan(TreeMutation::NormalizeText {
                    source: 1,
                    target: 3,
                    length: 4.0
                })
                .unwrap(),
            vec![update(true, 3, 7.0)]
        );
        assert_eq!(
            state
                .tree_mutation_plan(TreeMutation::NormalizeParent {
                    parent: 2,
                    target: 3,
                    index: 2.0,
                    length: 4.0
                })
                .unwrap(),
            vec![update(false, 3, 4.0)]
        );
        assert_eq!(
            state.start().unwrap(),
            BoundaryPoint {
                node: 1,
                offset: 3.0
            }
        );
    }
    #[test]
    fn should_preserve_insert_cross_node_offset_behavior_and_remove_in_separate_stages() {
        let state = range_state((1.0, 1.0), (2.0, 5.0));
        assert_eq!(
            state
                .tree_mutation_plan(TreeMutation::Insert {
                    parent: 1,
                    index: 2.0,
                    count: 3.0
                })
                .unwrap(),
            vec![update(false, 1, 8.0)]
        );
        assert_eq!(
            state
                .tree_mutation_plan(TreeMutation::RemoveDescendant {
                    source: 2,
                    parent: 1,
                    index: 3.0
                })
                .unwrap(),
            vec![update(false, 1, 3.0)]
        );
        assert!(
            state
                .tree_mutation_plan(TreeMutation::RemoveParent {
                    parent: 1,
                    index: 2.0
                })
                .unwrap()
                .is_empty()
        );
        assert_eq!(
            state
                .tree_mutation_plan(TreeMutation::RemoveParent {
                    parent: 2,
                    index: 2.0
                })
                .unwrap(),
            vec![update(false, 2, 4.0)]
        );
    }
    #[test]
    fn should_apply_numeric_updates_and_report_only_changed_owner_identities() {
        let mut state = range_state((1.0, 2.0), (1.0, 7.0));
        let snapshot = state.end().unwrap();
        let updates = state.character_data_plan(1, 3.0, 0.0, 2.0).unwrap();
        assert_eq!(state.apply_mutation_updates(updates).unwrap(), 0);
        assert_eq!(state.end().unwrap().offset, 9.0);
        let updates = state
            .tree_mutation_plan(TreeMutation::SplitText {
                source: 1,
                target: 2,
                offset: 3.0,
            })
            .unwrap();
        assert_eq!(state.apply_mutation_updates(updates).unwrap(), END_MOVED);
        assert_eq!(
            state.end().unwrap(),
            BoundaryPoint {
                node: 2,
                offset: 6.0
            }
        );
        assert_eq!(snapshot.offset, 7.0);
        let updates = state
            .tree_mutation_plan(TreeMutation::Insert {
                parent: 3,
                index: 0.0,
                count: 1.0,
            })
            .unwrap();
        assert_eq!(
            state.apply_mutation_updates(updates).unwrap(),
            START_MOVED | END_MOVED
        );
        assert_eq!(state.start().unwrap().node, 3);
        assert_eq!(state.end().unwrap().node, 3);
    }
    #[test]
    fn should_keep_javascript_number_comparisons_and_reject_uninitialized_endpoints() {
        let state = range_state((1.0, f64::NAN), (1.0, f64::INFINITY));
        assert_eq!(
            state.character_data_plan(1, 0.0, 1.0, 0.0).unwrap(),
            vec![update(false, 1, f64::INFINITY)]
        );
        assert!(
            RangeState::default()
                .character_data_plan(1, 0.0, 1.0, 0.0)
                .is_err()
        );
        assert!(
            RangeState::default()
                .tree_mutation_plan(TreeMutation::SplitParent {
                    parent: 1,
                    index: 0.0
                })
                .is_err()
        );
    }
}
