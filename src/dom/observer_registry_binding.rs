//! Owned input/output conversions for the native mutation observer registry.
use super::{
    data::DomString,
    observer_registry::{ObserverOptionsInput, ObserverRegistryStatistics},
};
use napi::bindgen_prelude::Utf16String;
use napi_derive::napi;

#[napi(object)]
pub struct NativeObserverNotificationStatistics {
    pub pending_observers: f64,
    pub capacity: f64,
    pub microtask_queued: bool,
}

#[napi(object)]
pub struct NativeObserverOptionsInput {
    pub attributes: Option<bool>,
    pub character_data: Option<bool>,
    pub child_list: Option<bool>,
    pub subtree: Option<bool>,
    pub attribute_old_value: Option<bool>,
    pub character_data_old_value: Option<bool>,
    pub attribute_filter: Option<Vec<Utf16String>>,
}

impl From<NativeObserverOptionsInput> for ObserverOptionsInput {
    fn from(input: NativeObserverOptionsInput) -> Self {
        Self {
            attributes: input.attributes,
            character_data: input.character_data,
            child_list: input.child_list.unwrap_or(false),
            subtree: input.subtree.unwrap_or(false),
            attribute_old_value: input.attribute_old_value,
            character_data_old_value: input.character_data_old_value,
            attribute_filter: input.attribute_filter.map(|filter| {
                filter
                    .into_iter()
                    .map(|value| DomString::from_units(&value))
                    .collect()
            }),
        }
    }
}

#[napi(object)]
pub struct NativeObserverInterest {
    pub observer: f64,
    pub old_value: bool,
}

#[napi(object)]
pub struct NativeObserverRegistryStatistics {
    pub queued_records: f64,
    pub queue_observers: f64,
    pub queue_capacity: f64,
    pub queue_map_capacity: f64,
    pub observers: f64,
    pub observed_nodes: f64,
    pub registrations: f64,
    pub observer_capacity: f64,
    pub node_capacity: f64,
    pub registration_capacity: f64,
    pub target_capacity: f64,
}

impl From<ObserverRegistryStatistics> for NativeObserverRegistryStatistics {
    fn from(stats: ObserverRegistryStatistics) -> Self {
        Self {
            queued_records: stats.queued_records as f64,
            queue_observers: stats.queue_observers as f64,
            queue_capacity: stats.queue_capacity as f64,
            queue_map_capacity: stats.queue_map_capacity as f64,
            observers: stats.observers as f64,
            observed_nodes: stats.observed_nodes as f64,
            registrations: stats.registrations as f64,
            observer_capacity: stats.observer_capacity as f64,
            node_capacity: stats.node_capacity as f64,
            registration_capacity: stats.registration_capacity as f64,
            target_capacity: stats.target_capacity as f64,
        }
    }
}
