//! Own the complete result until N-API copies it, choosing one-byte strings when possible.
use napi::{Env, Result, bindgen_prelude::ToNapiValue, sys};

/// Only Rust allocations cross the borrowed-input boundary; there are no persistent JS handles.
pub enum ReaderString {
    Latin1(Vec<u8>),
    Utf16(Vec<u16>),
}

impl ToNapiValue for ReaderString {
    unsafe fn to_napi_value(raw_env: sys::napi_env, output: Self) -> Result<sys::napi_value> {
        // ToNapiValue's caller supplies the current callback environment. The safe
        // string APIs copy the owned slices before they are dropped; the result stays in scope.
        let env = Env::from_raw(raw_env);
        let value = match output {
            Self::Latin1(bytes) => env.create_string_latin1(bytes)?,
            Self::Utf16(units) => env.create_string_utf16(units)?,
        };
        // SAFETY: value was just created in this same live callback environment.
        unsafe { ToNapiValue::to_napi_value(raw_env, value) }
    }
}
