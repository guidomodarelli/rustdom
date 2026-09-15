//! Borrowed boundary conversions; callback and signal references never enter native storage.
use super::{
    constants::JS_MAX_SAFE_INTEGER,
    event_listeners::{ListenerOptions, ListenerRegistry},
};
use napi::{Error, Result, Status, bindgen_prelude::Utf16String};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE_REGISTRIES: AtomicU64 = AtomicU64::new(0);
static CREATED_REGISTRIES: AtomicU64 = AtomicU64::new(0);
static RELEASED_REGISTRIES: AtomicU64 = AtomicU64::new(0);
static LIVE_LISTENERS: AtomicU64 = AtomicU64::new(0);
static LIVE_TYPES: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct NativeListenerStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
    pub listeners: f64,
    pub event_types: f64,
}

#[napi(object)]
pub struct NativeListenerStorageStatistics {
    pub listeners: f64,
    pub event_types: f64,
    pub callbacks: f64,
    pub records_capacity: f64,
    pub types_capacity: f64,
    pub callbacks_capacity: f64,
    pub bucket_capacity: f64,
}

#[napi(object)]
pub struct NativeListenerSnapshot {
    pub ids: Vec<f64>,
    pub selected: Vec<f64>,
}

#[napi]
pub struct NativeListenerRegistry {
    state: ListenerRegistry,
}

impl Drop for NativeListenerRegistry {
    fn drop(&mut self) {
        LIVE_REGISTRIES.fetch_sub(1, Ordering::Relaxed);
        RELEASED_REGISTRIES.fetch_add(1, Ordering::Relaxed);
        LIVE_LISTENERS.fetch_sub(self.state.len() as u64, Ordering::Relaxed);
        LIVE_TYPES.fetch_sub(self.state.type_count() as u64, Ordering::Relaxed);
    }
}

fn identity(value: f64, role: &str) -> Result<u64> {
    if !value.is_finite()
        || value.fract() != 0.0
        || value < 1.0
        || value > JS_MAX_SAFE_INTEGER as f64
    {
        return Err(Error::new(
            Status::InvalidArg,
            format!("NativeListenerRegistry: {role} must be a positive safe integer"),
        ));
    }
    Ok(value as u64)
}

impl NativeListenerRegistry {
    fn record_removal(&self, previous_listeners: usize, previous_types: usize) {
        let removed_listeners = previous_listeners - self.state.len();
        let removed_types = previous_types - self.state.type_count();
        if removed_listeners != 0 {
            LIVE_LISTENERS.fetch_sub(removed_listeners as u64, Ordering::Relaxed);
        }
        if removed_types != 0 {
            LIVE_TYPES.fetch_sub(removed_types as u64, Ordering::Relaxed);
        }
    }
}

#[napi]
impl NativeListenerRegistry {
    #[napi(constructor)]
    pub fn new() -> Self {
        LIVE_REGISTRIES.fetch_add(1, Ordering::Relaxed);
        CREATED_REGISTRIES.fetch_add(1, Ordering::Relaxed);
        Self {
            state: ListenerRegistry::default(),
        }
    }
    #[napi]
    pub fn add(
        &mut self,
        event_type: Utf16String,
        callback: f64,
        capture: bool,
        once: bool,
        passive: bool,
    ) -> Result<f64> {
        let callback = identity(callback, "callback identity")?;
        let previous_types = self.state.type_count();
        let id = self
            .state
            .add(
                &event_type,
                callback,
                ListenerOptions {
                    capture,
                    once,
                    passive,
                },
            )
            .map_err(|_| {
                Error::new(
                    Status::GenericFailure,
                    "NativeListenerRegistry: registration identifiers exhausted",
                )
            })?;
        if id != 0 {
            LIVE_LISTENERS.fetch_add(1, Ordering::Relaxed);
            LIVE_TYPES.fetch_add(
                (self.state.type_count() - previous_types) as u64,
                Ordering::Relaxed,
            );
        }
        Ok(id as f64)
    }
    #[napi]
    pub fn remove(&mut self, event_type: Utf16String, callback: f64, capture: bool) -> Result<f64> {
        let callback = identity(callback, "callback identity")?;
        let previous = (self.state.len(), self.state.type_count());
        let removed = self.state.remove(&event_type, callback, capture);
        self.record_removal(previous.0, previous.1);
        Ok(removed as f64)
    }
    #[napi]
    pub fn prepare_invocation(&mut self, id: f64, capturing: bool) -> Result<u32> {
        let id = identity(id, "registration identity")?;
        let previous = (self.state.len(), self.state.type_count());
        let action = self.state.prepare_invocation(id, capturing);
        self.record_removal(previous.0, previous.1);
        Ok(action)
    }
    #[napi]
    pub fn snapshot(&self, event_type: Utf16String) -> Vec<f64> {
        self.state
            .snapshot(&event_type)
            .into_iter()
            .map(|id| id as f64)
            .collect()
    }
    #[napi]
    pub fn snapshot_selection(
        &self,
        event_type: Utf16String,
        capturing: bool,
    ) -> NativeListenerSnapshot {
        let (ids, selected) = self.state.snapshot_selection(&event_type, capturing);
        NativeListenerSnapshot {
            ids: ids.into_iter().map(|id| id as f64).collect(),
            selected: selected.into_iter().map(|index| index as f64).collect(),
        }
    }
    #[napi]
    pub fn listener_count(&self, event_type: Utf16String) -> f64 {
        self.state.listener_count(&event_type) as f64
    }
    #[napi]
    pub fn has_callback(&self, callback: f64) -> Result<bool> {
        Ok(self
            .state
            .has_callback(identity(callback, "callback identity")?))
    }
    #[napi(getter)]
    pub fn has_event_types(&self) -> bool {
        self.state.had_event_type()
    }
    #[napi]
    pub fn storage_statistics(&self) -> NativeListenerStorageStatistics {
        let (records, types, callbacks) = self.state.capacities();
        NativeListenerStorageStatistics {
            listeners: self.state.len() as f64,
            event_types: self.state.type_count() as f64,
            callbacks: self.state.callback_count() as f64,
            records_capacity: records as f64,
            types_capacity: types as f64,
            callbacks_capacity: callbacks as f64,
            bucket_capacity: self.state.bucket_capacity() as f64,
        }
    }
    #[napi]
    pub fn statistics() -> NativeListenerStatistics {
        NativeListenerStatistics {
            live: LIVE_REGISTRIES.load(Ordering::Relaxed) as f64,
            created: CREATED_REGISTRIES.load(Ordering::Relaxed) as f64,
            released: RELEASED_REGISTRIES.load(Ordering::Relaxed) as f64,
            listeners: LIVE_LISTENERS.load(Ordering::Relaxed) as f64,
            event_types: LIVE_TYPES.load(Ordering::Relaxed) as f64,
        }
    }
}
