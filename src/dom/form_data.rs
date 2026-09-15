//! Ordered FormData entries with indexed names and file identities owned by V8.
use super::constants::JS_MAX_SAFE_INTEGER;
use indexmap::IndexMap;
use rustc_hash::{FxBuildHasher, FxHashMap};
use std::rc::Rc;

/// Small active forms retain a modest allocation; empty forms release all backing capacity.
const MIN_FORM_DATA_CAPACITY: usize = 16;

#[derive(Debug, PartialEq, Eq)]
pub(super) enum Value {
    Text(Vec<u16>),
    File,
}
impl Value {
    fn units(&self) -> usize {
        match self {
            Self::Text(text) => text.len(),
            Self::File => 0,
        }
    }
}

pub(super) struct Entry {
    pub name: Rc<[u16]>,
    pub value: Value,
}

pub(super) struct SetResult {
    pub id: u64,
    pub index: usize,
    pub existed: bool,
    pub removed: Vec<u64>,
}

pub(super) struct EntryList {
    entries: IndexMap<u64, Entry, FxBuildHasher>,
    names: FxHashMap<Rc<[u16]>, Vec<u64>>,
    next_id: u64,
    text_units: usize,
}
impl Default for EntryList {
    fn default() -> Self {
        Self {
            entries: IndexMap::default(),
            names: FxHashMap::default(),
            next_id: 1,
            text_units: 0,
        }
    }
}
impl EntryList {
    pub fn len(&self) -> usize {
        self.entries.len()
    }
    pub fn text_units(&self) -> usize {
        self.text_units
    }
    pub fn capacity(&self) -> usize {
        self.entries.capacity()
    }
    pub fn name_capacity(&self) -> usize {
        self.names.capacity()
    }
    pub fn get(&self, id: u64) -> Option<&Entry> {
        self.entries.get(&id)
    }
    pub fn at(&self, index: usize) -> Option<(u64, &Entry)> {
        self.entries
            .get_index(index)
            .map(|(id, entry)| (*id, entry))
    }
    pub fn ids(&self, name: &[u16]) -> &[u64] {
        self.names.get(name).map_or(&[], Vec::as_slice)
    }
    pub fn first(&self, name: &[u16]) -> Option<(u64, &Entry)> {
        self.ids(name)
            .first()
            .and_then(|id| self.get(*id).map(|entry| (*id, entry)))
    }

    /// File contents are not stored here; the returned identity indexes the host's visible owner map.
    pub fn append(&mut self, name: Vec<u16>, value: Value) -> Option<u64> {
        if self.next_id >= JS_MAX_SAFE_INTEGER {
            return None;
        }
        let id = self.next_id;
        self.next_id += 1;
        let name = self
            .names
            .get_key_value(name.as_slice())
            .map(|(key, _)| Rc::clone(key))
            .unwrap_or_else(|| Rc::from(name));
        self.text_units += value.units();
        self.names.entry(Rc::clone(&name)).or_default().push(id);
        self.entries.insert(id, Entry { name, value });
        Some(id)
    }

    /// Replace the first position and remove later duplicates in one ordered retain pass.
    pub fn set(&mut self, name: Vec<u16>, value: Value) -> Option<SetResult> {
        let Some(id) = self.ids(&name).first().copied() else {
            let index = self.entries.len();
            return self.append(name, value).map(|id| SetResult {
                id,
                index,
                existed: false,
                removed: vec![],
            });
        };
        let index = self
            .entries
            .get_index_of(&id)
            .expect("indexed first FormData entry");
        let first = self
            .entries
            .get_mut(&id)
            .expect("indexed first FormData value");
        self.text_units = self.text_units - first.value.units() + value.units();
        first.value = value;
        let mut removed = Vec::new();
        self.entries.retain(|entry_id, entry| {
            if *entry_id != id && entry.name.as_ref() == name.as_slice() {
                self.text_units -= entry.value.units();
                removed.push(*entry_id);
                false
            } else {
                true
            }
        });
        *self
            .names
            .get_mut(name.as_slice())
            .expect("indexed FormData name") = vec![id];
        self.compact();
        Some(SetResult {
            id,
            index,
            existed: true,
            removed,
        })
    }

    pub fn delete(&mut self, name: &[u16]) -> Vec<u64> {
        let Some(removed) = self.names.remove(name) else {
            return vec![];
        };
        self.entries.retain(|_, entry| {
            if entry.name.as_ref() == name {
                self.text_units -= entry.value.units();
                false
            } else {
                true
            }
        });
        self.compact();
        removed
    }

    fn compact(&mut self) {
        if self.entries.is_empty() {
            self.entries.shrink_to_fit();
            self.names.shrink_to_fit();
        } else {
            if self.entries.len() < self.entries.capacity() / 4 {
                self.entries
                    .shrink_to(self.entries.len().max(MIN_FORM_DATA_CAPACITY));
            }
            if self.names.len() < self.names.capacity() / 4 {
                self.names
                    .shrink_to(self.names.len().max(MIN_FORM_DATA_CAPACITY));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn text(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }
    fn value(value: &str) -> Value {
        Value::Text(text(value))
    }

    #[test]
    fn should_preserve_order_and_first_position_when_replacing_duplicates() {
        let mut list = EntryList::default();
        let first = list.append(text("a"), value("first")).unwrap();
        let middle = list.append(text("b"), value("middle")).unwrap();
        let duplicate = list.append(text("a"), Value::File).unwrap();
        assert_eq!(list.ids(&text("a")), &[first, duplicate]);
        assert!(Rc::ptr_eq(
            &list.get(first).unwrap().name,
            &list.get(duplicate).unwrap().name
        ));
        let result = list.set(text("a"), value("replacement")).unwrap();
        assert_eq!((result.id, result.index, result.existed), (first, 0, true));
        assert_eq!(result.removed, vec![duplicate]);
        assert_eq!(list.at(0).unwrap().0, first);
        assert_eq!(list.at(1).unwrap().0, middle);
        assert_eq!(
            list.first(&text("a")).unwrap().1.value,
            value("replacement")
        );
        assert_eq!(list.text_units(), "replacementmiddle".len());
        assert_eq!(list.delete(&text("a")), vec![first]);
        assert_eq!(list.at(0).unwrap().0, middle);
        assert_eq!(list.text_units(), "middle".len());
    }

    #[test]
    fn should_preserve_utf16_names_and_reclaim_capacity_with_one_entry_alive() {
        let mut list = EntryList::default();
        let kept = list.append(vec![0xd800, 0], Value::File).unwrap();
        for index in 0..1000 {
            list.append(text(&format!("name{index}")), value("payload"))
                .unwrap();
        }
        for index in 0..1000 {
            list.delete(&text(&format!("name{index}")));
        }
        assert_eq!(list.len(), 1);
        assert_eq!(list.at(0).unwrap().0, kept);
        assert_eq!(list.first(&[0xd800, 0]).unwrap().1.value, Value::File);
        assert!(list.capacity() <= MIN_FORM_DATA_CAPACITY * 2);
        assert!(list.name_capacity() <= MIN_FORM_DATA_CAPACITY * 2);
        assert_eq!(list.text_units(), 0);
        assert_eq!(list.delete(&[0xd800, 0]), vec![kept]);
        assert_eq!(list.capacity(), 0);
        assert_eq!(list.name_capacity(), 0);
    }

    #[test]
    fn should_reject_exhausted_new_identities_without_changing_existing_entries() {
        let mut list = EntryList::default();
        let id = list.append(text("kept"), Value::File).unwrap();
        list.next_id = JS_MAX_SAFE_INTEGER;
        assert!(list.append(text("other"), value("no")).is_none());
        assert!(list.set(text("other"), value("no")).is_none());
        assert_eq!(list.len(), 1);
        assert_eq!(list.first(&text("kept")).unwrap().0, id);
        assert!(list.set(text("kept"), value("updated")).unwrap().existed);
        assert_eq!(list.text_units(), 7);
    }
}
