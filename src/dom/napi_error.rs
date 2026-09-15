//! Shared Node-API error translation, outside the runtime-independent domain errors.
use super::error::TreeError;
use napi::{Env, Error, Status, bindgen_prelude::Unknown};

/// Preserve arbitrary JavaScript thrown values without coercing them to an Error message.
pub(crate) fn capture_pending_error(env: &Env, error: Error) -> Error {
    let mut pending = false;
    // SAFETY: this Env belongs to an active synchronous N-API invocation.
    if unsafe { napi::sys::napi_is_exception_pending(env.raw(), &mut pending) }
        != napi::sys::Status::napi_ok
        || !pending
    {
        return error;
    }
    let mut exception = std::ptr::null_mut();
    // SAFETY: the pending exception is a live value in this callback's handle scope.
    if unsafe { napi::sys::napi_get_and_clear_last_exception(env.raw(), &mut exception) }
        != napi::sys::Status::napi_ok
    {
        return error;
    }
    // SAFETY: the checked operation initialized this handle in the current Env.
    Error::from_unknown_without_coercion(unsafe {
        Unknown::from_raw_unchecked(env.raw(), exception)
    })
}

pub(super) fn to_napi_error(error: TreeError) -> Error {
    let status = if matches!(
        &error,
        TreeError::HandleExhausted
            | TreeError::MutationObserverIdsExhausted
            | TreeError::MutationRecordTokensExhausted
    ) {
        Status::GenericFailure
    } else {
        Status::InvalidArg
    };
    Error::new(status, error.to_string())
}

/// Keep each public controller's protocol errors specific while sharing the content state machine.
pub(super) fn to_range_operation_error(error: TreeError, operation: &str) -> Error {
    match error {
        TreeError::RangeContentProtocol(reason) => {
            Error::new(Status::InvalidArg, format!("{operation}: {reason}"))
        }
        other => to_napi_error(other),
    }
}
