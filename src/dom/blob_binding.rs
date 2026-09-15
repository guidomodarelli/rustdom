//! Native Blob/File metadata; byte-buffer handles remain visible to the JavaScript collector.
use super::{blob_data, data::DomString, napi_string::string_result};
use napi::bindgen_prelude::{Either, Utf16String};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE: AtomicU64 = AtomicU64::new(0);
static CREATED: AtomicU64 = AtomicU64::new(0);
static RELEASED: AtomicU64 = AtomicU64::new(0);
static MIME_UNITS: AtomicU64 = AtomicU64::new(0);
static FILE_NAME_UNITS: AtomicU64 = AtomicU64::new(0);
pub(super) static CONCATENATIONS: AtomicU64 = AtomicU64::new(0);
pub(super) static HOST_CONCATENATIONS: AtomicU64 = AtomicU64::new(0);
pub(super) static COPIED_BYTES: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct BlobSliceRange {
    pub start: f64,
    pub end: f64,
}
#[napi(object)]
pub struct NativeBlobStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
    pub mime_units: f64,
    pub file_name_units: f64,
    pub concatenations: f64,
    pub host_concatenations: f64,
    pub copied_bytes: f64,
}

#[napi]
pub struct NativeBlobMetadata {
    mime: String,
    name: Option<DomString>,
    name_units: usize,
    modified: f64,
}
impl Drop for NativeBlobMetadata {
    fn drop(&mut self) {
        LIVE.fetch_sub(1, Ordering::Relaxed);
        RELEASED.fetch_add(1, Ordering::Relaxed);
        MIME_UNITS.fetch_sub(self.mime.len() as u64, Ordering::Relaxed);
        FILE_NAME_UNITS.fetch_sub(self.name_units as u64, Ordering::Relaxed);
    }
}
#[napi]
impl NativeBlobMetadata {
    #[napi(constructor)]
    pub fn new(mime: Utf16String) -> Self {
        let mime = blob_data::mime_type(&mime);
        LIVE.fetch_add(1, Ordering::Relaxed);
        CREATED.fetch_add(1, Ordering::Relaxed);
        MIME_UNITS.fetch_add(mime.len() as u64, Ordering::Relaxed);
        Self {
            mime,
            name: None,
            name_units: 0,
            modified: 0.0,
        }
    }
    #[napi(getter)]
    pub fn mime_type(&self) -> &str {
        &self.mime
    }
    #[napi]
    pub fn set_file(&mut self, name: Utf16String, modified: f64) {
        FILE_NAME_UNITS.fetch_sub(self.name_units as u64, Ordering::Relaxed);
        self.name_units = name.len();
        self.name = Some(DomString::from_units(&name));
        self.modified = modified;
        FILE_NAME_UNITS.fetch_add(self.name_units as u64, Ordering::Relaxed);
    }
    #[napi(getter)]
    pub fn file_name(&self) -> Option<Either<&str, Utf16String>> {
        string_result(self.name.as_ref())
    }
    #[napi(getter)]
    pub fn last_modified(&self) -> f64 {
        self.modified
    }
    #[napi]
    pub fn statistics() -> NativeBlobStatistics {
        NativeBlobStatistics {
            live: LIVE.load(Ordering::Relaxed) as f64,
            created: CREATED.load(Ordering::Relaxed) as f64,
            released: RELEASED.load(Ordering::Relaxed) as f64,
            mime_units: MIME_UNITS.load(Ordering::Relaxed) as f64,
            file_name_units: FILE_NAME_UNITS.load(Ordering::Relaxed) as f64,
            concatenations: CONCATENATIONS.load(Ordering::Relaxed) as f64,
            host_concatenations: HOST_CONCATENATIONS.load(Ordering::Relaxed) as f64,
            copied_bytes: COPIED_BYTES.load(Ordering::Relaxed) as f64,
        }
    }
}

#[napi]
pub fn normalize_blob_endings(value: Utf16String) -> Utf16String {
    blob_data::normalize_endings(&value).into()
}
#[napi]
pub fn blob_slice_range(size: f64, start: Option<f64>, end: Option<f64>) -> BlobSliceRange {
    let (start, end) = blob_data::slice_range(size, start, end);
    BlobSliceRange { start, end }
}
