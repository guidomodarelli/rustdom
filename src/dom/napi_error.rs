//! Shared Node-API error translation, outside the runtime-independent domain errors.
use super::error::TreeError;
use napi::{Error, Status};

pub(super) fn to_napi_error(error: TreeError) -> Error {
    let status = if matches!(&error, TreeError::HandleExhausted) {
        Status::GenericFailure
    } else {
        Status::InvalidArg
    };
    Error::new(status, error.to_string())
}
