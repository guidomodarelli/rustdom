//! Ordered UTF-16 storage with constant-time quota accounting and live insertion-order cursors.
use indexmap::IndexMap;
use rustc_hash::FxBuildHasher;

/// Avoid repeated allocator churn for small live storage areas; empty areas release all capacity.
const MIN_STORAGE_CAPACITY: usize = 16;

struct Entry {
    value: Vec<u16>,
    sequence: u64,
}

#[derive(Debug, PartialEq, Eq)]
pub(super) enum SetStatus {
    Unchanged,
    QuotaExceeded,
    Write,
}
pub(super) struct SetPlan<'a> {
    pub status: SetStatus,
    pub old_value: Option<&'a [u16]>,
}

pub(super) struct StorageArea {
    items: IndexMap<Vec<u16>, Entry, FxBuildHasher>,
    units: usize,
    next_sequence: u64,
}

impl Default for StorageArea {
    fn default() -> Self {
        Self {
            items: IndexMap::default(),
            units: 0,
            next_sequence: 1,
        }
    }
}

impl StorageArea {
    pub fn len(&self) -> usize {
        self.items.len()
    }
    pub fn units(&self) -> usize {
        self.units
    }
    pub fn capacity(&self) -> usize {
        self.items.capacity()
    }
    pub fn get(&self, key: &[u16]) -> Option<&[u16]> {
        self.items.get(key).map(|entry| entry.value.as_slice())
    }
    pub fn key(&self, index: usize) -> Option<&[u16]> {
        self.items.get_index(index).map(|(key, _)| key.as_slice())
    }

    /// Match jsdom's oldValue = get(key) || null, including its empty-value event behavior.
    pub fn plan_set(&self, key: &[u16], value: &[u16], quota: f64) -> SetPlan<'_> {
        let old = self.get(key);
        let old_value = old.filter(|value| !value.is_empty());
        if old_value == Some(value) {
            return SetPlan {
                status: SetStatus::Unchanged,
                old_value: None,
            };
        }
        let replaced = old.map_or(0, |value| key.len() + value.len());
        let total = self.units - replaced + key.len() + value.len();
        if total as f64 > quota {
            return SetPlan {
                status: SetStatus::QuotaExceeded,
                old_value: None,
            };
        }
        SetPlan {
            status: SetStatus::Write,
            old_value,
        }
    }

    /// Commit against the current map after host scheduling, without rechecking the earlier quota.
    pub fn set(&mut self, key: Vec<u16>, value: Vec<u16>) {
        if let Some(entry) = self.items.get_mut(key.as_slice()) {
            self.units = self.units - entry.value.len() + value.len();
            entry.value = value;
        } else {
            let sequence = self.next_sequence;
            self.next_sequence = sequence
                .checked_add(1)
                .expect("storage insertion sequence exhausted");
            self.units += key.len() + value.len();
            self.items.insert(key, Entry { value, sequence });
        }
    }

    pub fn remove(&mut self, key: &[u16]) -> bool {
        let Some((key, entry)) = self.items.shift_remove_entry(key) else {
            return false;
        };
        self.units -= key.len() + entry.value.len();
        self.compact();
        true
    }

    pub fn clear(&mut self) {
        self.items.clear();
        self.units = 0;
        self.items.shrink_to_fit();
    }

    fn compact(&mut self) {
        if self.items.is_empty() {
            self.items.shrink_to_fit();
        } else if self.items.len() < self.items.capacity() / 4 {
            self.items
                .shrink_to(self.items.len().max(MIN_STORAGE_CAPACITY));
        }
    }

    /// Remaining insertion sequences stay sorted after shift_remove; clear never rewinds them.
    pub fn next_key(&self, after: u64) -> Option<(u64, &[u16])> {
        let mut low = 0;
        let mut high = self.items.len();
        while low < high {
            let middle = low + (high - low) / 2;
            if self
                .items
                .get_index(middle)
                .expect("bounded storage index")
                .1
                .sequence
                <= after
            {
                low = middle + 1;
            } else {
                high = middle;
            }
        }
        self.items
            .get_index(low)
            .map(|(key, entry)| (entry.sequence, key.as_slice()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn text(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }

    #[test]
    fn should_track_utf16_quota_and_preserve_overwrite_order() {
        let mut area = StorageArea::default();
        area.set(text("a"), text("🦀"));
        assert_eq!(area.units(), 3);
        assert_eq!(
            area.plan_set(&text("b"), &text("x"), 3.0).status,
            SetStatus::QuotaExceeded
        );
        area.set(text("b"), vec![0xd800]);
        area.set(text("a"), Vec::new());
        assert_eq!(area.units(), 3);
        assert_eq!(area.key(0), Some(text("a").as_slice()));
        area.remove(&text("a"));
        area.set(text("a"), text("later"));
        assert_eq!(area.key(0), Some(text("b").as_slice()));
        assert_eq!(area.key(1), Some(text("a").as_slice()));
    }

    #[test]
    fn should_preserve_empty_old_values_and_numeric_quota_edges() {
        let mut area = StorageArea::default();
        area.set(text("a"), Vec::new());
        let plan = area.plan_set(&text("a"), &[], 1.0);
        assert_eq!(plan.status, SetStatus::Write);
        assert_eq!(plan.old_value, None);
        assert_eq!(
            area.plan_set(&[], &[], -1.0).status,
            SetStatus::QuotaExceeded
        );
        assert_eq!(
            area.plan_set(&text("large"), &text("value"), f64::NAN)
                .status,
            SetStatus::Write
        );
        area.set(text("a"), text("stored"));
        assert_eq!(
            area.plan_set(&text("a"), &text("stored"), 0.0).status,
            SetStatus::Unchanged
        );
        assert_eq!(
            area.plan_set(&text("a"), &text("changed"), f64::NEG_INFINITY)
                .status,
            SetStatus::QuotaExceeded
        );
    }

    #[test]
    fn should_keep_live_cursor_order_through_delete_reinsert_and_clear() {
        let mut area = StorageArea::default();
        area.set(text("a"), text("1"));
        area.set(text("b"), text("2"));
        let first = area.next_key(0).unwrap().0;
        area.remove(&text("b"));
        area.set(text("c"), text("3"));
        let next = area.next_key(first).unwrap();
        assert_eq!(next.1, text("c"));
        let last = next.0;
        area.clear();
        area.set(text("a"), text("new"));
        assert_eq!(area.next_key(last).unwrap().1, text("a"));
    }

    #[test]
    fn should_release_capacity_without_discarding_a_surviving_entry() {
        let mut area = StorageArea::default();
        area.set(text("kept"), text("value"));
        for index in 0..4096 {
            area.set(text(&format!("key-{index}")), vec![0xd800; 32]);
        }
        for index in 0..4096 {
            assert!(area.remove(&text(&format!("key-{index}"))));
        }
        assert_eq!(area.get(&text("kept")), Some(text("value").as_slice()));
        assert_eq!(area.units(), 9);
        assert!(area.capacity() <= MIN_STORAGE_CAPACITY * 4);
        area.clear();
        assert_eq!((area.len(), area.units(), area.capacity()), (0, 0, 0));
    }
}
