//! Canonical cached assignment snapshots with numeric reverse references and no JavaScript owners.
use super::{
    compact_storage::{CompactMap, CompactSet, compact_vector},
    data::NodeData,
    error::{Result, TreeError},
    slotable_names::supports_slotable_name,
    slots::is_html_slot,
    store::{NodeId, TreeStore, node_id},
};
use rustc_hash::FxBuildHasher;

#[derive(Default)]
pub(crate) struct SlotAssignments {
    slots: CompactMap<NodeId, Vec<NodeId>, FxBuildHasher>,
    members: CompactMap<NodeId, CompactSet<NodeId, FxBuildHasher>, FxBuildHasher>,
    entries: usize,
}

pub struct AssignmentPlan {
    pub changed: bool,
    pub nodes: Vec<f64>,
}

pub struct AssignmentStatistics {
    pub slots: usize,
    pub entries: usize,
    pub members: usize,
    pub slot_capacity: usize,
    pub member_capacity: usize,
    pub vector_capacity: usize,
}

impl SlotAssignments {
    pub(crate) fn matches(&self, slot: NodeId, nodes: &[NodeId]) -> bool {
        self.slots.get(&slot).map_or(&[][..], Vec::as_slice) == nodes
    }
    fn compact(&mut self) {
        self.slots.compact();
        self.members.compact();
        if self.slots.is_empty() {
            self.slots.shrink_to_fit();
        }
        if self.members.is_empty() {
            self.members.shrink_to_fit();
        }
    }

    fn clear_slot(&mut self, slot: NodeId) -> bool {
        let Some(previous) = self.slots.remove(&slot) else {
            return false;
        };
        self.entries -= previous.len();
        for member in previous {
            if let Some(holders) = self.members.get_mut(&member) {
                holders.remove(&slot);
                holders.compact();
                if holders.is_empty() {
                    self.members.remove(&member);
                }
            }
        }
        true
    }

    pub(crate) fn set(&mut self, slot: NodeId, nodes: Vec<NodeId>) {
        if self.slots.get(&slot).map_or(&[][..], Vec::as_slice) == nodes {
            return;
        }
        self.clear_slot(slot);
        if !nodes.is_empty() {
            for &member in &nodes {
                self.members.entry(member).or_default().insert(slot);
            }
            self.entries += nodes.len();
            self.slots.insert(slot, nodes);
        }
        self.compact();
    }

    pub(crate) fn release_node(&mut self, node: NodeId) {
        let mut changed = self.clear_slot(node);
        if let Some(holders) = self.members.remove(&node) {
            changed = true;
            for slot in holders {
                if let Some(nodes) = self.slots.get_mut(&slot) {
                    let previous = nodes.len();
                    nodes.retain(|&member| member != node);
                    self.entries -= previous - nodes.len();
                    compact_vector(nodes);
                    if nodes.is_empty() {
                        self.slots.remove(&slot);
                    }
                }
            }
        }
        if changed {
            self.compact();
        }
    }

    pub(crate) fn validate_metadata(&self, node: NodeId, data: &NodeData) -> Result<()> {
        if self.slots.contains_key(&node) && !is_html_slot(data) {
            return Err(TreeError::NotSlot(node));
        }
        if self.members.contains_key(&node) && !supports_slotable_name(data.kind) {
            return Err(TreeError::NotSlotable(node));
        }
        Ok(())
    }

    pub(crate) fn statistics(&self) -> AssignmentStatistics {
        AssignmentStatistics {
            slots: self.slots.len(),
            entries: self.entries,
            members: self.members.len(),
            slot_capacity: self.slots.capacity(),
            member_capacity: self.members.capacity(),
            vector_capacity: self.slots.values().map(Vec::capacity).sum(),
        }
    }
}

impl TreeStore {
    pub(crate) fn assignment_slot(&self, slot: f64) -> Result<NodeId> {
        let slot = node_id(slot)?;
        self.links(slot)?;
        if !self.data.get(&slot).is_some_and(is_html_slot) {
            return Err(TreeError::NotSlot(slot));
        }
        Ok(slot)
    }

    pub fn cached_slotables(&self, slot: f64) -> Result<Vec<f64>> {
        let slot = self.assignment_slot(slot)?;
        Ok(self
            .slot_assignments
            .slots
            .get(&slot)
            .into_iter()
            .flatten()
            .map(|&node| node as f64)
            .collect())
    }

    pub fn assigned_node_count(&self, slot: f64) -> Result<usize> {
        let slot = self.assignment_slot(slot)?;
        Ok(self.slot_assignments.slots.get(&slot).map_or(0, Vec::len))
    }

    /// Capture candidates and notification decision without committing before the host signals.
    pub fn slot_assignment_plan(&self, slot: f64) -> Result<AssignmentPlan> {
        let slot_id = self.assignment_slot(slot)?;
        let nodes = self.find_slotables(slot)?;
        let previous = self
            .slot_assignments
            .slots
            .get(&slot_id)
            .map_or(&[][..], Vec::as_slice);
        let changed = previous.len() != nodes.len()
            || !previous
                .iter()
                .zip(&nodes)
                .all(|(&old, &new)| old as f64 == new);
        Ok(AssignmentPlan { changed, nodes })
    }

    /// Commit the captured snapshot after signaling, without recomputing after possible reentrancy.
    pub fn set_slot_assignment(&mut self, slot: f64, nodes: &[f64]) -> Result<()> {
        let slot = self.assignment_slot(slot)?;
        let nodes = self.assignment_nodes(nodes)?;
        self.slot_assignments.set(slot, nodes);
        Ok(())
    }

    pub(crate) fn assignment_nodes(&self, nodes: &[f64]) -> Result<Vec<NodeId>> {
        nodes
            .iter()
            .map(|&node| {
                let id = node_id(node)?;
                if !self
                    .links(id)?
                    .node_kind
                    .is_some_and(supports_slotable_name)
                {
                    return Err(TreeError::NotSlotable(id));
                }
                Ok(id)
            })
            .collect::<Result<Vec<_>>>()
    }
}

#[cfg(test)]
mod tests {
    use super::super::{constants::HTML_NAMESPACE, data::DomString};
    use super::*;

    fn element(tree: &mut TreeStore, name: &str) -> f64 {
        let handle = tree.allocate().unwrap();
        tree.replace_data(
            handle,
            NodeData {
                kind: 1,
                name: Some(DomString::Text(name.into())),
                namespace: Some(DomString::Text(HTML_NAMESPACE.into())),
                ..NodeData::default()
            },
        )
        .unwrap();
        handle
    }

    #[test]
    fn should_capture_before_signaling_and_commit_the_original_snapshot_after_changes() {
        let mut tree = TreeStore::new();
        let host = element(&mut tree, "div");
        let root = tree.allocate().unwrap();
        tree.set_data(root, r#"{"kind":11}"#).unwrap();
        tree.set_root_host(root, host, true).unwrap();
        let slot = element(&mut tree, "slot");
        tree.append(root, slot).unwrap();
        let child = element(&mut tree, "b");
        tree.append(host, child).unwrap();
        let plan = tree.slot_assignment_plan(slot).unwrap();
        assert!(plan.changed);
        assert_eq!(plan.nodes, vec![child]);
        assert!(tree.cached_slotables(slot).unwrap().is_empty());
        tree.set_slotable_name(child, &[65]).unwrap();
        tree.set_slot_assignment(slot, &plan.nodes).unwrap();
        assert_eq!(tree.cached_slotables(slot).unwrap(), vec![child]);
        assert!(tree.find_slotables(slot).unwrap().is_empty());
        let next = tree.slot_assignment_plan(slot).unwrap();
        assert!(next.changed);
        assert!(next.nodes.is_empty());
        tree.set_slot_assignment(slot, &next.nodes).unwrap();
        assert!(!tree.slot_assignment_plan(slot).unwrap().changed);
        assert_eq!(tree.slot_assignments.statistics().slots, 0);
    }

    #[test]
    fn should_reject_invalid_snapshots_and_retyping_before_any_state_changes() {
        let mut tree = TreeStore::new();
        let slot = element(&mut tree, "slot");
        let child = element(&mut tree, "b");
        tree.set_slot_assignment(slot, &[child]).unwrap();
        let reserved = tree.reserve_handles().unwrap();
        let before = tree.statistics();
        for invalid in [-1.0, 0.0, 0.5, f64::NAN, reserved] {
            assert!(tree.set_slot_assignment(slot, &[child, invalid]).is_err());
            assert!(tree.set_slot_assignment(invalid, &[child]).is_err());
        }
        assert!(tree.set_data(slot, r#"{"kind":1,"name":"div"}"#).is_err());
        assert!(tree.set_data(child, r#"{"kind":8}"#).is_err());
        assert_eq!(tree.cached_slotables(slot).unwrap(), vec![child]);
        assert_eq!(tree.statistics().data_updates, before.data_updates);
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        tree.set_slot_assignment(slot, &[]).unwrap();
        tree.set_data(child, r#"{"kind":8}"#).unwrap();
    }

    #[test]
    fn should_remove_shared_members_and_duplicate_ids_in_either_finalization_order() {
        let mut tree = TreeStore::new();
        let first = element(&mut tree, "slot");
        let second = element(&mut tree, "slot");
        let child = element(&mut tree, "b");
        let retained = element(&mut tree, "i");
        tree.set_slot_assignment(first, &[child, child, retained])
            .unwrap();
        tree.set_slot_assignment(second, &[retained, child])
            .unwrap();
        assert_eq!(tree.slot_assignments.statistics().entries, 5);
        assert_eq!(tree.slot_assignments.statistics().members, 2);
        tree.release(child).unwrap();
        assert_eq!(tree.cached_slotables(first).unwrap(), vec![retained]);
        assert_eq!(tree.cached_slotables(second).unwrap(), vec![retained]);
        tree.release(first).unwrap();
        assert_eq!(tree.slot_assignments.statistics().entries, 1);
        tree.release(retained).unwrap();
        assert!(tree.cached_slotables(second).unwrap().is_empty());
        let stats = tree.slot_assignments.statistics();
        assert_eq!(
            (
                stats.slots,
                stats.entries,
                stats.members,
                stats.slot_capacity,
                stats.member_capacity,
                stats.vector_capacity
            ),
            (0, 0, 0, 0, 0, 0)
        );
        tree.release(second).unwrap();
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_reclaim_large_snapshots_while_the_slot_and_members_remain_alive() {
        let mut tree = TreeStore::new();
        let slot = element(&mut tree, "slot");
        let children = (0..1000)
            .map(|_| element(&mut tree, "b"))
            .collect::<Vec<_>>();
        tree.set_slot_assignment(slot, &children).unwrap();
        assert!(tree.slot_assignments.statistics().vector_capacity >= children.len());
        tree.set_slot_assignment(slot, &children[..1]).unwrap();
        assert_eq!(tree.assigned_node_count(slot).unwrap(), 1);
        // Collection may reserve a few spare elements; it must release the large snapshot.
        assert!(tree.slot_assignments.statistics().vector_capacity <= 64);
        assert!(tree.slot_assignments.statistics().member_capacity <= 64);
        tree.set_slot_assignment(slot, &[]).unwrap();
        assert_eq!(tree.slot_assignments.statistics().member_capacity, 0);
        assert_eq!(tree.slot_assignments.statistics().slot_capacity, 0);
        assert_eq!(tree.slot_assignments.statistics().vector_capacity, 0);
        assert_eq!(tree.statistics().live_nodes, 1001.0);
    }
}
