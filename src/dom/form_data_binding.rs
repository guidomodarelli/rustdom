//! N-API entry-list operations; file objects remain in the host's GC-visible owner map.
use super::form_data::{Entry, EntryList, Value};
use napi::bindgen_prelude::{Either, Float64Array, Utf16String};
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
    pub name: Utf16String,
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
        Value::File => Either::B(id as f64),
    }
}
fn entry_snapshot(id: u64, entry: &Entry) -> FormDataEntry {
    FormDataEntry {
        id: id as f64,
        name: Utf16String::from(entry.name.to_vec()),
        value: entry_value(id, entry),
    }
}
fn input_value(value: Option<Utf16String>) -> Value {
    value.map_or(Value::File, |text| Value::Text(text.to_vec()))
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
