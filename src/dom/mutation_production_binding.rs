//! Borrow primitive JS strings during preparation and copy oldValue only when a selected observer requests it.
use super::{
    data::DomString,
    mutation_record::{MutationKind, MutationRecordDraft},
    mutation_record_binding::NativeMutationRecord,
    napi_error::to_napi_error,
    store::TreeStore,
};
use napi::{
    JsString, Result,
    bindgen_prelude::{Either, Null},
};
use napi_derive::napi;

#[napi(object, object_to_js = false)]
pub struct NativeMutationProductionInput<'env> {
    pub kind: String,
    pub target: f64,
    pub previous_sibling: f64,
    pub next_sibling: f64,
    pub attribute_name: Option<Either<JsString<'env>, Null>>,
    pub attribute_namespace: Option<Either<JsString<'env>, Null>>,
    pub old_value: Option<Either<JsString<'env>, Null>>,
    pub added_nodes: Vec<f64>,
    pub removed_nodes: Vec<f64>,
}

#[napi(object, object_from_js = false)]
pub struct NativePreparedMutation {
    pub observer: f64,
    pub record: NativeMutationRecord,
}

/// The explicit string length excludes N-API's terminator while preserving actual trailing NUL units.
fn owned_string(value: Option<Either<JsString<'_>, Null>>) -> Result<Option<DomString>> {
    match value {
        Some(Either::A(value)) => {
            let length = value.utf16_len()?;
            let utf16 = value.into_utf16()?;
            Ok(Some(DomString::from_units(&utf16.as_slice()[..length])))
        }
        _ => Ok(None),
    }
}

pub(super) fn prepare(
    tree: &TreeStore,
    input: NativeMutationProductionInput<'_>,
) -> Result<Vec<NativePreparedMutation>> {
    let kind = MutationKind::parse(&input.kind).map_err(to_napi_error)?;
    let name = owned_string(input.attribute_name)?;
    let namespace = owned_string(input.attribute_namespace)?;
    let interests = tree
        .interested_mutation_observers(input.target, kind, name.as_ref(), namespace.as_ref())
        .map_err(to_napi_error)?;
    if interests.is_empty() {
        return Ok(Vec::new());
    }
    let old_value = if interests.iter().any(|interest| interest.old_value) {
        owned_string(input.old_value)?
    } else {
        None
    };
    let draft = MutationRecordDraft {
        kind: input.kind,
        target: input.target,
        previous_sibling: input.previous_sibling,
        next_sibling: input.next_sibling,
        attribute_name: name,
        attribute_namespace: namespace,
        old_value,
        added_nodes: input.added_nodes,
        removed_nodes: input.removed_nodes,
    };
    tree.prepare_selected_mutations(draft, interests)
        .map(|records| {
            records
                .into_iter()
                .map(|record| NativePreparedMutation {
                    observer: record.observer as f64,
                    record: NativeMutationRecord::from_shared(record.record),
                })
                .collect()
        })
        .map_err(to_napi_error)
}
