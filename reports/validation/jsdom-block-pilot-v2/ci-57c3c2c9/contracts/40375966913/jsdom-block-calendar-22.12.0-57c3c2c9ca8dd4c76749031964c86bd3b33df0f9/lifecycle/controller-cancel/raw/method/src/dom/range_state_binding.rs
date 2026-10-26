//! V8 owns each NativeRange box; Rust stores only numeric endpoints and drops them with the wrapper.
use super::{
    error::TreeError,
    napi_error::to_napi_error,
    range_mutations::{END_MOVED, RangeUpdate, START_MOVED, TreeMutation},
    range_state::{BoundaryPoint, RangeState, query_offset},
    store::node_id,
};
use napi::Result;
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

/// Diagnostics contain counts, never instance registries or strong references.
static LIVE_RANGES: AtomicU64 = AtomicU64::new(0);
static CREATED_RANGES: AtomicU64 = AtomicU64::new(0);
static RELEASED_RANGES: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct NativeRangeStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
}

/// Counts are process-wide for this loaded addon, including its worker environments.
fn native_range_statistics() -> NativeRangeStatistics {
    NativeRangeStatistics {
        live: LIVE_RANGES.load(Ordering::Relaxed) as f64,
        created: CREATED_RANGES.load(Ordering::Relaxed) as f64,
        released: RELEASED_RANGES.load(Ordering::Relaxed) as f64,
    }
}

#[napi(object)]
pub struct NativeBoundaryPoint {
    pub node: f64,
    pub offset: f64,
}

#[napi(object)]
pub struct NativeRangeUpdate {
    pub start: bool,
    pub node: f64,
    pub offset: f64,
}

/// Finite tree-mutation phases; the host keeps their original ordering and live-range enumeration.
#[napi]
pub enum RangeMutationKind {
    SplitText,
    SplitParent,
    Insert,
    RemoveDescendant,
    RemoveParent,
    NormalizeText,
    NormalizeParent,
}
/// Bit flags identify the only changes that require moving a V8-owned node reference.
#[napi]
pub enum RangeEndpoint {
    Start = 1,
    End = 2,
}
// NAPI requires literal enum discriminants; keep them checked against the core's bit contract.
const _: () =
    assert!(RangeEndpoint::Start as u32 == START_MOVED && RangeEndpoint::End as u32 == END_MOVED);
impl From<RangeUpdate> for NativeRangeUpdate {
    fn from(update: RangeUpdate) -> Self {
        Self {
            start: update.start,
            node: update.point.node as f64,
            offset: update.point.offset,
        }
    }
}

fn updates_result(
    updates: super::error::Result<Vec<RangeUpdate>>,
) -> Result<Vec<NativeRangeUpdate>> {
    updates
        .map(|updates| updates.into_iter().map(Into::into).collect())
        .map_err(to_napi_error)
}

#[napi(object)]
pub struct NativeCollapsePlan {
    pub node: f64,
    pub offset: f64,
    pub update_start: bool,
}
impl From<BoundaryPoint> for NativeBoundaryPoint {
    fn from(point: BoundaryPoint) -> Self {
        Self {
            node: point.node as f64,
            offset: point.offset,
        }
    }
}

#[napi]
pub struct NativeRange {
    state: RangeState,
}

impl Default for NativeRange {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for NativeRange {
    fn drop(&mut self) {
        LIVE_RANGES.fetch_sub(1, Ordering::Relaxed);
        RELEASED_RANGES.fetch_add(1, Ordering::Relaxed);
    }
}

impl NativeRange {
    fn with_state(state: RangeState) -> Self {
        CREATED_RANGES.fetch_add(1, Ordering::Relaxed);
        LIVE_RANGES.fetch_add(1, Ordering::Relaxed);
        Self { state }
    }
    pub(super) fn inputs(&self) -> Result<((f64, u32), (f64, u32))> {
        let (start, end) = self.state.points().map_err(to_napi_error)?;
        Ok((
            (start.node as f64, query_offset(start.offset)),
            (end.node as f64, query_offset(end.offset)),
        ))
    }
    pub(super) fn raw_points(&self) -> Result<(BoundaryPoint, BoundaryPoint)> {
        self.state.points().map_err(to_napi_error)
    }
}

#[napi]
impl NativeRange {
    #[napi]
    pub fn statistics() -> NativeRangeStatistics {
        native_range_statistics()
    }
    #[napi(constructor)]
    pub fn new() -> Self {
        Self::with_state(RangeState::default())
    }
    #[napi]
    pub fn copy(&self) -> Self {
        Self::with_state(self.state.clone())
    }
    #[napi]
    pub fn collapse_plan(&self, to_start: bool) -> Result<NativeCollapsePlan> {
        let (point, update_start) = self.state.collapse_plan(to_start).map_err(to_napi_error)?;
        Ok(NativeCollapsePlan {
            node: point.node as f64,
            offset: point.offset,
            update_start,
        })
    }
    #[napi]
    pub fn apply_character_data(
        &mut self,
        node: f64,
        offset: f64,
        count: f64,
        inserted_length: f64,
    ) -> Result<()> {
        let updates = self
            .state
            .character_data_plan(
                node_id(node).map_err(to_napi_error)?,
                offset,
                count,
                inserted_length,
            )
            .map_err(to_napi_error)?;
        self.state
            .apply_mutation_updates(updates)
            .map_err(to_napi_error)?;
        Ok(())
    }
    #[napi]
    pub fn apply_tree_mutation(
        &mut self,
        kind: RangeMutationKind,
        source: f64,
        target: f64,
        index: f64,
        count: f64,
    ) -> Result<u32> {
        let source = node_id(source).map_err(to_napi_error)?;
        let target = node_id(target).map_err(to_napi_error)?;
        let mutation = match kind {
            RangeMutationKind::SplitText => TreeMutation::SplitText {
                source,
                target,
                offset: index,
            },
            RangeMutationKind::SplitParent => TreeMutation::SplitParent {
                parent: source,
                index,
            },
            RangeMutationKind::Insert => TreeMutation::Insert {
                parent: source,
                index,
                count,
            },
            RangeMutationKind::RemoveDescendant => TreeMutation::RemoveDescendant {
                source,
                parent: target,
                index,
            },
            RangeMutationKind::RemoveParent => TreeMutation::RemoveParent {
                parent: source,
                index,
            },
            RangeMutationKind::NormalizeText => TreeMutation::NormalizeText {
                source,
                target,
                length: count,
            },
            RangeMutationKind::NormalizeParent => TreeMutation::NormalizeParent {
                parent: source,
                target,
                index,
                length: count,
            },
        };
        let updates = self
            .state
            .tree_mutation_plan(mutation)
            .map_err(to_napi_error)?;
        self.state
            .apply_mutation_updates(updates)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn character_data_plan(
        &self,
        node: f64,
        offset: f64,
        count: f64,
        inserted_length: f64,
    ) -> Result<Vec<NativeRangeUpdate>> {
        updates_result(self.state.character_data_plan(
            node_id(node).map_err(to_napi_error)?,
            offset,
            count,
            inserted_length,
        ))
    }
    #[napi]
    pub fn split_text_plan(
        &self,
        source: f64,
        target: f64,
        offset: f64,
    ) -> Result<Vec<NativeRangeUpdate>> {
        updates_result(self.state.tree_mutation_plan(TreeMutation::SplitText {
            source: node_id(source).map_err(to_napi_error)?,
            target: node_id(target).map_err(to_napi_error)?,
            offset,
        }))
    }
    #[napi]
    pub fn split_parent_plan(&self, parent: f64, index: f64) -> Result<Vec<NativeRangeUpdate>> {
        updates_result(self.state.tree_mutation_plan(TreeMutation::SplitParent {
            parent: node_id(parent).map_err(to_napi_error)?,
            index,
        }))
    }
    #[napi]
    pub fn insert_plan(
        &self,
        parent: f64,
        index: f64,
        count: f64,
    ) -> Result<Vec<NativeRangeUpdate>> {
        updates_result(self.state.tree_mutation_plan(TreeMutation::Insert {
            parent: node_id(parent).map_err(to_napi_error)?,
            index,
            count,
        }))
    }
    #[napi]
    pub fn remove_descendant_plan(
        &self,
        source: f64,
        parent: f64,
        index: f64,
    ) -> Result<Vec<NativeRangeUpdate>> {
        updates_result(
            self.state
                .tree_mutation_plan(TreeMutation::RemoveDescendant {
                    source: node_id(source).map_err(to_napi_error)?,
                    parent: node_id(parent).map_err(to_napi_error)?,
                    index,
                }),
        )
    }
    #[napi]
    pub fn remove_parent_plan(&self, parent: f64, index: f64) -> Result<Vec<NativeRangeUpdate>> {
        updates_result(self.state.tree_mutation_plan(TreeMutation::RemoveParent {
            parent: node_id(parent).map_err(to_napi_error)?,
            index,
        }))
    }
    #[napi]
    pub fn normalize_text_plan(
        &self,
        source: f64,
        target: f64,
        length: f64,
    ) -> Result<Vec<NativeRangeUpdate>> {
        updates_result(self.state.tree_mutation_plan(TreeMutation::NormalizeText {
            source: node_id(source).map_err(to_napi_error)?,
            target: node_id(target).map_err(to_napi_error)?,
            length,
        }))
    }
    #[napi]
    pub fn normalize_parent_plan(
        &self,
        parent: f64,
        target: f64,
        index: f64,
        length: f64,
    ) -> Result<Vec<NativeRangeUpdate>> {
        updates_result(
            self.state
                .tree_mutation_plan(TreeMutation::NormalizeParent {
                    parent: node_id(parent).map_err(to_napi_error)?,
                    target: node_id(target).map_err(to_napi_error)?,
                    index,
                    length,
                }),
        )
    }
    #[napi]
    pub fn set_start(&mut self, node: f64, offset: f64) -> Result<()> {
        self.state.set_start(node, offset).map_err(to_napi_error)
    }
    #[napi]
    pub fn set_end(&mut self, node: f64, offset: f64) -> Result<()> {
        self.state.set_end(node, offset).map_err(to_napi_error)
    }
    #[napi(getter)]
    pub fn start(&self) -> Option<NativeBoundaryPoint> {
        self.state.start().map(Into::into)
    }
    #[napi(getter)]
    pub fn end(&self) -> Option<NativeBoundaryPoint> {
        self.state.end().map(Into::into)
    }
    #[napi(getter)]
    pub fn start_offset(&self) -> Result<f64> {
        self.state
            .start()
            .map(|point| point.offset)
            .ok_or(TreeError::UninitializedRange)
            .map_err(to_napi_error)
    }
    #[napi(getter)]
    pub fn end_offset(&self) -> Result<f64> {
        self.state
            .end()
            .map(|point| point.offset)
            .ok_or(TreeError::UninitializedRange)
            .map_err(to_napi_error)
    }
    #[napi(getter)]
    pub fn collapsed(&self) -> Result<bool> {
        self.state.collapsed().map_err(to_napi_error)
    }
}
