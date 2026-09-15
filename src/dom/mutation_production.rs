//! Prepare per-observer immutable payloads once per mutation, leaving queue commits to the binding effect order.
use super::{
    error::Result,
    mutation_record::{MutationRecordDraft, MutationRecordState},
    observer_registry::ObserverInterest,
    store::TreeStore,
};
use std::sync::Arc;

pub struct PreparedMutation {
    pub observer: u64,
    pub record: Arc<MutationRecordState>,
}

pub struct MutationBatch {
    pub observers: Vec<f64>,
    pub payload_indices: Vec<u32>,
    pub payloads: Vec<Arc<MutationRecordState>>,
}

/// Preserve observer order while representing each immutable variant once at the binding boundary.
pub fn coalesce_prepared(records: Vec<PreparedMutation>) -> Option<MutationBatch> {
    if records.is_empty() {
        return None;
    }
    let mut batch = MutationBatch {
        observers: Vec::with_capacity(records.len()),
        payload_indices: Vec::with_capacity(records.len()),
        payloads: Vec::new(),
    };
    for record in records {
        let index = match batch
            .payloads
            .iter()
            .position(|payload| Arc::ptr_eq(payload, &record.record))
        {
            Some(index) => index,
            None => {
                batch.payloads.push(record.record);
                batch.payloads.len() - 1
            }
        };
        batch.observers.push(record.observer as f64);
        batch.payload_indices.push(index as u32);
    }
    Some(batch)
}

impl TreeStore {
    /// All matching observers share at most two payloads, differing only in oldValue.
    pub fn prepare_selected_mutations(
        &self,
        draft: MutationRecordDraft,
        interests: Vec<ObserverInterest>,
    ) -> Result<Vec<PreparedMutation>> {
        if interests.is_empty() {
            return Ok(Vec::new());
        }
        let complete = Arc::new(self.mutation_record(draft)?);
        let mut without_old_value = None;
        let mut records = Vec::with_capacity(interests.len());
        for interest in interests {
            let record = if interest.old_value || complete.old_value.is_none() {
                Arc::clone(&complete)
            } else {
                Arc::clone(without_old_value.get_or_insert_with(|| {
                    Arc::new(MutationRecordState {
                        kind: complete.kind,
                        target: complete.target,
                        previous_sibling: complete.previous_sibling,
                        next_sibling: complete.next_sibling,
                        attribute_name: complete.attribute_name.clone(),
                        attribute_namespace: complete.attribute_namespace.clone(),
                        old_value: None,
                        added_nodes: complete.added_nodes.clone(),
                        removed_nodes: complete.removed_nodes.clone(),
                    })
                }))
            };
            records.push(PreparedMutation {
                observer: interest.observer,
                record,
            });
        }
        Ok(records)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dom::data::DomString;

    fn draft(target: f64) -> MutationRecordDraft {
        MutationRecordDraft {
            kind: "attributes".into(),
            target,
            previous_sibling: 0.0,
            next_sibling: 0.0,
            attribute_name: Some(DomString::from_units(&[102, 0, 55296])),
            attribute_namespace: Some(DomString::Text(String::new())),
            old_value: Some(DomString::from_units(&[111, 108, 100, 0, 56320])),
            added_nodes: vec![target, target],
            removed_nodes: vec![],
        }
    }

    #[test]
    fn should_map_observers_to_unique_payloads_without_reordering_or_retaining_empty_batches() {
        let mut tree = TreeStore::new();
        let target = tree.allocate().unwrap();
        let records = tree
            .prepare_selected_mutations(
                draft(target),
                vec![
                    ObserverInterest {
                        observer: 3,
                        old_value: false,
                    },
                    ObserverInterest {
                        observer: 1,
                        old_value: true,
                    },
                    ObserverInterest {
                        observer: 4,
                        old_value: false,
                    },
                    ObserverInterest {
                        observer: 2,
                        old_value: true,
                    },
                ],
            )
            .unwrap();
        let batch = coalesce_prepared(records).unwrap();
        assert_eq!(batch.observers, [3.0, 1.0, 4.0, 2.0]);
        assert_eq!(batch.payload_indices, [0, 1, 0, 1]);
        assert_eq!(batch.payloads.len(), 2);
        assert!(batch.payloads[0].old_value.is_none());
        assert_eq!(
            batch.payloads[1]
                .old_value
                .as_ref()
                .unwrap()
                .units()
                .collect::<Vec<_>>(),
            [111, 108, 100, 0, 56320]
        );
        assert!(coalesce_prepared(Vec::new()).is_none());
    }

    #[test]
    fn should_preserve_order_and_old_value_variants_without_mutating_queues_or_tree() {
        let mut tree = TreeStore::new();
        let target = tree.allocate().unwrap();
        let before = tree.statistics();
        let prepared = tree
            .prepare_selected_mutations(
                draft(target),
                vec![
                    ObserverInterest {
                        observer: 3,
                        old_value: false,
                    },
                    ObserverInterest {
                        observer: 1,
                        old_value: true,
                    },
                    ObserverInterest {
                        observer: 4,
                        old_value: false,
                    },
                    ObserverInterest {
                        observer: 2,
                        old_value: true,
                    },
                ],
            )
            .unwrap();
        assert_eq!(
            prepared
                .iter()
                .map(|record| record.observer)
                .collect::<Vec<_>>(),
            [3, 1, 4, 2]
        );
        assert!(prepared[0].record.old_value.is_none());
        assert_eq!(
            prepared[1]
                .record
                .old_value
                .as_ref()
                .unwrap()
                .units()
                .collect::<Vec<_>>(),
            [111, 108, 100, 0, 56320]
        );
        assert!(Arc::ptr_eq(&prepared[0].record, &prepared[2].record));
        assert!(Arc::ptr_eq(&prepared[1].record, &prepared[3].record));
        assert!(!Arc::ptr_eq(&prepared[0].record, &prepared[1].record));
        assert_eq!(
            &*prepared[0].record.added_nodes,
            [target as u64, target as u64]
        );
        assert_eq!(tree.statistics().mutations, before.mutations);
        assert_eq!(tree.observer_registry.statistics().queued_records, 0);
    }

    #[test]
    fn should_reuse_null_payloads_and_release_the_shared_data_after_all_prepared_records_drop() {
        let mut tree = TreeStore::new();
        let target = tree.allocate().unwrap();
        let mut input = draft(target);
        input.old_value = None;
        let prepared = tree
            .prepare_selected_mutations(
                input,
                vec![
                    ObserverInterest {
                        observer: 1,
                        old_value: true,
                    },
                    ObserverInterest {
                        observer: 2,
                        old_value: false,
                    },
                ],
            )
            .unwrap();
        assert!(Arc::ptr_eq(&prepared[0].record, &prepared[1].record));
        let weak = Arc::downgrade(&prepared[0].record);
        tree.release(target).unwrap();
        assert_eq!(prepared[1].record.target, target as u64);
        drop(prepared);
        assert!(weak.upgrade().is_none());
    }

    #[test]
    fn should_reject_invalid_payload_references_before_producing_any_record() {
        let mut tree = TreeStore::new();
        let target = tree.allocate().unwrap();
        let reserved = tree.reserve_handles().unwrap();
        let mut input = draft(target);
        input.added_nodes.push(reserved);
        let before = tree.statistics();
        assert!(
            tree.prepare_selected_mutations(
                input,
                vec![ObserverInterest {
                    observer: 1,
                    old_value: true
                }]
            )
            .is_err()
        );
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        assert_eq!(tree.observer_registry.statistics().queued_records, 0);
    }
}
