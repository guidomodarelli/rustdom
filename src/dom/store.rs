//! Authoritative native forest with stable handles and atomic topology mutations.
use rustc_hash::{FxHashMap, FxHashSet};

use super::data::NodeData;
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
    child_count: u64,
    children_version: u32,
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
    // Handles are assigned internally; HTML input cannot choose colliding keys.
    pub(crate) nodes: FxHashMap<NodeId, Links>,
    pub(crate) data: FxHashMap<NodeId, NodeData>,
    pub(crate) non_utf8_nodes: usize,
    data_updates: u64,
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
    pub(crate) fn activate(&mut self, id: NodeId) -> Result<()> {
        if self.nodes.contains_key(&id) {
            return Ok(());
        }
        if !self.reserved.remove(&id) {
            return Err(TreeError::UnknownHandle(id));
        }
        self.nodes.insert(id, Links::default());
        self.allocations += 1;
        Ok(())
    }

    pub(crate) fn links(&self, id: NodeId) -> Result<Links> {
        self.nodes
            .get(&id)
            .copied()
            .ok_or(TreeError::UnknownHandle(id))
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

    fn insert(
        &mut self,
        parent: NodeId,
        previous: NodeId,
        next: NodeId,
        child: NodeId,
    ) -> Result<f64> {
        let links = self.links(child)?;
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
                ancestor = self.links(ancestor)?.parent;
            }
        }
        // All validation precedes the first write, so rejected insertions are atomic.
        if previous != 0 {
            self.links(previous)?;
        }
        if next != 0 {
            self.links(next)?;
        }
        let child_links = self.nodes.get_mut(&child).expect("validated child");
        child_links.parent = parent;
        child_links.previous = previous;
        child_links.next = next;
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
            parent_links.children_version = parent_links.children_version.wrapping_add(1);
        }
        self.mutations += 1;
        Ok(if parent == 0 {
            0.0
        } else {
            self.nodes[&parent].child_count as f64
        })
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
            parent.children_version = parent.children_version.wrapping_add(1);
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

    /// Replace metadata only after decoding the whole snapshot successfully.
    pub fn set_data(&mut self, handle: f64, encoded: &str) -> Result<()> {
        let data: NodeData = serde_json::from_str(encoded).map_err(TreeError::InvalidMetadata)?;
        self.replace_data(handle, data)
    }

    /// Shared commit path for decoded snapshots and allocation-light native arguments.
    pub fn replace_data(&mut self, handle: f64, data: NodeData) -> Result<()> {
        let id = node_id(handle)?;
        self.activate(id)?;
        if data.template_content != 0.0 {
            self.activate(node_id(data.template_content)?)?;
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
        self.activate(parent)?;
        self.activate(child)?;
        let previous = self.links(parent)?.last;
        self.insert(parent, previous, 0, child)
    }
    pub fn prepend(&mut self, parent: f64, child: f64) -> Result<f64> {
        let parent = node_id(parent)?;
        let child = node_id(child)?;
        self.activate(parent)?;
        self.activate(child)?;
        let next = self.links(parent)?.first;
        self.insert(parent, 0, next, child)
    }
    pub fn insert_before(&mut self, reference: f64, child: f64) -> Result<f64> {
        let reference = node_id(reference)?;
        let child = node_id(child)?;
        self.activate(reference)?;
        self.activate(child)?;
        let links = self.links(reference)?;
        self.insert(links.parent, links.previous, reference, child)
    }
    pub fn insert_after(&mut self, reference: f64, child: f64) -> Result<f64> {
        let reference = node_id(reference)?;
        let child = node_id(child)?;
        self.activate(reference)?;
        self.activate(child)?;
        let links = self.links(reference)?;
        self.insert(links.parent, reference, links.next, child)
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
        self.detach(id)?;
        let mut child = self.nodes[&id].first;
        while child != 0 {
            let links = self.nodes.get_mut(&child).expect("linked child must exist");
            let next = links.next;
            links.parent = 0;
            links.previous = 0;
            links.next = 0;
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
}
