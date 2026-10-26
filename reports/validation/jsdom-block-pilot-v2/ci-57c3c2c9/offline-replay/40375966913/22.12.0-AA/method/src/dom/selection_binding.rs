//! Native scalar state for Selection; Range/Window references remain visible to V8.
use super::selection::{SelectionState, contains, selection_type};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};
static LIVE: AtomicU64 = AtomicU64::new(0);
static CREATED: AtomicU64 = AtomicU64::new(0);
static RELEASED: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct NativeSelectionStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
}
#[napi]
pub struct NativeSelectionState {
    state: SelectionState,
}
impl Default for NativeSelectionState {
    fn default() -> Self {
        Self::new()
    }
}
impl Drop for NativeSelectionState {
    fn drop(&mut self) {
        LIVE.fetch_sub(1, Ordering::Relaxed);
        RELEASED.fetch_add(1, Ordering::Relaxed);
    }
}
#[napi]
impl NativeSelectionState {
    #[napi(constructor)]
    pub fn new() -> Self {
        LIVE.fetch_add(1, Ordering::Relaxed);
        CREATED.fetch_add(1, Ordering::Relaxed);
        Self {
            state: SelectionState::default(),
        }
    }
    #[napi(getter)]
    pub fn direction(&self) -> f64 {
        self.state.direction
    }
    #[napi(setter)]
    pub fn set_direction(&mut self, value: f64) {
        self.state.direction = value;
    }
    #[napi(getter)]
    pub fn anchor_is_start(&self) -> bool {
        self.state.anchor_is_start()
    }
    #[napi]
    pub fn associate(
        &mut self,
        has_old: bool,
        has_new: bool,
        same: bool,
        start_equal: bool,
        end_equal: bool,
    ) -> bool {
        self.state
            .associate(has_old, has_new, same, start_equal, end_equal)
    }
    #[napi]
    pub fn orient(&mut self, focus_before_anchor: bool) {
        self.state.orient(focus_before_anchor);
    }
    #[napi]
    pub fn selection_type(has_range: bool, collapsed: bool) -> &'static str {
        selection_type(has_range, collapsed)
    }
    #[napi]
    pub fn contains(start_before: bool, end_after: bool, partial: bool) -> bool {
        contains(start_before, end_after, partial)
    }
    #[napi]
    pub fn statistics() -> NativeSelectionStatistics {
        NativeSelectionStatistics {
            live: LIVE.load(Ordering::Relaxed) as f64,
            created: CREATED.load(Ordering::Relaxed) as f64,
            released: RELEASED.load(Ordering::Relaxed) as f64,
        }
    }
}
