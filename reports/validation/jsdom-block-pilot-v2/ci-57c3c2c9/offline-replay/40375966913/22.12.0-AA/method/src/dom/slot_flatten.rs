//! Iterative slot flattening with path-local cycle detection and temporary numeric state.
use super::{
    constants::{ELEMENT_NODE, TEXT_NODE},
    error::{Result, TreeError},
    slots::is_html_slot,
    store::{NodeId, TreeStore, node_id},
};
use rustc_hash::FxHashSet;

enum FlattenTask {
    Expand { node: NodeId, root: NodeId },
    Emit(NodeId),
    Leave(NodeId),
}

impl TreeStore {
    /// Preserve assigned CDATA, but exclude it from fallback as jsdom's slotable predicate does.
    pub fn find_flattened_slotables(&self, slot: f64) -> Result<Vec<f64>> {
        let slot = node_id(slot)?;
        let root = self.root_and_depth(slot)?.0;
        let mut pending = vec![FlattenTask::Expand { node: slot, root }];
        let mut active = FxHashSet::default();
        let mut result = Vec::new();
        while let Some(task) = pending.pop() {
            match task {
                FlattenTask::Emit(node) => result.push(node as f64),
                FlattenTask::Leave(node) => {
                    active.remove(&node);
                }
                FlattenTask::Expand { node, root } => {
                    if self.root_hosts.shadow_host(root).is_none() {
                        continue;
                    }
                    if !active.insert(node) {
                        return Err(TreeError::SlotFlattenCycle(node));
                    }
                    let mut candidates = self.find_slotables(node as f64)?;
                    if candidates.is_empty() {
                        let mut child = self.links(node)?.first;
                        while child != 0 {
                            let links = self.links(child)?;
                            if matches!(links.node_kind, Some(ELEMENT_NODE | TEXT_NODE)) {
                                candidates.push(child as f64);
                            }
                            child = links.next;
                        }
                    }
                    pending.push(FlattenTask::Leave(node));
                    for candidate in candidates.into_iter().rev() {
                        let candidate = candidate as NodeId;
                        if self.data.get(&candidate).is_some_and(is_html_slot) {
                            let candidate_root = self.root_and_depth(candidate)?.0;
                            if self.root_hosts.shadow_host(candidate_root).is_some() {
                                pending.push(FlattenTask::Expand {
                                    node: candidate,
                                    root: candidate_root,
                                });
                                continue;
                            }
                        }
                        pending.push(FlattenTask::Emit(candidate));
                    }
                }
            }
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::super::{
        constants::HTML_NAMESPACE,
        data::{DomString, NodeData},
    };
    use super::*;

    fn node(tree: &mut TreeStore, kind: u16, name: &str) -> f64 {
        let handle = tree.allocate().unwrap();
        tree.replace_data(
            handle,
            NodeData {
                kind,
                name: (kind == ELEMENT_NODE).then(|| DomString::Text(name.into())),
                namespace: (kind == ELEMENT_NODE).then(|| DomString::Text(HTML_NAMESPACE.into())),
                ..NodeData::default()
            },
        )
        .unwrap();
        handle
    }

    #[test]
    fn should_distinguish_assigned_cdata_from_fallback_and_preserve_order() {
        let mut tree = TreeStore::new();
        let host = node(&mut tree, 1, "div");
        let root = node(&mut tree, 11, "");
        tree.set_root_host(root, host, true).unwrap();
        let slot = node(&mut tree, 1, "slot");
        tree.append(root, slot).unwrap();
        let text = node(&mut tree, 3, "");
        let cdata = node(&mut tree, 4, "");
        let element = node(&mut tree, 1, "b");
        for child in [text, cdata, element] {
            tree.append(slot, child).unwrap();
        }
        assert_eq!(
            tree.find_flattened_slotables(slot).unwrap(),
            vec![text, element]
        );
        tree.remove(cdata).unwrap();
        tree.append(host, cdata).unwrap();
        let snapshot = tree.find_flattened_slotables(slot).unwrap();
        assert_eq!(snapshot, vec![cdata]);
        tree.remove(cdata).unwrap();
        assert_eq!(
            tree.find_flattened_slotables(slot).unwrap(),
            vec![text, element]
        );
        assert_eq!(snapshot, vec![cdata]);
    }

    #[test]
    fn should_flatten_deep_fallback_without_recursive_control_state() {
        let mut tree = TreeStore::new();
        let host = node(&mut tree, 1, "div");
        let root = node(&mut tree, 11, "");
        tree.set_root_host(root, host, true).unwrap();
        let first = node(&mut tree, 1, "slot");
        tree.append(root, first).unwrap();
        let mut parent = first;
        for _ in 0..1024 {
            let child = node(&mut tree, 1, "slot");
            tree.append(parent, child).unwrap();
            parent = child;
        }
        let text = node(&mut tree, 3, "");
        tree.append(parent, text).unwrap();
        assert_eq!(tree.find_flattened_slotables(first).unwrap(), vec![text]);
    }

    #[test]
    fn should_reject_raw_assignment_cycles_without_modifying_the_tree() {
        let mut tree = TreeStore::new();
        let host = node(&mut tree, 1, "div");
        let root = node(&mut tree, 11, "");
        tree.set_root_host(root, host, true).unwrap();
        let slot = node(&mut tree, 1, "slot");
        tree.append(host, slot).unwrap();
        // Ordinary links stay acyclic, but the raw host edge makes this slot assign to itself.
        tree.append(root, host).unwrap();
        let before = tree.statistics();
        assert!(matches!(
            tree.find_flattened_slotables(slot),
            Err(TreeError::SlotFlattenCycle(_))
        ));
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().mutations, before.mutations);
        tree.remove(host).unwrap();
        assert!(tree.find_flattened_slotables(slot).unwrap().is_empty());
    }

    #[test]
    fn should_reject_unknown_inputs_and_release_resources_with_snapshots_retained() {
        let mut tree = TreeStore::new();
        let host = node(&mut tree, 1, "div");
        let root = node(&mut tree, 11, "");
        tree.set_root_host(root, host, true).unwrap();
        let slot = node(&mut tree, 1, "slot");
        tree.append(root, slot).unwrap();
        let child = node(&mut tree, 1, "b");
        tree.append(host, child).unwrap();
        let reserved = tree.reserve_handles().unwrap();
        let before = tree.statistics();
        for invalid in [-1.0, 0.0, 0.5, f64::NAN, reserved] {
            assert!(tree.find_flattened_slotables(invalid).is_err());
        }
        let result = tree.find_flattened_slotables(slot).unwrap();
        assert_eq!(result, vec![child]);
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        for handle in [child, slot, root, host, reserved] {
            tree.release(handle).unwrap();
        }
        assert_eq!(result, vec![child]);
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert_eq!(tree.root_host_statistics().hosted_roots, 0);
    }
}
