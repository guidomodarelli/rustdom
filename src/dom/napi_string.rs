//! Shared lossless DOM-string conversion at the Node-API boundary.
use super::data::DomString;
use napi::bindgen_prelude::{Either, Either3, Undefined, Utf16String};

/// Copy borrowed UTF-8 directly into V8; preserve isolated UTF-16 units on the fallback.
pub(super) fn string_result(value: Option<&DomString>) -> Option<Either<&str, Utf16String>> {
    value.map(|value| match value {
        DomString::Text(value) => Either::A(value.as_str()),
        DomString::Utf16(value) => Either::B(value.clone().into()),
        DomString::Undefined => unreachable!("Undefined is restricted to CharacterData getters"),
    })
}

/// Preserve internal undefined separately from nullable Node values at the V8 boundary.
pub(super) fn node_string_result(
    value: Option<&DomString>,
) -> Option<Either3<&str, Utf16String, Undefined>> {
    value.map(|value| match value {
        DomString::Text(value) => Either3::A(value.as_str()),
        DomString::Utf16(value) => Either3::B(value.clone().into()),
        DomString::Undefined => Either3::C(()),
    })
}
