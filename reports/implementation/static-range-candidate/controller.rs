//! StaticRange construction decisions with scoped host references and numeric native ownership.
use super::{
    constants::{
        ATTRIBUTE_NODE, DOCUMENT_TYPE_NODE, STATIC_RANGE_INVALID_NODE_MESSAGE,
        STATIC_RANGE_OPERATION_FAILURE,
    },
    napi_error::capture_pending_error,
    range_state::RangeState,
    range_state_binding::NativeRange,
};
use napi::{
    Env, Error, JsValue, Result, Status, ValueType,
    bindgen_prelude::{FnArgs, Function, JsObjectValue, Unknown},
};
use napi_derive::napi;

fn has_kind(node: Unknown<'_>, kind: u16) -> Result<bool> {
    let value: Unknown = node.coerce_to_object()?.get_c_named_property(c"nodeType")?;
    // Strict equality does not coerce strings, objects, bigint or other host values.
    Ok(value.get_type()? == ValueType::Number
        && value.coerce_to_number()?.get_double()? == f64::from(kind))
}

fn invalid_node(node: Unknown<'_>) -> Result<bool> {
    // Match the reference's repeated property reads and short-circuit ordering.
    Ok(has_kind(node, DOCUMENT_TYPE_NODE)? || has_kind(node, ATTRIBUTE_NODE)?)
}

fn construct<'env>(
    global: Unknown<'env>,
    start_node: Unknown<'env>,
    start_offset: f64,
    end_node: Unknown<'env>,
    end_offset: f64,
    helpers: Unknown<'env>,
) -> Result<NativeRange> {
    let host = helpers.coerce_to_object()?;
    if invalid_node(start_node)? || invalid_node(end_node)? {
        let reject: Function<FnArgs<(Unknown, String, String)>, Unknown> =
            host.get_c_named_property(c"exception")?;
        let exception = reject.apply(
            helpers,
            (
                global,
                STATIC_RANGE_INVALID_NODE_MESSAGE.to_owned(),
                "InvalidNodeTypeError".to_owned(),
            )
                .into(),
        )?;
        return Err(Error::from_unknown_without_coercion(exception));
    }
    // No TreeStore borrow or native box exists when either host callback runs.
    let identify: Function<Unknown, f64> = host.get_c_named_property(c"nodeId")?;
    let start = identify.apply(helpers, start_node)?;
    let end = identify.apply(helpers, end_node)?;
    let state = RangeState::from_endpoints(start, start_offset, end, end_offset)
        .map_err(super::napi_error::to_napi_error)?;
    Ok(NativeRange::with_state(state))
}

/// Validate the converted StaticRange nodes and create one numeric state after all host reads.
/// Host callbacks are synchronous; no JavaScript reference escapes this invocation.
#[napi]
pub fn initialize_static_range<'env>(
    env: &'env Env,
    global: Unknown<'env>,
    start_node: Unknown<'env>,
    start_offset: f64,
    end_node: Unknown<'env>,
    end_offset: f64,
    helpers: Unknown<'env>,
) -> Result<NativeRange> {
    match construct(
        global,
        start_node,
        start_offset,
        end_node,
        end_offset,
        helpers,
    ) {
        Ok(state) => Ok(state),
        Err(error) => {
            // The generic native error wrapper reconstructs Error; throw the original
            // value explicitly, as the existing XMLSerializer controller does.
            env.throw(capture_pending_error(env, error))?;
            Err(Error::new(
                Status::PendingException,
                STATIC_RANGE_OPERATION_FAILURE,
            ))
        }
    }
}
