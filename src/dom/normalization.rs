//! Read-only normalization planning; JavaScript still delivers mutation hooks and live-range updates.
use super::{
    constants::TEXT_NODE,
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};

pub(crate) struct NormalizationGroup {
    pub parent: NodeId,
    pub original_length: usize,
    pub appended_data: Vec<u16>,
    pub siblings: Vec<NodeId>,
}

impl TreeStore {
    /// Snapshot eligible Text identities, preserving the pinned implementation's inclusive traversal.
    pub fn normalization_candidates(&self, handle: f64) -> Result<Vec<f64>> {
        let mut pending = vec![node_id(handle)?];
        let mut candidates = Vec::new();
        while let Some(current) = pending.pop() {
            let data = self
                .data
                .get(&current)
                .ok_or(TreeError::MissingData(current))?;
            let links = self.links(current)?;
            if data.kind == TEXT_NODE && links.parent != 0 {
                candidates.push(current as f64);
            }
            let mut child = links.last;
            while child != 0 {
                pending.push(child);
                child = self.links(child)?.previous;
            }
        }
        Ok(candidates)
    }

    /// Re-read a candidate after earlier mutations; detached/non-Text candidates become no-ops.
    pub fn normalization_group(&self, handle: f64) -> Result<Option<NormalizationGroup>> {
        let id = node_id(handle)?;
        let data = self.data.get(&id).ok_or(TreeError::MissingData(id))?;
        let links = self.links(id)?;
        if data.kind != TEXT_NODE || links.parent == 0 {
            return Ok(None);
        }
        let mut group = NormalizationGroup {
            parent: links.parent,
            original_length: self.character_data(handle)?.len(),
            appended_data: Vec::new(),
            siblings: Vec::new(),
        };
        if group.original_length == 0 {
            return Ok(Some(group));
        }
        let mut previous = links.previous;
        while previous != 0 {
            let data = self
                .data
                .get(&previous)
                .ok_or(TreeError::MissingData(previous))?;
            if data.kind != TEXT_NODE {
                break;
            }
            group.siblings.push(previous);
            previous = self.links(previous)?.previous;
        }
        group.siblings.reverse();
        let mut next = links.next;
        while next != 0 {
            let data = self.data.get(&next).ok_or(TreeError::MissingData(next))?;
            if data.kind != TEXT_NODE {
                break;
            }
            group.siblings.push(next);
            next = self.links(next)?.next;
        }
        // jsdom appends preceding/succeeding data after the candidate's own value, even for a Text context.
        for &sibling in &group.siblings {
            group
                .appended_data
                .extend_from_slice(self.character_data(sibling as f64)?);
        }
        Ok(Some(group))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(tree: &mut TreeStore, metadata: &str) -> f64 {
        let handle = tree.allocate().unwrap();
        tree.set_data(handle, metadata).unwrap();
        handle
    }

    #[test]
    fn should_preserve_inclusive_candidates_and_exclusive_text_boundaries() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":11}"#);
        let first = node(&mut tree, r#"{"kind":3,"value":"before"}"#);
        let target = node(&mut tree, r#"{"kind":3,"value":[55296]}"#);
        let next = node(&mut tree, r#"{"kind":3,"value":"after"}"#);
        let cdata = node(&mut tree, r#"{"kind":4,"value":"boundary"}"#);
        let last = node(&mut tree, r#"{"kind":3,"value":"last"}"#);
        for child in [first, target, next, cdata, last] {
            tree.append(root, child).unwrap();
        }
        assert_eq!(
            tree.normalization_candidates(root).unwrap(),
            vec![first, target, next, last]
        );
        assert_eq!(tree.normalization_candidates(target).unwrap(), vec![target]);
        let group = tree.normalization_group(target).unwrap().unwrap();
        assert_eq!(group.parent, root as u64);
        assert_eq!(group.original_length, 1);
        assert_eq!(group.siblings, vec![first as u64, next as u64]);
        assert_eq!(
            group.appended_data,
            "beforeafter".encode_utf16().collect::<Vec<_>>()
        );
        assert!(tree.normalization_group(cdata).unwrap().is_none());
        tree.remove(target).unwrap();
        assert!(tree.normalization_group(target).unwrap().is_none());
        for handle in [first, target, next, cdata, last, root] {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_return_empty_removal_steps_and_read_current_siblings_after_mutations() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"root"}"#);
        let empty = node(&mut tree, r#"{"kind":3,"value":""}"#);
        let text = node(&mut tree, r#"{"kind":3,"value":"value"}"#);
        tree.append(root, empty).unwrap();
        tree.append(root, text).unwrap();
        let group = tree.normalization_group(empty).unwrap().unwrap();
        assert_eq!(group.original_length, 0);
        assert!(group.siblings.is_empty());
        tree.remove(empty).unwrap();
        let group = tree.normalization_group(text).unwrap().unwrap();
        assert!(group.siblings.is_empty());
        assert!(group.appended_data.is_empty());
        for handle in [empty, text, root] {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }

    #[test]
    fn should_reject_incomplete_trees_without_materializing_reservations_or_mutating_data() {
        let mut tree = TreeStore::new();
        let reserved = tree.reserve_handles().unwrap();
        let root = node(&mut tree, r#"{"kind":11}"#);
        let child = tree.allocate().unwrap();
        tree.append(root, child).unwrap();
        let before = tree.statistics();
        assert!(tree.normalization_candidates(reserved).is_err());
        assert!(tree.normalization_candidates(root).is_err());
        assert!(tree.normalization_group(child).is_err());
        let after = tree.statistics();
        assert_eq!(after.allocations, before.allocations);
        assert_eq!(after.reserved_handles, before.reserved_handles);
        assert_eq!(after.mutations, before.mutations);
        assert_eq!(after.data_updates, before.data_updates);
    }
}
