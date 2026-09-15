//! Immutable iterator intrinsics captured once per addon Env, never retaining a caller's DOM.
use napi::{
    Env, Error, JsValue, Property, Result,
    bindgen_prelude::{JsObjectValue, Object, ObjectRef, Unknown},
};
use napi_derive::napi;
use std::sync::atomic::Ordering;

struct XmlIntrinsics {
    values: ObjectRef,
}

/// Capture before consumers replace host globals. Each Env owns and finalizes its own reference.
#[napi(module_exports)]
fn initialize_xml_intrinsics(env: Env) -> Result<()> {
    if env.get_instance_data::<XmlIntrinsics>()?.is_some() {
        return Ok(());
    }
    // Boxing a Node-API symbol obtains its intrinsic prototype even if globalThis.Symbol was replaced.
    let prototype = env
        .create_symbol(None)?
        .coerce_to_object()?
        .get_prototype()?
        .coerce_to_object()?;
    let symbol: Unknown = prototype.get_named_property("constructor")?;
    let iterator: Unknown = symbol.coerce_to_object()?.get_named_property("iterator")?;
    let symbol_to_string: Unknown = prototype.get_named_property("toString")?;
    let mut values = Object::new(&env)?;
    values.define_properties(&[
        Property::new()
            .with_utf8_name("iterator")?
            .with_value(&iterator),
        Property::new()
            .with_utf8_name("symbolToString")?
            .with_value(&symbol_to_string),
    ])?;
    let values = values.create_ref()?;
    env.set_instance_data(XmlIntrinsics { values }, (), |context| {
        if context.value.values.unref(&context.env).is_err() {
            super::serialize_host::CLEANUP_ERRORS.fetch_add(1, Ordering::Relaxed);
        }
    })
}

/// Release the instance-data borrow before any host callback can reenter the serializer.
pub(super) fn get<'env>(env: &'env Env, name: &str) -> Result<Unknown<'env>> {
    let values = env
        .get_instance_data::<XmlIntrinsics>()?
        .ok_or_else(|| {
            Error::from_reason("XML serialization: iterator intrinsics are unavailable")
        })?
        .values
        .get_value(env)?;
    values.get_named_property(name)
}
