//! Ordered Attr collections, qualified-name caches and ownership without JavaScript references.
use super::store::NodeId;
use rustc_hash::{FxHashMap, FxHashSet};
use std::collections::HashMap;

#[derive(Default)]
pub struct AttributeIndex {
    pub ordered: Vec<NodeId>,
    pub names: HashMap<Vec<u16>, Vec<NodeId>>,
    references: FxHashMap<NodeId, usize>,
}

impl AttributeIndex {
    fn retain(&mut self, id: NodeId) {
        *self.references.entry(id).or_default() += 1;
    }
    fn release(&mut self, id: NodeId) {
        let count = self
            .references
            .get_mut(&id)
            .expect("retained Attr reference");
        *count -= 1;
        if *count == 0 {
            self.references.remove(&id);
        }
    }
}

#[derive(Default)]
pub struct AttributeCollections {
    pub elements: FxHashMap<NodeId, AttributeIndex>,
    pub owners: FxHashMap<NodeId, NodeId>,
    holders: FxHashMap<NodeId, FxHashSet<NodeId>>,
    // Constructor-only owner links are not collection references.
    loose_owners: FxHashMap<NodeId, FxHashSet<NodeId>>,
}

/// Only GC-visible references change in the host; ordering and lookup decisions stay native.
#[derive(Default)]
pub struct AttributeDelta {
    pub previous: NodeId,
    pub changed: bool,
    pub attached: NodeId,
    pub detached: NodeId,
    pub released: Vec<NodeId>,
}

impl AttributeCollections {
    pub fn holder_count(&self) -> usize {
        self.holders.values().map(FxHashSet::len).sum()
    }
    pub fn set_initial_owner(&mut self, attribute: NodeId, element: NodeId) {
        self.owners.insert(attribute, element);
        self.loose_owners
            .entry(element)
            .or_default()
            .insert(attribute);
    }
    fn remove_loose_owner(&mut self, attribute: NodeId, element: NodeId) {
        if let Some(attributes) = self.loose_owners.get_mut(&element) {
            attributes.remove(&attribute);
            if attributes.is_empty() {
                self.loose_owners.remove(&element);
            }
        }
    }
    pub fn has_references(&self, id: NodeId) -> bool {
        self.holders.contains_key(&id) || self.owners.contains_key(&id)
    }
    pub fn initialize(&mut self, element: NodeId) {
        self.elements.entry(element).or_default();
    }

    fn finish(&mut self, element: NodeId, touched: &[NodeId]) -> Vec<NodeId> {
        let mut released = Vec::new();
        let mut seen = FxHashSet::default();
        for &id in touched {
            if !seen.insert(id) {
                continue;
            }
            if self.elements[&element].references.contains_key(&id) {
                self.holders.entry(id).or_default().insert(element);
            } else {
                if let Some(holders) = self.holders.get_mut(&id) {
                    holders.remove(&element);
                    if holders.is_empty() {
                        self.holders.remove(&id);
                    }
                }
                released.push(id);
            }
        }
        released
    }

    pub fn append(&mut self, element: NodeId, attribute: NodeId, name: Vec<u16>) -> AttributeDelta {
        self.remove_loose_owner(attribute, element);
        let index = self
            .elements
            .get_mut(&element)
            .expect("initialized element");
        index.ordered.push(attribute);
        index.names.entry(name).or_default().push(attribute);
        index.retain(attribute);
        index.retain(attribute);
        self.owners.insert(attribute, element);
        let released = self.finish(element, &[attribute]);
        AttributeDelta {
            changed: true,
            attached: attribute,
            released,
            ..AttributeDelta::default()
        }
    }

    pub fn remove(&mut self, element: NodeId, attribute: NodeId, name: &[u16]) -> AttributeDelta {
        let index = self
            .elements
            .get_mut(&element)
            .expect("initialized element");
        let Some(position) = index.ordered.iter().position(|&id| id == attribute) else {
            return AttributeDelta::default();
        };
        index.ordered.remove(position);
        index.release(attribute);
        let mut evicted = None;
        if let Some(entry) = index.names.get_mut(name) {
            if !entry.is_empty() {
                // Preserve pinned jsdom's Array.splice(indexOf(...), 1) behavior.
                let position = entry
                    .iter()
                    .position(|&id| id == attribute)
                    .unwrap_or(entry.len() - 1);
                evicted = Some(entry.remove(position));
            }
            if entry.is_empty() {
                index.names.remove(name);
            }
        }
        if let Some(id) = evicted {
            index.release(id);
        }
        self.owners.remove(&attribute);
        let released = self.finish(element, &[attribute, evicted.unwrap_or(attribute)]);
        AttributeDelta {
            changed: true,
            detached: attribute,
            released,
            ..AttributeDelta::default()
        }
    }

    pub fn replace(
        &mut self,
        element: NodeId,
        old: NodeId,
        new: NodeId,
        new_name: Vec<u16>,
    ) -> AttributeDelta {
        let index = self
            .elements
            .get_mut(&element)
            .expect("initialized element");
        let Some(position) = index.ordered.iter().position(|&id| id == old) else {
            return AttributeDelta::default();
        };
        index.ordered[position] = new;
        index.release(old);
        index.retain(new);
        let entry = index.names.entry(new_name).or_default();
        let position = entry
            .iter()
            .position(|&id| id == old)
            .unwrap_or(entry.len().saturating_sub(1));
        let evicted = if position < entry.len() {
            Some(entry.remove(position))
        } else {
            None
        };
        entry.insert(position, new);
        // A different old qualified-name entry intentionally remains, matching jsdom 27.
        if let Some(id) = evicted {
            index.release(id);
        }
        index.retain(new);
        self.owners.remove(&old);
        self.remove_loose_owner(new, element);
        self.owners.insert(new, element);
        let released = self.finish(element, &[old, new, evicted.unwrap_or(new)]);
        AttributeDelta {
            previous: old,
            changed: true,
            attached: new,
            detached: old,
            released,
        }
    }

    /// Remove every reference to a collected node, regardless of finalizer ordering.
    pub fn release_node(&mut self, id: NodeId, name: Option<&[u16]>) -> Vec<NodeId> {
        if let Some(attributes) = self.loose_owners.remove(&id) {
            for attribute in attributes {
                if self.owners.get(&attribute) == Some(&id) {
                    self.owners.remove(&attribute);
                }
            }
        }
        if let Some(index) = self.elements.remove(&id) {
            for attribute in index.ordered {
                if self.owners.get(&attribute) == Some(&id) {
                    self.owners.remove(&attribute);
                }
            }
            for attribute in index.references.keys() {
                if let Some(holders) = self.holders.get_mut(attribute) {
                    holders.remove(&id);
                    if holders.is_empty() {
                        self.holders.remove(attribute);
                    }
                }
            }
        }
        if let Some(owner) = self.owners.remove(&id) {
            self.remove_loose_owner(id, owner);
        }
        let affected: Vec<_> = self
            .holders
            .remove(&id)
            .unwrap_or_default()
            .into_iter()
            .collect();
        for element in &affected {
            let index = self
                .elements
                .get_mut(element)
                .expect("existing Attr holder");
            index.ordered.retain(|&attribute| attribute != id);
            if let Some(name) = name
                && let Some(entry) = index.names.get_mut(name)
            {
                entry.retain(|&attribute| attribute != id);
                if entry.is_empty() {
                    index.names.remove(name);
                }
            }
            index.references.remove(&id);
        }
        if self.elements.is_empty() {
            self.elements.shrink_to_fit();
        }
        if self.owners.is_empty() {
            self.owners.shrink_to_fit();
        }
        if self.holders.is_empty() {
            self.holders.shrink_to_fit();
        }
        if self.loose_owners.is_empty() {
            self.loose_owners.shrink_to_fit();
        }
        affected
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn name(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }
    #[test]
    fn should_keep_legacy_aliases_without_retaining_unreferenced_attributes() {
        let mut collections = AttributeCollections::default();
        collections.initialize(1);
        collections.append(1, 2, name("p:key"));
        let change = collections.replace(1, 2, 3, name("q:key"));
        assert!(change.released.is_empty());
        assert_eq!(collections.elements[&1].ordered, vec![3]);
        assert_eq!(collections.elements[&1].names[&name("p:key")], vec![2]);
        let change = collections.remove(1, 3, &name("q:key"));
        assert_eq!(change.released, vec![3]);
        assert_eq!(collections.owners.get(&2), None);
        collections.release_node(2, Some(&name("p:key")));
        assert!(collections.elements[&1].names.is_empty());
        collections.release_node(1, None);
        assert!(collections.holders.is_empty());
    }
    #[test]
    fn should_release_references_when_elements_finalize_before_attributes() {
        let mut collections = AttributeCollections::default();
        collections.initialize(1);
        collections.append(1, 2, name("same"));
        collections.append(1, 3, name("same"));
        collections.release_node(1, None);
        assert!(collections.owners.is_empty());
        assert!(collections.holders.is_empty());
        assert!(collections.release_node(2, Some(&name("same"))).is_empty());
    }
}
