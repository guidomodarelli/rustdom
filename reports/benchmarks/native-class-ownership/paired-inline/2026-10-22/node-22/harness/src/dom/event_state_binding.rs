//! V8-finalized Event state; all retained payloads are native scalars or owned text.
use super::{
    data::DomString,
    event_state::{EventDispatchStatus, EventState, EventStateFlag},
    napi_string::string_result,
};
use napi::bindgen_prelude::{Either, Unknown, Utf16String};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE_EVENTS: AtomicU64 = AtomicU64::new(0);
static CREATED_EVENTS: AtomicU64 = AtomicU64::new(0);
static RELEASED_EVENTS: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct NativeEventStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
}

#[napi(object)]
pub struct NativeEventDispatchStep {
    pub index: f64,
    pub target_index: f64,
    pub capturing: bool,
    pub invoke: bool,
}

/// Compact host-array index plus two flags; negative values indicate completion.
#[napi]
pub enum EventInvocationEncoding {
    Complete = -1,
    Capturing = 1,
    Invoke = 2,
    Stride = 4,
}

#[napi]
pub struct NativeEventState {
    state: EventState,
}

impl Drop for NativeEventState {
    fn drop(&mut self) {
        LIVE_EVENTS.fetch_sub(1, Ordering::Relaxed);
        RELEASED_EVENTS.fetch_add(1, Ordering::Relaxed);
    }
}

#[napi]
impl NativeEventState {
    #[napi(constructor)]
    pub fn new(event_type: Utf16String, bubbles: bool, cancelable: bool, composed: bool) -> Self {
        LIVE_EVENTS.fetch_add(1, Ordering::Relaxed);
        CREATED_EVENTS.fetch_add(1, Ordering::Relaxed);
        Self {
            state: EventState::new(
                DomString::from_units(&event_type),
                bubbles,
                cancelable,
                composed,
            ),
        }
    }
    #[napi]
    pub fn flag(&self, flag: EventStateFlag) -> bool {
        self.state.flag(flag)
    }
    #[napi]
    pub fn prepare_dispatch(&mut self) -> EventDispatchStatus {
        self.state.prepare_dispatch()
    }
    #[napi]
    pub fn begin_dispatch(&mut self) {
        self.state.begin_dispatch();
    }
    #[napi]
    pub fn append_path(&mut self, root_closed: bool, slot_closed: bool, has_target: bool) -> f64 {
        self.state
            .path
            .append(root_closed, slot_closed, has_target)
            .map_or(-1.0, |index| index as f64)
    }
    #[napi]
    pub fn next_invocation(&mut self) -> Option<NativeEventDispatchStep> {
        self.state
            .next_invocation()
            .map(|step| NativeEventDispatchStep {
                index: step.index as f64,
                target_index: step.target_index.map_or(-1.0, |index| index as f64),
                capturing: step.capturing,
                invoke: step.invoke,
            })
    }
    #[napi]
    pub fn advance_invocation(&mut self) -> f64 {
        self.state.next_invocation().map_or(
            EventInvocationEncoding::Complete as i32 as f64,
            |step| {
                step.index as f64 * EventInvocationEncoding::Stride as i32 as f64
                    + if step.capturing {
                        EventInvocationEncoding::Capturing as i32 as f64
                    } else {
                        0.0
                    }
                    + if step.invoke {
                        EventInvocationEncoding::Invoke as i32 as f64
                    } else {
                        0.0
                    }
            },
        )
    }
    #[napi]
    pub fn visible_path_indices(&self) -> Vec<f64> {
        self.state
            .path
            .visible_indices()
            .into_iter()
            .map(|index| index.map_or(-1.0, |index| index as f64))
            .collect()
    }
    #[napi]
    pub fn finish_dispatch(&mut self) {
        self.state.finish_dispatch();
    }
    #[napi(getter)]
    pub fn path_length(&self) -> f64 {
        self.state.path.len() as f64
    }
    #[napi(getter)]
    pub fn path_capacity(&self) -> f64 {
        self.state.path.capacity() as f64
    }
    #[napi]
    pub fn set_flag(&mut self, flag: EventStateFlag, value: bool) {
        self.state.set_flag(flag, value);
    }
    #[napi]
    pub fn finish_construction(&mut self, trusted: bool, timestamp: f64) {
        self.state.finish_construction(trusted, timestamp);
    }
    #[napi(getter)]
    pub fn event_type(&self) -> Either<&str, Utf16String> {
        string_result(Some(&self.state.event_type)).expect("event type exists")
    }
    #[napi(setter)]
    pub fn set_event_type(&mut self, value: Utf16String) {
        self.state.event_type = DomString::from_units(&value);
    }
    #[napi(getter)]
    pub fn event_phase(&self) -> f64 {
        self.state.phase
    }
    #[napi(setter)]
    pub fn set_event_phase(&mut self, value: f64) {
        self.state.phase = value;
    }
    #[napi(getter)]
    pub fn time_stamp(&self) -> f64 {
        self.state.timestamp
    }
    #[napi(setter)]
    pub fn set_time_stamp(&mut self, value: f64) {
        self.state.timestamp = value;
    }
    #[napi(getter)]
    pub fn return_value(&self) -> bool {
        !self.state.flag(EventStateFlag::Canceled)
    }
    #[napi]
    pub fn set_return_value(&mut self, value: Either<bool, Unknown<'_>>) {
        // BeforeUnloadEvent converts its setter input to DOMString. The shared
        // Event implementation only acts on the literal boolean false.
        if let Either::A(value) = value {
            self.state.set_return_value(value);
        }
    }
    #[napi]
    pub fn set_cancel_bubble(&mut self, value: bool) {
        self.state.set_cancel_bubble(value);
    }
    #[napi]
    pub fn prevent_default(&mut self) {
        self.state.prevent_default();
    }
    #[napi]
    pub fn stop_propagation(&mut self) {
        self.state.stop_propagation();
    }
    #[napi]
    pub fn stop_immediate_propagation(&mut self) {
        self.state.stop_immediate_propagation();
    }
    #[napi]
    pub fn initialize(&mut self, event_type: Utf16String, bubbles: bool, cancelable: bool) {
        self.state
            .initialize(DomString::from_units(&event_type), bubbles, cancelable);
    }
    #[napi]
    pub fn initialize_if_idle(
        &mut self,
        event_type: Utf16String,
        bubbles: bool,
        cancelable: bool,
    ) -> bool {
        self.state
            .initialize_if_idle(DomString::from_units(&event_type), bubbles, cancelable)
    }
    #[napi]
    pub fn statistics() -> NativeEventStatistics {
        NativeEventStatistics {
            live: LIVE_EVENTS.load(Ordering::Relaxed) as f64,
            created: CREATED_EVENTS.load(Ordering::Relaxed) as f64,
            released: RELEASED_EVENTS.load(Ordering::Relaxed) as f64,
        }
    }
}
