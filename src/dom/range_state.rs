//! Canonical Range endpoints without references to a JavaScript heap or ownership of DOM nodes.
use super::{
    error::{Result, TreeError},
    store::{NodeId, node_id},
};

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct BoundaryPoint {
    pub node: NodeId,
    pub offset: f64,
}

#[derive(Clone, Default)]
pub(crate) struct RangeState {
    start: Option<BoundaryPoint>,
    end: Option<BoundaryPoint>,
}

impl RangeState {
    /// Apply a validated native decision without changing any host-owned node reference.
    pub(super) fn apply_point(&mut self, start: bool, point: BoundaryPoint) {
        if start {
            self.start = Some(point);
        } else {
            self.end = Some(point);
        }
    }
    pub fn set_start(&mut self, node: f64, offset: f64) -> Result<()> {
        self.start = Some(BoundaryPoint {
            node: node_id(node)?,
            offset,
        });
        Ok(())
    }
    pub fn set_end(&mut self, node: f64, offset: f64) -> Result<()> {
        self.end = Some(BoundaryPoint {
            node: node_id(node)?,
            offset,
        });
        Ok(())
    }
    pub fn start(&self) -> Option<BoundaryPoint> {
        self.start
    }
    pub fn end(&self) -> Option<BoundaryPoint> {
        self.end
    }
    pub fn points(&self) -> Result<(BoundaryPoint, BoundaryPoint)> {
        Ok((
            self.start.ok_or(TreeError::UninitializedRange)?,
            self.end.ok_or(TreeError::UninitializedRange)?,
        ))
    }
    pub fn collapsed(&self) -> Result<bool> {
        let (start, end) = self.points()?;
        Ok(start.node == end.node && start.offset == end.offset)
    }
    /// Collapse both numeric endpoints in one native operation.
    /// Returns the host edge selected by the existing plan, preserving errors atomically.
    pub fn collapse(&mut self, to_start: bool) -> Result<bool> {
        let (point, update_start) = self.collapse_plan(to_start)?;
        self.apply_point(update_start, point);
        Ok(update_start)
    }

    /// Select the retained point and which host ownership edge must be moved.
    pub fn collapse_plan(&self, to_start: bool) -> Result<(BoundaryPoint, bool)> {
        let (start, end) = self.points()?;
        Ok(if to_start {
            (start, false)
        } else {
            (end, true)
        })
    }
}

/// Preserve the existing Node-API u32 argument conversion for internal query snapshots.
pub(super) fn query_offset(offset: f64) -> u32 {
    const UINT32_MODULUS: f64 = 4_294_967_296.0;
    if offset.is_finite() {
        offset.trunc().rem_euclid(UINT32_MODULUS) as u32
    } else {
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_clone_independently_and_plan_collapse_without_changing_either_state() {
        let mut original = RangeState::default();
        original.set_start(1.0, -0.0).unwrap();
        original.set_end(2.0, 9.0).unwrap();
        let mut clone = original.clone();
        assert_eq!(
            clone.collapse_plan(true).unwrap(),
            (original.start().unwrap(), false)
        );
        assert_eq!(
            clone.collapse_plan(false).unwrap(),
            (original.end().unwrap(), true)
        );
        clone.set_start(2.0, 3.0).unwrap();
        assert_eq!(original.start().unwrap().node, 1);
        assert_eq!(
            original.start().unwrap().offset.to_bits(),
            (-0.0f64).to_bits()
        );
        assert_eq!(clone.start().unwrap().offset, 3.0);
        assert!(RangeState::default().collapse_plan(true).is_err());
    }
    #[test]
    fn should_collapse_both_directions_without_changing_an_independent_copy() {
        let mut original = RangeState::default();
        original.set_start(1.0, -0.0).unwrap();
        original.set_end(2.0, 7.5).unwrap();
        for to_start in [true, false] {
            let mut copy = original.clone();
            let retained = if to_start {
                original.start().unwrap()
            } else {
                original.end().unwrap()
            };
            assert_eq!(copy.collapse(to_start).unwrap(), !to_start);
            let (start, end) = copy.points().unwrap();
            assert_eq!(start.node, retained.node);
            assert_eq!(end.node, retained.node);
            assert_eq!(start.offset.to_bits(), retained.offset.to_bits());
            assert_eq!(end.offset.to_bits(), retained.offset.to_bits());
            assert!(copy.collapsed().unwrap());
        }
        assert_eq!(original.start().unwrap().node, 1);
        assert_eq!(original.end().unwrap().node, 2);
    }

    #[test]
    fn should_preserve_partial_state_when_native_collapse_rejects_it() {
        for (has_start, has_end) in [(false, false), (true, false), (false, true)] {
            let mut state = RangeState::default();
            if has_start {
                state.set_start(1.0, 2.0).unwrap();
            }
            if has_end {
                state.set_end(2.0, 3.0).unwrap();
            }
            let before = (state.start(), state.end());
            for to_start in [true, false] {
                assert!(matches!(
                    state.collapse(to_start),
                    Err(TreeError::UninitializedRange)
                ));
                assert_eq!((state.start(), state.end()), before);
            }
        }
    }

    #[test]
    fn should_preserve_independent_endpoint_snapshots_and_collapsed_state() {
        let mut state = RangeState::default();
        assert!(state.points().is_err());
        state.set_start(1.0, 3.0).unwrap();
        assert!(state.collapsed().is_err());
        let snapshot = state.start().unwrap();
        state.set_end(1.0, 3.0).unwrap();
        assert!(state.collapsed().unwrap());
        state.set_start(2.0, 7.0).unwrap();
        assert!(!state.collapsed().unwrap());
        assert_eq!(
            snapshot,
            BoundaryPoint {
                node: 1,
                offset: 3.0
            }
        );
        assert_eq!(state.end().unwrap(), snapshot);
    }
    #[test]
    fn should_reject_invalid_handles_without_replacing_either_boundary() {
        let mut state = RangeState::default();
        state.set_start(1.0, 0.0).unwrap();
        state.set_end(2.0, 4.0).unwrap();
        let before = state.points().unwrap();
        for handle in [
            0.0,
            -1.0,
            1.5,
            f64::NAN,
            f64::INFINITY,
            9_007_199_254_740_992.0,
        ] {
            assert!(state.set_start(handle, 5.0).is_err());
            assert!(state.set_end(handle, 5.0).is_err());
            assert_eq!(state.points().unwrap(), before);
        }
    }
    #[test]
    fn should_preserve_internal_number_values_and_the_existing_query_conversion() {
        let mut state = RangeState::default();
        for offset in [-0.0, -1.5, 4_294_967_297.0, f64::INFINITY, f64::NAN] {
            state.set_start(1.0, offset).unwrap();
            state.set_end(1.0, offset).unwrap();
            assert_eq!(state.start().unwrap().offset.to_bits(), offset.to_bits());
            assert_eq!(state.collapsed().unwrap(), !offset.is_nan());
        }
        for (input, expected) in [
            (f64::NAN, 0),
            (f64::INFINITY, 0),
            (-1.5, u32::MAX),
            (-0.0, 0),
            (4_294_967_297.0, 1),
            (3.9, 3),
        ] {
            assert_eq!(query_offset(input), expected);
        }
    }
}
