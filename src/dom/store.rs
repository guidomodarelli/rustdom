//! Authoritative native forest with stable handles and atomic topology mutations.
use rustc_hash::{FxHashMap, FxHashSet};
use std::num::NonZeroU64;

use super::constants::is_character_data;
use super::data::{DomString, NodeData};
use super::error::{Result, TreeError};

/// JavaScript represents every integer up to this value exactly.
const MAX_NODE_HANDLE: u64 = 9_007_199_254_740_991;
/// Keep a small reusable table while releasing high-water capacity after collection.
const MIN_NODE_CAPACITY: usize = 64;
/// Amortize handle allocation across Node-API without allocating unused node records.
pub const HANDLE_BATCH_SIZE: u64 = 128;

pub(crate) type NodeId = u64;

#[derive(Clone, Copy, Default)]
pub(crate) struct Links {
    pub parent: NodeId,
    pub previous: NodeId,
    pub next: NodeId,
    pub first: NodeId,
    pub last: NodeId,
    // Mirrors the kind at the single metadata commit boundary; None means no metadata yet.
    pub node_kind: Option<u16>,
    child_count: u64,
    children_version: u32,
    // Parent version and index + 1; the cache is reclaimed with this node record.
    cached_child_index: Option<(u32, NonZeroU64)>,
}

/// A complete link-cache update. Zero denotes the absence of a related node.
pub struct TreeLinks {
    pub id: f64,
    pub parent: f64,
    pub previous: f64,
    pub next: f64,
    pub first: f64,
    pub last: f64,
    pub child_count: f64,
    pub children_version: u32,
}

/// Observe live native allocations without retaining JavaScript nodes.
pub struct TreeStatistics {
    pub attribute_collections: f64,
    pub attribute_owners: f64,
    pub attribute_holders: f64,
    pub live_nodes: f64,
    pub capacity: f64,
    pub allocations: f64,
    pub releases: f64,
    pub mutations: f64,
    pub reserved_handles: f64,
    pub data_nodes: f64,
    pub data_updates: f64,
    pub serializations: f64,
}

/// Store topology without JavaScript references; the binding maintains GC ownership edges.
#[derive(Default)]
pub struct TreeStore {
    // Weak delivery identity prevents using captured IDs with another forest, without retaining tree data.
    pub(crate) delivery_identity: std::sync::Arc<()>,
    pub(crate) observer_registry: super::observer_registry::ObserverRegistry,
    pub(crate) slot_signals: super::slot_signals::SlotSignals,
    pub(crate) slot_backlinks: super::slot_backlinks::SlotBacklinks,
    pub(crate) slot_assignments: super::slot_assignments::SlotAssignments,
    pub(crate) slotable_names: super::slotable_names::SlotableNames,
    pub(crate) root_hosts: super::root_hosts::RootHosts,
    pub(crate) unicode_case: super::unicode_case::UnicodeCaseMapping,
    pub(crate) attribute_collections: super::attribute_index::AttributeCollections,
    // Handles are assigned internally; HTML input cannot choose colliding keys.
    pub(crate) nodes: FxHashMap<NodeId, Links>,
    pub(crate) data: FxHashMap<NodeId, NodeData>,
    pub(crate) non_utf8_nodes: usize,
    pub(crate) data_updates: u64,
    pub(crate) serializations: u64,
    reserved: FxHashSet<NodeId>,
    next_id: NodeId,
    allocations: u64,
    releases: u64,
    mutations: u64,
}

pub(crate) fn node_id(value: f64) -> Result<NodeId> {
    if !value.is_finite() || value.fract() != 0.0 || value < 1.0 || value > MAX_NODE_HANDLE as f64 {
        return Err(TreeError::InvalidHandle);
    }
    Ok(value as NodeId)
}

impl TreeStore {
    /// Check a handle's allocation eligibility without materializing its reserved record.
    pub(crate) fn validate_activation(&self, id: NodeId) -> Result<()> {
        if self.nodes.contains_key(&id) || self.reserved.contains(&id) {
            Ok(())
        } else {
            Err(TreeError::UnknownHandle(id))
        }
    }

    pub(crate) fn activate(&mut self, id: NodeId) -> Result<()> {
        self.activate_with_kind(id, None)
    }

    /// Metadata commits update the kind in the same lookup that activates the record.
    /// Ordinary topology activation preserves any existing metadata kind.
    fn activate_with_kind(&mut self, id: NodeId, kind: Option<u16>) -> Result<()> {
        if let Some(record) = self.nodes.get_mut(&id) {
            if kind.is_some() {
                record.node_kind = kind;
            }
            return Ok(());
        }
        if !self.reserved.remove(&id) {
            return Err(TreeError::UnknownHandle(id));
        }
        self.nodes.insert(
            id,
            Links {
                node_kind: kind,
                ..Links::default()
            },
        );
        self.allocations += 1;
        Ok(())
    }

    pub(crate) fn child_count(&self, id: NodeId) -> Result<u64> {
        Ok(self.links(id)?.child_count)
    }

    pub(crate) fn links(&self, id: NodeId) -> Result<Links> {
        self.nodes
            .get(&id)
            .copied()
            .ok_or(TreeError::UnknownHandle(id))
    }

    /// Fill each uncached sibling prefix once per parent version, in either query direction.
    pub(crate) fn sibling_index(&mut self, id: NodeId) -> Result<u64> {
        let links = self.links(id)?;
        if links.parent == 0 {
            return Ok(0);
        }
        let version = self.links(links.parent)?.children_version;
        if let Some((cached_version, index)) = links.cached_child_index
            && cached_version == version
        {
            return Ok(index.get() - 1);
        }
        let mut pending = Vec::new();
        let mut cursor = id;
        let mut next_index = 0;
        while cursor != 0 {
            let links = self.links(cursor)?;
            if let Some((cached_version, index)) = links.cached_child_index
                && cached_version == version
            {
                next_index = index.get();
                break;
            }
            pending.push(cursor);
            cursor = links.previous;
        }
        for child in pending.into_iter().rev() {
            // The number of children cannot exceed the safe-integer handle limit.
            let index = NonZeroU64::new(next_index + 1).expect("bounded sibling index");
            self.nodes
                .get_mut(&child)
                .expect("validated sibling")
                .cached_child_index = Some((version, index));
            next_index += 1;
        }
        Ok(next_index - 1)
    }

    /// A wrapped public version must not revive an index from an older epoch.
    fn children_changed(&mut self, parent: NodeId) {
        let links = self.nodes.get_mut(&parent).expect("validated parent");
        links.children_version = links.children_version.wrapping_add(1);
        let mut child = if links.children_version == 0 {
            links.first
        } else {
            0
        };
        while child != 0 {
            let links = self.nodes.get_mut(&child).expect("linked sibling");
            links.cached_child_index = None;
            child = links.next;
        }
    }

    /// Preview the detached links of a reserved handle without consuming its reservation.
    pub(crate) fn links_or_reserved(&self, id: NodeId) -> Result<Links> {
        if let Some(links) = self.nodes.get(&id) {
            Ok(*links)
        } else if self.reserved.contains(&id) {
            Ok(Links::default())
        } else {
            Err(TreeError::UnknownHandle(id))
        }
    }

    fn export(&self, id: NodeId) -> TreeLinks {
        let links = self.nodes[&id];
        TreeLinks {
            id: id as f64,
            parent: links.parent as f64,
            previous: links.previous as f64,
            next: links.next as f64,
            first: links.first as f64,
            last: links.last as f64,
            child_count: links.child_count as f64,
            children_version: links.children_version,
        }
    }

    fn validate_insertion(
        &self,
        parent: NodeId,
        previous: NodeId,
        next: NodeId,
        child: NodeId,
    ) -> Result<()> {
        let links = self.links_or_reserved(child)?;
        if links.parent != 0 || links.previous != 0 || links.next != 0 {
            return Err(TreeError::AlreadyAttached(child));
        }
        if child == previous || child == next {
            return Err(TreeError::SelfSibling(child));
        }
        if parent == child {
            return Err(TreeError::Cycle(child));
        }
        // A leaf cannot contain an ancestor: only subtree moves need the full walk.
        if links.first != 0 {
            let mut ancestor = parent;
            while ancestor != 0 {
                if ancestor == child {
                    return Err(TreeError::Cycle(child));
                }
                ancestor = self.links_or_reserved(ancestor)?.parent;
            }
        }
        if previous != 0 {
            self.links_or_reserved(previous)?;
        }
        if next != 0 {
            self.links_or_reserved(next)?;
        }
        Ok(())
    }

    /// Commit an insertion only after handle and topology validation have both succeeded.
    fn insert(&mut self, parent: NodeId, previous: NodeId, next: NodeId, child: NodeId) -> f64 {
        let child_links = self.nodes.get_mut(&child).expect("validated child");
        child_links.parent = parent;
        child_links.previous = previous;
        child_links.next = next;
        child_links.cached_child_index = None;
        if previous != 0 {
            self.nodes
                .get_mut(&previous)
                .expect("validated sibling")
                .next = child;
        }
        if next != 0 {
            self.nodes
                .get_mut(&next)
                .expect("validated sibling")
                .previous = child;
        }
        if parent != 0 {
            let parent_links = self.nodes.get_mut(&parent).expect("validated ancestor");
            if previous == 0 {
                parent_links.first = child;
            }
            if next == 0 {
                parent_links.last = child;
            }
            parent_links.child_count += 1;
            self.children_changed(parent);
        }
        self.mutations += 1;
        if parent == 0 {
            0.0
        } else {
            self.nodes[&parent].child_count as f64
        }
    }

    fn detach(&mut self, id: NodeId) -> Result<f64> {
        let links = self.links(id)?;
        if links.parent != 0 {
            let parent = self
                .nodes
                .get_mut(&links.parent)
                .expect("attached parent must exist");
            if parent.first == id {
                parent.first = links.next;
            }
            if parent.last == id {
                parent.last = links.previous;
            }
            parent.child_count -= 1;
        }
        if links.previous != 0 {
            self.nodes
                .get_mut(&links.previous)
                .expect("linked sibling must exist")
                .next = links.next;
        }
        if links.next != 0 {
            self.nodes
                .get_mut(&links.next)
                .expect("linked sibling must exist")
                .previous = links.previous;
        }
        let removed = self.nodes.get_mut(&id).expect("validated node");
        removed.parent = 0;
        removed.previous = 0;
        removed.next = 0;
        removed.cached_child_index = None;
        if links.parent != 0 {
            self.children_changed(links.parent);
        }
        self.mutations += 1;
        Ok(if links.parent == 0 {
            0.0
        } else {
            self.nodes[&links.parent].child_count as f64
        })
    }
}
impl TreeStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Replace snapshot data only before a canonical element collection exists.
    pub fn set_data(&mut self, handle: f64, encoded: &str) -> Result<()> {
        let data: NodeData = serde_json::from_str(encoded).map_err(TreeError::InvalidMetadata)?;
        self.replace_snapshot(handle, data)
    }

    /// Reject incompatible snapshot writes before changing metadata, owners or reserved handles.
    pub fn replace_snapshot(&mut self, handle: f64, data: NodeData) -> Result<()> {
        let id = node_id(handle)?;
        if self.attribute_collections.elements.contains_key(&id) {
            return Err(TreeError::AttributeCollectionInitialized(id));
        }
        self.replace_data(handle, data)
    }

    /// Commit metadata; callers updating an element preserve its authoritative Attr collection.
    pub fn replace_data(&mut self, handle: f64, mut data: NodeData) -> Result<()> {
        if is_character_data(data.kind)
            && let DomString::Text(value) = &data.value
        {
            data.value = DomString::Utf16(value.encode_utf16().collect());
        }
        let id = node_id(handle)?;
        if self.attribute_collections.has_references(id) {
            return Err(TreeError::AttributeInUse(id));
        }
        self.root_hosts.validate_metadata(id, data.kind)?;
        self.slotable_names.validate_metadata(id, data.kind)?;
        self.slot_assignments.validate_metadata(id, &data)?;
        self.slot_backlinks.validate_metadata(id, &data)?;
        self.slot_signals.validate_metadata(id, &data)?;
        if self.attribute_collections.elements.contains_key(&id) {
            if data.kind != super::constants::ELEMENT_NODE {
                return Err(TreeError::NotElement(id));
            }
            data.attributes = self.snapshot_attributes(id)?;
        }
        let template = if data.template_content == 0.0 {
            None
        } else {
            self.validate_activation(id)?;
            let template = node_id(data.template_content)?;
            self.validate_activation(template)?;
            Some(template)
        };
        // No fallible validation may follow the first activation: reservations and counters
        // are observable state, even before any metadata is inserted.
        self.activate_with_kind(id, Some(data.kind))?;
        if let Some(template) = template {
            self.activate(template)?;
        }
        let unsafe_data = usize::from(data.has_non_utf8());
        if let Some(previous) = self.data.insert(id, data) {
            self.non_utf8_nodes -= usize::from(previous.has_non_utf8());
        }
        self.non_utf8_nodes += unsafe_data;
        self.data_updates += 1;
        Ok(())
    }

    /// Allocate a handle that will never be reused, including after collection.
    pub fn allocate(&mut self) -> Result<f64> {
        if self.next_id == MAX_NODE_HANDLE {
            return Err(TreeError::HandleExhausted);
        }
        self.next_id += 1;
        self.nodes.insert(self.next_id, Links::default());
        self.allocations += 1;
        Ok(self.next_id as f64)
    }

    /// Reserve identifiers only; records become live when a native operation references them.
    pub fn reserve_handles(&mut self) -> Result<f64> {
        if self.next_id > MAX_NODE_HANDLE - HANDLE_BATCH_SIZE {
            return Err(TreeError::HandleExhausted);
        }
        let first = self.next_id + 1;
        self.next_id += HANDLE_BATCH_SIZE;
        self.reserved.extend(first..=self.next_id);
        Ok(first as f64)
    }
    pub fn get_links(&mut self, handle: f64) -> Result<TreeLinks> {
        let id = node_id(handle)?;
        self.activate(id)?;
        self.links(id)?;
        Ok(self.export(id))
    }
    pub fn append(&mut self, parent: f64, child: f64) -> Result<f64> {
        let parent = node_id(parent)?;
        let child = node_id(child)?;
        let previous = self.links_or_reserved(parent)?.last;
        self.validate_insertion(parent, previous, 0, child)?;
        self.activate(parent)?;
        self.activate(child)?;
        Ok(self.insert(parent, previous, 0, child))
    }
    pub fn prepend(&mut self, parent: f64, child: f64) -> Result<f64> {
        let parent = node_id(parent)?;
        let child = node_id(child)?;
        let next = self.links_or_reserved(parent)?.first;
        self.validate_insertion(parent, 0, next, child)?;
        self.activate(parent)?;
        self.activate(child)?;
        Ok(self.insert(parent, 0, next, child))
    }
    pub fn insert_before(&mut self, reference: f64, child: f64) -> Result<f64> {
        let reference = node_id(reference)?;
        let child = node_id(child)?;
        let links = self.links_or_reserved(reference)?;
        self.validate_insertion(links.parent, links.previous, reference, child)?;
        self.activate(reference)?;
        self.activate(child)?;
        Ok(self.insert(links.parent, links.previous, reference, child))
    }
    pub fn insert_after(&mut self, reference: f64, child: f64) -> Result<f64> {
        let reference = node_id(reference)?;
        let child = node_id(child)?;
        let links = self.links_or_reserved(reference)?;
        self.validate_insertion(links.parent, reference, links.next, child)?;
        self.activate(reference)?;
        self.activate(child)?;
        Ok(self.insert(links.parent, reference, links.next, child))
    }
    pub fn remove(&mut self, handle: f64) -> Result<f64> {
        let id = node_id(handle)?;
        self.activate(id)?;
        self.detach(id)
    }

    /// Return an iterative preorder traversal without crossing Node-API per node.
    pub fn descendants(&mut self, handle: f64) -> Result<Vec<f64>> {
        let root = node_id(handle)?;
        self.activate(root)?;
        self.links(root)?;
        let mut result = Vec::new();
        let mut pending = vec![root];
        while let Some(id) = pending.pop() {
            result.push(id as f64);
            let mut child = self.nodes[&id].last;
            while child != 0 {
                pending.push(child);
                child = self.nodes[&child].previous;
            }
        }
        Ok(result)
    }

    /// Release one collected owner without leaving stale links in surviving native records.
    pub fn release(&mut self, handle: f64) -> Result<bool> {
        let id = node_id(handle)?;
        if self.reserved.remove(&id) {
            return Ok(true);
        }
        if !self.nodes.contains_key(&id) {
            return Ok(false);
        }
        self.release_attribute_references(id)?;
        self.root_hosts.release_node(id);
        self.slotable_names.release_node(id);
        self.slot_assignments.release_node(id);
        self.slot_backlinks.release_node(id);
        self.slot_signals.release_node(id);
        self.observer_registry.release_node(id);
        self.detach(id)?;
        let mut child = self.nodes[&id].first;
        while child != 0 {
            let links = self.nodes.get_mut(&child).expect("linked child must exist");
            let next = links.next;
            links.parent = 0;
            links.previous = 0;
            links.next = 0;
            links.cached_child_index = None;
            child = next;
        }
        self.nodes.remove(&id);
        if let Some(data) = self.data.remove(&id) {
            self.non_utf8_nodes -= usize::from(data.has_non_utf8());
        }
        self.releases += 1;
        if self.nodes.capacity() > MIN_NODE_CAPACITY && self.nodes.len() < self.nodes.capacity() / 4
        {
            self.nodes
                .shrink_to(self.nodes.len().max(MIN_NODE_CAPACITY));
            self.data.shrink_to(self.data.len().max(MIN_NODE_CAPACITY));
        }
        Ok(true)
    }
    pub fn statistics(&self) -> TreeStatistics {
        TreeStatistics {
            attribute_collections: self.attribute_collections.elements.len() as f64,
            attribute_owners: self.attribute_collections.owners.len() as f64,
            attribute_holders: self.attribute_collections.holder_count() as f64,
            live_nodes: self.nodes.len() as f64,
            capacity: self.nodes.capacity() as f64,
            allocations: self.allocations as f64,
            releases: self.releases as f64,
            mutations: self.mutations as f64,
            reserved_handles: self.reserved.len() as f64,
            data_nodes: self.data.len() as f64,
            data_updates: self.data_updates as f64,
            serializations: self.serializations as f64,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn allocation_state(tree: &TreeStore) -> [f64; 8] {
        let statistics = tree.statistics();
        [
            statistics.live_nodes,
            statistics.capacity,
            statistics.allocations,
            statistics.releases,
            statistics.mutations,
            statistics.reserved_handles,
            statistics.data_nodes,
            statistics.data_updates,
        ]
    }

    #[test]
    fn should_reject_insertion_errors_before_materializing_reserved_handles() {
        type InsertionOperation = fn(&mut TreeStore, f64, f64) -> Result<f64>;
        let insertions: [InsertionOperation; 4] = [
            TreeStore::append,
            TreeStore::prepend,
            TreeStore::insert_before,
            TreeStore::insert_after,
        ];
        for insert in insertions {
            let mut tree = TreeStore::new();
            let reserved = tree.reserve_handles().unwrap();
            let unknown = reserved + HANDLE_BATCH_SIZE as f64;
            let before = allocation_state(&tree);
            assert!(matches!(
                insert(&mut tree, reserved, unknown),
                Err(TreeError::UnknownHandle(_))
            ));
            assert_eq!(allocation_state(&tree), before);
            assert!(matches!(
                insert(&mut tree, reserved, reserved),
                Err(TreeError::Cycle(_) | TreeError::SelfSibling(_))
            ));
            assert_eq!(allocation_state(&tree), before);
            let root = tree.allocate().unwrap();
            let child = tree.allocate().unwrap();
            tree.append(root, child).unwrap();
            let before = allocation_state(&tree);
            assert!(matches!(
                insert(&mut tree, reserved, child),
                Err(TreeError::AlreadyAttached(_))
            ));
            assert_eq!(allocation_state(&tree), before);
            assert_eq!(tree.descendants(root).unwrap(), vec![root, child]);
        }
    }

    #[test]
    fn should_follow_metadata_retyping_in_constraints_without_changing_failed_writes() {
        use super::super::node_constraints::ConstraintStatus;
        println!(
            "Native Links record size: {} bytes",
            std::mem::size_of::<Links>()
        );
        let mut tree = TreeStore::new();
        let document = tree.allocate().unwrap();
        tree.set_data(document, r#"{"kind":9}"#).unwrap();
        let child = tree.allocate().unwrap();
        tree.append(document, child).unwrap();
        let candidate = tree.allocate().unwrap();
        tree.set_data(candidate, r#"{"kind":1,"name":"candidate"}"#)
            .unwrap();
        assert!(
            tree.pre_insert_constraints(document, candidate, 0.0)
                .is_err()
        );
        tree.set_data(child, r#"{"kind":1,"name":"root"}"#).unwrap();
        assert_eq!(
            tree.pre_insert_constraints(document, candidate, 0.0)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
        tree.set_character_data(child, 8, vec![65]).unwrap();
        assert_eq!(
            tree.pre_insert_constraints(document, candidate, 0.0)
                .unwrap(),
            ConstraintStatus::Ready
        );
        tree.set_data(child, r#"{"kind":1,"name":"root"}"#).unwrap();
        tree.initialize_attribute_collection(child).unwrap();
        assert!(tree.set_character_data(child, 8, vec![66]).is_err());
        assert_eq!(
            tree.pre_insert_constraints(document, candidate, 0.0)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
        for handle in [child, candidate, document] {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }

    #[test]
    fn should_validate_all_metadata_handles_before_activating_either_record() {
        let mut tree = TreeStore::new();
        let reserved = tree.reserve_handles().unwrap();
        for template_content in [
            -1.0,
            1.5,
            f64::NAN,
            f64::INFINITY,
            MAX_NODE_HANDLE as f64 + 1.0,
            reserved + HANDLE_BATCH_SIZE as f64,
        ] {
            let before = allocation_state(&tree);
            let result = tree.replace_data(
                reserved,
                NodeData {
                    kind: super::super::constants::ELEMENT_NODE,
                    template_content,
                    ..NodeData::default()
                },
            );
            assert!(matches!(
                result,
                Err(TreeError::InvalidHandle | TreeError::UnknownHandle(_))
            ));
            assert_eq!(allocation_state(&tree), before);
        }
        let unknown = reserved + HANDLE_BATCH_SIZE as f64;
        let before = allocation_state(&tree);
        assert!(matches!(
            tree.replace_data(
                unknown,
                NodeData {
                    template_content: reserved,
                    ..NodeData::default()
                }
            ),
            Err(TreeError::UnknownHandle(_))
        ));
        assert_eq!(allocation_state(&tree), before);
    }

    #[test]
    fn should_preserve_shared_self_and_active_template_handle_allocation() {
        let mut tree = TreeStore::new();
        let first = tree.reserve_handles().unwrap();
        let template = first + 1.0;
        for handle in [first, first + 2.0] {
            tree.replace_data(
                handle,
                NodeData {
                    template_content: template,
                    ..NodeData::default()
                },
            )
            .unwrap();
        }
        assert_eq!(tree.statistics().allocations, 3.0);
        tree.replace_data(
            first,
            NodeData {
                template_content: first,
                ..NodeData::default()
            },
        )
        .unwrap();
        assert_eq!(tree.statistics().allocations, 3.0);
        let self_template = first + 3.0;
        tree.replace_data(
            self_template,
            NodeData {
                template_content: self_template,
                ..NodeData::default()
            },
        )
        .unwrap();
        assert_eq!(tree.statistics().allocations, 4.0);
        for offset in 0..HANDLE_BATCH_SIZE {
            tree.release(first + offset as f64).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert_eq!(tree.statistics().reserved_handles, 0.0);
    }

    #[test]
    fn should_invalidate_sibling_indices_after_mutations_and_version_wrap() {
        let mut tree = TreeStore::new();
        let parent = tree.allocate().unwrap();
        let other_parent = tree.allocate().unwrap();
        let children: Vec<_> = (0..4).map(|_| tree.allocate().unwrap()).collect();
        for &child in &children[..3] {
            tree.append(parent, child).unwrap();
        }
        // Model an earlier wrapped epoch; old cached zero versions must not revive.
        tree.nodes
            .get_mut(&(parent as NodeId))
            .unwrap()
            .children_version = 0;
        for (index, &child) in children[..3].iter().enumerate().rev() {
            assert_eq!(tree.sibling_index(child as NodeId).unwrap(), index as u64);
        }
        tree.nodes
            .get_mut(&(parent as NodeId))
            .unwrap()
            .children_version = u32::MAX;
        tree.prepend(parent, children[3]).unwrap();
        assert_eq!(tree.sibling_index(children[2] as NodeId).unwrap(), 3);
        assert_eq!(tree.sibling_index(children[0] as NodeId).unwrap(), 1);
        tree.remove(children[0]).unwrap();
        tree.append(parent, children[0]).unwrap();
        assert_eq!(tree.sibling_index(children[0] as NodeId).unwrap(), 3);
        assert_eq!(tree.sibling_index(children[1] as NodeId).unwrap(), 1);
        tree.remove(children[0]).unwrap();
        tree.append(other_parent, children[0]).unwrap();
        assert_eq!(tree.sibling_index(children[0] as NodeId).unwrap(), 0);
        tree.release(parent).unwrap();
        assert_eq!(tree.sibling_index(children[1] as NodeId).unwrap(), 0);
        for handle in children.into_iter().chain([other_parent]) {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_materialize_reserved_handles_without_reusing_released_ones() {
        let mut tree = TreeStore::new();
        let first = tree.reserve_handles().unwrap();
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert_eq!(tree.statistics().reserved_handles, HANDLE_BATCH_SIZE as f64);
        tree.append(first, first + 1.0).unwrap();
        assert_eq!(tree.statistics().live_nodes, 2.0);
        assert_eq!(
            tree.statistics().reserved_handles,
            (HANDLE_BATCH_SIZE - 2) as f64
        );
        tree.release(first + 2.0).unwrap();
        assert!(tree.get_links(first + 2.0).is_err());
        assert!(tree.append(first, first).is_err());
        tree.release(first).unwrap();
        tree.release(first + 1.0).unwrap();
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert!(tree.reserve_handles().unwrap() > first + HANDLE_BATCH_SIZE as f64 - 1.0);
    }

    #[test]
    fn should_preserve_order_when_inserting_and_removing_siblings() {
        let mut tree = TreeStore::new();
        let root = tree.allocate().unwrap();
        let first = tree.allocate().unwrap();
        let middle = tree.allocate().unwrap();
        let last = tree.allocate().unwrap();
        tree.append(root, first).unwrap();
        tree.append(root, last).unwrap();
        tree.insert_before(last, middle).unwrap();
        assert_eq!(
            tree.descendants(root).unwrap(),
            vec![root, first, middle, last]
        );
        tree.remove(middle).unwrap();
        assert_eq!(tree.descendants(root).unwrap(), vec![root, first, last]);
        assert_eq!(tree.get_links(root).unwrap().child_count, 2.0);
        assert_eq!(tree.get_links(middle).unwrap().parent, 0.0);
    }

    #[test]
    fn should_reject_cycles_and_attached_insertions_without_partial_writes() {
        let mut tree = TreeStore::new();
        let root = tree.allocate().unwrap();
        let child = tree.allocate().unwrap();
        assert!(matches!(tree.append(root, root), Err(TreeError::Cycle(id)) if id == root as u64));
        assert_eq!(tree.get_links(root).unwrap().child_count, 0.0);
        tree.append(root, child).unwrap();
        assert!(tree.append(child, root).is_err());
        assert!(tree.append(root, child).is_err());
        assert_eq!(tree.descendants(root).unwrap(), vec![root, child]);
    }

    #[test]
    fn should_reject_stale_and_non_integer_handles_after_collection() {
        let mut tree = TreeStore::new();
        let old = tree.allocate().unwrap();
        assert!(tree.release(old).unwrap());
        let new = tree.allocate().unwrap();
        assert_ne!(old, new);
        assert!(tree.get_links(old).is_err());
        assert!(tree.get_links(1.5).is_err());
        assert!(tree.get_links(f64::NAN).is_err());
        assert!(!tree.release(old).unwrap());
    }

    #[test]
    fn should_release_high_water_storage_and_detach_surviving_children() {
        let mut tree = TreeStore::new();
        let root = tree.allocate().unwrap();
        let ids: Vec<_> = (0..2048).map(|_| tree.allocate().unwrap()).collect();
        for &id in &ids {
            tree.append(root, id).unwrap();
        }
        tree.release(root).unwrap();
        assert_eq!(tree.get_links(ids[0]).unwrap().parent, 0.0);
        for id in ids {
            tree.release(id).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert!(tree.statistics().capacity < 256.0);
    }

    #[test]
    fn should_release_nameless_attribute_snapshots_without_retaining_data_or_links() {
        let mut tree = TreeStore::new();
        let root = tree.allocate().unwrap();
        for _ in 0..1024 {
            let attribute = tree.allocate().unwrap();
            tree.set_data(attribute, r#"{"kind":2,"value":[0,55296]}"#)
                .unwrap();
            tree.append(root, attribute).unwrap();
            assert!(tree.release(attribute).unwrap());
            assert!(!tree.release(attribute).unwrap());
            assert_eq!(tree.child_count(root as u64).unwrap(), 0);
        }
        tree.release(root).unwrap();
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert_eq!(tree.statistics().data_nodes, 0.0);
        assert_eq!(tree.non_utf8_nodes, 0);
    }
}
