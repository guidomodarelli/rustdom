//! Immutable Rust snapshots report dynamic capacity to V8 after wrapping and balance it at finalization.
use super::{
    attribute_copy::AttributeCopyData, napi_error::to_napi_error, napi_string::string_result,
    tree::NativeTree,
};
use napi::{
    Env, Error, Result,
    bindgen_prelude::{Either, JavaScriptClassExt, Object, ObjectFinalize, Utf16String},
};
use napi_derive::napi;
use std::{
    cell::Cell,
    rc::Rc,
    sync::atomic::{AtomicU64, Ordering},
};

static LIVE: AtomicU64 = AtomicU64::new(0);
static CREATED: AtomicU64 = AtomicU64::new(0);
static RELEASED: AtomicU64 = AtomicU64::new(0);
static LIVE_BYTES: AtomicU64 = AtomicU64::new(0);
static ACCOUNTED_BYTES: AtomicU64 = AtomicU64::new(0);
static ACCOUNTING_ERRORS: AtomicU64 = AtomicU64::new(0);

struct CopyState {
    data: AttributeCopyData,
    bytes: i64,
    accounted: Cell<bool>,
}

#[napi(custom_finalize)]
pub struct NativeAttributeCopy {
    state: Rc<CopyState>,
}

/// The owned input has no forest borrow. Instance creation uses the SDK, without ClassInstance deref.
pub(super) fn wrap_copy<'env>(env: &'env Env, data: AttributeCopyData) -> Result<Object<'env>> {
    let bytes = data
        .heap_capacity_bytes()
        .saturating_add(size_of::<CopyState>())
        .saturating_add(size_of::<NativeAttributeCopy>())
        .saturating_add(2 * size_of::<usize>());
    let bytes = i64::try_from(bytes).map_err(|_| {
        Error::from_reason(
            "NativeAttributeCopy: owned allocation exceeds the external memory counter range",
        )
    })?;
    let state = Rc::new(CopyState {
        data,
        bytes,
        accounted: Cell::new(false),
    });
    LIVE.fetch_add(1, Ordering::Relaxed);
    CREATED.fetch_add(1, Ordering::Relaxed);
    LIVE_BYTES.fetch_add(bytes as u64, Ordering::Relaxed);
    let instance = NativeAttributeCopy {
        state: Rc::clone(&state),
    }
    .into_instance(env)?;
    // Account only after successful wrapping. The scoped instance stays rooted during any GC.
    env.adjust_external_memory(bytes).map_err(|mut error| {
        ACCOUNTING_ERRORS.fetch_add(1, Ordering::Relaxed);
        error.reason = format!(
            "NativeAttributeCopy: reporting {bytes} owned bytes failed: {}",
            error.reason
        );
        error
    })?;
    state.accounted.set(true);
    ACCOUNTED_BYTES.fetch_add(bytes as u64, Ordering::Relaxed);
    Ok(instance.as_object(env))
}

impl ObjectFinalize for NativeAttributeCopy {
    fn finalize(self, env: Env) -> Result<()> {
        if self.state.accounted.replace(false) {
            let result = env.adjust_external_memory(-self.state.bytes);
            ACCOUNTED_BYTES.fetch_sub(self.state.bytes as u64, Ordering::Relaxed);
            result.map_err(|mut error| {
                ACCOUNTING_ERRORS.fetch_add(1, Ordering::Relaxed);
                error.reason = format!(
                    "NativeAttributeCopy: releasing {} reported bytes failed: {}",
                    self.state.bytes, error.reason
                );
                error
            })?;
        }
        Ok(())
    }
}
impl Drop for NativeAttributeCopy {
    fn drop(&mut self) {
        LIVE.fetch_sub(1, Ordering::Relaxed);
        RELEASED.fetch_add(1, Ordering::Relaxed);
        LIVE_BYTES.fetch_sub(self.state.bytes as u64, Ordering::Relaxed);
    }
}
#[napi]
impl NativeAttributeCopy {
    /// Prepare owned data; no source-forest borrow escapes this operation.
    #[napi]
    pub fn prepare<'env>(env: &'env Env, source: &NativeTree, handle: f64) -> Result<Object<'env>> {
        let data = source.attribute_copy_data(handle).map_err(to_napi_error)?;
        wrap_copy(env, data)
    }

    /// Initialize a fresh destination from immutable data without reading JS properties.
    #[napi]
    pub fn initialize(&self, destination: &mut NativeTree, handle: f64) -> Result<()> {
        destination
            .initialize_attribute_copy_data(handle, &self.state.data)
            .map_err(to_napi_error)
    }

    #[napi(getter)]
    pub fn local_name(&self) -> Either<&str, Utf16String> {
        string_result(Some(&self.state.data.0.name)).expect("Attr copy owns its name")
    }
    #[napi(getter)]
    pub fn namespace(&self) -> Option<Either<&str, Utf16String>> {
        string_result(self.state.data.0.namespace.as_ref())
    }
    #[napi(getter)]
    pub fn prefix(&self) -> Option<Either<&str, Utf16String>> {
        string_result(self.state.data.0.prefix.as_ref())
    }
    #[napi(getter)]
    pub fn value(&self) -> Either<&str, Utf16String> {
        string_result(Some(&self.state.data.0.value)).expect("Attr copy owns its value")
    }
}
#[napi(object)]
pub struct AttributeCopyStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
    pub live_bytes: f64,
    pub accounted_bytes: f64,
    pub accounting_errors: f64,
}
#[napi]
pub fn attribute_copy_statistics() -> AttributeCopyStatistics {
    AttributeCopyStatistics {
        live: LIVE.load(Ordering::Relaxed) as f64,
        created: CREATED.load(Ordering::Relaxed) as f64,
        released: RELEASED.load(Ordering::Relaxed) as f64,
        live_bytes: LIVE_BYTES.load(Ordering::Relaxed) as f64,
        accounted_bytes: ACCOUNTED_BYTES.load(Ordering::Relaxed) as f64,
        accounting_errors: ACCOUNTING_ERRORS.load(Ordering::Relaxed) as f64,
    }
}
