//! Synchronous FormData construction and File preparation with ordered, observable host reads.
use super::napi_error::capture_pending_error;
use napi::{
    Env, Error, JsValue, Property, Result, Status, ValueType,
    bindgen_prelude::{
        FnArgs, FromNapiValue, Function, JsObjectValue, Object, Unknown, Utf16String,
    },
};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static BUILDS: AtomicU64 = AtomicU64::new(0);
static PREPARATIONS: AtomicU64 = AtomicU64::new(0);
static ACTIVE: AtomicU64 = AtomicU64::new(0);
struct CallGuard;
impl Drop for CallGuard {
    fn drop(&mut self) {
        ACTIVE.fetch_sub(1, Ordering::Relaxed);
    }
}

struct Host<'env> {
    env: &'env Env,
    helpers: Unknown<'env>,
}
impl<'env> Host<'env> {
    fn text(&self, text: &str) -> Result<Unknown<'env>> {
        Ok(self.env.create_string(text)?.to_unknown())
    }
    fn units(&self, text: &[u16]) -> Result<Unknown<'env>> {
        Ok(self.env.create_string_utf16(text)?.to_unknown())
    }
    fn null(&self) -> Result<Unknown<'env>> {
        self.env.to_js_value(&())
    }
    fn number(&self, value: f64) -> Result<Unknown<'env>> {
        Ok(self.env.create_double(value)?.to_unknown())
    }
    fn get(&self, object: Unknown, key: &str) -> Result<Unknown<'env>> {
        object.coerce_to_object()?.get_named_property(key)
    }
    fn set(&self, object: Unknown, key: &str, value: Unknown) -> Result<()> {
        object.coerce_to_object()?.set_named_property(key, value)
    }
    fn equal(&self, left: Unknown, right: Unknown) -> Result<bool> {
        self.env.strict_equals(left, right)
    }
    fn is_text(&self, value: Unknown, text: &str) -> Result<bool> {
        self.equal(value, self.text(text)?)
    }
    fn is_null(&self, value: Unknown) -> Result<bool> {
        Ok(value.get_type()? == ValueType::Null)
    }
    fn call0(&self, receiver: Unknown, function: Unknown) -> Result<Unknown<'env>> {
        Function::<(), Unknown>::from_unknown(function)?.apply(receiver, ())
    }
    fn call1(&self, receiver: Unknown, function: Unknown, value: Unknown) -> Result<Unknown<'env>> {
        Function::<Unknown, Unknown>::from_unknown(function)?.apply(receiver, value)
    }
    fn call2(
        &self,
        receiver: Unknown,
        function: Unknown,
        first: Unknown,
        second: Unknown,
    ) -> Result<Unknown<'env>> {
        Function::<FnArgs<(Unknown, Unknown)>, Unknown>::from_unknown(function)?
            .apply(receiver, (first, second).into())
    }
    fn method0(&self, receiver: Unknown, key: &str) -> Result<Unknown<'env>> {
        self.call0(receiver, self.get(receiver, key)?)
    }
    fn helper1(&self, key: &str, value: Unknown) -> Result<Unknown<'env>> {
        self.call1(self.helpers, self.get(self.helpers, key)?, value)
    }
    fn attribute(&self, field: Unknown, key: &str) -> Result<Unknown<'env>> {
        self.call2(
            field,
            self.get(field, "getAttributeNS")?,
            self.null()?,
            self.text(key)?,
        )
    }
    fn is_impl(&self, class: &str, value: Unknown) -> Result<bool> {
        if !matches!(value.get_type()?, ValueType::Object | ValueType::Function) {
            return Ok(false);
        }
        let module = self.get(self.helpers, class)?;
        self.call1(module, self.get(module, "isImpl")?, value)?
            .coerce_to_bool()
    }
    fn object(&self, entries: &[(&str, Unknown)]) -> Result<Unknown<'env>> {
        let mut object = Object::new(self.env)?;
        for (name, value) in entries {
            object.define_properties(&[Property::new().with_utf8_name(name)?.with_value(value)])?;
        }
        Ok(object.to_unknown())
    }
    fn array(&self, values: &[Unknown]) -> Result<Unknown<'env>> {
        let mut array = self.env.create_array(values.len() as u32)?;
        for (index, value) in values.iter().enumerate() {
            array.set(index as u32, *value)?;
        }
        Ok(array.to_unknown())
    }
    fn usv(&self, value: Unknown<'env>) -> Result<Unknown<'env>> {
        if value.get_type()? == ValueType::Symbol {
            self.helper1(
                "throwTypeError",
                self.text("Value is a symbol, which cannot be converted to a string.")?,
            )?;
        }
        let string = value.coerce_to_string()?.to_unknown();
        let units = Utf16String::from_unknown(string)?;
        if value.get_type()? == ValueType::String
            && encoding_rs::mem::utf16_valid_up_to(&units) == units.len()
        {
            Ok(value)
        } else {
            self.text(&String::from_utf16_lossy(&units))
        }
    }

    /// Keep iterator.next cached and run each body in a bounded handle scope.
    fn each(
        &self,
        iterable: Unknown,
        mut body: impl FnMut(Unknown<'env>) -> Result<()>,
    ) -> Result<()> {
        let key = self.get(self.helpers, "iteratorSymbol")?;
        let method: Unknown = iterable.coerce_to_object()?.get_property(key)?;
        let iterator = self.call0(iterable, method)?;
        if !matches!(
            iterator.get_type()?,
            ValueType::Object | ValueType::Function
        ) {
            self.helper1(
                "throwTypeError",
                self.text("Result of the Symbol.iterator method is not an object")?,
            )?;
        }
        let next = self.get(iterator, "next")?;
        loop {
            let more = self
                .env
                .run_in_scope(|| {
                    let step = self.call0(iterator, next)?;
                    if !matches!(step.get_type()?, ValueType::Object | ValueType::Function) {
                        let global = self.env.get_global()?.to_unknown();
                        let text = self.call1(global, self.get(global, "String")?, step)?;
                        let text = Utf16String::from_unknown(text)?;
                        self.helper1(
                            "throwTypeError",
                            self.text(&format!(
                                "Iterator result {} is not an object",
                                String::from_utf16_lossy(&text)
                            ))?,
                        )?;
                    }
                    if self.get(step, "done")?.coerce_to_bool()? {
                        return Ok(false);
                    }
                    let value = self.get(step, "value")?;
                    if let Err(error) = body(value) {
                        // Detach the original thrown value before IteratorClose; a return() error cannot replace it.
                        let original = capture_pending_error(self.env, error);
                        let close = (|| {
                            let method = self.get(iterator, "return")?;
                            if !matches!(method.get_type()?, ValueType::Undefined | ValueType::Null)
                            {
                                self.call0(iterator, method)?;
                            }
                            Ok(())
                        })();
                        if let Err(error) = close {
                            drop(capture_pending_error(self.env, error));
                        }
                        return Err(original);
                    }
                    Ok(true)
                })
                .map_err(|error| capture_pending_error(self.env, error))?;
            if !more {
                return Ok(());
            }
        }
    }

    fn prepare(
        &self,
        mut value: Unknown<'env>,
        filename: Option<Unknown<'env>>,
    ) -> Result<Unknown<'env>> {
        PREPARATIONS.fetch_add(1, Ordering::Relaxed);
        let file_module = self.get(self.helpers, "File")?;
        if self.is_impl("Blob", value)? && !self.is_impl("File", value)? {
            let original = value;
            let create = self.get(file_module, "createImpl")?;
            let realm = self.get(value, "_globalObject")?;
            let empty = self.array(&[])?;
            let name = self.text("blob")?;
            let options = self.object(&[("type", self.get(original, "type")?)])?;
            value = self.call2(
                file_module,
                create,
                realm,
                self.array(&[empty, name, options])?,
            )?;
            self.set(value, "_buffer", self.get(original, "_buffer")?)?;
        }
        if self.is_impl("File", value)?
            && let Some(filename) = filename
            && filename.get_type()? != ValueType::Undefined
        {
            let original = value;
            let create = self.get(file_module, "createImpl")?;
            let realm = self.get(value, "_globalObject")?;
            let empty = self.array(&[])?;
            let options = self.object(&[
                ("type", self.get(original, "type")?),
                ("lastModified", self.get(original, "lastModified")?),
            ])?;
            value = self.call2(
                file_module,
                create,
                realm,
                self.array(&[empty, filename, options])?,
            )?;
            self.set(value, "_buffer", self.get(original, "_buffer")?)?;
        }
        Ok(value)
    }
    fn empty_file(&self, form: Unknown) -> Result<Unknown<'env>> {
        let file_module = self.get(self.helpers, "File")?;
        let create = self.get(file_module, "createImpl")?;
        let realm = self.get(form, "_globalObject")?;
        let empty = self.array(&[])?;
        let name = self.text("")?;
        let options = self.object(&[("type", self.text("application/octet-stream")?)])?;
        self.call2(
            file_module,
            create,
            realm,
            self.array(&[empty, name, options])?,
        )
    }
    fn append(&self, callback: Unknown, name: Unknown<'env>, value: Unknown<'env>) -> Result<()> {
        let name = self.usv(name)?;
        let value = if self.is_impl("File", value)? {
            value
        } else {
            self.usv(value)?
        };
        let value = self.prepare(value, None)?;
        self.call2(self.helpers, callback, name, value)?;
        Ok(())
    }
    fn field(
        &self,
        field: Unknown<'env>,
        form: Unknown<'env>,
        submitter: Unknown<'env>,
        callback: Unknown<'env>,
    ) -> Result<()> {
        let closest = self.call2(
            self.helpers,
            self.get(self.helpers, "closest")?,
            field,
            self.text("datalist")?,
        )?;
        if !self.is_null(closest)? || self.helper1("isDisabled", field)?.coerce_to_bool()? {
            return Ok(());
        }
        if self.helper1("isButton", field)?.coerce_to_bool()? && !self.equal(field, submitter)? {
            return Ok(());
        }
        for kind in ["checkbox", "radio"] {
            if self.is_text(self.get(field, "type")?, kind)?
                && self.equal(
                    self.get(field, "_checkedness")?,
                    self.env.to_js_value(&false)?,
                )?
            {
                return Ok(());
            }
        }
        if self.is_text(self.get(field, "localName")?, "object")? {
            return Ok(());
        }
        let name = self.attribute(field, "name")?;
        if self.is_text(self.get(field, "localName")?, "input")?
            && self.is_text(self.get(field, "type")?, "image")?
        {
            let mut prefix = if name.coerce_to_bool()? {
                Utf16String::from_unknown(name.coerce_to_string()?.to_unknown())?.to_vec()
            } else {
                vec![]
            };
            if name.coerce_to_bool()? {
                prefix.push(u16::from(b'.'));
            }
            let coordinate = self.get(field, "_selectedCoordinate")?;
            let default_coordinate = matches!(
                coordinate.get_type()?,
                ValueType::Null | ValueType::Undefined
            );
            for axis in ["x", "y"] {
                let mut key = prefix.clone();
                key.extend(axis.encode_utf16());
                let value = if default_coordinate {
                    self.number(0.0)?
                } else {
                    self.get(coordinate, axis)?
                };
                self.append(callback, self.units(&key)?, value)?;
            }
            return Ok(());
        }
        if self.is_null(name)? || self.is_text(name, "")? {
            return Ok(());
        }
        if self.is_text(self.get(field, "localName")?, "select")? {
            self.each(self.get(field, "options")?, |option| {
                if self.equal(
                    self.get(option, "_selectedness")?,
                    self.env.to_js_value(&true)?,
                )? && !self.helper1("isDisabled", field)?.coerce_to_bool()?
                {
                    self.append(callback, name, self.method0(option, "_getValue")?)?;
                }
                Ok(())
            })?;
        } else if self.is_text(self.get(field, "localName")?, "input")?
            && (self.is_text(self.get(field, "type")?, "checkbox")?
                || self.is_text(self.get(field, "type")?, "radio")?)
        {
            let present = self.call2(
                field,
                self.get(field, "hasAttributeNS")?,
                self.null()?,
                self.text("value")?,
            )?;
            let value = if present.coerce_to_bool()? {
                self.attribute(field, "value")?
            } else {
                self.text("on")?
            };
            self.append(callback, name, value)?;
        } else if self.is_text(self.get(field, "type")?, "file")? {
            if self.equal(
                self.get(self.get(field, "files")?, "length")?,
                self.number(0.0)?,
            )? {
                self.append(callback, name, self.empty_file(form)?)?;
            } else {
                let mut index = 0.0;
                while index
                    < self
                        .get(self.get(field, "files")?, "length")?
                        .coerce_to_number()?
                        .get_double()?
                {
                    let files = self.get(field, "files")?;
                    let value = self.call1(files, self.get(files, "item")?, self.number(index)?)?;
                    self.append(callback, name, value)?;
                    index += 1.0;
                }
            }
        } else {
            self.append(callback, name, self.method0(field, "_getValue")?)?;
        }
        let dirname = self.attribute(field, "dirname")?;
        if !self.is_null(dirname)? && !self.is_text(dirname, "")? {
            self.append(callback, dirname, self.text("ltr")?)?;
        }
        Ok(())
    }
}

fn invoke(env: &Env, operation: impl FnOnce() -> Result<()>) -> Result<()> {
    ACTIVE.fetch_add(1, Ordering::Relaxed);
    let _guard = CallGuard;
    match operation() {
        Ok(()) => Ok(()),
        Err(error) => {
            env.throw(capture_pending_error(env, error))?;
            Err(Error::new(
                Status::PendingException,
                "FormData native construction failed",
            ))
        }
    }
}

#[napi]
pub fn prepare_form_data_value(
    env: Env,
    value: Unknown,
    filename: Unknown,
    helpers: Unknown,
    receive: Unknown,
) -> Result<()> {
    invoke(&env, || {
        let host = Host { env: &env, helpers };
        host.call1(helpers, receive, host.prepare(value, Some(filename))?)?;
        Ok(())
    })
}

#[napi]
pub fn construct_form_data(
    env: Env,
    form: Unknown,
    submitter: Unknown,
    global_object: Unknown,
    helpers: Unknown,
    append: Unknown,
) -> Result<()> {
    BUILDS.fetch_add(1, Ordering::Relaxed);
    invoke(&env, || {
        let host = Host { env: &env, helpers };
        if !host.is_null(submitter)? {
            if !host
                .helper1("isSubmitButton", submitter)?
                .coerce_to_bool()?
            {
                host.helper1(
                    "throwTypeError",
                    host.text("The specified element is not a submit button")?,
                )?;
            }
            if !host.equal(host.get(submitter, "form")?, form)? {
                host.call2(
                    helpers,
                    host.get(helpers, "throwNotFound")?,
                    global_object,
                    host.text("The specified element is not owned by this form element")?,
                )?;
            }
        }
        let controls = host.method0(form, "_getSubmittableElementNodes")?;
        host.each(controls, |field| host.field(field, form, submitter, append))
    })
}

#[napi(object)]
pub struct FormDataConstructionStatistics {
    pub builds: f64,
    pub preparations: f64,
    pub active: f64,
}
#[napi]
pub fn form_data_construction_statistics() -> FormDataConstructionStatistics {
    FormDataConstructionStatistics {
        builds: BUILDS.load(Ordering::Relaxed) as f64,
        preparations: PREPARATIONS.load(Ordering::Relaxed) as f64,
        active: ACTIVE.load(Ordering::Relaxed) as f64,
    }
}
