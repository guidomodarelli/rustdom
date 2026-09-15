//! Scalar Event state and cancellation/initialization transitions, without JavaScript references.
use super::{
    data::DomString,
    event_path::{EventInvocation, EventPath},
};
use napi_derive::napi;

#[napi]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventStateFlag {
    Bubbles = 1,
    Cancelable = 2,
    Composed = 4,
    Initialized = 8,
    PropagationStopped = 16,
    ImmediatePropagationStopped = 32,
    Canceled = 64,
    PassiveListener = 128,
    Dispatching = 256,
    Trusted = 512,
}

#[napi]
#[derive(Debug, PartialEq, Eq)]
pub enum EventDispatchStatus {
    Ready = 0,
    UninitializedOrDispatching = 1,
    InvalidPhase = 2,
}

pub struct EventState {
    pub event_type: DomString,
    pub phase: f64,
    pub timestamp: f64,
    flags: u16,
    pub path: EventPath,
}

impl EventState {
    pub fn new(event_type: DomString, bubbles: bool, cancelable: bool, composed: bool) -> Self {
        let mut state = Self {
            event_type,
            phase: 0.0,
            timestamp: 0.0,
            flags: 0,
            path: EventPath::default(),
        };
        state.set_flag(EventStateFlag::Bubbles, bubbles);
        state.set_flag(EventStateFlag::Cancelable, cancelable);
        state.set_flag(EventStateFlag::Composed, composed);
        state.set_flag(EventStateFlag::Initialized, true);
        state
    }
    pub fn flag(&self, flag: EventStateFlag) -> bool {
        self.flags & flag as u16 != 0
    }
    pub fn prepare_dispatch(&mut self) -> EventDispatchStatus {
        if self.flag(EventStateFlag::Dispatching) || !self.flag(EventStateFlag::Initialized) {
            return EventDispatchStatus::UninitializedOrDispatching;
        }
        if self.phase != 0.0 {
            return EventDispatchStatus::InvalidPhase;
        }
        self.set_flag(EventStateFlag::Trusted, false);
        EventDispatchStatus::Ready
    }
    pub fn begin_dispatch(&mut self) {
        self.set_flag(EventStateFlag::Dispatching, true);
        self.path.reset_iteration();
    }
    pub fn next_invocation(&mut self) -> Option<EventInvocation> {
        let bubbles = self.flag(EventStateFlag::Bubbles);
        let stopped = self.flag(EventStateFlag::PropagationStopped);
        let step = self.path.next(bubbles, stopped)?;
        self.phase = step.phase as u8 as f64;
        Some(step)
    }
    pub fn finish_dispatch(&mut self) {
        self.phase = 0.0;
        self.path.clear();
        for flag in [
            EventStateFlag::Dispatching,
            EventStateFlag::PropagationStopped,
            EventStateFlag::ImmediatePropagationStopped,
        ] {
            self.set_flag(flag, false);
        }
    }
    pub fn set_flag(&mut self, flag: EventStateFlag, value: bool) {
        if value {
            self.flags |= flag as u16;
        } else {
            self.flags &= !(flag as u16);
        }
    }
    pub fn finish_construction(&mut self, trusted: bool, timestamp: f64) {
        for flag in [
            EventStateFlag::PropagationStopped,
            EventStateFlag::ImmediatePropagationStopped,
            EventStateFlag::Canceled,
            EventStateFlag::PassiveListener,
            EventStateFlag::Dispatching,
        ] {
            self.set_flag(flag, false);
        }
        self.set_flag(EventStateFlag::Initialized, true);
        self.set_flag(EventStateFlag::Trusted, trusted);
        self.phase = 0.0;
        self.timestamp = timestamp;
    }
    pub fn prevent_default(&mut self) {
        if self.flag(EventStateFlag::Cancelable) && !self.flag(EventStateFlag::PassiveListener) {
            self.set_flag(EventStateFlag::Canceled, true);
        }
    }
    pub fn stop_propagation(&mut self) {
        self.set_flag(EventStateFlag::PropagationStopped, true);
    }
    pub fn stop_immediate_propagation(&mut self) {
        self.stop_propagation();
        self.set_flag(EventStateFlag::ImmediatePropagationStopped, true);
    }
    pub fn set_cancel_bubble(&mut self, value: bool) {
        if value {
            self.stop_propagation();
        }
    }
    pub fn set_return_value(&mut self, value: bool) {
        if !value {
            self.prevent_default();
        }
    }
    pub fn initialize(&mut self, event_type: DomString, bubbles: bool, cancelable: bool) {
        self.event_type = event_type;
        self.set_flag(EventStateFlag::Initialized, true);
        for flag in [
            EventStateFlag::PropagationStopped,
            EventStateFlag::ImmediatePropagationStopped,
            EventStateFlag::Canceled,
            EventStateFlag::Trusted,
        ] {
            self.set_flag(flag, false);
        }
        self.set_flag(EventStateFlag::Bubbles, bubbles);
        self.set_flag(EventStateFlag::Cancelable, cancelable);
    }
    pub fn initialize_if_idle(
        &mut self,
        event_type: DomString,
        bubbles: bool,
        cancelable: bool,
    ) -> bool {
        if self.flag(EventStateFlag::Dispatching) {
            return false;
        }
        self.initialize(event_type, bubbles, cancelable);
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_preserve_dispatch_error_order_and_change_trust_only_after_acceptance() {
        let mut event = EventState::new(DomString::Text("go".into()), true, true, true);
        event.finish_construction(true, 123.0);
        event.phase = 2.0;
        event.set_flag(EventStateFlag::Initialized, false);
        assert_eq!(
            event.prepare_dispatch(),
            EventDispatchStatus::UninitializedOrDispatching
        );
        assert!(event.flag(EventStateFlag::Trusted));
        event.set_flag(EventStateFlag::Initialized, true);
        assert_eq!(event.prepare_dispatch(), EventDispatchStatus::InvalidPhase);
        assert!(event.flag(EventStateFlag::Trusted));
        event.phase = 0.0;
        assert_eq!(event.prepare_dispatch(), EventDispatchStatus::Ready);
        assert!(!event.flag(EventStateFlag::Trusted));
        event.begin_dispatch();
        assert_eq!(
            event.prepare_dispatch(),
            EventDispatchStatus::UninitializedOrDispatching
        );
    }

    #[test]
    fn should_apply_phase_and_target_decisions_even_when_stopped_and_preserve_cancellation_at_finish()
     {
        let mut event = EventState::new(DomString::Text("go".into()), true, true, true);
        event.prevent_default();
        event.stop_immediate_propagation();
        event.begin_dispatch();
        event.path.append(false, false, true);
        event.path.append(false, false, false);
        let step = event.next_invocation().unwrap();
        assert_eq!(step.index, 1);
        assert_eq!(step.target_index, Some(0));
        assert!(!step.invoke);
        assert_eq!(event.phase, 1.0);
        assert!(event.flag(EventStateFlag::Canceled));
        event.set_flag(EventStateFlag::PassiveListener, true);
        event.finish_dispatch();
        assert_eq!(event.phase, 0.0);
        assert_eq!(event.path.capacity(), 0);
        assert_eq!(event.path.len(), 0);
        assert!(event.flag(EventStateFlag::Canceled));
        assert!(event.flag(EventStateFlag::PassiveListener));
        for flag in [
            EventStateFlag::Dispatching,
            EventStateFlag::PropagationStopped,
            EventStateFlag::ImmediatePropagationStopped,
        ] {
            assert!(!event.flag(flag));
        }
    }
    #[test]
    fn should_cancel_only_when_allowed_and_keep_legacy_setters_one_way() {
        let mut event = EventState::new(DomString::Text("go".into()), true, false, false);
        event.prevent_default();
        assert!(!event.flag(EventStateFlag::Canceled));
        event.set_flag(EventStateFlag::Cancelable, true);
        event.set_flag(EventStateFlag::PassiveListener, true);
        event.set_return_value(false);
        assert!(!event.flag(EventStateFlag::Canceled));
        event.set_flag(EventStateFlag::PassiveListener, false);
        event.set_return_value(false);
        event.set_return_value(true);
        assert!(event.flag(EventStateFlag::Canceled));
        event.stop_immediate_propagation();
        event.set_cancel_bubble(false);
        assert!(event.flag(EventStateFlag::PropagationStopped));
        assert!(event.flag(EventStateFlag::ImmediatePropagationStopped));
    }
    #[test]
    fn should_preserve_timestamp_composed_and_dispatch_guards_during_initialization() {
        let mut event = EventState::new(DomString::from_units(&[97, 0, 55296]), true, true, true);
        event.finish_construction(true, 123.5);
        event.prevent_default();
        event.stop_immediate_propagation();
        event.set_flag(EventStateFlag::Dispatching, true);
        event.phase = 2.0;
        assert!(!event.initialize_if_idle(DomString::Text("ignored".into()), false, false));
        assert_eq!(event.event_type.units().collect::<Vec<_>>(), [97, 0, 55296]);
        assert!(event.flag(EventStateFlag::Canceled));
        event.set_flag(EventStateFlag::Dispatching, false);
        assert!(event.initialize_if_idle(DomString::from_units(&[56320, 0]), false, false));
        assert_eq!(event.event_type.units().collect::<Vec<_>>(), [56320, 0]);
        assert_eq!(event.timestamp, 123.5);
        assert_eq!(event.phase, 2.0);
        assert!(event.flag(EventStateFlag::Composed));
        for flag in [
            EventStateFlag::Canceled,
            EventStateFlag::Trusted,
            EventStateFlag::PropagationStopped,
            EventStateFlag::ImmediatePropagationStopped,
            EventStateFlag::Bubbles,
            EventStateFlag::Cancelable,
        ] {
            assert!(!event.flag(flag));
        }
    }
    #[test]
    fn should_finish_construction_without_erasing_type_or_base_initialization_flags() {
        let mut event = EventState::new(DomString::Text("go".into()), true, false, true);
        event.phase = 3.0;
        event.set_flag(EventStateFlag::Dispatching, true);
        event.set_flag(EventStateFlag::Canceled, true);
        event.set_flag(EventStateFlag::Initialized, false);
        event.finish_construction(false, 456.0);
        assert_eq!(event.event_type.as_str(), Some("go"));
        assert_eq!(event.phase, 0.0);
        assert_eq!(event.timestamp, 456.0);
        assert!(event.flag(EventStateFlag::Bubbles));
        assert!(event.flag(EventStateFlag::Composed));
        assert!(event.flag(EventStateFlag::Initialized));
        assert!(!event.flag(EventStateFlag::Dispatching));
        assert!(!event.flag(EventStateFlag::Canceled));
    }
}
