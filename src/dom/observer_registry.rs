//! Native observer registrations and ancestor selection; JavaScript retains only GC ownership edges.
use super::{
    compact_storage::{CompactMap, CompactSet, compact_vector},
    data::DomString,
    error::{Result, TreeError},
    mutation_record::MutationKind,
    store::{NodeId, TreeStore, node_id},
};
use napi_derive::napi;
use rustc_hash::{FxBuildHasher, FxHashMap};

#[derive(Default)]
pub struct ObserverOptionsInput {
    pub attributes: Option<bool>,
    pub character_data: Option<bool>,
    pub child_list: bool,
    pub subtree: bool,
    pub attribute_old_value: Option<bool>,
    pub character_data_old_value: Option<bool>,
    pub attribute_filter: Option<Vec<DomString>>,
}

/// Domain rejection codes are converted to the pinned host TypeError by the JavaScript binding.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[napi]
pub enum ObservationStatus {
    Added = 0,
    Replaced = 1,
    MissingMutationKind = 2,
    AttributeOldValueWithoutAttributes = 3,
    AttributeFilterWithoutAttributes = 4,
    CharacterOldValueWithoutCharacterData = 5,
}

struct ObserverOptions {
    attributes: bool,
    character_data: bool,
    child_list: bool,
    subtree: bool,
    attribute_old_value: bool,
    character_data_old_value: bool,
    attribute_filter: Option<Vec<DomString>>,
}

impl ObserverOptions {
    fn normalize(input: ObserverOptionsInput) -> std::result::Result<Self, ObservationStatus> {
        let attributes = input
            .attributes
            .unwrap_or(input.attribute_old_value.is_some() || input.attribute_filter.is_some());
        let character_data = input
            .character_data
            .unwrap_or(input.character_data_old_value.is_some());
        if !attributes && !character_data && !input.child_list {
            return Err(ObservationStatus::MissingMutationKind);
        }
        if input.attribute_old_value == Some(true) && !attributes {
            return Err(ObservationStatus::AttributeOldValueWithoutAttributes);
        }
        if input.attribute_filter.is_some() && !attributes {
            return Err(ObservationStatus::AttributeFilterWithoutAttributes);
        }
        if input.character_data_old_value == Some(true) && !character_data {
            return Err(ObservationStatus::CharacterOldValueWithoutCharacterData);
        }
        Ok(Self {
            attributes,
            character_data,
            child_list: input.child_list,
            subtree: input.subtree,
            attribute_old_value: input.attribute_old_value.unwrap_or(false),
            character_data_old_value: input.character_data_old_value.unwrap_or(false),
            attribute_filter: input.attribute_filter,
        })
    }

    fn matches(
        &self,
        descendant: bool,
        kind: MutationKind,
        name: Option<&DomString>,
        namespace: Option<&DomString>,
    ) -> bool {
        if descendant && !self.subtree {
            return false;
        }
        match kind {
            MutationKind::Attributes => {
                self.attributes
                    && self.attribute_filter.as_ref().is_none_or(|filter| {
                        // Preserve jsdom's name OR namespace comparison, including UTF-16 and empty filters.
                        filter.iter().any(|value| {
                            name.is_some_and(|name| value.units().eq(name.units()))
                                || namespace
                                    .is_some_and(|namespace| value.units().eq(namespace.units()))
                        })
                    })
            }
            MutationKind::CharacterData => self.character_data,
            MutationKind::ChildList => self.child_list,
        }
    }

    fn captures_old_value(&self, kind: MutationKind) -> bool {
        match kind {
            MutationKind::Attributes => self.attribute_old_value,
            MutationKind::CharacterData => self.character_data_old_value,
            MutationKind::ChildList => false,
        }
    }
}

struct Registration {
    observer: u64,
    options: ObserverOptions,
}

#[derive(Default)]
pub(crate) struct ObserverRegistry {
    observers: CompactMap<u64, CompactSet<NodeId, FxBuildHasher>, FxBuildHasher>,
    nodes: CompactMap<NodeId, Vec<Registration>, FxBuildHasher>,
    next_id: u64,
}

#[derive(Debug, PartialEq, Eq)]
pub struct ObserverInterest {
    pub observer: u64,
    pub old_value: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub struct ObserverRegistryStatistics {
    pub observers: usize,
    pub observed_nodes: usize,
    pub registrations: usize,
    pub observer_capacity: usize,
    pub node_capacity: usize,
    pub registration_capacity: usize,
    pub target_capacity: usize,
}

impl ObserverRegistry {
    fn compact(&mut self) {
        self.observers.compact();
        self.nodes.compact();
        if self.observers.is_empty() {
            self.observers.shrink_to_fit();
        }
        if self.nodes.is_empty() {
            self.nodes.shrink_to_fit();
        }
    }

    fn validate_observer(&self, handle: f64) -> Result<u64> {
        let observer = node_id(handle)?;
        if !self.observers.contains_key(&observer) {
            return Err(TreeError::UnknownMutationObserver(observer));
        }
        Ok(observer)
    }

    pub fn allocate(&mut self) -> Result<f64> {
        let observer = node_id(self.next_id as f64 + 1.0)
            .map_err(|_| TreeError::MutationObserverIdsExhausted)?;
        self.next_id = observer;
        self.observers.insert(observer, CompactSet::default());
        Ok(observer as f64)
    }

    fn register(
        &mut self,
        observer: u64,
        node: NodeId,
        options: ObserverOptions,
    ) -> ObservationStatus {
        let registrations = self.nodes.entry(node).or_default();
        if let Some(existing) = registrations
            .iter_mut()
            .find(|entry| entry.observer == observer)
        {
            existing.options = options;
            return ObservationStatus::Replaced;
        }
        registrations.push(Registration { observer, options });
        self.observers
            .get_mut(&observer)
            .expect("validated observer")
            .insert(node);
        ObservationStatus::Added
    }

    pub fn disconnect(&mut self, handle: f64) -> Result<Vec<f64>> {
        let observer = self.validate_observer(handle)?;
        let targets = std::mem::take(
            self.observers
                .get_mut(&observer)
                .expect("validated observer"),
        );
        let mut removed = Vec::with_capacity(targets.len());
        for &node in targets.iter() {
            let registrations = self.nodes.get_mut(&node).expect("registered target");
            registrations.retain(|entry| entry.observer != observer);
            compact_vector(registrations);
            if registrations.is_empty() {
                self.nodes.remove(&node);
            }
            removed.push(node as f64);
        }
        self.compact();
        Ok(removed)
    }

    /// Finalizers can arrive in either order; repeated observer cleanup is harmless.
    pub fn release(&mut self, handle: f64) -> Result<bool> {
        let observer = node_id(handle)?;
        if !self.observers.contains_key(&observer) {
            return Ok(false);
        }
        self.disconnect(handle)?;
        self.observers.remove(&observer);
        self.compact();
        Ok(true)
    }

    pub(crate) fn release_node(&mut self, node: NodeId) {
        if let Some(registrations) = self.nodes.remove(&node) {
            for registration in registrations {
                let targets = self
                    .observers
                    .get_mut(&registration.observer)
                    .expect("registered observer");
                targets.remove(&node);
                targets.compact();
                if targets.is_empty() {
                    targets.shrink_to_fit();
                }
            }
            self.compact();
        }
    }

    pub fn statistics(&self) -> ObserverRegistryStatistics {
        ObserverRegistryStatistics {
            observers: self.observers.len(),
            observed_nodes: self.nodes.len(),
            registrations: self.nodes.values().map(Vec::len).sum(),
            observer_capacity: self.observers.capacity(),
            node_capacity: self.nodes.capacity(),
            registration_capacity: self.nodes.values().map(Vec::capacity).sum(),
            target_capacity: self
                .observers
                .values()
                .map(|targets| targets.capacity())
                .sum(),
        }
    }
}

impl TreeStore {
    /// Reject invalid options before touching the target or replacing an existing registration.
    pub fn observe_mutations(
        &mut self,
        observer: f64,
        target: f64,
        input: ObserverOptionsInput,
    ) -> Result<ObservationStatus> {
        let observer = self.observer_registry.validate_observer(observer)?;
        let options = match ObserverOptions::normalize(input) {
            Ok(options) => options,
            Err(status) => return Ok(status),
        };
        let target = node_id(target)?;
        self.validate_activation(target)?;
        self.activate(target)?;
        Ok(self.observer_registry.register(observer, target, options))
    }

    /// Select each observer once in first-match order and OR old-value requests across matching ancestors.
    pub fn interested_mutation_observers(
        &self,
        target: f64,
        kind: MutationKind,
        name: Option<&DomString>,
        namespace: Option<&DomString>,
    ) -> Result<Vec<ObserverInterest>> {
        let target = node_id(target)?;
        self.links(target)?;
        let mut interests: Vec<ObserverInterest> = Vec::new();
        if self.observer_registry.nodes.is_empty() {
            return Ok(interests);
        }
        let mut positions: FxHashMap<u64, usize> = FxHashMap::default();
        let mut node = target;
        while node != 0 {
            if let Some(registrations) = self.observer_registry.nodes.get(&node) {
                for registration in registrations {
                    if registration
                        .options
                        .matches(node != target, kind, name, namespace)
                    {
                        let capture = registration.options.captures_old_value(kind);
                        if let Some(&index) = positions.get(&registration.observer) {
                            interests[index].old_value |= capture;
                        } else {
                            positions.insert(registration.observer, interests.len());
                            interests.push(ObserverInterest {
                                observer: registration.observer,
                                old_value: capture,
                            });
                        }
                    }
                }
            }
            node = self.links(node)?.parent;
        }
        Ok(interests)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn attributes(old_value: bool, subtree: bool) -> ObserverOptionsInput {
        ObserverOptionsInput {
            attributes: Some(true),
            attribute_old_value: Some(old_value),
            subtree,
            ..ObserverOptionsInput::default()
        }
    }

    #[test]
    fn should_normalize_present_false_options_and_reject_invalid_replacements_without_activation() {
        let mut tree = TreeStore::new();
        let observer = tree.observer_registry.allocate().unwrap();
        let target = tree.allocate().unwrap();
        let reserved = tree.reserve_handles().unwrap();
        assert_eq!(
            tree.observe_mutations(
                observer,
                target,
                ObserverOptionsInput {
                    attribute_old_value: Some(false),
                    ..ObserverOptionsInput::default()
                }
            )
            .unwrap(),
            ObservationStatus::Added
        );
        let before = tree.observer_registry.statistics();
        let before_reserved = tree.statistics().reserved_handles;
        for (input, expected) in [
            (
                ObserverOptionsInput::default(),
                ObservationStatus::MissingMutationKind,
            ),
            (
                ObserverOptionsInput {
                    attributes: Some(false),
                    attribute_old_value: Some(true),
                    child_list: true,
                    ..ObserverOptionsInput::default()
                },
                ObservationStatus::AttributeOldValueWithoutAttributes,
            ),
            (
                ObserverOptionsInput {
                    attributes: Some(false),
                    attribute_filter: Some(vec![]),
                    child_list: true,
                    ..ObserverOptionsInput::default()
                },
                ObservationStatus::AttributeFilterWithoutAttributes,
            ),
            (
                ObserverOptionsInput {
                    character_data: Some(false),
                    character_data_old_value: Some(true),
                    child_list: true,
                    ..ObserverOptionsInput::default()
                },
                ObservationStatus::CharacterOldValueWithoutCharacterData,
            ),
        ] {
            assert_eq!(
                tree.observe_mutations(observer, reserved, input).unwrap(),
                expected
            );
        }
        assert_eq!(tree.observer_registry.statistics(), before);
        assert_eq!(tree.statistics().reserved_handles, before_reserved);
        assert_eq!(
            tree.interested_mutation_observers(target, MutationKind::Attributes, None, None)
                .unwrap(),
            vec![ObserverInterest {
                observer: observer as u64,
                old_value: false
            }]
        );
        assert_eq!(
            tree.observe_mutations(
                observer,
                target,
                ObserverOptionsInput {
                    character_data_old_value: Some(false),
                    ..ObserverOptionsInput::default()
                }
            )
            .unwrap(),
            ObservationStatus::Replaced
        );
        assert!(
            tree.interested_mutation_observers(target, MutationKind::Attributes, None, None)
                .unwrap()
                .is_empty()
        );
        assert_eq!(
            tree.interested_mutation_observers(target, MutationKind::CharacterData, None, None)
                .unwrap(),
            vec![ObserverInterest {
                observer: observer as u64,
                old_value: false
            }]
        );
    }

    #[test]
    fn should_select_first_matches_and_merge_old_value_requests_across_current_ancestors() {
        let mut tree = TreeStore::new();
        let ancestor = tree.allocate().unwrap();
        let target = tree.allocate().unwrap();
        let sibling = tree.allocate().unwrap();
        tree.append(ancestor, target).unwrap();
        let first = tree.observer_registry.allocate().unwrap();
        let second = tree.observer_registry.allocate().unwrap();
        tree.observe_mutations(first, ancestor, attributes(true, true))
            .unwrap();
        tree.observe_mutations(second, target, attributes(false, false))
            .unwrap();
        tree.observe_mutations(first, target, attributes(false, false))
            .unwrap();
        assert_eq!(
            tree.interested_mutation_observers(target, MutationKind::Attributes, None, None)
                .unwrap(),
            vec![
                ObserverInterest {
                    observer: second as u64,
                    old_value: false
                },
                ObserverInterest {
                    observer: first as u64,
                    old_value: true
                },
            ]
        );
        tree.remove(target).unwrap();
        tree.append(sibling, target).unwrap();
        assert_eq!(
            tree.interested_mutation_observers(target, MutationKind::Attributes, None, None)
                .unwrap(),
            vec![
                ObserverInterest {
                    observer: second as u64,
                    old_value: false
                },
                ObserverInterest {
                    observer: first as u64,
                    old_value: false
                },
            ]
        );
        tree.observer_registry.disconnect(first).unwrap();
        assert_eq!(
            tree.interested_mutation_observers(target, MutationKind::Attributes, None, None)
                .unwrap(),
            vec![ObserverInterest {
                observer: second as u64,
                old_value: false
            }]
        );
        tree.observe_mutations(first, ancestor, attributes(true, false))
            .unwrap();
        tree.remove(target).unwrap();
        tree.append(ancestor, target).unwrap();
        assert_eq!(
            tree.interested_mutation_observers(target, MutationKind::Attributes, None, None)
                .unwrap()
                .len(),
            1
        );
    }

    #[test]
    fn should_preserve_empty_filters_and_lossless_name_or_namespace_matching() {
        let mut tree = TreeStore::new();
        let target = tree.allocate().unwrap();
        let observer = tree.observer_registry.allocate().unwrap();
        let namespace = DomString::from_units(&[117, 114, 110, 58, 55296]);
        tree.observe_mutations(
            observer,
            target,
            ObserverOptionsInput {
                attribute_filter: Some(vec![namespace.clone(), DomString::Text("flag".into())]),
                ..ObserverOptionsInput::default()
            },
        )
        .unwrap();
        let foreign_name = DomString::Text("other".into());
        assert_eq!(
            tree.interested_mutation_observers(
                target,
                MutationKind::Attributes,
                Some(&foreign_name),
                Some(&namespace)
            )
            .unwrap()
            .len(),
            1
        );
        assert!(
            tree.interested_mutation_observers(
                target,
                MutationKind::Attributes,
                Some(&foreign_name),
                None
            )
            .unwrap()
            .is_empty()
        );
        let utf16_name = DomString::Utf16("flag".encode_utf16().collect());
        assert_eq!(
            tree.interested_mutation_observers(
                target,
                MutationKind::Attributes,
                Some(&utf16_name),
                None
            )
            .unwrap()
            .len(),
            1
        );
        tree.observe_mutations(
            observer,
            target,
            ObserverOptionsInput {
                attribute_filter: Some(vec![]),
                ..ObserverOptionsInput::default()
            },
        )
        .unwrap();
        assert!(
            tree.interested_mutation_observers(
                target,
                MutationKind::Attributes,
                Some(&utf16_name),
                None
            )
            .unwrap()
            .is_empty()
        );
        assert!(
            tree.interested_mutation_observers(target, MutationKind::ChildList, None, None)
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn should_release_both_directions_and_reclaim_capacity_without_reusing_observer_ids() {
        let mut tree = TreeStore::new();
        let mut observers = Vec::new();
        let mut targets = Vec::new();
        for _ in 0..512 {
            let observer = tree.observer_registry.allocate().unwrap();
            let target = tree.allocate().unwrap();
            tree.observe_mutations(observer, target, attributes(false, false))
                .unwrap();
            observers.push(observer);
            targets.push(target);
        }
        assert_eq!(tree.observer_registry.statistics().registrations, 512);
        for (index, (&observer, &target)) in observers.iter().zip(targets.iter()).enumerate() {
            if index % 2 == 0 {
                tree.release(target).unwrap();
            }
            assert!(tree.observer_registry.release(observer).unwrap());
            assert!(!tree.observer_registry.release(observer).unwrap());
            tree.release(target).unwrap();
        }
        assert_eq!(
            tree.observer_registry.statistics(),
            ObserverRegistryStatistics {
                observers: 0,
                observed_nodes: 0,
                registrations: 0,
                observer_capacity: 0,
                node_capacity: 0,
                registration_capacity: 0,
                target_capacity: 0,
            }
        );
        assert!(tree.observer_registry.allocate().unwrap() > *observers.last().unwrap());
    }

    #[test]
    fn should_reject_invalid_handles_and_exhaustion_before_changing_registry_state() {
        let mut tree = TreeStore::new();
        let observer = tree.observer_registry.allocate().unwrap();
        let target = tree.allocate().unwrap();
        let before = tree.observer_registry.statistics();
        for invalid in [0.0, -1.0, 0.5, f64::NAN, f64::INFINITY, 999.0] {
            assert!(
                tree.observe_mutations(invalid, target, attributes(false, false))
                    .is_err()
            );
            assert!(
                tree.observe_mutations(observer, invalid, attributes(false, false))
                    .is_err()
            );
            assert!(
                tree.interested_mutation_observers(invalid, MutationKind::ChildList, None, None)
                    .is_err()
            );
            assert!(tree.observer_registry.disconnect(invalid).is_err());
        }
        assert_eq!(tree.observer_registry.statistics(), before);
        tree.observer_registry.next_id = 9_007_199_254_740_991;
        assert!(matches!(
            tree.observer_registry.allocate(),
            Err(TreeError::MutationObserverIdsExhausted)
        ));
        assert_eq!(tree.observer_registry.statistics(), before);
    }
}
