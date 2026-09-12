//! V8-finalized extraction controller using the shared native content stack.
use super::{
    error::TreeError,
    napi_error::to_range_operation_error,
    range_clone_binding::{RangeCloneAction, RangeCloneInstruction},
    range_contents::{ContentAction, ContentMachine},
    range_state_binding::{NativeRange, NativeRangeStatistics},
    store::TreeStore,
};
use napi::Result;
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE_EXTRACTS: AtomicU64 = AtomicU64::new(0);
static CREATED_EXTRACTS: AtomicU64 = AtomicU64::new(0);
static RELEASED_EXTRACTS: AtomicU64 = AtomicU64::new(0);

#[napi]
pub enum RangeExtractAction {
    CreateFragment,
    CloneNode,
    SliceData,
    AppendChild,
    PinNodes,
    Complete,
    InvalidDoctype,
    InconsistentRoots,
    ReplaceData,
}
// Shared effects reuse the clone wire representation; keep its discriminants checked at compile time.
const _: () = assert!(
    RangeExtractAction::CreateFragment as u32 == RangeCloneAction::CreateFragment as u32
        && RangeExtractAction::CloneNode as u32 == RangeCloneAction::CloneNode as u32
        && RangeExtractAction::SliceData as u32 == RangeCloneAction::SliceData as u32
        && RangeExtractAction::AppendChild as u32 == RangeCloneAction::AppendChild as u32
        && RangeExtractAction::PinNodes as u32 == RangeCloneAction::PinNodes as u32
        && RangeExtractAction::Complete as u32 == RangeCloneAction::Complete as u32
        && RangeExtractAction::InvalidDoctype as u32 == RangeCloneAction::InvalidDoctype as u32
        && RangeExtractAction::InconsistentRoots as u32
            == RangeCloneAction::InconsistentRoots as u32
);

#[napi(object)]
pub struct RangeExtractInstruction {
    pub kind: u32,
    pub node: f64,
    pub parent: f64,
    pub offset: f64,
    pub count: f64,
    pub deep: bool,
    pub nodes: Option<Vec<f64>>,
}
impl TryFrom<ContentAction> for RangeExtractInstruction {
    type Error = TreeError;
    fn try_from(action: ContentAction) -> super::error::Result<Self> {
        match action {
            ContentAction::ReplaceData {
                node,
                offset,
                count,
            } => Ok(Self {
                kind: RangeExtractAction::ReplaceData as u32,
                node: node as f64,
                parent: 0.0,
                offset,
                count,
                deep: false,
                nodes: None,
            }),
            ContentAction::Extracted { fragment, collapse } => Ok(Self {
                kind: RangeExtractAction::Complete as u32,
                node: fragment as f64,
                parent: collapse.map_or(0.0, |point| point.node as f64),
                offset: collapse.map_or(0.0, |point| point.offset),
                count: 0.0,
                deep: false,
                nodes: None,
            }),
            other => {
                let instruction = RangeCloneInstruction::try_from(other)?;
                Ok(Self {
                    kind: instruction.kind as u32,
                    node: instruction.node,
                    parent: instruction.parent,
                    offset: instruction.offset,
                    count: instruction.count,
                    deep: instruction.deep,
                    nodes: instruction.nodes,
                })
            }
        }
    }
}

#[napi]
pub struct NativeRangeExtract {
    machine: ContentMachine,
}
impl NativeRangeExtract {
    pub(super) fn step(
        &mut self,
        tree: &mut TreeStore,
        created: f64,
    ) -> Result<RangeExtractInstruction> {
        self.machine
            .step(tree, created)
            .and_then(RangeExtractInstruction::try_from)
            .map_err(|error| to_range_operation_error(error, "NativeRangeExtract"))
    }
}
impl Drop for NativeRangeExtract {
    fn drop(&mut self) {
        LIVE_EXTRACTS.fetch_sub(1, Ordering::Relaxed);
        RELEASED_EXTRACTS.fetch_add(1, Ordering::Relaxed);
    }
}
#[napi]
impl NativeRangeExtract {
    #[napi(constructor)]
    pub fn new(state: &NativeRange) -> Result<Self> {
        let (start, end) = state.raw_points()?;
        LIVE_EXTRACTS.fetch_add(1, Ordering::Relaxed);
        CREATED_EXTRACTS.fetch_add(1, Ordering::Relaxed);
        Ok(Self {
            machine: ContentMachine::for_extraction(start, end),
        })
    }
    #[napi]
    pub fn cancel(&mut self) {
        self.machine.cancel();
    }
    #[napi(getter)]
    pub fn complete(&self) -> bool {
        self.machine.complete()
    }
    #[napi]
    pub fn statistics() -> NativeRangeStatistics {
        NativeRangeStatistics {
            live: LIVE_EXTRACTS.load(Ordering::Relaxed) as f64,
            created: CREATED_EXTRACTS.load(Ordering::Relaxed) as f64,
            released: RELEASED_EXTRACTS.load(Ordering::Relaxed) as f64,
        }
    }
}
