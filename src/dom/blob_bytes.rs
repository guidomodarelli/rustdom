//! Synchronous byte concatenation after all observable argument getters have completed.
use super::{
    blob_binding::{CONCATENATIONS, COPIED_BYTES, HOST_CONCATENATIONS},
    napi_error::capture_pending_error,
};
use napi::{
    Env, Error, JsValue, Result, Status,
    bindgen_prelude::{Array, BufferSlice, Function, JsObjectValue, Object, Unknown},
};
use napi_derive::napi;
use std::{ffi::c_void, ptr, sync::atomic::Ordering};

struct BufferInfo {
    pointer: *const u8,
    length: usize,
}

/// Inspect internal backing stores without invoking overridden JavaScript properties.
fn buffer_info(env: Env, value: Unknown) -> Result<Option<BufferInfo>> {
    let mut is_buffer = false;
    // SAFETY: the value is rooted in this active callback's handle scope.
    napi::check_status!(unsafe {
        napi::sys::napi_is_buffer(env.raw(), value.raw(), &mut is_buffer)
    })?;
    if !is_buffer {
        return Ok(None);
    }
    let mut kind = napi::sys::TypedarrayType::uint8_array;
    let mut length = 0;
    let mut data = ptr::null_mut::<c_void>();
    let mut backing = ptr::null_mut();
    let mut offset = 0;
    // SAFETY: Node Buffers are typed-array objects; outputs remain local to this callback.
    napi::check_status!(unsafe {
        napi::sys::napi_get_typedarray_info(
            env.raw(),
            value.raw(),
            &mut kind,
            &mut length,
            &mut data,
            &mut backing,
            &mut offset,
        )
    })?;
    if kind != napi::sys::TypedarrayType::uint8_array {
        return Ok(None);
    }
    let mut ordinary = false;
    // SAFETY: the preceding checked call initialized the backing-store handle.
    napi::check_status!(unsafe {
        napi::sys::napi_is_arraybuffer(env.raw(), backing, &mut ordinary)
    })?;
    if !ordinary {
        return Ok(None);
    }
    let mut detached = false;
    // SAFETY: only ordinary ArrayBuffers reach this operation.
    napi::check_status!(unsafe {
        napi::sys::napi_is_detached_arraybuffer(env.raw(), backing, &mut detached)
    })?;
    if detached {
        return Ok(None);
    }
    // SAFETY: the verified Buffer is ordinary and live. No JS callbacks occur before copying.
    napi::check_status!(unsafe {
        napi::sys::napi_get_buffer_info(env.raw(), value.raw(), &mut data, &mut length)
    })?;
    if length != 0 && data.is_null() {
        return Err(Error::from_reason("Blob buffer has no accessible data"));
    }
    Ok(Some(BufferInfo {
        pointer: data.cast(),
        length,
    }))
}

fn host_concat<'env>(buffers: Array<'env>, constructor: Object<'env>) -> Result<Unknown<'env>> {
    HOST_CONCATENATIONS.fetch_add(1, Ordering::Relaxed);
    let function: Function<Unknown, Unknown> = constructor.get_named_property("concat")?;
    function.apply(constructor.to_unknown(), buffers.to_unknown())
}

fn concatenate<'env>(
    env: Env,
    buffers: Array<'env>,
    constructor: Object<'env>,
) -> Result<Unknown<'env>> {
    // Collect rooted values first: a later array getter may resize/detach an earlier input.
    // Do not reserve from an untrusted array length or borrow byte pointers during this phase.
    let mut values = Vec::new();
    for index in 0..buffers.len() {
        let value = buffers.get::<Unknown>(index)?.expect("bounded array index");
        let mut is_buffer = false;
        // SAFETY: type inspection cannot invoke getters or read potentially shared bytes.
        napi::check_status!(unsafe {
            napi::sys::napi_is_buffer(env.raw(), value.raw(), &mut is_buffer)
        })?;
        if !is_buffer {
            return host_concat(buffers, constructor);
        }
        values.push(value);
    }
    let mut infos = Vec::new();
    let mut total = 0usize;
    for value in &values {
        let Some(info) = buffer_info(env, *value)? else {
            return host_concat(buffers, constructor);
        };
        let Some(next) = total.checked_add(info.length) else {
            return host_concat(buffers, constructor);
        };
        total = next;
        infos.push(info);
    }
    let mut output = Vec::<u8>::new();
    if output.try_reserve_exact(total).is_err() {
        return host_concat(buffers, constructor);
    }
    let mut offset = 0;
    for info in infos {
        if info.length != 0 {
            // SAFETY: all source handles remain rooted; shared/detached backing was excluded.
            // There are no JS calls or byte borrows across callbacks. The freshly allocated
            // destination is disjoint, has capacity `total`, and each checked span fits.
            unsafe {
                ptr::copy_nonoverlapping(
                    info.pointer,
                    output.as_mut_ptr().add(offset),
                    info.length,
                );
            }
            offset += info.length;
        }
    }
    // SAFETY: the disjoint copies above initialized exactly `total` bytes.
    unsafe {
        output.set_len(total);
    }
    let result = BufferSlice::from_data(&env, output)?;
    CONCATENATIONS.fetch_add(1, Ordering::Relaxed);
    COPIED_BYTES.fetch_add(total as u64, Ordering::Relaxed);
    Ok(result.to_unknown())
}

#[napi]
pub fn concatenate_blob_buffers<'env>(
    env: Env,
    buffers: Array<'env>,
    constructor: Object<'env>,
) -> Result<Unknown<'env>> {
    match concatenate(env, buffers, constructor) {
        Ok(value) => Ok(value),
        Err(error) => {
            env.throw(capture_pending_error(&env, error))?;
            Err(Error::new(
                Status::PendingException,
                "Blob byte construction failed",
            ))
        }
    }
}
