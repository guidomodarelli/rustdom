//! Scalar reader state and native string results, without persistent JavaScript references.
use super::{
    blob_bytes::with_ordinary_buffer,
    file_reader::{self, ReaderState},
    file_reader_output::ReaderString,
    napi_error::capture_pending_error,
};
use base64_simd::STANDARD;
use napi::{
    Env, Error, Result, Status,
    bindgen_prelude::{Unknown, Utf16String},
};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE: AtomicU64 = AtomicU64::new(0);
static CREATED: AtomicU64 = AtomicU64::new(0);
static RELEASED: AtomicU64 = AtomicU64::new(0);
static DECODED: AtomicU64 = AtomicU64::new(0);

#[napi]
pub enum ReaderStringFormat {
    BinaryString,
    DataUrl,
    Text,
}
#[napi(object)]
pub struct NativeFileReaderStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
    pub decoded: f64,
}
#[napi]
pub struct NativeFileReaderState {
    state: ReaderState,
}
impl Default for NativeFileReaderState {
    fn default() -> Self {
        Self::new()
    }
}
impl Drop for NativeFileReaderState {
    fn drop(&mut self) {
        LIVE.fetch_sub(1, Ordering::Relaxed);
        RELEASED.fetch_add(1, Ordering::Relaxed);
    }
}
#[napi]
impl NativeFileReaderState {
    #[napi(constructor)]
    pub fn new() -> Self {
        LIVE.fetch_add(1, Ordering::Relaxed);
        CREATED.fetch_add(1, Ordering::Relaxed);
        Self {
            state: ReaderState::default(),
        }
    }
    #[napi(getter)]
    pub fn ready_state(&self) -> u32 {
        self.state.ready as u32
    }
    #[napi]
    pub fn begin(&mut self) -> bool {
        self.state.begin()
    }
    #[napi]
    pub fn abort(&mut self) -> bool {
        self.state.abort()
    }
    #[napi]
    pub fn enter_stage(&mut self) -> bool {
        self.state.enter_stage()
    }
    #[napi]
    pub fn finish(&mut self) {
        self.state.finish();
    }
    #[napi]
    pub fn statistics() -> NativeFileReaderStatistics {
        NativeFileReaderStatistics {
            live: LIVE.load(Ordering::Relaxed) as f64,
            created: CREATED.load(Ordering::Relaxed) as f64,
            released: RELEASED.load(Ordering::Relaxed) as f64,
            decoded: DECODED.load(Ordering::Relaxed) as f64,
        }
    }
}

#[napi(ts_return_type = "string | null")]
pub fn file_reader_string(
    env: Env,
    data: Unknown,
    format: ReaderStringFormat,
    label: Option<Utf16String>,
    mime: Option<Utf16String>,
) -> Result<Option<ReaderString>> {
    let label = label.map_or_else(String::new, |value| String::from_utf16_lossy(&value));
    // SAFETY: the closure performs only synchronous Rust conversion and returns owned strings.
    let decoded = unsafe {
        with_ordinary_buffer(env, data, |bytes| {
            let value = match format {
                ReaderStringFormat::BinaryString => ReaderString::Latin1(bytes.to_vec()),
                ReaderStringFormat::Text => {
                    let text = file_reader::decode_text(bytes, &label);
                    if text.is_ascii() {
                        ReaderString::Latin1(text.into_bytes())
                    } else {
                        ReaderString::Utf16(text.encode_utf16().collect())
                    }
                }
                ReaderStringFormat::DataUrl
                    if mime
                        .as_ref()
                        .is_none_or(|value| value.iter().all(|unit| *unit < 128)) =>
                {
                    // Public Blob MIME types are ASCII. Write directly into the final buffer and
                    // let N-API construct a Latin1 string without an intermediate UTF16 allocation.
                    let prefix_length =
                        "data:;base64,".len() + mime.as_ref().map_or(0, |value| value.len());
                    let capacity = STANDARD
                        .encoded_length(bytes.len())
                        .checked_add(prefix_length)
                        .unwrap_or(prefix_length);
                    let mut value = String::with_capacity(capacity);
                    value.push_str("data:");
                    if let Some(mime) = mime.as_ref() {
                        value.extend(mime.iter().map(|unit| char::from(*unit as u8)));
                    }
                    value.push_str(";base64,");
                    STANDARD.encode_append(bytes, &mut value);
                    ReaderString::Latin1(value.into_bytes())
                }
                ReaderStringFormat::DataUrl => {
                    let mut value: Vec<u16> = "data:".encode_utf16().collect();
                    if let Some(mime) = mime.as_ref() {
                        value.extend(mime.iter().copied());
                    }
                    value.extend(";base64,".encode_utf16());
                    value.extend(STANDARD.encode_to_string(bytes).encode_utf16());
                    ReaderString::Utf16(value)
                }
            };
            DECODED.fetch_add(1, Ordering::Relaxed);
            value
        })
    };
    match decoded {
        Ok(value) => Ok(value),
        Err(error) => {
            env.throw(capture_pending_error(&env, error))?;
            Err(Error::new(
                Status::PendingException,
                "FileReader native conversion failed",
            ))
        }
    }
}

#[napi]
pub fn file_reader_encoding(label: Option<Utf16String>) -> &'static str {
    let label = label.map_or_else(String::new, |value| String::from_utf16_lossy(&value));
    file_reader::encoding_for_label(&label).name()
}
