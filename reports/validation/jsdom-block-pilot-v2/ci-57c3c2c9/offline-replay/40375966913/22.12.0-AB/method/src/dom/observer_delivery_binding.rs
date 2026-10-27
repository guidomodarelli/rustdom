//! V8-finalized delivery controller whose retained state is numeric plus a weak forest identity.
use super::{
    napi_error::to_napi_error,
    observer_delivery::{DeliveryAction, DeliveryDriver},
    store::TreeStore,
};
use napi::Result;
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE_DELIVERIES: AtomicU64 = AtomicU64::new(0);
static CREATED_DELIVERIES: AtomicU64 = AtomicU64::new(0);
static RELEASED_DELIVERIES: AtomicU64 = AtomicU64::new(0);

#[napi]
pub enum ObserverDeliveryAction {
    Complete = 0,
    Observer = 1,
    Slot = 2,
}

#[napi(object)]
pub struct ObserverDeliveryInstruction {
    pub kind: ObserverDeliveryAction,
    pub observer: f64,
    pub slot: f64,
    pub records: Vec<f64>,
    pub complete: bool,
}

#[napi(object)]
pub struct ObserverDeliveryStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
}

#[napi]
pub struct NativeObserverDelivery {
    driver: DeliveryDriver,
}

impl NativeObserverDelivery {
    pub(super) fn from_driver(driver: DeliveryDriver) -> Self {
        LIVE_DELIVERIES.fetch_add(1, Ordering::Relaxed);
        CREATED_DELIVERIES.fetch_add(1, Ordering::Relaxed);
        Self { driver }
    }
    pub(super) fn step(&mut self, tree: &mut TreeStore) -> Result<ObserverDeliveryInstruction> {
        let action = self.driver.step(tree).map_err(to_napi_error)?;
        let mut instruction = ObserverDeliveryInstruction {
            kind: ObserverDeliveryAction::Complete,
            observer: 0.0,
            slot: 0.0,
            records: vec![],
            complete: self.driver.complete(),
        };
        match action {
            DeliveryAction::Observer { observer, records } => {
                instruction.kind = ObserverDeliveryAction::Observer;
                instruction.observer = observer;
                instruction.records = records;
            }
            DeliveryAction::Slot(slot) => {
                instruction.kind = ObserverDeliveryAction::Slot;
                instruction.slot = slot;
            }
            DeliveryAction::Complete => {}
        }
        Ok(instruction)
    }
}

impl Drop for NativeObserverDelivery {
    fn drop(&mut self) {
        LIVE_DELIVERIES.fetch_sub(1, Ordering::Relaxed);
        RELEASED_DELIVERIES.fetch_add(1, Ordering::Relaxed);
    }
}

#[napi]
impl NativeObserverDelivery {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self::from_driver(DeliveryDriver::default())
    }
    #[napi]
    pub fn cancel(&mut self) {
        self.driver.cancel();
    }
    #[napi(getter)]
    pub fn complete(&self) -> bool {
        self.driver.complete()
    }
    #[napi(getter)]
    pub fn remaining_observers(&self) -> f64 {
        self.driver.remaining_observers() as f64
    }
    #[napi(getter)]
    pub fn remaining_slots(&self) -> f64 {
        self.driver.remaining_slots() as f64
    }
    #[napi]
    pub fn statistics() -> ObserverDeliveryStatistics {
        ObserverDeliveryStatistics {
            live: LIVE_DELIVERIES.load(Ordering::Relaxed) as f64,
            created: CREATED_DELIVERIES.load(Ordering::Relaxed) as f64,
            released: RELEASED_DELIVERIES.load(Ordering::Relaxed) as f64,
        }
    }
}
