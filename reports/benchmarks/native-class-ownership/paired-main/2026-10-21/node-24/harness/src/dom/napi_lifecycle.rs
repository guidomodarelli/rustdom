//! Diagnostics for constructor references owned by the patched N-API runtime.
use napi_derive::napi;

#[napi(object)]
pub struct NativeClassReferenceStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
    pub cleanup_errors: f64,
}

#[napi]
pub fn class_reference_statistics() -> NativeClassReferenceStatistics {
    let [live, created, released, cleanup_errors] =
        napi::bindgen_prelude::class_reference_statistics();
    NativeClassReferenceStatistics {
        live: live as f64,
        created: created as f64,
        released: released as f64,
        cleanup_errors: cleanup_errors as f64,
    }
}
