//! Ordered listener membership and options without JavaScript callback references.
use super::{compact_storage::CompactMap, constants::JS_MAX_SAFE_INTEGER};
use napi_derive::napi;
use rustc_hash::FxBuildHasher;
use std::{collections::BTreeSet, sync::Arc};

#[napi]
pub enum ListenerInvocation {
    Missing = 0,
    OtherPhase = 1,
    Invoke = 2,
    Once = 4,
    Passive = 8,
    ForgetCallback = 16,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ListenerError {
    IdentifiersExhausted,
}

#[derive(Clone, Copy)]
pub struct ListenerOptions {
    pub capture: bool,
    pub once: bool,
    pub passive: bool,
}

struct ListenerRecord {
    event_type: Arc<[u16]>,
    callback: u64,
    options: ListenerOptions,
}

#[derive(Default)]
struct ListenerBucket {
    order: BTreeSet<u64>,
    identities: CompactMap<(u64, bool), u64, FxBuildHasher>,
}

#[derive(Default)]
pub struct ListenerRegistry {
    types: CompactMap<Arc<[u16]>, ListenerBucket, FxBuildHasher>,
    records: CompactMap<u64, ListenerRecord, FxBuildHasher>,
    callbacks: CompactMap<u64, usize, FxBuildHasher>,
    next_id: u64,
    had_event_type: bool,
}

impl ListenerRegistry {
    pub fn add(
        &mut self,
        event_type: &[u16],
        callback: u64,
        options: ListenerOptions,
    ) -> Result<u64, ListenerError> {
        if self
            .types
            .get(event_type)
            .is_some_and(|bucket| bucket.identities.contains_key(&(callback, options.capture)))
        {
            return Ok(0);
        }
        if self.next_id == JS_MAX_SAFE_INTEGER {
            return Err(ListenerError::IdentifiersExhausted);
        }
        self.next_id += 1;
        let id = self.next_id;
        let event_type = self
            .types
            .get_key_value(event_type)
            .map_or_else(|| Arc::from(event_type), |(key, _)| Arc::clone(key));
        let bucket = self.types.entry(Arc::clone(&event_type)).or_default();
        bucket.order.insert(id);
        bucket.identities.insert((callback, options.capture), id);
        self.records.insert(
            id,
            ListenerRecord {
                event_type,
                callback,
                options,
            },
        );
        *self.callbacks.entry(callback).or_default() += 1;
        self.had_event_type = true;
        Ok(id)
    }

    pub fn remove(&mut self, event_type: &[u16], callback: u64, capture: bool) -> u64 {
        let Some(id) = self
            .types
            .get(event_type)
            .and_then(|bucket| bucket.identities.get(&(callback, capture)))
            .copied()
        else {
            return 0;
        };
        self.remove_id(id);
        id
    }

    fn remove_id(&mut self, id: u64) {
        let Some(record) = self.records.remove(&id) else {
            return;
        };
        let bucket = self
            .types
            .get_mut(record.event_type.as_ref())
            .expect("registered event type exists");
        bucket.order.remove(&id);
        bucket
            .identities
            .remove(&(record.callback, record.options.capture));
        if bucket.order.is_empty() {
            self.types.remove(record.event_type.as_ref());
            self.types.compact();
        } else {
            bucket.identities.compact();
        }
        let count = self
            .callbacks
            .get_mut(&record.callback)
            .expect("registered callback exists");
        *count -= 1;
        if *count == 0 {
            self.callbacks.remove(&record.callback);
            self.callbacks.compact();
        }
        self.records.compact();
    }

    pub fn snapshot(&self, event_type: &[u16]) -> Vec<u64> {
        self.types
            .get(event_type)
            .map_or_else(Vec::new, |bucket| bucket.order.iter().copied().collect())
    }

    /// The host retains every captured owner, while only eligible indices need invocation checks.
    pub fn snapshot_selection(
        &self,
        event_type: &[u16],
        capturing: bool,
    ) -> (Vec<u64>, Vec<usize>) {
        let ids = self.snapshot(event_type);
        let selected = ids
            .iter()
            .enumerate()
            .filter_map(|(index, id)| {
                self.records
                    .get(id)
                    .filter(|record| record.options.capture == capturing)
                    .map(|_| index)
            })
            .collect();
        (ids, selected)
    }

    /// Removes once entries before returning control to the callback host.
    pub fn prepare_invocation(&mut self, id: u64, capturing: bool) -> u32 {
        let Some(record) = self.records.get(&id) else {
            return ListenerInvocation::Missing as u32;
        };
        if record.options.capture != capturing {
            return ListenerInvocation::OtherPhase as u32;
        }
        let callback = record.callback;
        let options = record.options;
        let mut action = ListenerInvocation::Invoke as u32;
        if options.passive {
            action |= ListenerInvocation::Passive as u32;
        }
        if options.once {
            self.remove_id(id);
            action |= ListenerInvocation::Once as u32;
            if !self.has_callback(callback) {
                action |= ListenerInvocation::ForgetCallback as u32;
            }
        }
        action
    }

    /// Reports active membership without allocating an invocation snapshot.
    pub fn listener_count(&self, event_type: &[u16]) -> usize {
        self.types
            .get(event_type)
            .map_or(0, |bucket| bucket.order.len())
    }
    pub fn has_callback(&self, callback: u64) -> bool {
        self.callbacks.contains_key(&callback)
    }
    pub fn had_event_type(&self) -> bool {
        self.had_event_type
    }
    pub fn len(&self) -> usize {
        self.records.len()
    }
    pub fn type_count(&self) -> usize {
        self.types.len()
    }
    pub fn callback_count(&self) -> usize {
        self.callbacks.len()
    }
    pub fn bucket_capacity(&self) -> usize {
        self.types
            .values()
            .map(|bucket| bucket.identities.capacity())
            .sum()
    }
    pub fn capacities(&self) -> (usize, usize, usize) {
        (
            self.records.capacity(),
            self.types.capacity(),
            self.callbacks.capacity(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_count_active_listeners_after_removal_and_once_invocation() {
        let mut registry = ListenerRegistry::default();
        let event_type: Vec<u16> = "abort".encode_utf16().collect();
        assert_eq!(registry.listener_count(&event_type), 0);
        let once = registry
            .add(&event_type, 1, options(false, true, false))
            .unwrap();
        registry
            .add(&event_type, 2, options(true, false, false))
            .unwrap();
        assert_eq!(registry.listener_count(&event_type), 2);
        registry.prepare_invocation(once, false);
        assert_eq!(registry.listener_count(&event_type), 1);
        registry.remove(&event_type, 2, true);
        assert_eq!(registry.listener_count(&event_type), 0);
    }
    fn options(capture: bool, once: bool, passive: bool) -> ListenerOptions {
        ListenerOptions {
            capture,
            once,
            passive,
        }
    }

    #[test]
    fn should_deduplicate_by_callback_capture_and_keep_first_options() {
        let mut registry = ListenerRegistry::default();
        let first = registry
            .add(&[0, 55296], 7, options(false, false, true))
            .unwrap();
        assert_eq!(
            registry.add(&[0, 55296], 7, options(false, true, false)),
            Ok(0)
        );
        let capture = registry
            .add(&[0, 55296], 7, options(true, true, false))
            .unwrap();
        assert_eq!(registry.snapshot(&[0, 55296]), [first, capture]);
        assert_eq!(
            registry.snapshot_selection(&[0, 55296], true),
            (vec![first, capture], vec![1])
        );
        assert_eq!(
            registry.snapshot_selection(&[0, 55296], false),
            (vec![first, capture], vec![0])
        );
        assert_eq!(
            registry.prepare_invocation(first, true),
            ListenerInvocation::OtherPhase as u32
        );
        assert_eq!(
            registry.prepare_invocation(first, false),
            ListenerInvocation::Invoke as u32 | ListenerInvocation::Passive as u32
        );
        assert_eq!(
            registry.prepare_invocation(capture, true),
            ListenerInvocation::Invoke as u32 | ListenerInvocation::Once as u32
        );
        assert!(registry.has_callback(7));
        assert_eq!(registry.remove(&[0, 55296], 7, false), first);
        assert!(!registry.has_callback(7));
        assert_eq!(registry.len(), 0);
        assert_eq!(registry.type_count(), 0);
        assert!(registry.had_event_type());
    }

    #[test]
    fn should_keep_removed_and_readded_records_distinct_from_snapshots() {
        let mut registry = ListenerRegistry::default();
        let old = registry
            .add(&[97], 1, options(false, false, false))
            .unwrap();
        let snapshot = registry.snapshot(&[97]);
        registry.remove(&[97], 1, false);
        let new = registry.add(&[97], 1, options(false, true, false)).unwrap();
        assert_ne!(old, new);
        assert_eq!(snapshot, [old]);
        assert_eq!(
            registry.prepare_invocation(old, false),
            ListenerInvocation::Missing as u32
        );
        assert_eq!(
            registry.prepare_invocation(new, false),
            ListenerInvocation::Invoke as u32
                | ListenerInvocation::Once as u32
                | ListenerInvocation::ForgetCallback as u32
        );
        assert_eq!(
            registry.prepare_invocation(new, false),
            ListenerInvocation::Missing as u32
        );
    }

    #[test]
    fn should_compact_unique_type_and_callback_bursts_while_preserving_history() {
        let mut registry = ListenerRegistry::default();
        registry.add(&[1], 1, options(false, false, false)).unwrap();
        for id in 2..10_002 {
            registry
                .add(&[id as u16], id, options(false, false, false))
                .unwrap();
        }
        for id in 2..10_002 {
            registry.remove(&[id as u16], id, false);
        }
        assert_eq!(registry.len(), 1);
        assert_eq!(registry.type_count(), 1);
        assert_eq!(registry.callback_count(), 1);
        let (records, types, callbacks) = registry.capacities();
        assert!(records <= 64 && types <= 64 && callbacks <= 64);
        registry.remove(&[1], 1, false);
        assert!(registry.had_event_type());
        assert_eq!(registry.len(), 0);
        assert_eq!(registry.type_count(), 0);
    }

    #[test]
    fn should_reject_exhaustion_before_mutation_but_preserve_duplicates() {
        let mut registry = ListenerRegistry::default();
        registry.add(&[1], 1, options(false, false, false)).unwrap();
        registry.next_id = JS_MAX_SAFE_INTEGER;
        assert_eq!(registry.add(&[1], 1, options(false, false, false)), Ok(0));
        assert_eq!(
            registry.add(&[2], 2, options(false, false, false)),
            Err(ListenerError::IdentifiersExhausted)
        );
        assert_eq!(registry.len(), 1);
        assert_eq!(registry.type_count(), 1);
    }
}
