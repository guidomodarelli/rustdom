//! XMLSerializer control flow, preserving host reads, arbitrary exceptions and realm factories.
use super::napi_error::capture_pending_error;
use napi::{
    Env, Error, JsValue, Property, Result, Status, ValueType,
    bindgen_prelude::{FnArgs, FromNapiValue, Function, JsObjectValue, ToNapiValue, Unknown},
};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static CALLS: AtomicU64 = AtomicU64::new(0);
static ACTIVE: AtomicU64 = AtomicU64::new(0);
static ERROR_CONVERSIONS: AtomicU64 = AtomicU64::new(0);

struct RunGuard;
impl Drop for RunGuard {
    fn drop(&mut self) {
        ACTIVE.fetch_sub(1, Ordering::Relaxed);
    }
}

struct Host<'env> {
    env: &'env Env,
    helpers: Unknown<'env>,
}

impl<'env> Host<'env> {
    fn helper(&self, name: &str) -> Result<Unknown<'env>> {
        self.helpers.coerce_to_object()?.get_named_property(name)
    }

    fn property(&self, receiver: Unknown, name: &str) -> Result<Unknown<'env>> {
        let name = self.env.create_string(name)?.to_unknown();
        Function::<FnArgs<(Unknown, Unknown)>, Unknown>::from_unknown(self.helper("property")?)?
            .apply(self.helpers, (receiver, name).into())
    }

    fn caught_value(&self, error: Error) -> Result<Unknown<'env>> {
        let error = capture_pending_error(self.env, error);
        // SAFETY: the active scope owns the original value's handle. Conversion releases
        // Error's temporary retained reference without coercing primitives or invoking getters.
        let raw = unsafe { Error::to_napi_value(self.env.raw(), error)? };
        Ok(unsafe { Unknown::from_raw_unchecked(self.env.raw(), raw) })
    }

    fn serialize(&self, root: Unknown<'env>) -> Result<Unknown<'env>> {
        let wrapped = Function::<Unknown, Unknown>::from_unknown(self.helper("wrapper")?)?
            .apply(self.helpers, root)?;
        let result = crate::xml::serialize_xml(*self.env, wrapped, false)?;
        // SAFETY: UTF-16 or the dynamic result is converted before its RAII owner drops;
        // the returned JS handle remains rooted in this synchronous callback's scope.
        let raw = unsafe { ToNapiValue::to_napi_value(self.env.raw(), result)? };
        Ok(unsafe { Unknown::from_raw_unchecked(self.env.raw(), raw) })
    }

    fn run(&self, owner: Unknown<'env>, root: Unknown<'env>) -> Result<Unknown<'env>> {
        let error = match self.serialize(root) {
            Ok(value) => return Ok(value),
            Err(error) => self.caught_value(error)?,
        };
        ERROR_CONVERSIONS.fetch_add(1, Ordering::Relaxed);
        // Match CallExpression order: fetch the factory, then realm, then message.
        // Failures in this catch body propagate directly rather than being wrapped again.
        let namespace = self.helper("exceptionNamespace")?;
        let factory = self.property(namespace, "create")?;
        let global = self.property(owner, "_globalObject")?;
        let message = self.property(error, "message")?;
        let mut arguments = self.env.create_array(2)?;
        // Array literals create own data properties, bypassing inherited setters and
        // non-writable indices installed while reading the original exception's message.
        arguments.define_properties(&[
            Property::new().with_utf8_name("0")?.with_value(&message),
            Property::new()
                .with_utf8_name("1")?
                .with_value(&self.env.create_string("InvalidStateError")?),
        ])?;
        let arguments = arguments.to_unknown();
        let exception = if factory.get_type()? == ValueType::Function {
            Function::<FnArgs<(Unknown, Unknown)>, Unknown>::from_unknown(factory)?
                .apply(namespace, (global, arguments).into())?
        } else {
            // Delegate only the engine's diagnostic for the already observed invalid callee.
            Function::<FnArgs<(Unknown, Unknown, Unknown)>, Unknown>::from_unknown(
                self.helper("invalidFactory")?,
            )?
            .apply(self.helpers, (factory, global, arguments).into())?
        };
        Err(Error::from_unknown_without_coercion(exception))
    }
}

/// Execute one XMLSerializer call without persistent JS references or a TreeStore borrow.
#[napi]
pub fn xml_serializer_operation<'env>(
    env: &'env Env,
    owner: Unknown<'env>,
    root: Unknown<'env>,
    helpers: Unknown<'env>,
) -> Result<Unknown<'env>> {
    CALLS.fetch_add(1, Ordering::Relaxed);
    ACTIVE.fetch_add(1, Ordering::Relaxed);
    let _guard = RunGuard;
    match (Host { env, helpers }).run(owner, root) {
        Ok(value) => Ok(value),
        Err(error) => {
            env.throw(capture_pending_error(env, error))?;
            Err(Error::new(
                Status::PendingException,
                "XMLSerializer native operation failed",
            ))
        }
    }
}

#[napi(object)]
pub struct XmlSerializerStatistics {
    pub calls: f64,
    pub active: f64,
    pub error_conversions: f64,
}

/// Observe finite operation liveness without retaining serializers, documents or windows.
#[napi]
pub fn xml_serializer_statistics() -> XmlSerializerStatistics {
    XmlSerializerStatistics {
        calls: CALLS.load(Ordering::Relaxed) as f64,
        active: ACTIVE.load(Ordering::Relaxed) as f64,
        error_conversions: ERROR_CONVERSIONS.load(Ordering::Relaxed) as f64,
    }
}
