//! Numeric host relationships and traversals; JavaScript keeps the corresponding GC-visible edges.
use super::{
    compact_storage::{CompactMap, CompactSet},
    constants::{DOCUMENT_FRAGMENT_NODE, ELEMENT_NODE},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};
use rustc_hash::FxBuildHasher;

#[derive(Clone, Copy, PartialEq, Eq)]
struct RootHost {
    host: NodeId,
    shadow: bool,
}
type RootSet = CompactSet<NodeId, FxBuildHasher>;

/// Both directions are owned by the forest and contain only numeric identities.
#[derive(Default)]
pub(crate) struct RootHosts {
    roots: CompactMap<NodeId, RootHost, FxBuildHasher>,
    owners: CompactMap<NodeId, RootSet, FxBuildHasher>,
}

pub struct RootHostStatistics {
    pub hosted_roots: usize,
    pub host_owners: usize,
    pub root_capacity: usize,
    pub owner_capacity: usize,
}

impl RootHosts {
    fn compact(&mut self) {
        self.roots.compact();
        self.owners.compact();
        if self.roots.is_empty() {
            self.roots.shrink_to_fit();
        }
        if self.owners.is_empty() {
            self.owners.shrink_to_fit();
        }
    }

    fn detach(&mut self, root: NodeId) -> bool {
        let Some(previous) = self.roots.remove(&root) else {
            return false;
        };
        let owner_empty = {
            let roots = self
                .owners
                .get_mut(&previous.host)
                .expect("registered host owner");
            roots.remove(&root);
            roots.compact();
            roots.is_empty()
        };
        if owner_empty {
            self.owners.remove(&previous.host);
        }
        true
    }

    fn set(&mut self, root: NodeId, host: NodeId, shadow: bool) {
        let relation = RootHost { host, shadow };
        if self.roots.get(&root) == Some(&relation) {
            return;
        }
        self.detach(root);
        self.roots.insert(root, relation);
        self.owners.entry(host).or_default().insert(root);
        self.compact();
    }

    fn clear(&mut self, root: NodeId) {
        if self.detach(root) {
            self.compact();
        }
    }

    /// Either endpoint can finalize first; no stale host identity remains in surviving roots.
    pub(crate) fn release_node(&mut self, node: NodeId) {
        let mut changed = self.detach(node);
        if let Some(roots) = self.owners.remove(&node) {
            changed = true;
            for root in roots {
                self.roots.remove(&root);
            }
        }
        if changed {
            self.compact();
        }
    }

    /// Registered constructor roles remain valid when metadata is initialized or replaced later.
    pub(crate) fn validate_metadata(&self, node: NodeId, kind: u16) -> Result<()> {
        if self.roots.contains_key(&node) && kind != DOCUMENT_FRAGMENT_NODE {
            return Err(TreeError::NotDocumentFragment(node));
        }
        if self.owners.contains_key(&node) && kind != ELEMENT_NODE {
            return Err(TreeError::NotElement(node));
        }
        Ok(())
    }

    pub(crate) fn statistics(&self) -> RootHostStatistics {
        RootHostStatistics {
            hosted_roots: self.roots.len(),
            host_owners: self.owners.len(),
            root_capacity: self.roots.capacity(),
            owner_capacity: self.owners.capacity(),
        }
    }
}

#[derive(Clone, Copy)]
enum HostTraversal {
    ShadowIncluding,
    HostIncluding,
}

impl TreeStore {
    fn host_parent(&self, node: NodeId, traversal: HostTraversal) -> Result<Option<NodeId>> {
        let links = self.links_or_reserved(node)?;
        if links.parent != 0 {
            return Ok(Some(links.parent));
        }
        Ok(self
            .root_hosts
            .roots
            .get(&node)
            .filter(|relation| relation.shadow || matches!(traversal, HostTraversal::HostIncluding))
            .map(|relation| relation.host))
    }

    fn ancestor_through_hosts(
        &self,
        ancestor: NodeId,
        node: NodeId,
        traversal: HostTraversal,
    ) -> Result<bool> {
        let mut current = node;
        // Public topology mutations prevent ordinary cycles; raw host/topology combinations
        // can still form one, so bound the complete traversal without a visited-node allocation.
        for _ in 0..=self.nodes.len() {
            if current == ancestor {
                return Ok(true);
            }
            let Some(parent) = self.host_parent(current, traversal)? else {
                return Ok(false);
            };
            current = parent;
        }
        Err(TreeError::Cycle(current))
    }

    /// Constructor calls may register reserved handles before metadata is available.
    pub fn set_root_host(&mut self, root: f64, host: f64, shadow: bool) -> Result<()> {
        let root = node_id(root)?;
        self.validate_activation(root)?;
        if host == 0.0 {
            self.root_hosts.clear(root);
            return Ok(());
        }
        let host = node_id(host)?;
        self.validate_activation(host)?;
        if self.root_hosts.owners.contains_key(&root)
            || self
                .links_or_reserved(root)?
                .node_kind
                .is_some_and(|kind| kind != DOCUMENT_FRAGMENT_NODE)
        {
            return Err(TreeError::NotDocumentFragment(root));
        }
        if self.root_hosts.roots.contains_key(&host)
            || self
                .links_or_reserved(host)?
                .node_kind
                .is_some_and(|kind| kind != ELEMENT_NODE)
        {
            return Err(TreeError::NotElement(host));
        }
        if self.ancestor_through_hosts(root, host, HostTraversal::HostIncluding)? {
            return Err(TreeError::Cycle(root));
        }
        self.activate(root)?;
        self.activate(host)?;
        self.root_hosts.set(root, host, shadow);
        Ok(())
    }

    pub fn root_host(&self, root: f64) -> Result<f64> {
        let root = node_id(root)?;
        self.links(root)?;
        Ok(self
            .root_hosts
            .roots
            .get(&root)
            .map_or(0.0, |relation| relation.host as f64))
    }

    pub fn shadow_including_root(&self, node: f64) -> Result<f64> {
        let mut current = node_id(node)?;
        self.links(current)?;
        for _ in 0..=self.nodes.len() {
            let Some(parent) = self.host_parent(current, HostTraversal::ShadowIncluding)? else {
                return Ok(current as f64);
            };
            current = parent;
        }
        Err(TreeError::Cycle(current))
    }

    pub fn is_shadow_inclusive_ancestor(&self, ancestor: f64, node: f64) -> Result<bool> {
        let ancestor = node_id(ancestor)?;
        let node = node_id(node)?;
        self.links(ancestor)?;
        self.links(node)?;
        self.ancestor_through_hosts(ancestor, node, HostTraversal::ShadowIncluding)
    }

    pub fn is_host_inclusive_ancestor(&self, ancestor: f64, node: f64) -> Result<bool> {
        let ancestor = node_id(ancestor)?;
        let node = node_id(node)?;
        self.links(ancestor)?;
        self.links(node)?;
        self.ancestor_through_hosts(ancestor, node, HostTraversal::HostIncluding)
    }

    pub fn root_host_statistics(&self) -> RootHostStatistics {
        self.root_hosts.statistics()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn node(tree: &mut TreeStore, kind: u16) -> f64 {
        let node = tree.allocate().unwrap();
        tree.set_data(node, &format!(r#"{{"kind":{kind},"name":"node"}}"#))
            .unwrap();
        node
    }

    #[test]
    fn should_distinguish_shadow_roots_from_template_hosts_across_live_moves() {
        let mut tree = TreeStore::new();
        let document = node(&mut tree, 9);
        let host = node(&mut tree, 1);
        let root = node(&mut tree, 11);
        let child = node(&mut tree, 1);
        tree.append(document, host).unwrap();
        tree.append(root, child).unwrap();
        tree.set_root_host(root, host, true).unwrap();
        assert_eq!(tree.shadow_including_root(child).unwrap(), document);
        assert!(tree.is_shadow_inclusive_ancestor(host, child).unwrap());
        assert!(!tree.contains_node(host, child).unwrap());
        tree.set_root_host(root, host, false).unwrap();
        assert_eq!(tree.shadow_including_root(child).unwrap(), root);
        assert!(!tree.is_shadow_inclusive_ancestor(host, child).unwrap());
        assert!(tree.is_host_inclusive_ancestor(host, child).unwrap());
        tree.remove(host).unwrap();
        tree.set_root_host(root, host, true).unwrap();
        assert_eq!(tree.shadow_including_root(child).unwrap(), host);
        tree.set_root_host(root, 0.0, true).unwrap();
        assert_eq!(tree.shadow_including_root(child).unwrap(), root);
    }

    #[test]
    fn should_register_early_constructor_roles_and_preserve_failed_metadata_writes() {
        let mut tree = TreeStore::new();
        let root = tree.reserve_handles().unwrap();
        let host = root + 1.0;
        tree.set_root_host(root, host, true).unwrap();
        assert_eq!(tree.root_host(root).unwrap(), host);
        let before = tree.statistics();
        assert!(tree.set_data(root, r#"{"kind":1,"name":"wrong"}"#).is_err());
        assert!(tree.set_data(host, r#"{"kind":11}"#).is_err());
        assert_eq!(tree.statistics().data_updates, before.data_updates);
        tree.set_data(root, r#"{"kind":11}"#).unwrap();
        tree.set_data(host, r#"{"kind":1,"name":"host"}"#).unwrap();
        assert_eq!(tree.shadow_including_root(root).unwrap(), host);
    }

    #[test]
    fn should_reject_cycles_and_invalid_handles_without_materializing_reservations() {
        let mut tree = TreeStore::new();
        let root = tree.reserve_handles().unwrap();
        let host = root + 1.0;
        let before = tree.statistics();
        assert!(tree.set_root_host(root, root, true).is_err());
        assert!(tree.set_root_host(root, -1.0, true).is_err());
        assert!(tree.set_root_host(root, host + 1000.0, true).is_err());
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        tree.set_root_host(root, host, true).unwrap();
        tree.append(root, host).unwrap(); // Raw topology can create a cross-host cycle.
        assert!(tree.shadow_including_root(host).is_err());
        assert!(tree.set_root_host(root, host, true).is_err());
        tree.set_root_host(root, 0.0, false).unwrap();
        assert_eq!(tree.shadow_including_root(host).unwrap(), root);
    }

    #[test]
    fn should_release_both_directions_and_reclaim_capacity_with_a_live_root_remaining() {
        let mut tree = TreeStore::new();
        let host = node(&mut tree, 1);
        let retained = node(&mut tree, 11);
        tree.set_root_host(retained, host, true).unwrap();
        let roots: Vec<_> = (0..1024)
            .map(|_| {
                let root = node(&mut tree, 11);
                tree.set_root_host(root, host, false).unwrap();
                root
            })
            .collect();
        for root in roots {
            tree.release(root).unwrap();
        }
        assert_eq!(tree.root_host_statistics().hosted_roots, 1);
        assert!(tree.root_host_statistics().root_capacity < 256);
        tree.release(host).unwrap();
        assert_eq!(tree.root_host(retained).unwrap(), 0.0);
        let state = tree.root_host_statistics();
        assert_eq!(state.hosted_roots, 0);
        assert_eq!(state.host_owners, 0);
        assert_eq!(state.root_capacity, 0);
        assert_eq!(state.owner_capacity, 0);
        tree.release(retained).unwrap();
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_replace_owners_without_clearing_unrelated_roots_and_restore_root_links_after_moves() {
        let mut tree = TreeStore::new();
        let first_host = node(&mut tree, 1);
        let next_host = node(&mut tree, 1);
        let root = node(&mut tree, 11);
        let sibling_root = node(&mut tree, 11);
        let parent = node(&mut tree, 1);
        tree.set_root_host(root, first_host, true).unwrap();
        tree.set_root_host(sibling_root, first_host, false).unwrap();
        tree.set_root_host(root, next_host, true).unwrap();
        tree.release(first_host).unwrap();
        assert_eq!(tree.root_host(sibling_root).unwrap(), 0.0);
        assert_eq!(tree.root_host(root).unwrap(), next_host);
        tree.append(parent, root).unwrap();
        assert_eq!(tree.shadow_including_root(root).unwrap(), parent);
        tree.remove(root).unwrap();
        assert_eq!(tree.shadow_including_root(root).unwrap(), next_host);
        for handle in [root, sibling_root, next_host, parent] {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.root_host_statistics().hosted_roots, 0);
        assert_eq!(tree.root_host_statistics().host_owners, 0);
    }
}
