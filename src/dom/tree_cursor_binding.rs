//! N-API traversal suspension: no native reference to a JS callback, node or realm.
use super::{
    napi_error::to_napi_error,
    store::{TreeStore, node_id},
    tree_cursor::{Action, Cursor, FILTER_ACCEPT, FILTER_SKIP, Traversal, TraversalMethod},
};
use napi::{Error, Result};
use napi_derive::napi;
use std::sync::{
    Arc, Weak,
    atomic::{AtomicU64, Ordering},
};

static LIVE_CURSORS: AtomicU64 = AtomicU64::new(0);
static LIVE_OPERATIONS: AtomicU64 = AtomicU64::new(0);
static CREATED_OPERATIONS: AtomicU64 = AtomicU64::new(0);
static CREATED_CURSORS: AtomicU64 = AtomicU64::new(0);
static RELEASED_CURSORS: AtomicU64 = AtomicU64::new(0);

#[napi]
pub enum TraversalAction {
    Complete,
    Filter,
    Accepted,
    Recursive,
}
/// Positive results are accepted node handles; these sentinels cannot collide with them.
#[napi]
pub enum TraversalMoveResult {
    Recursive = -1,
    Complete = 0,
}
#[napi(object)]
pub struct TraversalInstruction {
    pub kind: TraversalAction,
    pub node: f64,
}
#[napi(object)]
pub struct TraversalStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
    pub operations: f64,
    pub created_operations: f64,
}

#[napi]
pub struct NativeTraversal {
    cursor: Cursor,
    forest: Weak<()>,
    identity: Arc<()>,
}

#[napi]
pub struct NativeTraversalOperation {
    traversal: Traversal,
    cursor: Weak<()>,
    awaiting_result: bool,
}

impl NativeTraversal {
    pub(super) fn create(tree: &TreeStore, root: f64, mask: u32, has_filter: bool) -> Result<Self> {
        let root = node_id(root).map_err(to_napi_error)?;
        tree.links(root).map_err(to_napi_error)?;
        LIVE_CURSORS.fetch_add(1, Ordering::Relaxed);
        CREATED_CURSORS.fetch_add(1, Ordering::Relaxed);
        Ok(Self {
            cursor: Cursor::new(root, mask, has_filter),
            forest: Arc::downgrade(&tree.delivery_identity),
            identity: Arc::new(()),
        })
    }

    fn check_forest(&self, tree: &TreeStore) -> Result<()> {
        if self.forest.as_ptr() != Arc::as_ptr(&tree.delivery_identity) {
            return Err(Error::from_reason(
                "NativeTraversal: operation belongs to a different forest",
            ));
        }
        Ok(())
    }

    /// The weak tokens keep allocation identities distinct without cloning them on every step.
    fn check_operation(
        &self,
        tree: &TreeStore,
        operation: &NativeTraversalOperation,
    ) -> Result<()> {
        self.check_forest(tree)?;
        if operation.cursor.as_ptr() != Arc::as_ptr(&self.identity) {
            return Err(Error::from_reason(
                "NativeTraversal: operation belongs to a different cursor",
            ));
        }
        Ok(())
    }

    pub(super) fn pre_remove(&mut self, tree: &TreeStore, removed: f64) -> Result<()> {
        self.check_forest(tree)?;
        self.cursor
            .pre_remove(tree, node_id(removed).map_err(to_napi_error)?)
            .map_err(to_napi_error)
    }

    pub(super) fn step(
        &mut self,
        tree: &TreeStore,
        operation: &mut NativeTraversalOperation,
    ) -> Result<TraversalInstruction> {
        self.check_operation(tree, operation)?;
        if operation.awaiting_result {
            return Err(Error::from_reason(
                "NativeTraversal: filter result is required before continuing",
            ));
        }
        self.advance(
            tree,
            &mut operation.traversal,
            &mut operation.awaiting_result,
        )
    }

    /// No callback can suspend this stack-local operation, so no JS operation object is needed.
    pub(super) fn move_unfiltered(
        &mut self,
        tree: &TreeStore,
        method: TraversalMethod,
    ) -> Result<f64> {
        self.check_forest(tree)?;
        if self.cursor.has_filter {
            return Err(Error::from_reason(
                "NativeTraversal: direct movement requires a cursor without a filter",
            ));
        }
        let mut traversal = Traversal::new(&self.cursor, method);
        let instruction = self.advance(tree, &mut traversal, &mut false)?;
        Ok(match instruction.kind {
            TraversalAction::Accepted => instruction.node,
            TraversalAction::Complete => TraversalMoveResult::Complete as i32 as f64,
            TraversalAction::Recursive => TraversalMoveResult::Recursive as i32 as f64,
            TraversalAction::Filter => {
                return Err(Error::from_reason(
                    "NativeTraversal: direct movement unexpectedly requested a filter",
                ));
            }
        })
    }

    /// Validate ownership before consuming the response; a wrong forest/cursor must leave it pending.
    pub(super) fn resume_step(
        &mut self,
        tree: &TreeStore,
        operation: &mut NativeTraversalOperation,
        result: u16,
    ) -> Result<TraversalInstruction> {
        self.check_operation(tree, operation)?;
        operation.resume(result)?;
        self.advance(
            tree,
            &mut operation.traversal,
            &mut operation.awaiting_result,
        )
    }

    /// Recycle an idle operation without reading its old, potentially released candidate.
    pub(super) fn restart_step(
        &mut self,
        tree: &TreeStore,
        operation: &mut NativeTraversalOperation,
        method: TraversalMethod,
    ) -> Result<TraversalInstruction> {
        self.check_operation(tree, operation)?;
        operation.traversal = Traversal::new(&self.cursor, method);
        operation.awaiting_result = false;
        self.advance(
            tree,
            &mut operation.traversal,
            &mut operation.awaiting_result,
        )
    }

    fn advance(
        &mut self,
        tree: &TreeStore,
        traversal: &mut Traversal,
        awaiting_result: &mut bool,
    ) -> Result<TraversalInstruction> {
        loop {
            let action = traversal
                .advance(tree, self.cursor.current)
                .map_err(to_napi_error)?;
            match action {
                Action::Complete => {
                    return Ok(TraversalInstruction {
                        kind: TraversalAction::Complete,
                        node: 0.0,
                    });
                }
                Action::Accept(node) => {
                    self.cursor.current = node;
                    self.cursor.before = traversal.before;
                    return Ok(TraversalInstruction {
                        kind: TraversalAction::Accepted,
                        node: node as f64,
                    });
                }
                Action::Filter(node) => {
                    if self.cursor.active {
                        return Ok(TraversalInstruction {
                            kind: TraversalAction::Recursive,
                            node: node as f64,
                        });
                    }
                    let kind = tree
                        .links(node)
                        .map_err(to_napi_error)?
                        .node_kind
                        .ok_or_else(|| {
                            Error::from_reason("NativeTraversal: candidate has no node type")
                        })?;
                    if self.cursor.mask & 1u32.wrapping_shl(u32::from(kind).wrapping_sub(1)) == 0 {
                        traversal.resume(FILTER_SKIP);
                    } else if !self.cursor.has_filter {
                        traversal.resume(FILTER_ACCEPT);
                    } else {
                        self.cursor.active = true;
                        *awaiting_result = true;
                        return Ok(TraversalInstruction {
                            kind: TraversalAction::Filter,
                            node: node as f64,
                        });
                    }
                }
            }
        }
    }
}

impl Drop for NativeTraversal {
    fn drop(&mut self) {
        LIVE_CURSORS.fetch_sub(1, Ordering::Relaxed);
        RELEASED_CURSORS.fetch_add(1, Ordering::Relaxed);
    }
}
impl Drop for NativeTraversalOperation {
    fn drop(&mut self) {
        LIVE_OPERATIONS.fetch_sub(1, Ordering::Relaxed);
    }
}

#[napi]
impl NativeTraversal {
    #[napi]
    pub fn start(&self, method: TraversalMethod) -> NativeTraversalOperation {
        LIVE_OPERATIONS.fetch_add(1, Ordering::Relaxed);
        CREATED_OPERATIONS.fetch_add(1, Ordering::Relaxed);
        NativeTraversalOperation {
            traversal: Traversal::new(&self.cursor, method),
            cursor: Arc::downgrade(&self.identity),
            awaiting_result: false,
        }
    }
    #[napi(getter)]
    pub fn current(&self) -> f64 {
        self.cursor.current as f64
    }
    #[napi(setter)]
    pub fn set_current(&mut self, node: f64) -> Result<()> {
        self.cursor.current = node_id(node).map_err(to_napi_error)?;
        Ok(())
    }
    #[napi(getter)]
    pub fn before(&self) -> bool {
        self.cursor.before
    }
    #[napi(setter)]
    pub fn set_active(&mut self, active: bool) {
        self.cursor.active = active;
    }
    #[napi]
    pub fn statistics() -> TraversalStatistics {
        TraversalStatistics {
            live: LIVE_CURSORS.load(Ordering::Relaxed) as f64,
            created: CREATED_CURSORS.load(Ordering::Relaxed) as f64,
            released: RELEASED_CURSORS.load(Ordering::Relaxed) as f64,
            operations: LIVE_OPERATIONS.load(Ordering::Relaxed) as f64,
            created_operations: CREATED_OPERATIONS.load(Ordering::Relaxed) as f64,
        }
    }
}

#[napi]
impl NativeTraversalOperation {
    #[napi]
    pub fn resume(&mut self, result: u16) -> Result<()> {
        if !self.awaiting_result {
            return Err(Error::from_reason(
                "NativeTraversal: no filter result is pending",
            ));
        }
        self.awaiting_result = false;
        self.traversal.resume(result);
        Ok(())
    }
}
