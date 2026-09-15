//! Run assignment traversal natively, yielding before signals and after each committed ownership update.
use super::{
    error::{Result, TreeError},
    slots::is_html_slot,
    store::{NodeId, TreeStore, node_id},
};

#[derive(Debug)]
pub enum AssignmentAction {
    Signal {
        slot: NodeId,
        nodes: Vec<f64>,
        next: NodeId,
    },
    Applied {
        slot: NodeId,
        nodes: Vec<f64>,
        next: NodeId,
        cache_changed: bool,
    },
    Complete,
}

struct PendingAssignment {
    slot: NodeId,
    nodes: Vec<f64>,
}

pub struct AssignmentDriver {
    root: NodeId,
    next: NodeId,
    subtree: bool,
    pending: Option<PendingAssignment>,
    complete: bool,
    cancelled: bool,
}

impl AssignmentDriver {
    pub fn new(root: f64, subtree: bool) -> Result<Self> {
        let root = node_id(root)?;
        Ok(Self {
            root,
            next: root,
            subtree,
            pending: None,
            complete: false,
            cancelled: false,
        })
    }

    pub fn complete(&self) -> bool {
        self.complete
    }

    pub fn cancel(&mut self) {
        self.root = 0;
        self.next = 0;
        self.pending = None;
        if !self.complete {
            self.cancelled = true;
        }
    }

    pub fn step(&mut self, tree: &mut TreeStore) -> Result<AssignmentAction> {
        if self.cancelled {
            return Err(TreeError::SlotAssignmentProtocol(
                "cannot resume a cancelled or failed operation",
            ));
        }
        let result = self.advance(tree);
        if result.is_err() {
            self.cancel();
        }
        result
    }

    fn advance(&mut self, tree: &mut TreeStore) -> Result<AssignmentAction> {
        if self.complete {
            return Ok(AssignmentAction::Complete);
        }
        tree.links(self.root)?;
        if let Some(pending) = self.pending.take() {
            // The caller signaled after the previous step. Commit that captured plan, not a recomputed one.
            return tree.commit_assignment_action(pending.slot, pending.nodes, self.next);
        }
        while self.next != 0 {
            let node = self.next;
            // SymbolTree captures following before returning the current value to the loop body.
            self.next = if self.subtree {
                tree.assignment_following(node, self.root)?
            } else {
                0
            };
            if self.subtree && !tree.data.get(&node).is_some_and(is_html_slot) {
                continue;
            }
            let plan = tree.slot_assignment_plan(node as f64)?;
            if plan.changed {
                self.pending = Some(PendingAssignment {
                    slot: node,
                    nodes: plan.nodes.clone(),
                });
                return Ok(AssignmentAction::Signal {
                    slot: node,
                    nodes: plan.nodes,
                    next: self.next,
                });
            }
            if plan
                .nodes
                .iter()
                .any(|&member| tree.slot_backlinks.get(member as NodeId) != Some(node))
            {
                // Even an unchanged cache must restore backlinks after intervening assignment work.
                return tree.commit_assignment_action(node, plan.nodes, self.next);
            }
            // No externally visible state or ownership edge changed; continue inside this native call.
        }
        self.complete = true;
        self.root = 0;
        Ok(AssignmentAction::Complete)
    }
}

impl TreeStore {
    fn assignment_following(&self, node: NodeId, root: NodeId) -> Result<NodeId> {
        let first = self.links(node)?.first;
        if first != 0 {
            return Ok(first);
        }
        let mut current = node;
        while current != 0 && current != root {
            let links = self.links(current)?;
            if links.next != 0 {
                return Ok(links.next);
            }
            current = links.parent;
        }
        Ok(0)
    }

    fn commit_assignment_action(
        &mut self,
        slot: NodeId,
        nodes: Vec<f64>,
        next: NodeId,
    ) -> Result<AssignmentAction> {
        let slot = self.assignment_slot(slot as f64)?;
        let validated = self.assignment_nodes(&nodes)?;
        let cache_changed = !self.slot_assignments.matches(slot, &validated);
        // All fallible validation precedes this atomic native commit. Return immediately afterward,
        // so an error at a later slot cannot prevent the host from applying this ownership update.
        self.slot_assignments.set(slot, validated.clone());
        for node in validated {
            self.slot_backlinks.set(node, Some(slot));
        }
        Ok(AssignmentAction::Applied {
            slot,
            nodes,
            next,
            cache_changed,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::super::constants::HTML_NAMESPACE;
    use super::*;

    fn element(tree: &mut TreeStore, name: &str) -> f64 {
        let node = tree.allocate().unwrap();
        tree.set_data(
            node,
            &serde_json::json!({ "kind": 1, "name": name, "namespace": HTML_NAMESPACE })
                .to_string(),
        )
        .unwrap();
        node
    }

    fn fixture() -> (TreeStore, f64, f64) {
        let mut tree = TreeStore::new();
        let host = element(&mut tree, "div");
        let root = tree.allocate().unwrap();
        tree.set_data(root, r#"{"kind":11}"#).unwrap();
        tree.set_root_host(root, host, true).unwrap();
        (tree, host, root)
    }

    fn named_slot(tree: &mut TreeStore, root: f64, name: &str) -> f64 {
        let slot = element(tree, "slot");
        tree.set_data(
            slot,
            &serde_json::json!({ "kind": 1, "name": "slot", "namespace": HTML_NAMESPACE,
            "attributes": [{ "name": "name", "value": name }] })
            .to_string(),
        )
        .unwrap();
        tree.append(root, slot).unwrap();
        slot
    }

    #[test]
    fn should_finish_large_unchanged_trees_in_one_step_without_allocating_persistent_state() {
        let (mut tree, _, root) = fixture();
        for _ in 0..1000 {
            named_slot(&mut tree, root, "");
        }
        let before = tree.statistics();
        let mut driver = AssignmentDriver::new(root, true).unwrap();
        assert!(matches!(
            driver.step(&mut tree).unwrap(),
            AssignmentAction::Complete
        ));
        assert!(driver.complete());
        assert_eq!(driver.root, 0);
        assert_eq!(driver.next, 0);
        assert!(driver.pending.is_none());
        assert_eq!(tree.slot_assignments.statistics().entries, 0);
        assert_eq!(tree.slot_backlinks.statistics().assigned_nodes, 0);
        assert_eq!(tree.statistics().mutations, before.mutations);
        assert_eq!(tree.statistics().data_updates, before.data_updates);
    }

    #[test]
    fn should_commit_captured_candidates_and_follow_the_cursor_captured_before_signaling() {
        let (mut tree, host, root) = fixture();
        let first = named_slot(&mut tree, root, "a");
        let second = named_slot(&mut tree, root, "b");
        let third = named_slot(&mut tree, root, "c");
        let child = element(&mut tree, "b");
        tree.set_slotable_name(child, &[97]).unwrap();
        tree.append(host, child).unwrap();
        let other = element(&mut tree, "i");
        tree.set_slotable_name(other, &[98]).unwrap();
        tree.append(host, other).unwrap();
        tree.set_slot_assignment(second, &[other]).unwrap();
        tree.set_slot_backlink(other, second).unwrap();
        let later = element(&mut tree, "em");
        tree.set_slotable_name(later, &[99]).unwrap();
        tree.append(host, later).unwrap();
        let mut driver = AssignmentDriver::new(root, true).unwrap();
        assert!(
            matches!(driver.step(&mut tree).unwrap(), AssignmentAction::Signal { slot, nodes, next }
            if slot == first as NodeId && nodes == [child] && next == second as NodeId)
        );
        assert!(tree.cached_slotables(first).unwrap().is_empty());
        tree.remove(second).unwrap();
        let added = named_slot(&mut tree, root, "b");
        tree.set_slotable_name(child, &[98]).unwrap();
        assert!(
            matches!(driver.step(&mut tree).unwrap(), AssignmentAction::Applied { slot, nodes, cache_changed: true, .. }
            if slot == first as NodeId && nodes == [child])
        );
        assert_eq!(tree.cached_slotables(first).unwrap(), [child]);
        assert_eq!(tree.slot_backlink(child).unwrap(), first);
        assert!(
            matches!(driver.step(&mut tree).unwrap(), AssignmentAction::Signal { slot, nodes, next: 0 }
            if slot == second as NodeId && nodes.is_empty())
        );
        assert!(
            matches!(driver.step(&mut tree).unwrap(), AssignmentAction::Applied { slot, nodes, .. }
            if slot == second as NodeId && nodes.is_empty())
        );
        assert!(matches!(
            driver.step(&mut tree).unwrap(),
            AssignmentAction::Complete
        ));
        assert!(tree.cached_slotables(added).unwrap().is_empty());
        assert!(tree.cached_slotables(third).unwrap().is_empty());
        assert_eq!(tree.find_slotables(third).unwrap(), [later]);
        assert_eq!(tree.find_slotables(added).unwrap(), [child, other]);
        assert_eq!(tree.slot_backlink(other).unwrap(), second);
    }

    #[test]
    fn should_restore_backlinks_without_signaling_when_the_cached_nodes_are_unchanged() {
        let (mut tree, host, root) = fixture();
        let slot = named_slot(&mut tree, root, "");
        let other = element(&mut tree, "slot");
        let child = element(&mut tree, "b");
        tree.append(host, child).unwrap();
        tree.set_slot_assignment(slot, &[child]).unwrap();
        tree.set_slot_backlink(child, other).unwrap();
        let mut driver = AssignmentDriver::new(slot, false).unwrap();
        assert!(
            matches!(driver.step(&mut tree).unwrap(), AssignmentAction::Applied { nodes, cache_changed: false, .. } if nodes == [child])
        );
        assert_eq!(tree.slot_backlink(child).unwrap(), slot);
        assert_eq!(tree.slot_signals.statistics().pending_slots, 0);
        assert!(matches!(
            driver.step(&mut tree).unwrap(),
            AssignmentAction::Complete
        ));
    }

    #[test]
    fn should_cancel_failed_captured_plans_without_committing_or_dropping_accepted_signals() {
        let (mut tree, host, root) = fixture();
        let slot = named_slot(&mut tree, root, "");
        let children = (0..1000)
            .map(|_| {
                let child = element(&mut tree, "b");
                tree.append(host, child).unwrap();
                child
            })
            .collect::<Vec<_>>();
        let mut driver = AssignmentDriver::new(slot, false).unwrap();
        assert!(matches!(
            driver.step(&mut tree).unwrap(),
            AssignmentAction::Signal { .. }
        ));
        assert!(driver.pending.as_ref().unwrap().nodes.capacity() >= children.len());
        tree.queue_slot_signal(slot).unwrap();
        tree.release(children[0]).unwrap();
        let before = tree.statistics();
        assert!(driver.step(&mut tree).is_err());
        assert!(driver.pending.is_none());
        assert_eq!(driver.root, 0);
        assert!(driver.step(&mut tree).is_err());
        assert!(tree.cached_slotables(slot).unwrap().is_empty());
        assert_eq!(tree.slot_backlinks.statistics().assigned_nodes, 0);
        assert_eq!(tree.slot_signals.statistics().pending_slots, 1);
        assert_eq!(tree.statistics().mutations, before.mutations);
        let mut cancelled = AssignmentDriver::new(slot, false).unwrap();
        cancelled.step(&mut tree).unwrap();
        cancelled.cancel();
        assert!(cancelled.pending.is_none());
        assert!(cancelled.step(&mut tree).is_err());
        assert_eq!(tree.take_slot_signals(), [slot]);
    }

    #[test]
    fn should_preserve_completed_prefixes_and_reject_invalid_roots_without_activating_handles() {
        let (mut tree, host, root) = fixture();
        let first = named_slot(&mut tree, root, "a");
        let second = named_slot(&mut tree, root, "b");
        let child = element(&mut tree, "b");
        tree.set_slotable_name(child, &[97]).unwrap();
        tree.append(host, child).unwrap();
        let mut driver = AssignmentDriver::new(root, true).unwrap();
        driver.step(&mut tree).unwrap();
        driver.step(&mut tree).unwrap();
        tree.release(second).unwrap();
        assert!(driver.step(&mut tree).is_err());
        assert_eq!(tree.cached_slotables(first).unwrap(), [child]);
        assert_eq!(tree.slot_backlink(child).unwrap(), first);
        let reserved = tree.reserve_handles().unwrap();
        let before = tree.statistics();
        let mut missing = AssignmentDriver::new(reserved, true).unwrap();
        assert!(missing.step(&mut tree).is_err());
        let mut wrong_role = AssignmentDriver::new(host, false).unwrap();
        assert!(wrong_role.step(&mut tree).is_err());
        assert!(AssignmentDriver::new(0.0, true).is_err());
        assert!(AssignmentDriver::new(f64::NAN, false).is_err());
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
    }
}
