//! Scoped access to observable JS properties; owned references never outlive the synchronous serializer.
use napi::{
    Env, Error, JsValue, Property, Result, Status, ValueType,
    bindgen_prelude::{
        FnArgs, FromNapiValue, Function, JsObjectValue, KeyCollectionMode, KeyConversion,
        KeyFilter, Object, ObjectRef, ToNapiValue, TypeName, Unknown, Utf16String,
    },
};
use std::{
    rc::Rc,
    sync::atomic::{AtomicU64, Ordering},
};

pub(super) static LIVE_REFERENCES: AtomicU64 = AtomicU64::new(0);
pub(super) static CLEANUP_ERRORS: AtomicU64 = AtomicU64::new(0);

struct OwnedValue {
    env: Env,
    reference: Option<ObjectRef>,
    boxed: bool,
}

impl Drop for OwnedValue {
    fn drop(&mut self) {
        if let Some(reference) = self.reference.take() {
            // Env belongs to the still-active native call, including exceptional unwinding.
            // Preserve a diagnostic counter if the runtime rejects mandatory reference cleanup.
            if reference.unref(&self.env).is_err() {
                CLEANUP_ERRORS.fetch_add(1, Ordering::Relaxed);
            }
            LIVE_REFERENCES.fetch_sub(1, Ordering::Relaxed);
        }
    }
}

#[derive(Clone)]
pub struct HeldValue(Rc<OwnedValue>);

impl TypeName for HeldValue {
    fn type_name() -> &'static str {
        "unknown"
    }
    fn value_type() -> ValueType {
        ValueType::Unknown
    }
}

impl ToNapiValue for HeldValue {
    unsafe fn to_napi_value(
        env: napi::sys::napi_env,
        value: Self,
    ) -> Result<napi::sys::napi_value> {
        // The return handle is created in the live caller scope before the owned reference drops.
        let env = Env::from(env);
        Ok(value.value(&env)?.raw())
    }
}

impl HeldValue {
    pub fn new(env: &Env, value: Unknown) -> Result<Self> {
        let boxed = !matches!(value.get_type()?, ValueType::Object | ValueType::Function);
        let object = if boxed {
            let mut holder = Object::new(env)?;
            holder.define_properties(&[Property::new()
                .with_utf8_name("value")?
                .with_value(&value)])?;
            holder
        } else {
            value.coerce_to_object()?
        };
        let reference = object.create_ref()?;
        LIVE_REFERENCES.fetch_add(1, Ordering::Relaxed);
        Ok(Self(Rc::new(OwnedValue {
            env: *env,
            reference: Some(reference),
            boxed,
        })))
    }

    pub fn value<'env>(&self, env: &'env Env) -> Result<Unknown<'env>> {
        let object = self
            .0
            .reference
            .as_ref()
            .expect("live owned reference")
            .get_value(env)?;
        if self.0.boxed {
            object.get_named_property("value")
        } else {
            Ok(object.to_unknown())
        }
    }
}

pub(super) struct Host<'env> {
    pub env: &'env Env,
}

impl<'env> Host<'env> {
    pub fn text(&self, value: &str) -> Result<Unknown<'env>> {
        Ok(self.env.create_string(value)?.to_unknown())
    }
    pub fn units(&self, value: &[u16]) -> Result<Unknown<'env>> {
        Ok(self.env.create_string_utf16(value)?.to_unknown())
    }
    pub fn null(&self) -> Result<Unknown<'env>> {
        self.env.to_js_value(&())
    }
    pub fn number(&self, value: u32) -> Result<Unknown<'env>> {
        Ok(self.env.create_uint32(value)?.to_unknown())
    }
    pub fn float(&self, value: f64) -> Result<Unknown<'env>> {
        Ok(self.env.create_double(value)?.to_unknown())
    }
    pub fn string(&self, value: Unknown) -> Result<Vec<u16>> {
        // The owned binding conversion truncates the C terminator while preserving embedded NULs.
        Ok(Utf16String::from_unknown(value.coerce_to_string()?.to_unknown())?.to_vec())
    }
    /// Construct an intrinsic TypeError without converting user values or losing UTF-16 code units.
    fn type_error(&self, message: &[u16]) -> Result<Error> {
        let message = self.units(message)?;
        let mut exception = std::ptr::null_mut();
        // SAFETY: message and the resulting exception belong to this active handle scope.
        let status = unsafe {
            napi::sys::napi_create_type_error(
                self.env.raw(),
                std::ptr::null_mut(),
                message.raw(),
                &mut exception,
            )
        };
        if status != napi::sys::Status::napi_ok {
            return Err(Error::new(
                Status::from(status),
                "XML serialization: TypeError creation failed",
            ));
        }
        // SAFETY: the checked call initialized exception; capture preserves its intrinsic realm.
        Ok(Error::from_unknown_without_coercion(unsafe {
            Unknown::from_raw_unchecked(self.env.raw(), exception)
        }))
    }

    /// Preserve the engine's primitive diagnostics without calling mutable conversion hooks.
    fn iterator_result_error(&self, result: Unknown) -> Result<Error> {
        crate::dom::napi_error::iterator_result_error(
            self.env,
            super::serialize_intrinsics::get(self.env, "iterator")?,
            result,
        )
    }
    /// Non-callable cached next values are described without invoking object conversion hooks.
    fn iterator_next_error(&self, value: Unknown) -> Result<Error> {
        let kind = value.get_type()?;
        let label = match kind {
            ValueType::Undefined => "undefined",
            ValueType::Null => "object null",
            ValueType::Boolean => "boolean ",
            ValueType::Number => "number ",
            ValueType::String => "string \"",
            ValueType::Symbol => "symbol",
            ValueType::BigInt => "bigint",
            _ => "object",
        };
        let mut message: Vec<u16> = label.encode_utf16().collect();
        if matches!(
            kind,
            ValueType::Boolean | ValueType::Number | ValueType::String
        ) {
            message.extend(self.string(value)?);
            if kind == ValueType::String {
                message.push(b'"' as u16);
            }
        }
        message.extend(" is not a function".encode_utf16());
        self.type_error(&message)
    }

    pub fn is_null(&self, value: Unknown) -> Result<bool> {
        Ok(value.get_type()? == ValueType::Null)
    }
    pub fn equals(&self, left: Unknown, right: Unknown) -> Result<bool> {
        self.env.strict_equals(left, right)
    }
    pub fn equals_text(&self, value: Unknown, text: &str) -> Result<bool> {
        self.equals(value, self.text(text)?)
    }

    pub fn get(&self, receiver: Unknown, name: &str) -> Result<Unknown<'env>> {
        match receiver.get_type()? {
            ValueType::Null => Err(Error::from_reason(format!(
                "Cannot read properties of null (reading '{name}')"
            ))),
            ValueType::Undefined => Err(Error::from_reason(format!(
                "Cannot read properties of undefined (reading '{name}')"
            ))),
            _ => receiver.coerce_to_object()?.get_named_property(name),
        }
    }
    pub fn key(&self, receiver: Unknown, key: Unknown) -> Result<Unknown<'env>> {
        // Node-API forwards the raw key to V8, preserving ToPropertyKey, including symbol results.
        receiver.coerce_to_object()?.get_property(key)
    }
    pub fn set(&self, receiver: Unknown, key: Unknown, value: Unknown) -> Result<()> {
        receiver.coerce_to_object()?.set_property(key, value)
    }
    pub fn has(&self, receiver: Unknown, key: Unknown) -> Result<bool> {
        receiver.coerce_to_object()?.has_property_js(key)
    }

    pub fn call0(
        &self,
        receiver: Unknown,
        function: Unknown,
        failure: &str,
    ) -> Result<Unknown<'env>> {
        if function.get_type()? != ValueType::Function {
            return Err(Error::from_reason(failure));
        }
        Function::<(), Unknown>::from_unknown(function)?.apply(receiver, ())
    }
    pub fn call1(
        &self,
        receiver: Unknown,
        function: Unknown,
        argument: Unknown,
        failure: &str,
    ) -> Result<Unknown<'env>> {
        if function.get_type()? != ValueType::Function {
            return Err(Error::from_reason(failure));
        }
        Function::<Unknown, Unknown>::from_unknown(function)?.apply(receiver, argument)
    }
    pub fn call2(
        &self,
        receiver: Unknown,
        function: Unknown,
        first: Unknown,
        second: Unknown,
        failure: &str,
    ) -> Result<Unknown<'env>> {
        if function.get_type()? != ValueType::Function {
            return Err(Error::from_reason(failure));
        }
        Function::<FnArgs<(Unknown, Unknown)>, Unknown>::from_unknown(function)?
            .apply(receiver, (first, second).into())
    }
    pub fn method1(
        &self,
        receiver: Unknown,
        name: &str,
        argument: Unknown,
        failure: &str,
    ) -> Result<Unknown<'env>> {
        self.call1(receiver, self.get(receiver, name)?, argument, failure)
    }

    pub fn null_map(&self) -> Result<Unknown<'env>> {
        let object: Unknown = self.env.get_global()?.get_named_property("Object")?;
        self.call1(
            object,
            self.get(object, "create")?,
            self.null()?,
            "Object.create is not a function",
        )
    }

    pub fn new_set(&self) -> Result<Unknown<'env>> {
        let constructor: Unknown = self.env.get_global()?.get_named_property("Set")?;
        if constructor.get_type()? != ValueType::Function {
            return Err(Error::from_reason("Set is not a constructor"));
        }
        Function::<(), Unknown>::from_unknown(constructor)?.new_instance(())
    }

    /// String concatenation uses the default primitive hint, unlike template interpolation.
    pub fn concat_string(&self, value: Unknown) -> Result<Vec<u16>> {
        if !matches!(value.get_type()?, ValueType::Object | ValueType::Function) {
            return self.string(value);
        }
        let symbol: Unknown = self.env.get_global()?.get_named_property("Symbol")?;
        let primitive = self.key(value, self.get(symbol, "toPrimitive")?)?;
        if !matches!(
            primitive.get_type()?,
            ValueType::Null | ValueType::Undefined
        ) {
            let result = self.call1(
                value,
                primitive,
                self.text("default")?,
                "Cannot convert object to primitive value",
            )?;
            if matches!(result.get_type()?, ValueType::Object | ValueType::Function) {
                return Err(Error::from_reason(
                    "Cannot convert object to primitive value",
                ));
            }
            return self.string(result);
        }
        for name in ["valueOf", "toString"] {
            let method = self.get(value, name)?;
            if method.get_type()? != ValueType::Function {
                continue;
            }
            let result = self.call0(value, method, "Cannot convert object to primitive value")?;
            if !matches!(result.get_type()?, ValueType::Object | ValueType::Function) {
                return self.string(result);
            }
        }
        Err(Error::from_reason(
            "Cannot convert object to primitive value",
        ))
    }

    /// Detach a pending exception before IteratorClose runs; do not stringify user-thrown values.
    pub fn capture_error(&self, error: Error) -> Error {
        crate::dom::napi_error::capture_pending_error(self.env, error)
    }

    pub fn close_after_error(&self, iterator: &IteratorRecord, error: Error) -> Error {
        let original = self.capture_error(error);
        if let Err(close_error) = iterator.close(self) {
            drop(self.capture_error(close_error));
        }
        original
    }

    pub fn array1(&self, value: Unknown) -> Result<Unknown<'env>> {
        let mut array = self.env.create_array(1)?;
        array.set(0, value)?;
        Ok(array.to_unknown())
    }

    /// CopyDataProperties preserves shallow array sharing and intrinsic ordinary-object inheritance.
    pub fn spread(&self, source: Unknown) -> Result<Unknown<'env>> {
        let source = source.coerce_to_object()?;
        let names = source.get_all_property_names(
            KeyCollectionMode::OwnOnly,
            KeyFilter::Enumerable,
            KeyConversion::NumbersToStrings,
        )?;
        let length: u32 = names.get_named_property("length")?;
        let mut output = Object::new(self.env)?;
        for index in 0..length {
            let name: Unknown = names.get_element(index)?;
            let value: Unknown = source.get_property(name)?;
            output.define_properties(&[Property::new()
                .with_name(self.env, name)?
                .with_value(&value)])?;
        }
        Ok(output.to_unknown())
    }
}

pub(super) struct IteratorRecord {
    iterator: HeldValue,
    next: HeldValue,
}

impl IteratorRecord {
    pub fn new(host: &Host, iterable: Unknown, expression: &str) -> Result<Self> {
        let key = super::serialize_intrinsics::get(host.env, "iterator")?;
        let method = host.key(iterable, key)?;
        if method.get_type()? != ValueType::Function {
            return Err(host.type_error(
                &format!("{expression} is not iterable")
                    .encode_utf16()
                    .collect::<Vec<_>>(),
            )?);
        }
        let iterator = host.call0(iterable, method, "value is not iterable")?;
        if !matches!(
            iterator.get_type()?,
            ValueType::Object | ValueType::Function
        ) {
            return Err(host.type_error(
                &"Result of the Symbol.iterator method is not an object"
                    .encode_utf16()
                    .collect::<Vec<_>>(),
            )?);
        }
        let next = host.get(iterator, "next")?;
        Ok(Self {
            iterator: HeldValue::new(host.env, iterator)?,
            next: HeldValue::new(host.env, next)?,
        })
    }

    pub fn next<'env>(&self, host: &Host<'env>) -> Result<Option<Unknown<'env>>> {
        let next = self.next.value(host.env)?;
        if next.get_type()? != ValueType::Function {
            return Err(host.iterator_next_error(next)?);
        }
        let result = host.call0(
            self.iterator.value(host.env)?,
            next,
            "iterator.next is not a function",
        )?;
        if !matches!(result.get_type()?, ValueType::Object | ValueType::Function) {
            return Err(host.iterator_result_error(result)?);
        }
        if host.get(result, "done")?.coerce_to_bool()? {
            Ok(None)
        } else {
            Ok(Some(host.get(result, "value")?))
        }
    }

    /// Abrupt completion inside a for-of body invokes return; the original exception takes precedence.
    pub fn close(&self, host: &Host) -> Result<()> {
        let iterator = self.iterator.value(host.env)?;
        let return_method = host.get(iterator, "return")?;
        if matches!(
            return_method.get_type()?,
            ValueType::Null | ValueType::Undefined
        ) {
            return Ok(());
        }
        host.call0(iterator, return_method, "iterator.return is not a function")?;
        Ok(())
    }
}
