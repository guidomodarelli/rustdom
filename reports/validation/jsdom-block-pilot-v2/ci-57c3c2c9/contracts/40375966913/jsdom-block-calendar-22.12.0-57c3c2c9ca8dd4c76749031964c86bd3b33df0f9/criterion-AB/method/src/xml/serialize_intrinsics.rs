//! Immutable iterator intrinsics captured once per addon Env, never retaining a caller's DOM.
use napi::{
    Env, Error, Property, Result, ValueType,
    bindgen_prelude::{
        JsObjectValue, KeyCollectionMode, KeyConversion, KeyFilter, Object, ObjectRef, Unknown,
    },
};
use napi_derive::napi;
use std::sync::atomic::Ordering;

struct XmlIntrinsics {
    values: ObjectRef,
}

/// Obtain the own @@iterator that CreateUnmappedArgumentsObject installs intrinsically.
fn capture_iterator_key<'env>(env: &'env Env) -> Result<Unknown<'env>> {
    // Strict arguments are fresh ordinary objects with one own symbol: @@iterator.
    // Creating it consults neither Array/Iterator prototypes nor global constructors/loaders.
    // Node-API reads only names, so the intrinsic throwing callee accessor is never invoked.
    let arguments: Object =
        env.run_script("(function () { 'use strict'; return arguments; })()")?;
    let keys = arguments.get_all_property_names(
        KeyCollectionMode::OwnOnly,
        KeyFilter::SkipStrings,
        KeyConversion::KeepNumbers,
    )?;
    if keys.get_named_property::<u32>("length")? != 1 {
        return Err(Error::from_reason(
            "XML iterator intrinsics: strict arguments must expose one own symbol",
        ));
    }
    let key: Unknown = keys.get_element(0)?;
    if key.get_type()? != ValueType::Symbol {
        return Err(Error::from_reason(
            "XML iterator intrinsics: strict arguments key is not a Symbol",
        ));
    }
    Ok(key)
}
/// Capture before consumers replace host globals. Each Env owns and finalizes its own reference.
#[napi(module_exports)]
fn initialize_xml_intrinsics(env: Env) -> Result<()> {
    if env.get_instance_data::<XmlIntrinsics>()?.is_some() {
        return Ok(());
    }
    let iterator = capture_iterator_key(&env)?;

    let mut values = Object::new(&env)?;
    values.define_properties(&[Property::new()
        .with_utf8_name("iterator")?
        .with_value(&iterator)])?;
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
