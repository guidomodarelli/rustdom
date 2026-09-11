//! Node-API adapter for the platform-independent tree store.
use super::{error::TreeError, store};
use napi::{Error, Result, Status};
use napi_derive::napi;

#[napi(object)]
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

impl From<store::TreeLinks> for TreeLinks {
    fn from(links: store::TreeLinks) -> Self {
        Self {
            id: links.id,
            parent: links.parent,
            previous: links.previous,
            next: links.next,
            first: links.first,
            last: links.last,
            child_count: links.child_count,
            children_version: links.children_version,
        }
    }
}

#[napi(object)]
pub struct TreeStatistics {
    pub live_nodes: f64,
    pub capacity: f64,
    pub allocations: f64,
    pub releases: f64,
    pub mutations: f64,
    pub reserved_handles: f64,
}

/// Convert errors only at the JavaScript boundary; core tests never need Node symbols.
fn to_napi_error(error: TreeError) -> Error {
    let status = if error == TreeError::HandleExhausted {
        Status::GenericFailure
    } else {
        Status::InvalidArg
    };
    Error::new(status, error.to_string())
}

/// Own native topology while JavaScript maintains the corresponding GC ownership edges.
#[napi]
#[derive(Default)]
pub struct NativeTree {
    store: store::TreeStore,
}

#[napi]
impl NativeTree {
    /// Share the canonical allocation policy with JavaScript without duplicating constants.
    #[napi(getter)]
    pub fn handle_batch_size(&self) -> u32 {
        store::HANDLE_BATCH_SIZE as u32
    }

    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            store: store::TreeStore::new(),
        }
    }

    /// Allocate a stable handle that is never reused.
    #[napi]
    pub fn allocate(&mut self) -> Result<f64> {
        self.store.allocate().map_err(to_napi_error)
    }

    /// Reserve a fixed handle batch without retaining nodes for unused entries.
    #[napi]
    pub fn reserve_handles(&mut self) -> Result<f64> {
        self.store.reserve_handles().map_err(to_napi_error)
    }

    /// Inspect one authoritative native link record.
    #[napi]
    pub fn get_links(&mut self, handle: f64) -> Result<TreeLinks> {
        self.store
            .get_links(handle)
            .map(Into::into)
            .map_err(to_napi_error)
    }

    /// Append a detached node after validating all affected handles.
    #[napi]
    pub fn append(&mut self, parent: f64, child: f64) -> Result<f64> {
        self.store.append(parent, child).map_err(to_napi_error)
    }

    /// Prepend a detached node without exposing partial mutation on failure.
    #[napi]
    pub fn prepend(&mut self, parent: f64, child: f64) -> Result<f64> {
        self.store.prepend(parent, child).map_err(to_napi_error)
    }

    /// Insert before an existing sibling.
    #[napi]
    pub fn insert_before(&mut self, reference: f64, child: f64) -> Result<f64> {
        self.store
            .insert_before(reference, child)
            .map_err(to_napi_error)
    }

    /// Insert after an existing sibling.
    #[napi]
    pub fn insert_after(&mut self, reference: f64, child: f64) -> Result<f64> {
        self.store
            .insert_after(reference, child)
            .map_err(to_napi_error)
    }

    /// Detach one node while preserving its subtree.
    #[napi]
    pub fn remove(&mut self, handle: f64) -> Result<f64> {
        self.store.remove(handle).map_err(to_napi_error)
    }

    /// Traverse a subtree in preorder using one Node-API call.
    #[napi]
    pub fn descendants(&mut self, handle: f64) -> Result<Vec<f64>> {
        self.store.descendants(handle).map_err(to_napi_error)
    }

    /// Reclaim a collected owner; repeated release is harmless.
    #[napi]
    pub fn release(&mut self, handle: f64) -> Result<bool> {
        self.store.release(handle).map_err(to_napi_error)
    }

    /// Observe allocation and mutation counters without retaining nodes.
    #[napi]
    pub fn statistics(&self) -> TreeStatistics {
        let stats = self.store.statistics();
        TreeStatistics {
            live_nodes: stats.live_nodes,
            capacity: stats.capacity,
            allocations: stats.allocations,
            releases: stats.releases,
            mutations: stats.mutations,
            reserved_handles: stats.reserved_handles,
        }
    }
}
