//! Sparse slotable-name state; default empty names require no per-node allocation.
use super::{
    compact_storage::CompactMap,
    constants::{CDATA_SECTION_NODE, ELEMENT_NODE, TEXT_NODE},
    data::DomString,
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};
use rustc_hash::FxBuildHasher;

/// jsdom's CDATASection inherits Text's name state, even where the slotable concept excludes it.
pub(crate) fn supports_slotable_name(kind: u16) -> bool {
    matches!(kind, ELEMENT_NODE | TEXT_NODE | CDATA_SECTION_NODE)
}

#[derive(Default)]
pub(crate) struct SlotableNames {
    names: CompactMap<NodeId, DomString, FxBuildHasher>,
}

impl SlotableNames {
    pub(crate) fn get(&self, node: NodeId) -> Option<&DomString> {
        self.names.get(&node)
    }

    pub(crate) fn release_node(&mut self, node: NodeId) {
        if self.names.remove(&node).is_some() {
            self.names.compact();
            if self.names.is_empty() {
                self.names.shrink_to_fit();
            }
        }
    }

    pub(crate) fn validate_metadata(&self, node: NodeId, kind: u16) -> Result<()> {
        if self.names.contains_key(&node) && !supports_slotable_name(kind) {
            return Err(TreeError::NotSlotable(node));
        }
        Ok(())
    }

    pub(crate) fn statistics(&self) -> (usize, usize) {
        (self.names.len(), self.names.capacity())
    }
}

impl TreeStore {
    fn validate_slotable(&self, node: NodeId) -> Result<()> {
        if !self
            .links(node)?
            .node_kind
            .is_some_and(supports_slotable_name)
        {
            return Err(TreeError::NotSlotable(node));
        }
        Ok(())
    }

    /// Absence represents the default empty name, independently of reflected attributes.
    pub fn slotable_name(&self, node: f64) -> Result<Option<&DomString>> {
        let node = node_id(node)?;
        self.validate_slotable(node)?;
        Ok(self.slotable_names.get(node))
    }

    pub fn set_slotable_name(&mut self, node: f64, name: &[u16]) -> Result<()> {
        let node = node_id(node)?;
        self.validate_slotable(node)?;
        if name.is_empty() {
            self.slotable_names.release_node(node);
        } else {
            self.slotable_names
                .names
                .insert(node, DomString::from_units(name));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn element(tree: &mut TreeStore) -> f64 {
        let node = tree.allocate().unwrap();
        tree.set_data(node, r#"{"kind":1,"name":"b"}"#).unwrap();
        node
    }

    #[test]
    fn should_store_only_nonempty_lossless_names_and_clear_them_on_reset() {
        let mut tree = TreeStore::new();
        let node = element(&mut tree);
        assert!(tree.slotable_name(node).unwrap().is_none());
        assert_eq!(tree.slotable_names.statistics(), (0, 0));
        tree.set_slotable_name(node, &[55296, 0, 56320]).unwrap();
        assert_eq!(
            tree.slotable_name(node)
                .unwrap()
                .unwrap()
                .units()
                .collect::<Vec<_>>(),
            vec![55296, 0, 56320]
        );
        tree.set_data(node, r#"{"kind":3,"value":"text"}"#).unwrap();
        assert_eq!(
            tree.slotable_name(node)
                .unwrap()
                .unwrap()
                .units()
                .collect::<Vec<_>>(),
            vec![55296, 0, 56320]
        );
        tree.set_slotable_name(node, &[]).unwrap();
        assert!(tree.slotable_name(node).unwrap().is_none());
        assert_eq!(tree.slotable_names.statistics(), (0, 0));
        tree.set_data(node, r#"{"kind":4,"value":"cdata"}"#)
            .unwrap();
        assert!(tree.slotable_name(node).unwrap().is_none());
        tree.set_slotable_name(node, &[65]).unwrap();
        assert_eq!(
            tree.slotable_name(node)
                .unwrap()
                .unwrap()
                .units()
                .collect::<Vec<_>>(),
            vec![65]
        );
        tree.release(node).unwrap();
        assert_eq!(tree.slotable_names.statistics(), (0, 0));
    }

    #[test]
    fn should_preserve_state_and_reservations_when_inputs_or_metadata_are_rejected() {
        let mut tree = TreeStore::new();
        let node = element(&mut tree);
        let reserved = tree.reserve_handles().unwrap();
        let comment = tree.allocate().unwrap();
        tree.set_data(comment, r#"{"kind":8,"value":"comment"}"#)
            .unwrap();
        tree.set_slotable_name(node, &[65]).unwrap();
        let before = tree.statistics();
        for invalid in [-1.0, 0.0, 0.5, f64::NAN, reserved, comment] {
            assert!(tree.set_slotable_name(invalid, &[66]).is_err());
            assert!(tree.slotable_name(invalid).is_err());
        }
        assert!(tree.set_data(node, r#"{"kind":8}"#).is_err());
        assert_eq!(
            tree.slotable_name(node)
                .unwrap()
                .unwrap()
                .units()
                .collect::<Vec<_>>(),
            vec![65]
        );
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().data_updates, before.data_updates);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        tree.set_slotable_name(node, &[]).unwrap();
        tree.set_data(node, r#"{"kind":8}"#).unwrap();
        assert!(tree.slotable_name(node).is_err());
    }

    #[test]
    fn should_reclaim_name_capacity_while_an_unrelated_node_remains_alive() {
        let mut tree = TreeStore::new();
        let held = element(&mut tree);
        let mut named = Vec::new();
        for _ in 0..1000 {
            let node = element(&mut tree);
            tree.set_slotable_name(node, &[65]).unwrap();
            named.push(node);
        }
        let (_, peak) = tree.slotable_names.statistics();
        assert_eq!(tree.slotable_names.statistics().0, named.len());
        for node in named {
            tree.release(node).unwrap();
        }
        assert!(peak >= 1000);
        assert_eq!(tree.slotable_names.statistics(), (0, 0));
        assert_eq!(tree.statistics().live_nodes, 1.0);
        tree.release(held).unwrap();
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }
}
