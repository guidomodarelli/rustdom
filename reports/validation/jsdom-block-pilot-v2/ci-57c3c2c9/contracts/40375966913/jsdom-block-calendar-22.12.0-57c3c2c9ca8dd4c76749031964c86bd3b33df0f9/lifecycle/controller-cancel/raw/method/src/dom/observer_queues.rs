//! Ordered observer queues share immutable native payloads without owning JavaScript objects or trees.
use super::{
    compact_storage::CompactMap,
    error::{Result, TreeError},
    mutation_record::MutationRecordState,
    store::node_id,
};
use rustc_hash::FxBuildHasher;
use std::sync::Arc;

struct QueuedRecord {
    token: u64,
    record: Arc<MutationRecordState>,
}

#[derive(Default)]
pub(crate) struct ObserverQueues {
    queues: CompactMap<u64, Vec<QueuedRecord>, FxBuildHasher>,
    next_token: u64,
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct ObserverQueueStatistics {
    pub queued_records: usize,
    pub queue_observers: usize,
    pub queue_capacity: usize,
    pub queue_map_capacity: usize,
}

impl ObserverQueues {
    fn compact(&mut self) {
        self.queues.compact();
        if self.queues.is_empty() {
            self.queues.shrink_to_fit();
        }
    }

    /// The registry validates the observer before this allocation; failure consumes no token or payload.
    pub fn enqueue(&mut self, observer: u64, record: Arc<MutationRecordState>) -> Result<f64> {
        let token = node_id(self.next_token as f64 + 1.0)
            .map_err(|_| TreeError::MutationRecordTokensExhausted)?;
        self.next_token = token;
        self.queues
            .entry(observer)
            .or_default()
            .push(QueuedRecord { token, record });
        Ok(token as f64)
    }

    /// Return the binding's identities in insertion order and release the queue's share of each payload.
    pub fn take(&mut self, observer: u64) -> Vec<f64> {
        let records = self.queues.remove(&observer).unwrap_or_default();
        self.compact();
        records
            .into_iter()
            .map(|record| record.token as f64)
            .collect()
    }

    pub fn discard(&mut self, observer: u64) {
        self.queues.remove(&observer);
        self.compact();
    }

    /// A read-only native snapshot remains usable after its queue or originating tree is released.
    pub fn get(&self, observer: u64, token: u64) -> Option<Arc<MutationRecordState>> {
        self.queues
            .get(&observer)?
            .iter()
            .find(|record| record.token == token)
            .map(|record| Arc::clone(&record.record))
    }

    pub fn statistics(&self) -> ObserverQueueStatistics {
        ObserverQueueStatistics {
            queued_records: self.queues.values().map(Vec::len).sum(),
            queue_observers: self.queues.len(),
            queue_capacity: self.queues.values().map(Vec::capacity).sum(),
            queue_map_capacity: self.queues.capacity(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dom::{data::DomString, mutation_record::MutationKind};

    fn record() -> Arc<MutationRecordState> {
        Arc::new(MutationRecordState {
            kind: MutationKind::Attributes,
            target: 1,
            previous_sibling: 0,
            next_sibling: 0,
            attribute_name: Some(DomString::Text("flag".into())),
            attribute_namespace: None,
            old_value: Some(DomString::from_units(&[111, 108, 100, 55296])),
            added_nodes: Box::new([]),
            removed_nodes: Box::new([]),
        })
    }

    #[test]
    fn should_keep_independent_fifo_queues_and_never_reuse_drained_tokens() {
        let mut queues = ObserverQueues::default();
        let payload = record();
        let first = queues.enqueue(1, Arc::clone(&payload)).unwrap();
        let second = queues.enqueue(2, Arc::clone(&payload)).unwrap();
        let third = queues.enqueue(1, Arc::clone(&payload)).unwrap();
        assert_eq!(queues.take(1), [first, third]);
        assert!(queues.take(1).is_empty());
        assert_eq!(queues.take(2), [second]);
        assert_eq!(queues.statistics(), ObserverQueueStatistics::default());
        assert!(queues.enqueue(1, payload).unwrap() > third);
    }

    #[test]
    fn should_keep_payloads_after_original_wrappers_drop_and_release_each_share_on_drain() {
        let mut queues = ObserverQueues::default();
        let payload = record();
        let weak = Arc::downgrade(&payload);
        let token = queues.enqueue(1, Arc::clone(&payload)).unwrap();
        queues.enqueue(2, Arc::clone(&payload)).unwrap();
        drop(payload);
        let snapshot = queues.get(1, token as u64).unwrap();
        assert_eq!(
            snapshot
                .old_value
                .as_ref()
                .unwrap()
                .units()
                .collect::<Vec<_>>(),
            [111, 108, 100, 55296]
        );
        queues.discard(1);
        assert!(weak.upgrade().is_some());
        queues.discard(2);
        assert!(weak.upgrade().is_some());
        drop(snapshot);
        assert!(weak.upgrade().is_none());
        assert_eq!(queues.statistics(), ObserverQueueStatistics::default());
    }

    #[test]
    fn should_reclaim_large_queues_and_preserve_all_state_on_token_exhaustion() {
        let mut queues = ObserverQueues::default();
        let payload = record();
        for _ in 0..2048 {
            queues.enqueue(1, Arc::clone(&payload)).unwrap();
        }
        let before = queues.statistics();
        queues.next_token = 9_007_199_254_740_991;
        assert!(matches!(
            queues.enqueue(1, Arc::clone(&payload)),
            Err(TreeError::MutationRecordTokensExhausted)
        ));
        assert_eq!(queues.statistics(), before);
        assert_eq!(queues.take(1).len(), 2048);
        assert_eq!(queues.statistics(), ObserverQueueStatistics::default());
        assert_eq!(Arc::strong_count(&payload), 1);
    }
}
