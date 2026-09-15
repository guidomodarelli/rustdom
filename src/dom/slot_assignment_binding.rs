//! V8-finalized assignment controller; no JavaScript runs while TreeStore is mutably borrowed.
use super::{
    napi_error::to_napi_error,
    slot_assignment_driver::{AssignmentAction, AssignmentDriver},
    store::TreeStore,
};
use napi::Result;
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE_DRIVERS: AtomicU64 = AtomicU64::new(0);
static CREATED_DRIVERS: AtomicU64 = AtomicU64::new(0);
static RELEASED_DRIVERS: AtomicU64 = AtomicU64::new(0);

#[napi]
pub enum SlotAssignmentAction {
    Complete,
    Signal,
    Applied,
}

#[napi(object)]
pub struct SlotAssignmentInstruction {
    pub kind: SlotAssignmentAction,
    pub slot: f64,
    pub nodes: Vec<f64>,
    pub next_node: f64,
    pub cache_changed: bool,
}

#[napi(object)]
pub struct SlotAssignmentDriverStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
}

#[napi]
pub struct NativeSlotAssignmentDriver {
    driver: AssignmentDriver,
}

impl NativeSlotAssignmentDriver {
    pub(super) fn step(&mut self, tree: &mut TreeStore) -> Result<SlotAssignmentInstruction> {
        let action = self.driver.step(tree).map_err(to_napi_error)?;
        Ok(match action {
            AssignmentAction::Complete => SlotAssignmentInstruction {
                kind: SlotAssignmentAction::Complete,
                slot: 0.0,
                nodes: Vec::new(),
                next_node: 0.0,
                cache_changed: false,
            },
            AssignmentAction::Signal { slot, nodes, next } => SlotAssignmentInstruction {
                kind: SlotAssignmentAction::Signal,
                slot: slot as f64,
                nodes,
                next_node: next as f64,
                cache_changed: false,
            },
            AssignmentAction::Applied {
                slot,
                nodes,
                next,
                cache_changed,
            } => SlotAssignmentInstruction {
                kind: SlotAssignmentAction::Applied,
                slot: slot as f64,
                nodes,
                next_node: next as f64,
                cache_changed,
            },
        })
    }
}

impl Drop for NativeSlotAssignmentDriver {
    fn drop(&mut self) {
        LIVE_DRIVERS.fetch_sub(1, Ordering::Relaxed);
        RELEASED_DRIVERS.fetch_add(1, Ordering::Relaxed);
    }
}

#[napi]
impl NativeSlotAssignmentDriver {
    /// Validate the numeric root here; the tree step validates allocation and the single-slot role.
    #[napi(constructor)]
    pub fn new(root: f64, subtree: bool) -> Result<Self> {
        let driver = AssignmentDriver::new(root, subtree).map_err(to_napi_error)?;
        LIVE_DRIVERS.fetch_add(1, Ordering::Relaxed);
        CREATED_DRIVERS.fetch_add(1, Ordering::Relaxed);
        Ok(Self { driver })
    }

    #[napi]
    pub fn cancel(&mut self) {
        self.driver.cancel();
    }

    #[napi(getter)]
    pub fn complete(&self) -> bool {
        self.driver.complete()
    }

    #[napi]
    pub fn statistics() -> SlotAssignmentDriverStatistics {
        SlotAssignmentDriverStatistics {
            live: LIVE_DRIVERS.load(Ordering::Relaxed) as f64,
            created: CREATED_DRIVERS.load(Ordering::Relaxed) as f64,
            released: RELEASED_DRIVERS.load(Ordering::Relaxed) as f64,
        }
    }
}
