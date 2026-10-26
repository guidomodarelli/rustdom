//! Native notification membership and microtask coalescing, without callbacks or JavaScript references.
use super::compact_storage::CompactSet;
use rustc_hash::FxBuildHasher;

#[derive(Default)]
pub(crate) struct ObserverNotifications {
    active: CompactSet<u64, FxBuildHasher>,
    microtask_queued: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub struct NotificationStatistics {
    pub pending_observers: usize,
    pub capacity: usize,
    pub microtask_queued: bool,
}

impl ObserverNotifications {
    pub fn activate(&mut self, observer: u64) {
        self.active.insert(observer);
    }

    pub fn request_microtask(&mut self) -> bool {
        if self.microtask_queued {
            return false;
        }
        self.microtask_queued = true;
        true
    }

    /// Reset before callbacks and return only the original batch, in native creation order.
    pub fn begin(&mut self) -> Vec<f64> {
        self.microtask_queued = false;
        let active = std::mem::take(&mut self.active);
        let mut observers: Vec<_> = active.iter().copied().collect();
        observers.sort_unstable();
        observers
            .into_iter()
            .map(|observer| observer as f64)
            .collect()
    }

    /// A finalizer removes stale membership but must not cancel an already scheduled job.
    pub fn release(&mut self, observer: u64) {
        self.active.remove(&observer);
        self.active.compact();
        if self.active.is_empty() {
            self.active.shrink_to_fit();
        }
    }

    pub fn statistics(&self) -> NotificationStatistics {
        NotificationStatistics {
            pending_observers: self.active.len(),
            capacity: self.active.capacity(),
            microtask_queued: self.microtask_queued,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_deduplicate_sort_and_coalesce_without_losing_reentrant_batches() {
        let mut notifications = ObserverNotifications::default();
        notifications.activate(5);
        notifications.activate(1);
        notifications.activate(5);
        assert!(notifications.request_microtask());
        assert!(!notifications.request_microtask());
        assert_eq!(notifications.begin(), [1.0, 5.0]);
        notifications.activate(7);
        notifications.activate(5);
        assert!(notifications.request_microtask());
        assert!(!notifications.request_microtask());
        assert_eq!(notifications.begin(), [5.0, 7.0]);
        assert_eq!(
            notifications.statistics(),
            NotificationStatistics {
                pending_observers: 0,
                capacity: 0,
                microtask_queued: false
            }
        );
    }

    #[test]
    fn should_preserve_a_scheduled_empty_job_and_reclaim_finalized_membership() {
        let mut notifications = ObserverNotifications::default();
        assert!(notifications.request_microtask());
        for observer in 1..=2048 {
            notifications.activate(observer);
        }
        for observer in 1..=2048 {
            notifications.release(observer);
        }
        assert_eq!(
            notifications.statistics(),
            NotificationStatistics {
                pending_observers: 0,
                capacity: 0,
                microtask_queued: true
            }
        );
        assert!(!notifications.request_microtask());
        assert!(notifications.begin().is_empty());
        assert!(notifications.request_microtask());
    }
}
