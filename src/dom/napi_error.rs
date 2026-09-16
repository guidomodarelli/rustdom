//! Shared Node-API error translation, outside the runtime-independent domain errors.
use super::error::TreeError;
use napi::{
    Env, Error, Result, Status,
    bindgen_prelude::{FnArgs, Function, Unknown},
};

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

/// Preserve the source expression that V8 includes in a missing-iterator diagnostic.
#[derive(Clone, Copy)]
pub(crate) enum IterationSource {
    Controls,
    Options,
}

/// Produce an engine error from inert values already observed by the caller.
/// No real iterator/conversion is reentered and no persistent reference is created.
fn protocol_error(env: &Env, source: &str, first: Unknown, second: Unknown) -> Result<Error> {
    let reject: Function<FnArgs<(Unknown, Unknown)>, ()> = env.run_script(source)?;
    match reject.call((first, second).into()) {
        Err(error) => Ok(capture_pending_error(env, error)),
        Ok(()) => Err(Error::from_reason(
            "Protocol diagnostic requires an invalid value",
        )),
    }
}

/// Reject an already-read non-callable iterator method without observing it again.
pub(crate) fn iterator_method_error(
    env: &Env,
    iterator_key: Unknown,
    method: Unknown,
    site: IterationSource,
) -> Result<Error> {
    let source = match site {
        IterationSource::Controls => {
            r#"((key, method) => {
            const controls = { __proto__: null, [key]: method };
            for (const field of controls) break;
        })"#
        }
        IterationSource::Options => {
            r#"((key, method) => {
            const field = { __proto__: null, options: { __proto__: null, [key]: method } };
            for (const option of field.options) break;
        })"#
        }
    };
    protocol_error(env, source, iterator_key, method)
}

/// Reject a primitive returned by the actual iterator factory without calling it twice.
pub(crate) fn iterator_object_error(
    env: &Env,
    iterator_key: Unknown,
    value: Unknown,
) -> Result<Error> {
    protocol_error(
        env,
        r#"((key, value) => {
        const iterable = { __proto__: null, [key]() { return value; } };
        for (const entry of iterable) break;
    })"#,
        iterator_key,
        value,
    )
}

/// Reject a cached non-callable next slot with V8's side-effect-free diagnostic.
pub(crate) fn iterator_next_error(
    env: &Env,
    iterator_key: Unknown,
    next: Unknown,
) -> Result<Error> {
    protocol_error(
        env,
        r#"((key, next) => {
        const iterable = { __proto__: null, [key]() { return { __proto__: null, next }; } };
        for (const entry of iterable) break;
    })"#,
        iterator_key,
        next,
    )
}

/// Ask the engine to create its intrinsic TypeError for an already-read primitive iterator result.
/// The synthetic iterator cannot reenter or close the caller's actual iterator.
pub(crate) fn iterator_result_error(
    env: &Env,
    iterator_key: Unknown,
    result: Unknown,
) -> Result<Error> {
    protocol_error(
        env,
        r#"((iteratorKey, result) => {
        const iterable = {
            __proto__: null,
            [iteratorKey]() { return { __proto__: null, next() { return result; } }; }
        };
        for (const value of iterable) break;
    })"#,
        iterator_key,
        result,
    )
}

/// Keep explicit WebIDL conversion calls distinct from intrinsic iteration diagnostics.
pub(crate) enum StringConversionFault {
    Constructor,
    NullResult,
    Method,
}

/// Reproduce the conversion expression's error using only a previously observed invalid slot/value.
pub(crate) fn string_conversion_error(
    env: &Env,
    value: Unknown,
    fault: StringConversionFault,
) -> Result<Error> {
    let source = match fault {
        StringConversionFault::Constructor => "(StringCtor => { StringCtor(); })",
        StringConversionFault::NullResult => "(value => { value.toWellFormed(); })",
        StringConversionFault::Method => {
            r#"(method => {
            const exports = { __proto__: null, DOMString() { return { __proto__: null, toWellFormed: method }; } };
            exports.DOMString().toWellFormed();
        })"#
        }
    };
    protocol_error(env, source, value, value)
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
