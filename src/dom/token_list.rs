//! Ordered UTF-16 token sets with native validation, normalization and sparse-capacity reclamation.
use super::compact_storage::{CompactSet, compact_vector};
use rustc_hash::FxBuildHasher;
use std::{
    rc::Rc,
    sync::atomic::{AtomicU64, Ordering},
};

pub(super) static LIVE_SETS: AtomicU64 = AtomicU64::new(0);
pub(super) static TOKEN_UNITS: AtomicU64 = AtomicU64::new(0);

pub(super) struct TokenSet {
    items: Vec<Rc<[u16]>>,
    members: CompactSet<Rc<[u16]>, FxBuildHasher>,
    units: usize,
}

impl Drop for TokenSet {
    fn drop(&mut self) {
        LIVE_SETS.fetch_sub(1, Ordering::Relaxed);
        TOKEN_UNITS.fetch_sub(self.units as u64, Ordering::Relaxed);
    }
}

impl Default for TokenSet {
    fn default() -> Self {
        LIVE_SETS.fetch_add(1, Ordering::Relaxed);
        Self {
            items: Vec::new(),
            members: CompactSet::default(),
            units: 0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Validation {
    Valid,
    Empty,
    Space,
}

pub(super) fn html_space(unit: u16) -> bool {
    matches!(unit, 0x09 | 0x0a | 0x0c | 0x0d | 0x20)
}

/// replace checks all empties first; add/remove validate each argument independently.
pub(super) fn validate(tokens: &[Vec<u16>], pair: bool) -> Validation {
    if pair && tokens.iter().any(Vec::is_empty) {
        return Validation::Empty;
    }
    for token in tokens {
        if token.is_empty() {
            return Validation::Empty;
        }
        if token.iter().any(|unit| html_space(*unit)) {
            return Validation::Space;
        }
    }
    Validation::Valid
}

impl TokenSet {
    pub fn parse(value: &[u16]) -> Self {
        let mut set = Self::default();
        let mut start = 0;
        for index in 0..=value.len() {
            if index == value.len() || html_space(value[index]) {
                if start != index {
                    set.append(&value[start..index]);
                }
                start = index + 1;
            }
        }
        set
    }
    pub fn len(&self) -> usize {
        self.items.len()
    }
    pub fn contains(&self, token: &[u16]) -> bool {
        self.members.contains(token)
    }
    pub fn get(&self, index: usize) -> Option<Vec<u16>> {
        self.items.get(index).map(|value| value.to_vec())
    }
    pub fn append(&mut self, token: &[u16]) {
        if self.contains(token) {
            return;
        }
        let token: Rc<[u16]> = token.into();
        self.units += token.len();
        TOKEN_UNITS.fetch_add(token.len() as u64, Ordering::Relaxed);
        self.members.insert(token.clone());
        self.items.push(token);
    }
    pub fn remove(&mut self, tokens: &[Vec<u16>]) {
        let mut removed = false;
        for token in tokens {
            removed |= self.members.remove(token.as_slice());
        }
        if !removed {
            return;
        }
        self.items
            .retain(|token| self.members.contains(token.as_ref()));
        self.update_units();
        compact_vector(&mut self.items);
        self.members.compact();
    }
    pub fn replace(&mut self, token: &[u16], replacement: &[u16]) -> bool {
        if !self.contains(token) {
            return false;
        }
        let replacement: Rc<[u16]> = self
            .members
            .get(replacement)
            .cloned()
            .unwrap_or_else(|| replacement.into());
        let mut seen = false;
        self.items.retain_mut(|item| {
            if item.as_ref() == token || item.as_ref() == replacement.as_ref() {
                if seen {
                    return false;
                }
                *item = replacement.clone();
                seen = true;
            }
            true
        });
        self.members.remove(token);
        self.members.insert(replacement);
        self.update_units();
        compact_vector(&mut self.items);
        self.members.compact();
        true
    }
    fn update_units(&mut self) {
        let units = self.items.iter().map(|token| token.len()).sum::<usize>();
        if units >= self.units {
            TOKEN_UNITS.fetch_add((units - self.units) as u64, Ordering::Relaxed);
        } else {
            TOKEN_UNITS.fetch_sub((self.units - units) as u64, Ordering::Relaxed);
        }
        self.units = units;
    }
    pub fn serialize(&self) -> Vec<u16> {
        let mut value = Vec::with_capacity(self.units + self.items.len().saturating_sub(1));
        for (index, token) in self.items.iter().enumerate() {
            if index != 0 {
                value.push(0x20);
            }
            value.extend_from_slice(token);
        }
        value
    }
    pub fn capacity(&self) -> (usize, usize) {
        (self.items.capacity(), self.members.capacity())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn text(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }
    #[test]
    fn should_parse_exact_html_space_and_keep_utf16_and_order() {
        let set = TokenSet::parse(&[32, 97, 9, 98, 12, 97, 13, 0xd800, 32, 11, 0xa0, 0]);
        assert_eq!(set.len(), 4);
        assert_eq!(set.get(0), Some(text("a")));
        assert_eq!(set.get(1), Some(text("b")));
        assert_eq!(set.get(2), Some(vec![0xd800]));
        assert_eq!(set.get(3), Some(vec![11, 0xa0, 0]));
        assert!(set.contains(&[0xd800]));
        assert_eq!(set.get(4), None);
    }
    #[test]
    fn should_preserve_validation_precedence_for_pairs_and_variadic_calls() {
        let tokens = [text("bad space"), Vec::new()];
        assert_eq!(validate(&tokens, false), Validation::Space);
        assert_eq!(validate(&tokens, true), Validation::Empty);
        assert_eq!(
            validate(&[text("valid\u{b}token")], false),
            Validation::Valid
        );
    }
    #[test]
    fn should_replace_at_the_first_position_and_deduplicate() {
        let mut set = TokenSet::parse(&text("a b c"));
        assert!(set.replace(&text("b"), &text("a")));
        assert_eq!(set.serialize(), text("a c"));
        assert!(set.replace(&text("a"), &text("z")));
        assert_eq!(set.serialize(), text("z c"));
        assert!(!set.replace(&text("missing"), &text("x")));
        set.append(&text("z"));
        assert_eq!(set.len(), 2);
        assert!(set.replace(&text("z"), &text("z")));
        assert_eq!(set.serialize(), text("z c"));
    }
    #[test]
    fn should_reclaim_large_storage_after_bulk_removal() {
        let tokens = (0..4096)
            .map(|index| text(&format!("token{index}")))
            .collect::<Vec<_>>();
        let mut set = TokenSet::default();
        for token in &tokens {
            set.append(token);
        }
        assert!(set.capacity().0 >= tokens.len());
        set.remove(&tokens);
        assert_eq!(set.len(), 0);
        assert_eq!(set.capacity(), (0, 0));
        assert!(set.serialize().is_empty());
    }
}
