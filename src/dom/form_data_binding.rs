//! N-API entry-list operations; file objects remain in the host's GC-visible owner map.
use super::constants::JS_MAX_SAFE_INTEGER;
use super::form_data::{Entry, EntryList, Name, Value};
use napi::bindgen_prelude::{Either, Float64Array, Utf16String};
use napi::{Error, Result, Status};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE: AtomicU64 = AtomicU64::new(0);
static CREATED: AtomicU64 = AtomicU64::new(0);
static RELEASED: AtomicU64 = AtomicU64::new(0);
static ENTRIES: AtomicU64 = AtomicU64::new(0);
static TEXT_UNITS: AtomicU64 = AtomicU64::new(0);
static CAPACITY: AtomicU64 = AtomicU64::new(0);
static NAME_CAPACITY: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct NativeFormDataStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
    pub entries: f64,
    pub text_units: f64,
    pub capacity: f64,
    pub name_capacity: f64,
}
#[napi(object)]
pub struct FormDataEntry {
    pub id: f64,
    pub name: Either<Utf16String, f64>,
    pub value: Either<Utf16String, f64>,
}
#[napi(object)]
pub struct FormDataSetResult {
    pub id: f64,
    pub index: f64,
    pub existed: bool,
    pub removed: Vec<f64>,
}

fn entry_value(id: u64, entry: &Entry) -> Either<Utf16String, f64> {
    match &entry.value {
        Value::Text(text) => Either::A(Utf16String::from(text.clone())),
        Value::Host => Either::B(id as f64),
    }
}
fn entry_snapshot(id: u64, entry: &Entry) -> FormDataEntry {
    FormDataEntry {
        id: id as f64,
        name: match &entry.name {
            Name::Text(name) => Either::A(Utf16String::from(name.to_vec())),
            Name::Host(id) => Either::B(*id as f64),
        },
        value: entry_value(id, entry),
    }
}
fn input_value(value: Option<Utf16String>) -> Value {
    value.map_or(Value::Host, |text| Value::Text(text.to_vec()))
}

fn host_name(value: f64) -> Result<u64> {
    if !value.is_finite()
        || value <= 0.0
        || value.fract() != 0.0
        || value > JS_MAX_SAFE_INTEGER as f64
    {
        return Err(Error::new(
            Status::InvalidArg,
            "FormData host name identity must be a positive safe integer",
        ));
    }
    Ok(value as u64)
}

#[napi]
pub struct NativeFormDataEntries {
    list: EntryList,
}
impl Default for NativeFormDataEntries {
    fn default() -> Self {
        Self::new()
    }
}
impl NativeFormDataEntries {
    fn account(&self, add: bool) {
        for (counter, value) in [
            (&ENTRIES, self.list.len()),
            (&TEXT_UNITS, self.list.text_units()),
            (&CAPACITY, self.list.capacity()),
            (&NAME_CAPACITY, self.list.name_capacity()),
        ] {
            if add {
                counter.fetch_add(value as u64, Ordering::Relaxed);
            } else {
                counter.fetch_sub(value as u64, Ordering::Relaxed);
            }
        }
    }
    fn update<T>(&mut self, change: impl FnOnce(&mut EntryList) -> T) -> T {
        self.account(false);
        let result = change(&mut self.list);
        self.account(true);
        result
    }
}
impl Drop for NativeFormDataEntries {
    fn drop(&mut self) {
        self.account(false);
        LIVE.fetch_sub(1, Ordering::Relaxed);
        RELEASED.fetch_add(1, Ordering::Relaxed);
    }
}

#[napi]
impl NativeFormDataEntries {
    #[napi(constructor)]
    pub fn new() -> Self {
        LIVE.fetch_add(1, Ordering::Relaxed);
        CREATED.fetch_add(1, Ordering::Relaxed);
        Self {
            list: EntryList::default(),
        }
    }
    #[napi(getter)]
    pub fn length(&self) -> f64 {
        self.list.len() as f64
    }
    #[napi]
    pub fn append(&mut self, name: Utf16String, value: Option<Utf16String>) -> Option<f64> {
        self.update(|list| list.append(name.to_vec(), input_value(value)))
            .map(|id| id as f64)
    }
    #[napi]
    pub fn set(
        &mut self,
        name: Utf16String,
        value: Option<Utf16String>,
    ) -> Option<FormDataSetResult> {
        self.update(|list| list.set(name.to_vec(), input_value(value)))
            .map(|result| FormDataSetResult {
                id: result.id as f64,
                index: result.index as f64,
                existed: result.existed,
                removed: result.removed.into_iter().map(|id| id as f64).collect(),
            })
    }
    #[napi]
    pub fn delete(&mut self, name: Utf16String) -> Vec<f64> {
        self.update(|list| list.delete(&name))
            .into_iter()
            .map(|id| id as f64)
            .collect()
    }
    #[napi]
    pub fn has(&self, name: Utf16String) -> bool {
        !self.list.ids(&name).is_empty()
    }
    #[napi]
    pub fn get(&self, name: Utf16String) -> Option<Either<Utf16String, f64>> {
        self.list
            .first(&name)
            .map(|(id, entry)| entry_value(id, entry))
    }
    #[napi]
    pub fn get_all(&self, name: Utf16String) -> Vec<Either<Utf16String, f64>> {
        self.list
            .ids(&name)
            .iter()
            .map(|id| entry_value(*id, self.list.get(*id).expect("indexed FormData entry")))
            .collect()
    }
    #[napi]
    pub fn first_id(&self, name: Utf16String) -> Option<f64> {
        self.list.ids(&name).first().map(|id| *id as f64)
    }
    #[napi]
    pub fn ids(&self, name: Utf16String) -> Float64Array {
        self.list
            .ids(&name)
            .iter()
            .map(|id| *id as f64)
            .collect::<Vec<_>>()
            .into()
    }
    #[napi]
    pub fn append_host(
        &mut self,
        name: Option<f64>,
        value: Option<Utf16String>,
    ) -> Result<Option<f64>> {
        let name = name.map(host_name).transpose()?;
        if name.is_some_and(|name| self.list.host_ids(name).is_empty()) {
            return Err(Error::new(
                Status::InvalidArg,
                "FormData host name identity is not active",
            ));
        }
        Ok(self
            .update(|list| list.append_host(name, input_value(value)))
            .map(|id| id as f64))
    }
    #[napi]
    pub fn set_host(
        &mut self,
        name: Option<f64>,
        value: Option<Utf16String>,
    ) -> Result<Option<FormDataSetResult>> {
        let name = name.map(host_name).transpose()?;
        if name.is_some_and(|name| self.list.host_ids(name).is_empty()) {
            return Err(Error::new(
                Status::InvalidArg,
                "FormData host name identity is not active",
            ));
        }
        Ok(self
            .update(|list| list.set_host(name, input_value(value)))
            .map(|result| FormDataSetResult {
                id: result.id as f64,
                index: result.index as f64,
                existed: result.existed,
                removed: result.removed.into_iter().map(|id| id as f64).collect(),
            }))
    }
    #[napi]
    pub fn delete_host(&mut self, name: f64) -> Result<Vec<f64>> {
        let name = host_name(name)?;
        Ok(self
            .update(|list| list.delete_host(name))
            .into_iter()
            .map(|id| id as f64)
            .collect())
    }
    #[napi]
    pub fn has_host(&self, name: f64) -> Result<bool> {
        Ok(!self.list.host_ids(host_name(name)?).is_empty())
    }
    #[napi]
    pub fn first_host_id(&self, name: f64) -> Result<Option<f64>> {
        Ok(self
            .list
            .host_ids(host_name(name)?)
            .first()
            .map(|id| *id as f64))
    }
    #[napi]
    pub fn host_ids(&self, name: f64) -> Result<Float64Array> {
        Ok(self
            .list
            .host_ids(host_name(name)?)
            .iter()
            .map(|id| *id as f64)
            .collect::<Vec<_>>()
            .into())
    }
    #[napi]
    pub fn id_at(&self, index: f64) -> Option<f64> {
        if !index.is_finite()
            || index < 0.0
            || index.fract() != 0.0
            || index >= self.list.len() as f64
        {
            return None;
        }
        self.list.at(index as usize).map(|(id, _)| id as f64)
    }
    /// Read the native typed-array metadata in constant time without any JavaScript property lookup.
    #[napi]
    pub fn id_array_length(identities: Float64Array) -> f64 {
        identities.len() as f64
    }
    #[napi]
    pub fn all_ids(&self) -> Float64Array {
        (0..self.list.len())
            .map(|index| self.list.at(index).expect("bounded FormData identity").0 as f64)
            .collect::<Vec<_>>()
            .into()
    }
    #[napi]
    pub fn entry_at(&self, index: f64) -> Option<FormDataEntry> {
        if !index.is_finite()
            || index < 0.0
            || index.fract() != 0.0
            || index >= self.list.len() as f64
        {
            return None;
        }
        self.list
            .at(index as usize)
            .map(|(id, entry)| entry_snapshot(id, entry))
    }
    #[napi]
    pub fn snapshot(&self) -> Vec<FormDataEntry> {
        (0..self.list.len())
            .map(|index| {
                let (id, entry) = self.list.at(index).expect("bounded FormData entry");
                entry_snapshot(id, entry)
            })
            .collect()
    }
    #[napi]
    pub fn statistics() -> NativeFormDataStatistics {
        NativeFormDataStatistics {
            live: LIVE.load(Ordering::Relaxed) as f64,
            created: CREATED.load(Ordering::Relaxed) as f64,
            released: RELEASED.load(Ordering::Relaxed) as f64,
            entries: ENTRIES.load(Ordering::Relaxed) as f64,
            text_units: TEXT_UNITS.load(Ordering::Relaxed) as f64,
            capacity: CAPACITY.load(Ordering::Relaxed) as f64,
            name_capacity: NAME_CAPACITY.load(Ordering::Relaxed) as f64,
        }
    }
}
