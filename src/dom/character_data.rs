//! Canonical CharacterData storage and UTF-16 string operations, independent of JavaScript.
use super::{
    constants::{CDATA_SECTION_NODE, PROCESSING_INSTRUCTION_NODE, TEXT_NODE, is_character_data},
    data::{DomString, NodeData},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};
use std::collections::VecDeque;

#[derive(Debug, PartialEq)]
pub(crate) enum WholeText {
    Units(Vec<u16>),
    Undefined,
    Nan,
}

impl TreeStore {
    fn character_value(&self, id: NodeId) -> Result<&DomString> {
        let data = self.data.get(&id).ok_or(TreeError::MissingData(id))?;
        if !is_character_data(data.kind) {
            return Err(TreeError::NotCharacterData(id));
        }
        Ok(&data.value)
    }

    fn character_units(&self, id: NodeId) -> Result<&[u16]> {
        match self.character_value(id)? {
            DomString::Utf16(units) => Ok(units),
            DomString::Undefined => Err(TreeError::UndefinedCharacterDataProperty("length")),
            DomString::Text(_) => {
                unreachable!("CharacterData is normalized at the storage boundary")
            }
        }
    }

    /// Initialize a detached node directly in its final native representation.
    pub fn set_character_data(&mut self, handle: f64, kind: u16, value: Vec<u16>) -> Result<()> {
        self.set_character_value(handle, kind, DomString::Utf16(value))
    }

    /// Preserve the reference's internal undefined value without a JavaScript owner or side map.
    pub fn set_character_value(&mut self, handle: f64, kind: u16, value: DomString) -> Result<()> {
        if !is_character_data(kind) {
            return Err(TreeError::NotCharacterData(node_id(handle)?));
        }
        let name = self
            .data
            .get(&node_id(handle)?)
            .filter(|data| kind == PROCESSING_INSTRUCTION_NODE && data.kind == kind)
            .and_then(|data| data.name.clone());
        self.replace_data(
            handle,
            NodeData {
                kind,
                name,
                value,
                ..NodeData::default()
            },
        )
    }

    pub fn character_data(&self, handle: f64) -> Result<&[u16]> {
        self.character_units(node_id(handle)?)
    }

    pub fn character_data_value(&self, handle: f64) -> Result<&DomString> {
        self.character_value(node_id(handle)?)
    }

    pub fn character_length(&self, handle: f64) -> Result<usize> {
        Ok(self.character_data(handle)?.len())
    }

    /// Offset/count count UTF-16 units; count is clamped without integer overflow.
    pub fn substring_data(&self, handle: f64, offset: u32, count: u32) -> Result<Vec<u16>> {
        let units = self.character_data(handle)?;
        let start = offset as usize;
        if start > units.len() {
            return Err(TreeError::CharacterOffset {
                offset,
                length: units.len(),
            });
        }
        let end = start + (count as usize).min(units.len() - start);
        Ok(units[start..end].to_vec())
    }

    /// Commit a splice atomically and return the previous value for mutation observers.
    pub fn replace_character_data(
        &mut self,
        handle: f64,
        offset: u32,
        count: u32,
        replacement: &[u16],
    ) -> Result<Vec<u16>> {
        let id = node_id(handle)?;
        let old = self.character_units(id)?;
        let start = offset as usize;
        if start > old.len() {
            return Err(TreeError::CharacterOffset {
                offset,
                length: old.len(),
            });
        }
        let end = start + (count as usize).min(old.len() - start);
        let mut next = Vec::with_capacity(start + replacement.len() + old.len() - end);
        next.extend_from_slice(&old[..start]);
        next.extend_from_slice(replacement);
        next.extend_from_slice(&old[end..]);
        let data = self.data.get_mut(&id).expect("validated CharacterData");
        let previous = std::mem::replace(&mut data.value, DomString::Utf16(next));
        self.data_updates += 1;
        match previous {
            DomString::Utf16(units) => Ok(units),
            DomString::Text(_) | DomString::Undefined => {
                unreachable!("CharacterData was validated before the splice")
            }
        }
    }

    /// Match jsdom's Text wholeText traversal, including CDATA as the queried subject.
    pub fn whole_text(&self, handle: f64) -> Result<WholeText> {
        let root = node_id(handle)?;
        if !matches!(
            self.data.get(&root).map(|data| data.kind),
            Some(TEXT_NODE | CDATA_SECTION_NODE)
        ) {
            return Err(TreeError::NotCharacterData(root));
        }
        let mut first = root;
        while self.nodes[&first].previous != 0 {
            let previous = self.nodes[&first].previous;
            if self
                .data
                .get(&previous)
                .ok_or(TreeError::MissingData(previous))?
                .kind
                != TEXT_NODE
            {
                break;
            }
            first = previous;
        }
        let mut output = Vec::new();
        let mut current = first;
        loop {
            if matches!(self.character_value(current)?, DomString::Undefined) {
                return self.whole_text_with_undefined(root);
            }
            output.extend_from_slice(self.character_units(current)?);
            let next = self.nodes[&current].next;
            if next == 0
                || (next != root
                    && self
                        .data
                        .get(&next)
                        .ok_or(TreeError::MissingData(next))?
                        .kind
                        != TEXT_NODE)
            {
                break;
            }
            current = next;
        }
        Ok(WholeText::Units(output))
    }

    /// Reproduce JS addition in subject/previous/next order, copying string pieces only once.
    /// Two undefined operands produce NaN; a later string converts that accumulated number.
    fn whole_text_with_undefined(&self, root: NodeId) -> Result<WholeText> {
        enum Part<'a> {
            Value(&'a DomString),
            Scalar(&'static str),
        }
        let mut parts = VecDeque::new();
        let mut nan = false;
        let value = self.character_value(root)?;
        if !matches!(value, DomString::Undefined) {
            parts.push_back(Part::Value(value));
        }
        for prepend in [true, false] {
            let mut current = root;
            loop {
                let links = self.links(current)?;
                let next = if prepend { links.previous } else { links.next };
                if next == 0
                    || self
                        .data
                        .get(&next)
                        .ok_or(TreeError::MissingData(next))?
                        .kind
                        != TEXT_NODE
                {
                    break;
                }
                let value = self.character_value(next)?;
                if parts.is_empty() && matches!(value, DomString::Undefined) {
                    nan = true;
                } else {
                    if parts.is_empty() {
                        parts.push_back(Part::Scalar(if nan { "NaN" } else { "undefined" }));
                    }
                    if prepend {
                        parts.push_front(Part::Value(value));
                    } else {
                        parts.push_back(Part::Value(value));
                    }
                }
                current = next;
            }
        }
        if parts.is_empty() {
            return Ok(if nan {
                WholeText::Nan
            } else {
                WholeText::Undefined
            });
        }
        let mut output = Vec::new();
        for part in parts {
            match part {
                Part::Value(value) => output.extend(value.units()),
                Part::Scalar(value) => output.extend(value.encode_utf16()),
            }
        }
        Ok(WholeText::Units(output))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_preserve_undefined_without_treating_it_as_empty_or_accepting_it_as_json() {
        let mut tree = TreeStore::new();
        let handle = tree.allocate().unwrap();
        tree.set_character_value(handle, TEXT_NODE, DomString::Undefined)
            .unwrap();
        assert!(matches!(
            tree.character_data_value(handle).unwrap(),
            DomString::Undefined
        ));
        assert!(!tree.character_data_value(handle).unwrap().is_empty());
        assert!(matches!(
            tree.character_length(handle),
            Err(TreeError::UndefinedCharacterDataProperty("length"))
        ));
        assert!(matches!(
            tree.substring_data(handle, 0, 0),
            Err(TreeError::UndefinedCharacterDataProperty("length"))
        ));
        assert!(matches!(
            tree.replace_character_data(handle, 0, 0, &[65]),
            Err(TreeError::UndefinedCharacterDataProperty("length"))
        ));
        assert_eq!(tree.whole_text(handle).unwrap(), WholeText::Undefined);
        assert!(serde_json::from_str::<DomString>("null").is_err());
        tree.release(handle).unwrap();
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }

    #[test]
    fn should_keep_subject_specific_numeric_addition_before_string_concatenation() {
        let mut tree = TreeStore::new();
        let parent = tree.allocate().unwrap();
        let handles: Vec<_> = (0..3).map(|_| tree.allocate().unwrap()).collect();
        for &handle in &handles {
            tree.set_character_value(handle, TEXT_NODE, DomString::Undefined)
                .unwrap();
            tree.append(parent, handle).unwrap();
        }
        assert_eq!(tree.whole_text(handles[1]).unwrap(), WholeText::Nan);
        tree.set_character_data(handles[0], TEXT_NODE, vec![65])
            .unwrap();
        assert_eq!(
            tree.whole_text(handles[2]).unwrap(),
            WholeText::Units("ANaN".encode_utf16().collect())
        );
        assert_eq!(
            tree.whole_text(handles[0]).unwrap(),
            WholeText::Units("Aundefinedundefined".encode_utf16().collect())
        );
        for handle in handles.into_iter().chain([parent]) {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }

    #[test]
    fn should_preserve_utf16_boundaries_and_reject_invalid_splices_atomically() {
        let mut tree = TreeStore::new();
        let handle = tree.allocate().unwrap();
        tree.set_character_data(handle, TEXT_NODE, vec![65, 0xd83e, 0xdd80, 0, 0xd800])
            .unwrap();
        assert_eq!(tree.character_length(handle).unwrap(), 5);
        assert_eq!(
            tree.substring_data(handle, 2, u32::MAX).unwrap(),
            vec![0xdd80, 0, 0xd800]
        );
        assert!(matches!(
            tree.replace_character_data(handle, 6, 0, &[66]),
            Err(TreeError::CharacterOffset { .. })
        ));
        assert_eq!(tree.character_length(handle).unwrap(), 5);
        let old = tree.replace_character_data(handle, 1, 1, &[90]).unwrap();
        assert_eq!(old, vec![65, 0xd83e, 0xdd80, 0, 0xd800]);
        assert_eq!(
            tree.character_data(handle).unwrap(),
            &[65, 90, 0xdd80, 0, 0xd800]
        );
        tree.release(handle).unwrap();
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }

    #[test]
    fn should_keep_whole_text_order_and_stop_at_non_text_siblings() {
        let mut tree = TreeStore::new();
        let parent = tree.allocate().unwrap();
        let handles: Vec<_> = (0..4).map(|_| tree.allocate().unwrap()).collect();
        for (index, handle) in handles.iter().enumerate() {
            tree.set_character_data(
                *handle,
                if index == 2 {
                    CDATA_SECTION_NODE
                } else {
                    TEXT_NODE
                },
                vec![65 + index as u16],
            )
            .unwrap();
            tree.append(parent, *handle).unwrap();
        }
        assert_eq!(
            tree.whole_text(handles[1]).unwrap(),
            WholeText::Units(vec![65, 66])
        );
        assert_eq!(
            tree.whole_text(handles[2]).unwrap(),
            WholeText::Units(vec![65, 66, 67, 68])
        );
        assert_eq!(
            tree.whole_text(handles[3]).unwrap(),
            WholeText::Units(vec![68])
        );
    }
}
