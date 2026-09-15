//! Immutable iterator intrinsics captured once per addon Env, never retaining a caller's DOM.
use napi::{
    Env, Error, JsValue, Property, Result, ValueType,
    bindgen_prelude::{
        Function, JsObjectValue, KeyCollectionMode, KeyConversion, KeyFilter, Object, ObjectRef,
        Unknown,
    },
};
use napi_derive::napi;
use std::sync::atomic::Ordering;

struct XmlIntrinsics {
    values: ObjectRef,
}

/// Let the engine select its well-known key without consulting replaceable Symbol constructors.
fn capture_iterator_key<'env>(env: &'env Env) -> Result<Unknown<'env>> {
    // Node-API has no well-known-symbol accessor. Probe only fresh objects and enumerated keys,
    // never caller methods. An absent key produces an intrinsic TypeError returned for fallback.
    let select: Function<Unknown, Unknown> = env.run_script(
        r#"(keys => {
            const probe = { __proto__: null };
            for (let index = 0; index < keys.length; index++) {
                const key = keys[index];
                probe[key] = () => ({
                    next: () => ({ done: false, value: key }),
                    return: () => ({ done: true })
                });
            }
            try {
                for (const key of probe) return key;
            } catch (error) {
                return error;
            }
        })"#,
    )?;
    // Preserve the existing route without requiring generator prototypes when Array exposes
    // the key. Node-API enumerates own symbol names without invoking property getters.
    let array_prototype = env
        .create_array(0)?
        .to_unknown()
        .coerce_to_object()?
        .get_prototype()?
        .coerce_to_object()?;
    let array_keys = array_prototype.get_all_property_names(
        KeyCollectionMode::OwnOnly,
        KeyFilter::SkipStrings,
        KeyConversion::KeepNumbers,
    )?;
    let array_candidate = select.call(array_keys.to_unknown())?;
    if array_candidate.get_type()? == ValueType::Symbol {
        return Ok(array_candidate);
    }
    // Syntax creates an unexposed generator without reading a global constructor. Only if
    // Array lacks the key, follow its fresh prototype via %GeneratorPrototype% to %IteratorPrototype%.
    let generator: Object = env.run_script("(function* () {})()")?;
    let fresh_generator_prototype = generator.get_prototype()?.coerce_to_object()?;
    let generator_prototype = fresh_generator_prototype
        .get_prototype()?
        .coerce_to_object()?;
    let iterator_prototype = generator_prototype.get_prototype()?.coerce_to_object()?;
    let iterator_keys = iterator_prototype.get_all_property_names(
        KeyCollectionMode::OwnOnly,
        KeyFilter::SkipStrings,
        KeyConversion::KeepNumbers,
    )?;
    let candidate = select.call(iterator_keys.to_unknown())?;
    if candidate.get_type()? == ValueType::Symbol {
        Ok(candidate)
    } else {
        // Both probes failed on controlled objects; preserve the actual intrinsic exception.
        Err(Error::from_unknown_without_coercion(candidate))
    }
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
