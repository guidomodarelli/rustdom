//! Shared Node-API error translation, outside the runtime-independent domain errors.
use super::error::TreeError;
use napi::{Error, Status};

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
