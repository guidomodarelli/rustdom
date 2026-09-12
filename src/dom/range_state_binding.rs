//! V8 owns each NativeRange box; Rust stores only numeric endpoints and drops them with the wrapper.
use super::{
    error::TreeError,
    napi_error::to_napi_error,
    range_state::{BoundaryPoint, RangeState, query_offset},
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
    pub(super) fn inputs(&self) -> Result<((f64, u32), (f64, u32))> {
        let (start, end) = self.state.points().map_err(to_napi_error)?;
        Ok((
            (start.node as f64, query_offset(start.offset)),
            (end.node as f64, query_offset(end.offset)),
        ))
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
        CREATED_RANGES.fetch_add(1, Ordering::Relaxed);
        LIVE_RANGES.fetch_add(1, Ordering::Relaxed);
        Self {
            state: RangeState::default(),
        }
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
