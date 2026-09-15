//! Shared native areas and map-owning cursors, with no JavaScript/window references.
use super::web_storage::{SetStatus, StorageArea};
use napi::bindgen_prelude::{Either, Null, Utf16String};
use napi_derive::napi;
use std::{
    cell::RefCell,
    rc::Rc,
    sync::atomic::{AtomicU64, Ordering},
};

static LIVE: AtomicU64 = AtomicU64::new(0);
static CREATED: AtomicU64 = AtomicU64::new(0);
static RELEASED: AtomicU64 = AtomicU64::new(0);
static ENTRIES: AtomicU64 = AtomicU64::new(0);
static UNITS: AtomicU64 = AtomicU64::new(0);
static CAPACITY: AtomicU64 = AtomicU64::new(0);
static CURSORS: AtomicU64 = AtomicU64::new(0);

#[napi]
pub enum StorageSetStatus {
    Unchanged,
    QuotaExceeded,
    Write,
}
#[napi(object)]
pub struct StorageSetPlan {
    pub status: StorageSetStatus,
    pub old_value: Either<Utf16String, Null>,
}
#[napi(object)]
pub struct NativeStorageStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
    pub entries: f64,
    pub units: f64,
    pub capacity: f64,
    pub cursors: f64,
}

struct TrackedArea {
    area: StorageArea,
}
impl TrackedArea {
    fn update<T>(&mut self, action: impl FnOnce(&mut StorageArea) -> T) -> T {
        ENTRIES.fetch_sub(self.area.len() as u64, Ordering::Relaxed);
        UNITS.fetch_sub(self.area.units() as u64, Ordering::Relaxed);
        CAPACITY.fetch_sub(self.area.capacity() as u64, Ordering::Relaxed);
        let result = action(&mut self.area);
        ENTRIES.fetch_add(self.area.len() as u64, Ordering::Relaxed);
        UNITS.fetch_add(self.area.units() as u64, Ordering::Relaxed);
        CAPACITY.fetch_add(self.area.capacity() as u64, Ordering::Relaxed);
        result
    }
}
impl Drop for TrackedArea {
    fn drop(&mut self) {
        LIVE.fetch_sub(1, Ordering::Relaxed);
        RELEASED.fetch_add(1, Ordering::Relaxed);
        ENTRIES.fetch_sub(self.area.len() as u64, Ordering::Relaxed);
        UNITS.fetch_sub(self.area.units() as u64, Ordering::Relaxed);
        CAPACITY.fetch_sub(self.area.capacity() as u64, Ordering::Relaxed);
    }
}

#[napi]
pub struct NativeStorageArea {
    state: Rc<RefCell<TrackedArea>>,
}
impl Default for NativeStorageArea {
    fn default() -> Self {
        Self::new()
    }
}
#[napi]
impl NativeStorageArea {
    #[napi(constructor)]
    pub fn new() -> Self {
        LIVE.fetch_add(1, Ordering::Relaxed);
        CREATED.fetch_add(1, Ordering::Relaxed);
        Self {
            state: Rc::new(RefCell::new(TrackedArea {
                area: StorageArea::default(),
            })),
        }
    }
    #[napi(getter)]
    pub fn size(&self) -> f64 {
        self.state.borrow().area.len() as f64
    }
    #[napi(getter)]
    pub fn units(&self) -> f64 {
        self.state.borrow().area.units() as f64
    }
    #[napi(getter)]
    pub fn capacity(&self) -> f64 {
        self.state.borrow().area.capacity() as f64
    }
    #[napi]
    pub fn key(&self, index: u32) -> Option<Utf16String> {
        self.state
            .borrow()
            .area
            .key(index as usize)
            .map(|value| value.to_vec().into())
    }
    #[napi]
    pub fn get(&self, key: Utf16String) -> Option<Utf16String> {
        self.state
            .borrow()
            .area
            .get(&key)
            .map(|value| value.to_vec().into())
    }
    #[napi]
    pub fn plan_set(
        &self,
        key: Utf16String,
        value: Utf16String,
        quota: Option<f64>,
    ) -> StorageSetPlan {
        let state = self.state.borrow();
        let plan = state.area.plan_set(&key, &value, quota.unwrap_or(f64::NAN));
        StorageSetPlan {
            status: match plan.status {
                SetStatus::Unchanged => StorageSetStatus::Unchanged,
                SetStatus::QuotaExceeded => StorageSetStatus::QuotaExceeded,
                SetStatus::Write => StorageSetStatus::Write,
            },
            old_value: plan
                .old_value
                .map_or(Either::B(Null), |value| Either::A(value.to_vec().into())),
        }
    }
    #[napi]
    pub fn set(&mut self, key: Utf16String, value: Utf16String) {
        self.state
            .borrow_mut()
            .update(|area| area.set(key.to_vec(), value.to_vec()));
    }
    #[napi]
    pub fn delete(&mut self, key: Utf16String) -> bool {
        self.state.borrow_mut().update(|area| area.remove(&key))
    }
    #[napi]
    pub fn clear(&mut self) {
        self.state.borrow_mut().update(StorageArea::clear);
    }
    #[napi]
    pub fn key_cursor(&self) -> NativeStorageKeyCursor {
        CURSORS.fetch_add(1, Ordering::Relaxed);
        NativeStorageKeyCursor {
            state: Some(Rc::clone(&self.state)),
            sequence: 0,
        }
    }
    #[napi]
    pub fn statistics() -> NativeStorageStatistics {
        NativeStorageStatistics {
            live: LIVE.load(Ordering::Relaxed) as f64,
            created: CREATED.load(Ordering::Relaxed) as f64,
            released: RELEASED.load(Ordering::Relaxed) as f64,
            entries: ENTRIES.load(Ordering::Relaxed) as f64,
            units: UNITS.load(Ordering::Relaxed) as f64,
            capacity: CAPACITY.load(Ordering::Relaxed) as f64,
            cursors: CURSORS.load(Ordering::Relaxed) as f64,
        }
    }
}

#[napi]
pub struct NativeStorageKeyCursor {
    state: Option<Rc<RefCell<TrackedArea>>>,
    sequence: u64,
}
impl Drop for NativeStorageKeyCursor {
    fn drop(&mut self) {
        CURSORS.fetch_sub(1, Ordering::Relaxed);
    }
}
#[napi]
impl NativeStorageKeyCursor {
    #[napi]
    pub fn next(&mut self) -> Option<Utf16String> {
        let next = self
            .state
            .as_ref()?
            .borrow()
            .area
            .next_key(self.sequence)
            .map(|(sequence, key)| (sequence, key.to_vec()));
        if let Some((sequence, key)) = next {
            self.sequence = sequence;
            Some(key.into())
        } else {
            self.state = None;
            None
        }
    }
}
