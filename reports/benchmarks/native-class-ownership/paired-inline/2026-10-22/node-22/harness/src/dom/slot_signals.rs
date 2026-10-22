//! Ordered slot signals with constant-time deduplication and amortized removal of finalized IDs.
use super::{
    compact_storage::{CompactSet, compact_vector},
    data::NodeData,
    error::{Result, TreeError},
    slots::is_html_slot,
    store::{NodeId, TreeStore, node_id},
};
use rustc_hash::FxBuildHasher;

#[derive(Default)]
pub(crate) struct SlotSignals {
    queue: Vec<NodeId>,
    members: CompactSet<NodeId, FxBuildHasher>,
}

pub struct SignalStatistics {
    pub pending_slots: usize,
    pub queue_entries: usize,
    pub queue_capacity: usize,
    pub membership_capacity: usize,
}

impl SlotSignals {
    fn enqueue(&mut self, slot: NodeId) -> bool {
        if !self.members.insert(slot) {
            return false;
        }
        self.queue.push(slot);
        true
    }

    /// Move the current batch out before callbacks can enqueue their next batch.
    fn take(&mut self) -> Vec<f64> {
        let queue = std::mem::take(&mut self.queue);
        let members = std::mem::take(&mut self.members);
        queue
            .into_iter()
            .filter(|slot| members.contains(slot))
            .map(|slot| slot as f64)
            .collect()
    }

    pub(crate) fn release_node(&mut self, node: NodeId) {
        if !self.members.remove(&node) {
            return;
        }
        if self.members.is_empty() {
            self.queue = Vec::new();
            self.members = CompactSet::default();
            return;
        }
        self.members.compact();
        // Released handles are never reused: a tombstone cannot become a fresh queued signal.
        // Compact geometrically, avoiding a full vector shift for every finalizer in a burst.
        if self.queue.len() / 2 > self.members.len() {
            let members = &self.members;
            self.queue.retain(|slot| members.contains(slot));
            compact_vector(&mut self.queue);
        }
    }

    pub(crate) fn validate_metadata(&self, node: NodeId, data: &NodeData) -> Result<()> {
        if self.members.contains(&node) && !is_html_slot(data) {
            return Err(TreeError::NotSlot(node));
        }
        Ok(())
    }

    pub(crate) fn statistics(&self) -> SignalStatistics {
        SignalStatistics {
            pending_slots: self.members.len(),
            queue_entries: self.queue.len(),
            queue_capacity: self.queue.capacity(),
            membership_capacity: self.members.capacity(),
        }
    }
}

impl TreeStore {
    /// Validate before accepting a signal; repeated pending slots retain their original position.
    pub fn queue_slot_signal(&mut self, slot: f64) -> Result<bool> {
        let slot = node_id(slot)?;
        self.links(slot)?;
        if !self.data.get(&slot).is_some_and(is_html_slot) {
            return Err(TreeError::NotSlot(slot));
        }
        Ok(self.slot_signals.enqueue(slot))
    }

    pub fn take_slot_signals(&mut self) -> Vec<f64> {
        self.slot_signals.take()
    }
}

#[cfg(test)]
mod tests {
    use super::super::{constants::HTML_NAMESPACE, data::DomString};
    use super::*;

    fn slot(tree: &mut TreeStore) -> f64 {
        let node = tree.allocate().unwrap();
        tree.replace_data(
            node,
            NodeData {
                kind: 1,
                name: Some(DomString::Text("slot".into())),
                namespace: Some(DomString::Text(HTML_NAMESPACE.into())),
                ..NodeData::default()
            },
        )
        .unwrap();
        node
    }

    #[test]
    fn should_deduplicate_in_first_signal_order_and_separate_reentrant_batches() {
        let mut tree = TreeStore::new();
        let first = slot(&mut tree);
        let second = slot(&mut tree);
        assert!(tree.queue_slot_signal(first).unwrap());
        assert!(tree.queue_slot_signal(second).unwrap());
        assert!(!tree.queue_slot_signal(first).unwrap());
        assert_eq!(tree.slot_signals.statistics().pending_slots, 2);
        let previous = tree.take_slot_signals();
        assert_eq!(previous, [first, second]);
        assert_eq!(tree.slot_signals.statistics().queue_capacity, 0);
        assert_eq!(tree.slot_signals.statistics().membership_capacity, 0);
        assert!(tree.queue_slot_signal(second).unwrap());
        assert!(tree.queue_slot_signal(first).unwrap());
        assert_eq!(tree.take_slot_signals(), [second, first]);
        assert_eq!(previous, [first, second]);
        assert!(tree.take_slot_signals().is_empty());
    }

    #[test]
    fn should_reject_invalid_roles_and_handles_without_accepting_partial_state() {
        let mut tree = TreeStore::new();
        let queued = slot(&mut tree);
        let comment = tree.allocate().unwrap();
        tree.set_data(comment, r#"{"kind":8}"#).unwrap();
        let foreign = tree.allocate().unwrap();
        tree.set_data(
            foreign,
            r#"{"kind":1,"name":"slot","namespace":"urn:foreign"}"#,
        )
        .unwrap();
        let reserved = tree.reserve_handles().unwrap();
        tree.queue_slot_signal(queued).unwrap();
        let before = tree.statistics();
        for invalid in [
            0.0,
            -1.0,
            0.5,
            f64::NAN,
            f64::INFINITY,
            comment,
            foreign,
            reserved,
        ] {
            assert!(tree.queue_slot_signal(invalid).is_err());
        }
        assert!(tree.set_data(queued, r#"{"kind":1,"name":"div"}"#).is_err());
        assert_eq!(tree.slot_signals.statistics().pending_slots, 1);
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().data_updates, before.data_updates);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        assert_eq!(tree.take_slot_signals(), [queued]);
        tree.set_data(queued, r#"{"kind":1,"name":"div"}"#).unwrap();
    }

    #[test]
    fn should_discard_finalized_slots_and_reclaim_burst_capacity_with_a_live_slot_remaining() {
        let mut tree = TreeStore::new();
        let slots = (0..2000).map(|_| slot(&mut tree)).collect::<Vec<_>>();
        for &slot in &slots {
            tree.queue_slot_signal(slot).unwrap();
        }
        assert!(tree.slot_signals.statistics().queue_capacity >= slots.len());
        for &slot in &slots[..slots.len() - 1] {
            tree.release(slot).unwrap();
        }
        let sparse = tree.slot_signals.statistics();
        assert_eq!(sparse.pending_slots, 1);
        assert!(sparse.queue_entries <= 3);
        assert!(sparse.queue_capacity <= 64);
        assert!(sparse.membership_capacity <= 64);
        assert_eq!(tree.take_slot_signals(), [slots[slots.len() - 1]]);
        assert_eq!(tree.statistics().live_nodes, 1.0);
        tree.queue_slot_signal(slots[slots.len() - 1]).unwrap();
        tree.release(slots[slots.len() - 1]).unwrap();
        let empty = tree.slot_signals.statistics();
        assert_eq!(
            (
                empty.pending_slots,
                empty.queue_entries,
                empty.queue_capacity,
                empty.membership_capacity
            ),
            (0, 0, 0, 0)
        );
    }

    #[test]
    fn should_reuse_live_slots_across_many_independent_drains_without_retaining_buffers() {
        let mut tree = TreeStore::new();
        let queued = slot(&mut tree);
        for _ in 0..1000 {
            assert!(tree.queue_slot_signal(queued).unwrap());
            assert!(!tree.queue_slot_signal(queued).unwrap());
            assert_eq!(tree.take_slot_signals(), [queued]);
            let state = tree.slot_signals.statistics();
            assert_eq!(
                (
                    state.pending_slots,
                    state.queue_entries,
                    state.queue_capacity,
                    state.membership_capacity
                ),
                (0, 0, 0, 0)
            );
        }
        assert_eq!(tree.statistics().live_nodes, 1.0);
    }
}
