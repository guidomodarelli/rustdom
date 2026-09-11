//! Canonical CharacterData storage and UTF-16 string operations, independent of JavaScript.
use super::{
    constants::{CDATA_SECTION_NODE, TEXT_NODE, is_character_data},
    data::{DomString, NodeData},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};

impl TreeStore {
    fn character_units(&self, id: NodeId) -> Result<&[u16]> {
        let data = self.data.get(&id).ok_or(TreeError::MissingData(id))?;
        if !is_character_data(data.kind) {
            return Err(TreeError::NotCharacterData(id));
        }
        match &data.value {
            DomString::Utf16(units) => Ok(units),
            DomString::Text(_) => {
                unreachable!("CharacterData is normalized at the storage boundary")
            }
        }
    }

    /// Initialize a detached node directly in its final native representation.
    pub fn set_character_data(&mut self, handle: f64, kind: u16, value: Vec<u16>) -> Result<()> {
        if !is_character_data(kind) {
            return Err(TreeError::NotCharacterData(node_id(handle)?));
        }
        self.replace_data(
            handle,
            NodeData {
                kind,
                value: DomString::Utf16(value),
                ..NodeData::default()
            },
        )
    }

    pub fn character_data(&self, handle: f64) -> Result<&[u16]> {
        self.character_units(node_id(handle)?)
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
            DomString::Text(_) => unreachable!("CharacterData uses canonical UTF-16 storage"),
        }
    }

    /// Match jsdom's Text wholeText traversal, including CDATA as the queried subject.
    pub fn whole_text(&self, handle: f64) -> Result<Vec<u16>> {
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
        Ok(output)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert_eq!(tree.whole_text(handles[1]).unwrap(), vec![65, 66]);
        assert_eq!(tree.whole_text(handles[2]).unwrap(), vec![65, 66, 67, 68]);
        assert_eq!(tree.whole_text(handles[3]).unwrap(), vec![68]);
    }
}
