//! Scoped DOMImplementation control; all document owners remain visible to V8.
use super::{document_implementation, napi_error::capture_pending_error};
use napi::{
    Env, Error, JsValue, Result, Status, ValueType,
    bindgen_prelude::{FnArgs, FromNapiValue, Function, JsObjectValue, Unknown, Utf16String},
};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static CALLS: AtomicU64 = AtomicU64::new(0);
static ACTIVE: AtomicU64 = AtomicU64::new(0);
struct Guard;
impl Drop for Guard {
    fn drop(&mut self) {
        ACTIVE.fetch_sub(1, Ordering::Relaxed);
    }
}

#[napi]
pub enum DocumentImplementationOperation {
    HasFeature,
    CreateDocumentType,
    CreateDocument,
    CreateHtmlDocument,
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
    fn global(&self) -> Result<Unknown<'env>> {
        self.get(self.owner, "_globalObject")
    }
    fn text(&self, value: &str) -> Result<Unknown<'env>> {
        Ok(self.env.create_string(value)?.to_unknown())
    }
    fn null(&self) -> Result<Unknown<'env>> {
        self.env.to_js_value(&())
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
    fn document_type(
        &self,
        global: Unknown,
        owner: Unknown,
        name: Unknown,
        public_id: Unknown,
        system_id: Unknown,
    ) -> Result<Unknown<'env>> {
        Function::<FnArgs<(Unknown, Unknown, Unknown, Unknown, Unknown)>, Unknown>::from_unknown(
            self.get(self.helpers, "createDocumentType")?,
        )?
        .apply(
            self.helpers,
            (global, owner, name, public_id, system_id).into(),
        )
    }
    fn run(
        &self,
        operation: DocumentImplementationOperation,
        args: Unknown<'env>,
    ) -> Result<Unknown<'env>> {
        let arg = |index| args.coerce_to_object()?.get_element::<Unknown>(index);
        match operation {
            DocumentImplementationOperation::HasFeature => self.env.to_js_value(&true),
            DocumentImplementationOperation::CreateDocumentType => {
                let global = self.global()?;
                let name = arg(0)?;
                let value = name.coerce_to_string()?;
                let length = value.utf16_len()?;
                let converted = value.into_utf16()?;
                if !document_implementation::valid_qualified_name(&converted.as_slice()[..length]) {
                    self.call2("throwQNameError", global, name)?;
                }
                self.document_type(
                    self.global()?,
                    self.get(self.owner, "_ownerDocument")?,
                    name,
                    arg(1)?,
                    arg(2)?,
                )
            }
            DocumentImplementationOperation::CreateDocument => {
                let namespace = arg(0)?;
                let namespace_text = if namespace.get_type()? == ValueType::String {
                    Some(Utf16String::from_unknown(namespace)?.to_vec())
                } else {
                    None
                };
                let content_type = document_implementation::content_type(namespace_text.as_deref());
                let document = self.call2(
                    "createXmlDocument",
                    self.global()?,
                    self.text(content_type)?,
                )?;
                let name = arg(1)?;
                let element = if self.env.strict_equals(name, self.text("")?)? {
                    self.null()?
                } else {
                    self.call3("createElementNS", document, namespace, name)?
                };
                let doctype = arg(2)?;
                if doctype.get_type()? != ValueType::Null {
                    self.call2("appendToDocument", document, doctype)?;
                }
                if element.get_type()? != ValueType::Null {
                    self.call2("appendToDocument", document, element)?;
                }
                self.call2("copyOrigin", document, self.owner)?;
                Ok(document)
            }
            DocumentImplementationOperation::CreateHtmlDocument => {
                let document = self.call1("createHtmlDocument", self.global()?)?;
                let doctype = self.document_type(
                    self.global()?,
                    document,
                    self.text("html")?,
                    self.text("")?,
                    self.text("")?,
                )?;
                self.call2("appendToDocument", document, doctype)?;
                let html = self.call2("createHtmlElement", document, self.text("html")?)?;
                self.call2("appendToDocument", document, html)?;
                let head = self.call2("createHtmlElement", document, self.text("head")?)?;
                self.call2("appendToHtml", html, head)?;
                let title = arg(0)?;
                if title.get_type()? != ValueType::Undefined {
                    let title_element =
                        self.call2("createHtmlElement", document, self.text("title")?)?;
                    self.call2("appendToHead", head, title_element)?;
                    let text = self.call2("createTextNode", document, title)?;
                    self.call2("appendToTitle", title_element, text)?;
                }
                let body = self.call2("createHtmlElement", document, self.text("body")?)?;
                self.call2("appendToHtml", html, body)?;
                Ok(document)
            }
        }
    }
}

#[napi]
pub fn document_implementation_operation<'env>(
    env: &'env Env,
    owner: Unknown<'env>,
    operation: DocumentImplementationOperation,
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
                "DOMImplementation native operation failed",
            ))
        }
    }
}

#[napi(object)]
pub struct DocumentImplementationStatistics {
    pub calls: f64,
    pub active: f64,
}
#[napi]
pub fn document_implementation_statistics() -> DocumentImplementationStatistics {
    DocumentImplementationStatistics {
        calls: CALLS.load(Ordering::Relaxed) as f64,
        active: ACTIVE.load(Ordering::Relaxed) as f64,
    }
}
