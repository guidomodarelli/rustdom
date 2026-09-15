//! Native observer/slot delivery control; effects run only after each step returns to JavaScript.
use super::{
    error::{Result, TreeError},
    slots::is_html_slot,
    store::{TreeStore, node_id},
};
use std::{
    sync::{Arc, Weak},
    vec::IntoIter,
};

pub enum DeliveryAction {
    Observer { observer: f64, records: Vec<f64> },
    Slot(f64),
    Complete,
}

pub struct DeliveryDriver {
    forest: Weak<()>,
    observers: IntoIter<f64>,
    slots: IntoIter<f64>,
    complete: bool,
    cancelled: bool,
}

impl Default for DeliveryDriver {
    fn default() -> Self {
        Self {
            forest: Weak::new(),
            observers: Vec::new().into_iter(),
            slots: Vec::new().into_iter(),
            complete: true,
            cancelled: false,
        }
    }
}

impl DeliveryDriver {
    pub fn complete(&self) -> bool {
        self.complete
    }
    pub fn remaining_observers(&self) -> usize {
        self.observers.len()
    }
    pub fn remaining_slots(&self) -> usize {
        self.slots.len()
    }

    pub fn cancel(&mut self) {
        self.observers = Vec::new().into_iter();
        self.slots = Vec::new().into_iter();
        self.forest = Weak::new();
        if !self.complete {
            self.cancelled = true;
        }
    }

    fn finish_if_exhausted(&mut self) {
        if self.observers.len() == 0 && self.slots.len() == 0 {
            self.complete = true;
            self.cancel();
        }
    }

    pub fn step(&mut self, tree: &mut TreeStore) -> Result<DeliveryAction> {
        if self.cancelled {
            return Err(TreeError::ObserverDeliveryProtocol(
                "cannot resume a cancelled or failed delivery",
            ));
        }
        if self.complete {
            return Ok(DeliveryAction::Complete);
        }
        let result = self.advance(tree);
        if result.is_err() {
            self.cancel();
        }
        result
    }

    fn advance(&mut self, tree: &mut TreeStore) -> Result<DeliveryAction> {
        let forest = self
            .forest
            .upgrade()
            .ok_or(TreeError::ObserverDeliveryProtocol(
                "originating native forest was released",
            ))?;
        if !Arc::ptr_eq(&forest, &tree.delivery_identity) {
            return Err(TreeError::ObserverDeliveryProtocol(
                "cannot advance a batch with a different native forest",
            ));
        }
        while let Some(observer) = self.observers.next() {
            let records = tree.observer_registry.take_records(observer)?;
            if !records.is_empty() {
                self.finish_if_exhausted();
                return Ok(DeliveryAction::Observer { observer, records });
            }
        }
        if let Some(slot) = self.slots.next() {
            let id = node_id(slot)?;
            tree.links(id)?;
            if !tree.data.get(&id).is_some_and(is_html_slot) {
                return Err(TreeError::NotSlot(id));
            }
            self.finish_if_exhausted();
            return Ok(DeliveryAction::Slot(slot));
        }
        self.finish_if_exhausted();
        Ok(DeliveryAction::Complete)
    }
}

impl TreeStore {
    /// Capture membership now, but leave individual record queues untouched until their observer step.
    pub fn start_observer_delivery(&mut self) -> DeliveryDriver {
        let observers = self.observer_registry.notifications.begin();
        let slots = self.take_slot_signals();
        let complete = observers.is_empty() && slots.is_empty();
        DeliveryDriver {
            forest: Arc::downgrade(&self.delivery_identity),
            observers: observers.into_iter(),
            slots: slots.into_iter(),
            complete,
            cancelled: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dom::{
        constants::HTML_NAMESPACE,
        data::{DomString, NodeData},
        mutation_record::{MutationRecordDraft, MutationRecordState},
    };

    fn payload(tree: &TreeStore, target: f64) -> Arc<MutationRecordState> {
        Arc::new(
            tree.mutation_record(MutationRecordDraft {
                kind: "childList".into(),
                target,
                previous_sibling: 0.0,
                next_sibling: 0.0,
                attribute_name: None,
                attribute_namespace: None,
                old_value: None,
                added_nodes: vec![],
                removed_nodes: vec![],
            })
            .unwrap(),
        )
    }
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
    fn should_drain_each_observer_at_its_turn_and_keep_new_batches_separate_from_captured_slots() {
        let mut tree = TreeStore::new();
        let target = tree.allocate().unwrap();
        let first = tree.observer_registry.allocate().unwrap();
        let second = tree.observer_registry.allocate().unwrap();
        let first_slot = slot(&mut tree);
        let second_slot = slot(&mut tree);
        let record = payload(&tree, target);
        let second_original = tree
            .observer_registry
            .enqueue_record(second, Arc::clone(&record))
            .unwrap();
        let first_original = tree
            .observer_registry
            .enqueue_record(first, Arc::clone(&record))
            .unwrap();
        tree.queue_slot_signal(second_slot).unwrap();
        tree.queue_slot_signal(first_slot).unwrap();
        tree.observer_registry.notifications.request_microtask();
        let mut driver = tree.start_observer_delivery();
        assert_eq!(tree.slot_signals.statistics().pending_slots, 0);
        assert!(
            !tree
                .observer_registry
                .notifications
                .statistics()
                .microtask_queued
        );
        assert!(
            matches!(driver.step(&mut tree).unwrap(), DeliveryAction::Observer { observer, records } if observer == first && records == [first_original])
        );
        let second_new = tree
            .observer_registry
            .enqueue_record(second, Arc::clone(&record))
            .unwrap();
        let first_new = tree
            .observer_registry
            .enqueue_record(first, Arc::clone(&record))
            .unwrap();
        assert!(
            matches!(driver.step(&mut tree).unwrap(), DeliveryAction::Observer { observer, records } if observer == second && records == [second_original, second_new])
        );
        assert!(
            matches!(driver.step(&mut tree).unwrap(), DeliveryAction::Slot(node) if node == second_slot)
        );
        tree.queue_slot_signal(second_slot).unwrap();
        assert!(
            matches!(driver.step(&mut tree).unwrap(), DeliveryAction::Slot(node) if node == first_slot)
        );
        assert!(driver.complete());
        assert_eq!(driver.remaining_observers(), 0);
        assert_eq!(driver.remaining_slots(), 0);
        let mut next = tree.start_observer_delivery();
        assert!(
            matches!(next.step(&mut tree).unwrap(), DeliveryAction::Observer { observer, records } if observer == first && records == [first_new])
        );
        assert!(
            matches!(next.step(&mut tree).unwrap(), DeliveryAction::Slot(node) if node == second_slot)
        );
        assert!(next.complete());
        assert!(matches!(
            next.step(&mut tree).unwrap(),
            DeliveryAction::Complete
        ));
    }

    #[test]
    fn should_cancel_buffers_without_discarding_unvisited_record_queues() {
        let mut tree = TreeStore::new();
        let target = tree.allocate().unwrap();
        let first = tree.observer_registry.allocate().unwrap();
        let second = tree.observer_registry.allocate().unwrap();
        let record = payload(&tree, target);
        tree.observer_registry
            .enqueue_record(first, Arc::clone(&record))
            .unwrap();
        let pending = tree
            .observer_registry
            .enqueue_record(second, record)
            .unwrap();
        let mut driver = tree.start_observer_delivery();
        assert!(
            matches!(driver.step(&mut tree).unwrap(), DeliveryAction::Observer { observer, .. } if observer == first)
        );
        driver.cancel();
        assert_eq!(driver.remaining_observers(), 0);
        assert_eq!(driver.remaining_slots(), 0);
        assert!(driver.step(&mut tree).is_err());
        assert_eq!(
            tree.observer_registry.take_records(second).unwrap(),
            [pending]
        );
    }

    #[test]
    fn should_reject_foreign_forests_without_consuming_their_queues_or_retaining_the_origin() {
        let mut origin = TreeStore::new();
        let target = origin.allocate().unwrap();
        let observer = origin.observer_registry.allocate().unwrap();
        origin
            .observer_registry
            .enqueue_record(observer, payload(&origin, target))
            .unwrap();
        let mut driver = origin.start_observer_delivery();
        let mut foreign = TreeStore::new();
        let foreign_target = foreign.allocate().unwrap();
        let foreign_observer = foreign.observer_registry.allocate().unwrap();
        let token = foreign
            .observer_registry
            .enqueue_record(foreign_observer, payload(&foreign, foreign_target))
            .unwrap();
        assert!(driver.step(&mut foreign).is_err());
        assert_eq!(
            foreign
                .observer_registry
                .take_records(foreign_observer)
                .unwrap(),
            [token]
        );
        let mut pending = origin.start_observer_delivery();
        // Requeue because starting the first batch already consumed active membership.
        origin
            .observer_registry
            .enqueue_record(observer, payload(&origin, target))
            .unwrap();
        pending.cancel();
        pending = origin.start_observer_delivery();
        let identity = Arc::downgrade(&origin.delivery_identity);
        drop(origin);
        assert!(identity.upgrade().is_none());
        assert!(pending.step(&mut foreign).is_err());
        assert_eq!(pending.remaining_observers(), 0);
    }

    #[test]
    fn should_skip_empty_observers_in_one_step_and_cancel_when_a_captured_slot_was_released() {
        let mut tree = TreeStore::new();
        let target = tree.allocate().unwrap();
        let record = payload(&tree, target);
        for _ in 0..1024 {
            let observer = tree.observer_registry.allocate().unwrap();
            tree.observer_registry
                .enqueue_record(observer, Arc::clone(&record))
                .unwrap();
            tree.observer_registry.take_records(observer).unwrap();
        }
        let captured = slot(&mut tree);
        tree.queue_slot_signal(captured).unwrap();
        let mut driver = tree.start_observer_delivery();
        assert!(
            matches!(driver.step(&mut tree).unwrap(), DeliveryAction::Slot(node) if node == captured)
        );
        assert!(driver.complete());
        tree.queue_slot_signal(captured).unwrap();
        let mut stale = tree.start_observer_delivery();
        tree.release(captured).unwrap();
        assert!(stale.step(&mut tree).is_err());
        assert_eq!(stale.remaining_slots(), 0);
    }
}
