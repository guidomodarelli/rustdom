//! Reclaim sparse native hash tables even when tombstones hide their allocated bucket count.
use std::collections::{HashMap, HashSet, hash_map::RandomState};
use std::hash::{BuildHasher, Hash};
use std::ops::{Deref, DerefMut};

/// Keep small allocations reusable while giving large sparse indexes room for the next burst.
const MIN_REUSABLE_CAPACITY: usize = 16;
/// Rehash only after at least three quarters of a large allocation become unused.
const COMPACTION_RATIO: usize = 4;

fn reduced_capacity(length: usize, capacity: usize) -> Option<usize> {
    if capacity > MIN_REUSABLE_CAPACITY * COMPACTION_RATIO && length <= capacity / COMPACTION_RATIO
    {
        Some(if length == 0 {
            0
        } else {
            length.saturating_mul(2).max(MIN_REUSABLE_CAPACITY)
        })
    } else {
        None
    }
}

pub(crate) fn compact_vector<Value>(values: &mut Vec<Value>) {
    if let Some(target) = reduced_capacity(values.len(), values.capacity()) {
        values.shrink_to(target);
    }
}

/// Remember capacity before deletion: HashMap::capacity excludes slots occupied by tombstones.
pub struct CompactMap<Key, Value, Hasher = RandomState> {
    values: HashMap<Key, Value, Hasher>,
    allocated_capacity: usize,
}

impl<Key, Value, Hasher: Default> Default for CompactMap<Key, Value, Hasher> {
    fn default() -> Self {
        Self {
            values: HashMap::with_hasher(Hasher::default()),
            allocated_capacity: 0,
        }
    }
}

impl<Key, Value, Hasher> Deref for CompactMap<Key, Value, Hasher> {
    type Target = HashMap<Key, Value, Hasher>;
    fn deref(&self) -> &Self::Target {
        &self.values
    }
}

impl<Key, Value, Hasher> DerefMut for CompactMap<Key, Value, Hasher> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.allocated_capacity = self.allocated_capacity.max(self.values.capacity());
        &mut self.values
    }
}

impl<Key: Eq + Hash, Value, Hasher: BuildHasher + Clone> CompactMap<Key, Value, Hasher> {
    pub fn compact(&mut self) {
        self.allocated_capacity = self.allocated_capacity.max(self.values.capacity());
        if let Some(target) = reduced_capacity(self.values.len(), self.allocated_capacity) {
            // shrink_to may itself skip a tombstone-heavy table whose reported capacity is low.
            let replacement =
                HashMap::with_capacity_and_hasher(target, self.values.hasher().clone());
            let previous = std::mem::replace(&mut self.values, replacement);
            self.values.extend(previous);
            self.allocated_capacity = self.values.capacity();
        }
    }

    pub fn shrink_to_fit(&mut self) {
        if self.values.is_empty() {
            self.values = HashMap::with_hasher(self.values.hasher().clone());
        } else {
            self.values.shrink_to_fit();
        }
        self.allocated_capacity = self.values.capacity();
    }
}

/// Native owner/reference sets need the same protection as keyed tables.
pub struct CompactSet<Value, Hasher> {
    values: HashSet<Value, Hasher>,
    allocated_capacity: usize,
}

impl<Value, Hasher: Default> Default for CompactSet<Value, Hasher> {
    fn default() -> Self {
        Self {
            values: HashSet::with_hasher(Hasher::default()),
            allocated_capacity: 0,
        }
    }
}

impl<Value, Hasher> Deref for CompactSet<Value, Hasher> {
    type Target = HashSet<Value, Hasher>;
    fn deref(&self) -> &Self::Target {
        &self.values
    }
}

impl<Value, Hasher> DerefMut for CompactSet<Value, Hasher> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.allocated_capacity = self.allocated_capacity.max(self.values.capacity());
        &mut self.values
    }
}

impl<Value: Eq + Hash, Hasher: BuildHasher + Clone> CompactSet<Value, Hasher> {
    pub fn compact(&mut self) {
        self.allocated_capacity = self.allocated_capacity.max(self.values.capacity());
        if let Some(target) = reduced_capacity(self.values.len(), self.allocated_capacity) {
            let replacement =
                HashSet::with_capacity_and_hasher(target, self.values.hasher().clone());
            let previous = std::mem::replace(&mut self.values, replacement);
            self.values.extend(previous);
            self.allocated_capacity = self.values.capacity();
        }
    }
}

impl<Value, Hasher> IntoIterator for CompactSet<Value, Hasher> {
    type Item = Value;
    type IntoIter = std::collections::hash_set::IntoIter<Value>;
    fn into_iter(self) -> Self::IntoIter {
        self.values.into_iter()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::hash::{BuildHasherDefault, Hasher};

    // reserve(256) gives 448 entries on this toolchain: enough to expose the retained
    // capacity regression, without quadratic collision setup on thousands of keys.
    const COLLIDING_FIXTURE_RESERVATION: usize = 256;

    #[derive(Default)]
    struct CollidingHasher;
    impl Hasher for CollidingHasher {
        fn write(&mut self, _bytes: &[u8]) {}
        fn finish(&self) -> u64 {
            0
        }
    }

    fn assert_map_reclaims_tombstones(remaining: u64) {
        let mut values = CompactMap::<u64, u64, BuildHasherDefault<CollidingHasher>>::default();
        values.reserve(COLLIDING_FIXTURE_RESERVATION);
        let count = values.capacity() as u64;
        for key in 0..count {
            values.insert(key, key);
        }
        for key in remaining..count {
            values.remove(&key);
            values.compact();
        }
        // Reusing a table full of tombstones exposes its old bucket allocation again.
        values.insert(count, count);
        println!(
            "compact-storage map remaining={remaining} peak={count} after-reuse={}",
            values.capacity()
        );
        assert!(values.capacity() < 256);
        assert_eq!(values.len(), remaining as usize + 1);
        for key in 0..remaining {
            assert_eq!(values.get(&key), Some(&key));
        }
        assert_eq!(values.get(&count), Some(&count));
    }

    fn assert_set_reclaims_tombstones(remaining: u64) {
        let mut values = CompactSet::<u64, BuildHasherDefault<CollidingHasher>>::default();
        values.reserve(COLLIDING_FIXTURE_RESERVATION);
        let count = values.capacity() as u64;
        for key in 0..count {
            values.insert(key);
        }
        for key in remaining..count {
            values.remove(&key);
            values.compact();
        }
        values.insert(count);
        println!(
            "compact-storage set remaining={remaining} peak={count} after-reuse={}",
            values.capacity()
        );
        assert!(values.capacity() < 256);
        assert_eq!(values.len(), remaining as usize + 1);
        for key in 0..remaining {
            assert!(values.contains(&key));
        }
        assert!(values.contains(&count));
    }

    #[test]
    fn should_reclaim_map_buckets_when_tombstones_hide_their_capacity() {
        assert_map_reclaims_tombstones(8);
    }

    #[test]
    fn should_reclaim_empty_map_buckets_when_tombstones_hide_their_capacity() {
        assert_map_reclaims_tombstones(0);
    }

    #[test]
    fn should_reclaim_set_buckets_when_tombstones_hide_their_capacity() {
        assert_set_reclaims_tombstones(8);
    }

    #[test]
    fn should_reclaim_empty_set_buckets_when_tombstones_hide_their_capacity() {
        assert_set_reclaims_tombstones(0);
    }
}
