//! Recorded slot backlinks are distinct from fresh assignment queries and cached slot lists.
use super::{
    compact_storage::{CompactMap, CompactSet},
    data::NodeData,
    error::{Result, TreeError},
    slotable_names::supports_slotable_name,
    slots::is_html_slot,
    store::{NodeId, TreeStore, node_id},
};
use rustc_hash::FxBuildHasher;

/// Store only numeric links; the Node binding keeps the corresponding V8 ownership edge.
#[derive(Default)]
pub(crate) struct SlotBacklinks {
    nodes: CompactMap<NodeId, NodeId, FxBuildHasher>,
    owners: CompactMap<NodeId, CompactSet<NodeId, FxBuildHasher>, FxBuildHasher>,
}

pub struct BacklinkStatistics {
    pub assigned_nodes: usize,
    pub slot_owners: usize,
    pub node_capacity: usize,
    pub owner_capacity: usize,
    pub reference_capacity: usize,
}

impl SlotBacklinks {
    fn compact(&mut self) {
        self.nodes.compact();
        self.owners.compact();
        if self.nodes.is_empty() {
            self.nodes.shrink_to_fit();
        }
        if self.owners.is_empty() {
            self.owners.shrink_to_fit();
        }
    }

    fn detach(&mut self, node: NodeId) -> bool {
        let Some(previous) = self.nodes.remove(&node) else {
            return false;
        };
        let members = self.owners.get_mut(&previous).expect("recorded slot owner");
        members.remove(&node);
        members.compact();
        if members.is_empty() {
            self.owners.remove(&previous);
        }
        true
    }

    fn set(&mut self, node: NodeId, slot: Option<NodeId>) {
        if self.nodes.get(&node).copied() == slot {
            return;
        }
        self.detach(node);
        if let Some(slot) = slot {
            self.nodes.insert(node, slot);
            self.owners.entry(slot).or_default().insert(node);
        }
        self.compact();
    }

    /// Finalization clears either direction, including a slot with its own recorded backlink.
    pub(crate) fn release_node(&mut self, node: NodeId) {
        let mut changed = self.detach(node);
        if let Some(members) = self.owners.remove(&node) {
            changed = true;
            for member in members {
                self.nodes.remove(&member);
            }
        }
        if changed {
            self.compact();
        }
    }

    pub(crate) fn validate_metadata(&self, node: NodeId, data: &NodeData) -> Result<()> {
        if self.nodes.contains_key(&node) && !supports_slotable_name(data.kind) {
            return Err(TreeError::NotSlotable(node));
        }
        if self.owners.contains_key(&node) && !is_html_slot(data) {
            return Err(TreeError::NotSlot(node));
        }
        Ok(())
    }

    pub(crate) fn statistics(&self) -> BacklinkStatistics {
        BacklinkStatistics {
            assigned_nodes: self.nodes.len(),
            slot_owners: self.owners.len(),
            node_capacity: self.nodes.capacity(),
            owner_capacity: self.owners.capacity(),
            reference_capacity: self.owners.values().map(|members| members.capacity()).sum(),
        }
    }
}

impl TreeStore {
    /// Read the last recorded link, even when the node was removed or renamed afterward.
    pub fn slot_backlink(&self, node: f64) -> Result<f64> {
        let node = node_id(node)?;
        self.links(node)?;
        Ok(self.slot_backlinks.nodes.get(&node).copied().unwrap_or(0) as f64)
    }

    /// Update only after complete input validation; zero explicitly clears a raw backlink.
    pub fn set_slot_backlink(&mut self, node: f64, slot: f64) -> Result<()> {
        let node = node_id(node)?;
        if !self
            .links(node)?
            .node_kind
            .is_some_and(supports_slotable_name)
        {
            return Err(TreeError::NotSlotable(node));
        }
        let slot = if slot == 0.0 {
            None
        } else {
            let slot = node_id(slot)?;
            self.links(slot)?;
            if !self.data.get(&slot).is_some_and(is_html_slot) {
                return Err(TreeError::NotSlot(slot));
            }
            Some(slot)
        };
        self.slot_backlinks.set(node, slot);
        Ok(())
    }

    /// Select Node's event parent in one native call; subclass-specific rules remain separate.
    pub fn event_parent(&self, node: f64) -> Result<f64> {
        let node = node_id(node)?;
        let links = self.links(node)?;
        Ok(self
            .slot_backlinks
            .nodes
            .get(&node)
            .copied()
            .unwrap_or(links.parent) as f64)
    }
}

#[cfg(test)]
mod tests {
    use super::super::{constants::HTML_NAMESPACE, data::DomString};
    use super::*;

    fn element(tree: &mut TreeStore, name: &str) -> f64 {
        let node = tree.allocate().unwrap();
        tree.replace_data(
            node,
            NodeData {
                kind: 1,
                name: Some(DomString::Text(name.into())),
                namespace: Some(DomString::Text(HTML_NAMESPACE.into())),
                ..NodeData::default()
            },
        )
        .unwrap();
        node
    }

    #[test]
    fn should_preserve_recorded_backlinks_independently_of_topology_names_and_cache() {
        let mut tree = TreeStore::new();
        let parent = element(&mut tree, "div");
        let slot = element(&mut tree, "slot");
        let child = element(&mut tree, "b");
        tree.append(parent, child).unwrap();
        assert_eq!(tree.event_parent(child).unwrap(), parent);
        tree.set_slot_assignment(slot, &[child]).unwrap();
        assert_eq!(tree.slot_backlink(child).unwrap(), 0.0);
        tree.set_slot_backlink(child, slot).unwrap();
        tree.remove(child).unwrap();
        tree.set_slotable_name(child, &[65]).unwrap();
        tree.set_slot_assignment(slot, &[]).unwrap();
        assert_eq!(tree.slot_backlink(child).unwrap(), slot);
        assert_eq!(tree.event_parent(child).unwrap(), slot);
        assert!(tree.cached_slotables(slot).unwrap().is_empty());
        tree.set_slot_backlink(child, 0.0).unwrap();
        assert_eq!(tree.event_parent(child).unwrap(), 0.0);
        tree.append(parent, child).unwrap();
        assert_eq!(tree.event_parent(child).unwrap(), parent);
    }

    #[test]
    fn should_reject_invalid_links_and_metadata_before_modifying_state_or_reservations() {
        let mut tree = TreeStore::new();
        let slot = element(&mut tree, "slot");
        let child = element(&mut tree, "b");
        let comment = tree.allocate().unwrap();
        tree.set_data(comment, r#"{"kind":8}"#).unwrap();
        let foreign = tree.allocate().unwrap();
        tree.set_data(
            foreign,
            r#"{"kind":1,"name":"slot","namespace":"urn:foreign"}"#,
        )
        .unwrap();
        let reserved = tree.reserve_handles().unwrap();
        tree.set_slot_backlink(child, slot).unwrap();
        let before = tree.statistics();
        for invalid in [-1.0, 0.5, f64::NAN, f64::INFINITY, reserved] {
            assert!(tree.set_slot_backlink(child, invalid).is_err());
            assert!(tree.set_slot_backlink(invalid, slot).is_err());
            assert!(tree.slot_backlink(invalid).is_err());
            assert!(tree.event_parent(invalid).is_err());
        }
        assert!(tree.set_slot_backlink(0.0, slot).is_err());
        assert!(tree.set_slot_backlink(comment, slot).is_err());
        assert!(tree.set_slot_backlink(child, foreign).is_err());
        assert!(tree.set_slot_backlink(child, comment).is_err());
        assert!(tree.set_data(child, r#"{"kind":8}"#).is_err());
        assert!(tree.set_data(slot, r#"{"kind":1,"name":"div"}"#).is_err());
        assert_eq!(tree.slot_backlink(child).unwrap(), slot);
        assert_eq!(tree.slot_backlinks.statistics().assigned_nodes, 1);
        assert_eq!(tree.slot_backlinks.statistics().slot_owners, 1);
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        assert_eq!(tree.statistics().data_updates, before.data_updates);
        tree.set_data(child, r#"{"kind":4,"value":"inherited Text"}"#)
            .unwrap();
        assert_eq!(tree.slot_backlink(child).unwrap(), slot);
        assert_eq!(tree.slot_backlink(comment).unwrap(), 0.0);
    }

    #[test]
    fn should_release_shared_and_self_backlinks_in_either_finalization_order() {
        let mut tree = TreeStore::new();
        let first = element(&mut tree, "slot");
        let second = element(&mut tree, "slot");
        let child = element(&mut tree, "b");
        for node in [first, second, child] {
            tree.set_slot_backlink(node, first).unwrap();
        }
        tree.set_slot_backlink(child, second).unwrap();
        tree.release(first).unwrap();
        assert_eq!(tree.slot_backlink(second).unwrap(), 0.0);
        assert_eq!(tree.slot_backlink(child).unwrap(), second);
        tree.release(child).unwrap();
        assert_eq!(tree.slot_backlinks.statistics().assigned_nodes, 0);
        tree.set_slot_backlink(second, second).unwrap();
        tree.release(second).unwrap();
        let stats = tree.slot_backlinks.statistics();
        assert_eq!(
            (
                stats.assigned_nodes,
                stats.slot_owners,
                stats.node_capacity,
                stats.owner_capacity,
                stats.reference_capacity
            ),
            (0, 0, 0, 0, 0)
        );
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_reclaim_shared_and_distinct_owner_capacity_while_nodes_remain_alive() {
        let mut tree = TreeStore::new();
        let slot = element(&mut tree, "slot");
        let children = (0..1000)
            .map(|_| element(&mut tree, "b"))
            .collect::<Vec<_>>();
        for &child in &children {
            tree.set_slot_backlink(child, slot).unwrap();
        }
        assert!(tree.slot_backlinks.statistics().reference_capacity >= children.len());
        for &child in &children[1..] {
            tree.set_slot_backlink(child, 0.0).unwrap();
        }
        let sparse = tree.slot_backlinks.statistics();
        assert_eq!(sparse.assigned_nodes, 1);
        assert!(sparse.reference_capacity <= 64);
        assert!(sparse.node_capacity <= 64);
        assert_eq!(tree.slot_backlink(children[0]).unwrap(), slot);
        let owners = (0..children.len())
            .map(|_| element(&mut tree, "slot"))
            .collect::<Vec<_>>();
        for (&child, &owner) in children.iter().zip(&owners) {
            tree.set_slot_backlink(child, owner).unwrap();
        }
        for &child in &children[1..] {
            tree.set_slot_backlink(child, 0.0).unwrap();
        }
        assert_eq!(tree.slot_backlinks.statistics().slot_owners, 1);
        assert!(tree.slot_backlinks.statistics().owner_capacity <= 64);
        tree.set_slot_backlink(children[0], 0.0).unwrap();
        let empty = tree.slot_backlinks.statistics();
        assert_eq!(
            (
                empty.node_capacity,
                empty.owner_capacity,
                empty.reference_capacity
            ),
            (0, 0, 0)
        );
        assert_eq!(tree.statistics().live_nodes, 2001.0);
    }
}
