//! DOMParser dispatch and recovery within one synchronous Node-API scope.
use super::napi_error::capture_pending_error;
use napi::{
    Env, Error, JsValue, Result, Status, ValueType,
    bindgen_prelude::{
        FnArgs, FromNapiValue, Function, JsObjectValue, ToNapiValue, Unknown, Utf16String,
    },
};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

const XML_MIME_TYPES: [&str; 4] = [
    "text/xml",
    "application/xml",
    "application/xhtml+xml",
    "image/svg+xml",
];
const PARSER_ERROR_NAMESPACE: &str = "http://www.mozilla.org/newlayout/xml/parsererror.xml";
static CALLS: AtomicU64 = AtomicU64::new(0);
static ACTIVE: AtomicU64 = AtomicU64::new(0);
static XML_RECOVERIES: AtomicU64 = AtomicU64::new(0);
struct Guard;
impl Drop for Guard {
    fn drop(&mut self) {
        ACTIVE.fetch_sub(1, Ordering::Relaxed);
    }
}

fn parsing_mode(content_type: &[u16]) -> Option<&'static str> {
    let matches = |expected: &str| content_type.iter().copied().eq(expected.encode_utf16());
    if matches("text/html") {
        Some("html")
    } else if XML_MIME_TYPES.iter().any(|value| matches(value)) {
        Some("xml")
    } else {
        None
    }
}

#[napi]
pub enum DomParserOperation {
    ParseFromString,
    CreateScriptingDisabledDocument,
}

struct Host<'env> {
    env: &'env Env,
    owner: Unknown<'env>,
    helpers: Unknown<'env>,
}
impl<'env> Host<'env> {
    fn get(&self, receiver: Unknown, name: &str) -> Result<Unknown<'env>> {
        receiver.coerce_to_object()?.get_named_property(name)
    }
    fn text(&self, value: &str) -> Result<Unknown<'env>> {
        Ok(self.env.create_string(value)?.to_unknown())
    }
    fn call0(&self, name: &str) -> Result<Unknown<'env>> {
        Function::<(), Unknown>::from_unknown(self.get(self.helpers, name)?)?
            .apply(self.helpers, ())
    }
    fn call1(&self, name: &str, first: Unknown) -> Result<Unknown<'env>> {
        Function::<Unknown, Unknown>::from_unknown(self.get(self.helpers, name)?)?
            .apply(self.helpers, first)
    }
    fn call2(&self, name: &str, first: Unknown, second: Unknown) -> Result<Unknown<'env>> {
        Function::<FnArgs<(Unknown, Unknown)>, Unknown>::from_unknown(
            self.get(self.helpers, name)?,
        )?
        .apply(self.helpers, (first, second).into())
    }
    fn call3(
        &self,
        name: &str,
        first: Unknown,
        second: Unknown,
        third: Unknown,
    ) -> Result<Unknown<'env>> {
        Function::<FnArgs<(Unknown, Unknown, Unknown)>, Unknown>::from_unknown(
            self.get(self.helpers, name)?,
        )?
        .apply(self.helpers, (first, second, third).into())
    }
    fn call4(
        &self,
        name: &str,
        first: Unknown,
        second: Unknown,
        third: Unknown,
        fourth: Unknown,
    ) -> Result<Unknown<'env>> {
        Function::<FnArgs<(Unknown, Unknown, Unknown, Unknown)>, Unknown>::from_unknown(
            self.get(self.helpers, name)?,
        )?
        .apply(self.helpers, (first, second, third, fourth).into())
    }
    fn parse_document(
        &self,
        mode: Unknown,
        content_type: Unknown,
        markup: Unknown,
    ) -> Result<Unknown<'env>> {
        Function::<FnArgs<(Unknown, Unknown, Unknown)>, Unknown>::from_unknown(
            self.get(self.helpers, "parseDocument")?,
        )?
        .apply(self.owner, (mode, content_type, markup).into())
    }
    fn empty_document(&self, mode: Unknown, content_type: Unknown) -> Result<Unknown<'env>> {
        Function::<FnArgs<(Unknown, Unknown)>, Unknown>::from_unknown(
            self.get(self.helpers, "emptyDocument")?,
        )?
        .apply(self.owner, (mode, content_type).into())
    }
    fn caught_value(&self, error: Error) -> Result<Unknown<'env>> {
        let captured = capture_pending_error(self.env, error);
        // SAFETY: conversion runs on the active Env's owning thread. Error's ToNapiValue
        // returns the original retained value, including primitives, in this handle scope.
        // Its temporary reference is released by the conversion; the scoped handle remains live.
        let raw = unsafe { Error::to_napi_value(self.env.raw(), captured)? };
        Ok(unsafe { Unknown::from_raw_unchecked(self.env.raw(), raw) })
    }
    fn run(&self, operation: DomParserOperation, args: Unknown<'env>) -> Result<Unknown<'env>> {
        let arg = |index| args.coerce_to_object()?.get_element::<Unknown>(index);
        match operation {
            DomParserOperation::ParseFromString => {
                let markup = arg(0)?;
                let content_type = arg(1)?;
                let converted = self.call1("contentTypeString", content_type)?;
                let mode = if converted.get_type()? == ValueType::String {
                    parsing_mode(&Utf16String::from_unknown(converted)?)
                } else {
                    None
                };
                let Some(mode) = mode else {
                    return self.call0("invalidContentType");
                };
                let parsing_mode = self.text(mode)?;
                if mode == "html" {
                    return self.parse_document(parsing_mode, content_type, markup);
                }
                match self.parse_document(parsing_mode, content_type, markup) {
                    Ok(document) => Ok(document),
                    Err(error) => {
                        let error = self.caught_value(error)?;
                        XML_RECOVERIES.fetch_add(1, Ordering::Relaxed);
                        let document = self.empty_document(parsing_mode, content_type)?;
                        let element = self.call3(
                            "createParserError",
                            document,
                            self.text(PARSER_ERROR_NAMESPACE)?,
                            self.text("parsererror")?,
                        )?;
                        self.call2("writeParserError", element, error)?;
                        self.call2("appendParserError", document, element)?;
                        Ok(document)
                    }
                }
            }
            DomParserOperation::CreateScriptingDisabledDocument => {
                let global = self.get(self.owner, "_globalObject")?;
                let url = self.call1("documentUrl", self.owner)?;
                let document = self.call4("createDocument", global, arg(0)?, arg(1)?, url)?;
                let markup = arg(2)?;
                if markup.get_type()? != ValueType::Undefined {
                    self.call2("parseIntoDocument", markup, document)?;
                }
                Ok(document)
            }
        }
    }
}

#[napi]
pub fn dom_parser_operation<'env>(
    env: &'env Env,
    owner: Unknown<'env>,
    operation: DomParserOperation,
    args: Unknown<'env>,
    helpers: Unknown<'env>,
) -> Result<Unknown<'env>> {
    CALLS.fetch_add(1, Ordering::Relaxed);
    ACTIVE.fetch_add(1, Ordering::Relaxed);
    let _guard = Guard;
    match (Host {
        env,
        owner,
        helpers,
    })
    .run(operation, args)
    {
        Ok(value) => Ok(value),
        Err(error) => {
            env.throw(capture_pending_error(env, error))?;
            Err(Error::new(
                Status::PendingException,
                "DOMParser native operation failed",
            ))
        }
    }
}
#[napi(object)]
pub struct DomParserStatistics {
    pub calls: f64,
    pub active: f64,
    pub xml_recoveries: f64,
}
#[napi]
pub fn dom_parser_statistics() -> DomParserStatistics {
    DomParserStatistics {
        calls: CALLS.load(Ordering::Relaxed) as f64,
        active: ACTIVE.load(Ordering::Relaxed) as f64,
        xml_recoveries: XML_RECOVERIES.load(Ordering::Relaxed) as f64,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_dispatch_only_exact_supported_mime_values() {
        assert_eq!(
            parsing_mode(&"text/html".encode_utf16().collect::<Vec<_>>()),
            Some("html")
        );
        for value in XML_MIME_TYPES {
            assert_eq!(
                parsing_mode(&value.encode_utf16().collect::<Vec<_>>()),
                Some("xml")
            );
        }
        for value in [
            "",
            "TEXT/HTML",
            "text/html; charset=utf-8",
            " text/xml",
            "text/xml\0",
        ] {
            assert_eq!(
                parsing_mode(&value.encode_utf16().collect::<Vec<_>>()),
                None
            );
        }
        assert_eq!(parsing_mode(&[0xd800]), None);
    }
}
