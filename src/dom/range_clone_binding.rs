//! V8-finalized clone controller. Instructions contain scalars; the host pins nodes for the synchronous operation.
use super::{
    error::TreeError,
    napi_error::to_range_operation_error,
    range_contents::{ContentAction, ContentMachine},
    range_state_binding::{NativeRange, NativeRangeStatistics},
    store::TreeStore,
};
use napi::Result;
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE_CLONES: AtomicU64 = AtomicU64::new(0);
static CREATED_CLONES: AtomicU64 = AtomicU64::new(0);
static RELEASED_CLONES: AtomicU64 = AtomicU64::new(0);

#[napi]
pub enum RangeCloneAction {
    CreateFragment,
    CloneNode,
    SliceData,
    AppendChild,
    PinNodes,
    Complete,
    InvalidDoctype,
    InconsistentRoots,
}

#[napi(object)]
pub struct RangeCloneInstruction {
    pub kind: RangeCloneAction,
    pub node: f64,
    pub parent: f64,
    pub offset: f64,
    pub count: f64,
    pub deep: bool,
    pub nodes: Option<Vec<f64>>,
}
impl TryFrom<ContentAction> for RangeCloneInstruction {
    type Error = TreeError;
    fn try_from(action: ContentAction) -> super::error::Result<Self> {
        let mut instruction = Self {
            kind: RangeCloneAction::Complete,
            node: 0.0,
            parent: 0.0,
            offset: 0.0,
            count: 0.0,
            deep: false,
            nodes: None,
        };
        match action {
            ContentAction::CreateFragment(node) => {
                instruction.kind = RangeCloneAction::CreateFragment;
                instruction.node = node as f64;
            }
            ContentAction::CloneNode { node, deep } => {
                instruction.kind = RangeCloneAction::CloneNode;
                instruction.node = node as f64;
                instruction.deep = deep;
            }
            ContentAction::SliceData {
                node,
                offset,
                count,
            } => {
                instruction.kind = RangeCloneAction::SliceData;
                instruction.node = node as f64;
                instruction.offset = offset;
                instruction.count = count;
            }
            ContentAction::AppendChild { parent, node } => {
                instruction.kind = RangeCloneAction::AppendChild;
                instruction.parent = parent as f64;
                instruction.node = node as f64;
            }
            ContentAction::PinNodes(nodes) => {
                instruction.kind = RangeCloneAction::PinNodes;
                instruction.nodes = Some(nodes.into_iter().map(|node| node as f64).collect());
            }
            ContentAction::Complete(node) => instruction.node = node as f64,
            ContentAction::InvalidDoctype => instruction.kind = RangeCloneAction::InvalidDoctype,
            ContentAction::InconsistentRoots => {
                instruction.kind = RangeCloneAction::InconsistentRoots
            }
            ContentAction::ReplaceData { .. } | ContentAction::Extracted { .. } => {
                return Err(TreeError::RangeContentProtocol(
                    "extraction effect reached a clone controller",
                ));
            }
        }
        Ok(instruction)
    }
}

#[napi]
pub struct NativeRangeClone {
    machine: ContentMachine,
}
impl NativeRangeClone {
    pub(super) fn step(
        &mut self,
        tree: &mut TreeStore,
        created: f64,
    ) -> Result<RangeCloneInstruction> {
        self.machine
            .step(tree, created)
            .and_then(RangeCloneInstruction::try_from)
            .map_err(|error| to_range_operation_error(error, "NativeRangeClone"))
    }
}
impl Drop for NativeRangeClone {
    fn drop(&mut self) {
        LIVE_CLONES.fetch_sub(1, Ordering::Relaxed);
        RELEASED_CLONES.fetch_add(1, Ordering::Relaxed);
    }
}
#[napi]
impl NativeRangeClone {
    #[napi(constructor)]
    pub fn new(state: &NativeRange) -> Result<Self> {
        let (start, end) = state.raw_points()?;
        LIVE_CLONES.fetch_add(1, Ordering::Relaxed);
        CREATED_CLONES.fetch_add(1, Ordering::Relaxed);
        Ok(Self {
            machine: ContentMachine::new(start, end),
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
            live: LIVE_CLONES.load(Ordering::Relaxed) as f64,
            created: CREATED_CLONES.load(Ordering::Relaxed) as f64,
            released: RELEASED_CLONES.load(Ordering::Relaxed) as f64,
        }
    }
}
