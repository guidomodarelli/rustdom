//! Shared lossless DOM-string conversion at the Node-API boundary.
use super::data::DomString;
use napi::bindgen_prelude::{Either, Utf16String};

/// Copy borrowed UTF-8 directly into V8; preserve isolated UTF-16 units on the fallback.
pub(super) fn string_result(value: Option<&DomString>) -> Option<Either<&str, Utf16String>> {
    value.map(|value| match value {
        DomString::Text(value) => Either::A(value.as_str()),
        DomString::Utf16(value) => Either::B(value.clone().into()),
    })
}
