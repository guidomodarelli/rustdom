//! Immutable mutation payloads own text and numeric node snapshots, never JavaScript references.
use super::{
    data::DomString,
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MutationKind {
    Attributes,
    CharacterData,
    ChildList,
}

impl MutationKind {
    fn parse(value: &str) -> Result<Self> {
        match value {
            "attributes" => Ok(Self::Attributes),
            "characterData" => Ok(Self::CharacterData),
            "childList" => Ok(Self::ChildList),
            _ => Err(TreeError::InvalidMutationRecordType),
        }
    }
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Attributes => "attributes",
            Self::CharacterData => "characterData",
            Self::ChildList => "childList",
        }
    }
}

pub struct MutationRecordDraft {
    pub kind: String,
    pub target: f64,
    pub previous_sibling: f64,
    pub next_sibling: f64,
    pub attribute_name: Option<DomString>,
    pub attribute_namespace: Option<DomString>,
    pub old_value: Option<DomString>,
    pub added_nodes: Vec<f64>,
    pub removed_nodes: Vec<f64>,
}

pub struct MutationRecordState {
    pub kind: MutationKind,
    pub target: NodeId,
    pub previous_sibling: NodeId,
    pub next_sibling: NodeId,
    pub attribute_name: Option<DomString>,
    pub attribute_namespace: Option<DomString>,
    pub old_value: Option<DomString>,
    pub added_nodes: Box<[NodeId]>,
    pub removed_nodes: Box<[NodeId]>,
}

impl TreeStore {
    fn record_node(&self, handle: f64, optional: bool) -> Result<NodeId> {
        if optional && handle == 0.0 {
            return Ok(0);
        }
        let node = node_id(handle)?;
        self.links(node)?;
        Ok(node)
    }

    /// Validate every reference before creating an immutable payload; preserve order and duplicates.
    pub fn mutation_record(&self, draft: MutationRecordDraft) -> Result<MutationRecordState> {
        let kind = MutationKind::parse(&draft.kind)?;
        let target = self.record_node(draft.target, false)?;
        let previous_sibling = self.record_node(draft.previous_sibling, true)?;
        let next_sibling = self.record_node(draft.next_sibling, true)?;
        let added_nodes = draft
            .added_nodes
            .iter()
            .map(|&node| self.record_node(node, false))
            .collect::<Result<Vec<_>>>()?;
        let removed_nodes = draft
            .removed_nodes
            .iter()
            .map(|&node| self.record_node(node, false))
            .collect::<Result<Vec<_>>>()?;
        Ok(MutationRecordState {
            kind,
            target,
            previous_sibling,
            next_sibling,
            attribute_name: draft.attribute_name,
            attribute_namespace: draft.attribute_namespace,
            old_value: draft.old_value,
            added_nodes: added_nodes.into_boxed_slice(),
            removed_nodes: removed_nodes.into_boxed_slice(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn draft(target: f64) -> MutationRecordDraft {
        MutationRecordDraft {
            kind: "childList".into(),
            target,
            previous_sibling: 0.0,
            next_sibling: 0.0,
            attribute_name: None,
            attribute_namespace: None,
            old_value: None,
            added_nodes: vec![],
            removed_nodes: vec![],
        }
    }

    #[test]
    fn should_preserve_nullable_lossless_fields_and_each_kind_without_mutating_the_tree() {
        let mut tree = TreeStore::new();
        let target = tree.allocate().unwrap();
        for kind in ["attributes", "characterData", "childList"] {
            let mut input = draft(target);
            input.kind = kind.into();
            input.attribute_name = Some(DomString::from_units(&[97, 0, 55296]));
            input.attribute_namespace = Some(DomString::from_units(&[]));
            input.old_value = Some(DomString::from_units(&[56320, 98]));
            let record = tree.mutation_record(input).unwrap();
            assert_eq!(record.kind.as_str(), kind);
            assert_eq!(record.target, target as NodeId);
            assert_eq!(
                record.attribute_name.unwrap().units().collect::<Vec<_>>(),
                [97, 0, 55296]
            );
            assert!(record.attribute_namespace.unwrap().is_empty());
            assert_eq!(
                record.old_value.unwrap().units().collect::<Vec<_>>(),
                [56320, 98]
            );
        }
        let empty = tree.mutation_record(draft(target)).unwrap();
        assert!(empty.attribute_name.is_none());
        assert!(empty.attribute_namespace.is_none());
        assert!(empty.old_value.is_none());
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }

    #[test]
    fn should_keep_ordered_snapshot_ids_after_tree_changes_and_release() {
        let mut tree = TreeStore::new();
        let target = tree.allocate().unwrap();
        let first = tree.allocate().unwrap();
        let second = tree.allocate().unwrap();
        tree.append(target, first).unwrap();
        tree.append(target, second).unwrap();
        let mut input = draft(target);
        input.previous_sibling = first;
        input.next_sibling = second;
        input.added_nodes = vec![first, second, first];
        input.removed_nodes = vec![second];
        let record = tree.mutation_record(input).unwrap();
        tree.remove(first).unwrap();
        for node in [first, second, target] {
            tree.release(node).unwrap();
        }
        assert_eq!(
            &*record.added_nodes,
            &[first as NodeId, second as NodeId, first as NodeId]
        );
        assert_eq!(&*record.removed_nodes, &[second as NodeId]);
        assert_eq!(record.previous_sibling, first as NodeId);
        assert_eq!(record.next_sibling, second as NodeId);
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_reject_invalid_references_and_types_without_activating_reserved_handles() {
        let mut tree = TreeStore::new();
        let target = tree.allocate().unwrap();
        let reserved = tree.reserve_handles().unwrap();
        let released = tree.allocate().unwrap();
        tree.release(released).unwrap();
        let before = tree.statistics();
        for invalid in [0.0, -1.0, 0.5, f64::NAN, f64::INFINITY, reserved, released] {
            assert!(tree.mutation_record(draft(invalid)).is_err());
            let mut added = draft(target);
            added.added_nodes = vec![target, invalid];
            assert!(tree.mutation_record(added).is_err());
            let mut removed = draft(target);
            removed.removed_nodes = vec![invalid];
            assert!(tree.mutation_record(removed).is_err());
            if invalid != 0.0 {
                let mut sibling = draft(target);
                sibling.previous_sibling = invalid;
                assert!(tree.mutation_record(sibling).is_err());
                let mut sibling = draft(target);
                sibling.next_sibling = invalid;
                assert!(tree.mutation_record(sibling).is_err());
            }
        }
        let mut unknown = draft(target);
        unknown.kind = "unknown".into();
        assert!(tree.mutation_record(unknown).is_err());
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        assert_eq!(tree.statistics().mutations, before.mutations);
    }
}
