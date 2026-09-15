//! V8-finalized immutable MutationRecord payloads with lossless nullable strings.
use super::{
    data::DomString,
    mutation_record::{MutationRecordDraft, MutationRecordState},
    napi_error::to_napi_error,
    napi_string::string_result,
    tree::NativeTree,
};
use napi::{
    Result,
    bindgen_prelude::{Either, Null, Utf16String},
};
use napi_derive::napi;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE_RECORDS: AtomicU64 = AtomicU64::new(0);
static CREATED_RECORDS: AtomicU64 = AtomicU64::new(0);
static RELEASED_RECORDS: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct MutationRecordInput {
    pub kind: String,
    pub target: f64,
    pub previous_sibling: f64,
    pub next_sibling: f64,
    pub attribute_name: Option<Either<Utf16String, Null>>,
    pub attribute_namespace: Option<Either<Utf16String, Null>>,
    pub old_value: Option<Either<Utf16String, Null>>,
    pub added_nodes: Vec<f64>,
    pub removed_nodes: Vec<f64>,
}

#[napi(object)]
pub struct MutationRecordStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
}

#[napi]
pub struct NativeMutationRecord {
    state: Arc<MutationRecordState>,
}

impl NativeMutationRecord {
    pub(super) fn shared_state(&self) -> Arc<MutationRecordState> {
        Arc::clone(&self.state)
    }
    pub(super) fn from_shared(state: Arc<MutationRecordState>) -> Self {
        LIVE_RECORDS.fetch_add(1, Ordering::Relaxed);
        CREATED_RECORDS.fetch_add(1, Ordering::Relaxed);
        Self { state }
    }
}

/// Optional object properties and explicit null are distinct inputs at the N-API object boundary.
fn nullable_string(value: Option<Either<Utf16String, Null>>) -> Option<DomString> {
    match value {
        Some(Either::A(value)) => Some(DomString::from_units(&value)),
        _ => None,
    }
}

impl Drop for NativeMutationRecord {
    fn drop(&mut self) {
        LIVE_RECORDS.fetch_sub(1, Ordering::Relaxed);
        RELEASED_RECORDS.fetch_add(1, Ordering::Relaxed);
    }
}

#[napi]
impl NativeMutationRecord {
    #[napi(constructor)]
    pub fn new(tree: &NativeTree, input: MutationRecordInput) -> Result<Self> {
        let state = tree
            .mutation_record_state(MutationRecordDraft {
                kind: input.kind,
                target: input.target,
                previous_sibling: input.previous_sibling,
                next_sibling: input.next_sibling,
                attribute_name: nullable_string(input.attribute_name),
                attribute_namespace: nullable_string(input.attribute_namespace),
                old_value: nullable_string(input.old_value),
                added_nodes: input.added_nodes,
                removed_nodes: input.removed_nodes,
            })
            .map_err(to_napi_error)?;
        Ok(Self::from_shared(Arc::new(state)))
    }
    #[napi(getter)]
    pub fn kind(&self) -> &'static str {
        self.state.kind.as_str()
    }
    #[napi(getter)]
    pub fn target(&self) -> f64 {
        self.state.target as f64
    }
    #[napi(getter)]
    pub fn previous_sibling(&self) -> f64 {
        self.state.previous_sibling as f64
    }
    #[napi(getter)]
    pub fn next_sibling(&self) -> f64 {
        self.state.next_sibling as f64
    }
    #[napi(getter)]
    pub fn attribute_name(&self) -> Option<Either<&str, Utf16String>> {
        string_result(self.state.attribute_name.as_ref())
    }
    #[napi(getter)]
    pub fn attribute_namespace(&self) -> Option<Either<&str, Utf16String>> {
        string_result(self.state.attribute_namespace.as_ref())
    }
    #[napi(getter)]
    pub fn old_value(&self) -> Option<Either<&str, Utf16String>> {
        string_result(self.state.old_value.as_ref())
    }
    #[napi(getter)]
    pub fn added_nodes(&self) -> Vec<f64> {
        self.state
            .added_nodes
            .iter()
            .map(|&node| node as f64)
            .collect()
    }
    #[napi(getter)]
    pub fn removed_nodes(&self) -> Vec<f64> {
        self.state
            .removed_nodes
            .iter()
            .map(|&node| node as f64)
            .collect()
    }
    #[napi]
    pub fn statistics() -> MutationRecordStatistics {
        MutationRecordStatistics {
            live: LIVE_RECORDS.load(Ordering::Relaxed) as f64,
            created: CREATED_RECORDS.load(Ordering::Relaxed) as f64,
            released: RELEASED_RECORDS.load(Ordering::Relaxed) as f64,
        }
    }
}
