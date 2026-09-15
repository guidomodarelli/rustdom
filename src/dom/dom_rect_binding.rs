//! A V8-finalized rectangle owns exactly four native doubles and no host references.
use super::dom_rect::Rect;
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE_RECTS: AtomicU64 = AtomicU64::new(0);
static CREATED_RECTS: AtomicU64 = AtomicU64::new(0);
static RELEASED_RECTS: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct NativeRectStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
}

/// Field order matches DOMRectReadOnly.toJSON; the host preserves its object realm.
#[napi(object)]
pub struct RectSnapshot {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub left: f64,
}

#[napi]
pub struct NativeDomRect {
    rect: Rect,
}

impl Drop for NativeDomRect {
    fn drop(&mut self) {
        LIVE_RECTS.fetch_sub(1, Ordering::Relaxed);
        RELEASED_RECTS.fetch_add(1, Ordering::Relaxed);
    }
}

#[napi]
impl NativeDomRect {
    #[napi(constructor)]
    pub fn new(x: f64, y: f64, width: f64, height: f64) -> Self {
        LIVE_RECTS.fetch_add(1, Ordering::Relaxed);
        CREATED_RECTS.fetch_add(1, Ordering::Relaxed);
        Self {
            rect: Rect {
                x,
                y,
                width,
                height,
            },
        }
    }
    #[napi(getter)]
    pub fn x(&self) -> f64 {
        self.rect.x
    }
    #[napi(setter)]
    pub fn set_x(&mut self, value: f64) {
        self.rect.x = value;
    }
    #[napi(getter)]
    pub fn y(&self) -> f64 {
        self.rect.y
    }
    #[napi(setter)]
    pub fn set_y(&mut self, value: f64) {
        self.rect.y = value;
    }
    #[napi(getter)]
    pub fn width(&self) -> f64 {
        self.rect.width
    }
    #[napi(setter)]
    pub fn set_width(&mut self, value: f64) {
        self.rect.width = value;
    }
    #[napi(getter)]
    pub fn height(&self) -> f64 {
        self.rect.height
    }
    #[napi(setter)]
    pub fn set_height(&mut self, value: f64) {
        self.rect.height = value;
    }
    #[napi(getter)]
    pub fn top(&self) -> f64 {
        self.rect.top()
    }
    #[napi(getter)]
    pub fn right(&self) -> f64 {
        self.rect.right()
    }
    #[napi(getter)]
    pub fn bottom(&self) -> f64 {
        self.rect.bottom()
    }
    #[napi(getter)]
    pub fn left(&self) -> f64 {
        self.rect.left()
    }
    #[napi]
    pub fn snapshot(&self) -> RectSnapshot {
        RectSnapshot {
            x: self.rect.x,
            y: self.rect.y,
            width: self.rect.width,
            height: self.rect.height,
            top: self.rect.top(),
            right: self.rect.right(),
            bottom: self.rect.bottom(),
            left: self.rect.left(),
        }
    }
    #[napi]
    pub fn statistics() -> NativeRectStatistics {
        NativeRectStatistics {
            live: LIVE_RECTS.load(Ordering::Relaxed) as f64,
            created: CREATED_RECTS.load(Ordering::Relaxed) as f64,
            released: RELEASED_RECTS.load(Ordering::Relaxed) as f64,
        }
    }
}
