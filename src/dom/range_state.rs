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
