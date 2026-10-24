//! Range stringification over native data, retaining the pinned exclusive-Text behavior.
use super::{
    constants::TEXT_NODE,
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};

impl TreeStore {
    fn is_text(&self, node: NodeId) -> Result<bool> {
        Ok(self
            .data
            .get(&node)
            .ok_or(TreeError::MissingData(node))?
            .kind
            == TEXT_NODE)
    }

    /// None represents the same internal inconsistent-root failure as the prior helper.
    pub fn range_text(
        &mut self,
        start: f64,
        start_offset: u32,
        end: f64,
        end_offset: u32,
    ) -> Result<Option<Vec<u16>>> {
        let start_id = node_id(start)?;
        let end_id = node_id(end)?;
        let start_text = self.is_text(start_id)?;
        let end_text = self.is_text(end_id)?;
        if start_id == end_id && start_text {
            let value = self.character_data(start)?;
            let from = (start_offset as usize).min(value.len());
            let to = (end_offset as usize).min(value.len());
            return Ok(Some(if from < to {
                value[from..to].to_vec()
            } else {
                Vec::new()
            }));
        }
        let mut output = Vec::new();
        if start_text {
            let value = self.character_data(start)?;
            output.extend_from_slice(&value[(start_offset as usize).min(value.len())..]);
        }
        let stop = self.after_subtree(end_id)?;
        let mut current = start_id;
        while current != 0 && current != stop {
            if self.is_text(current)? {
                let after_start = self.compare_boundary_points_position(
                    current as f64,
                    0,
                    start,
                    u64::from(start_offset),
                )?;
                match after_start {
                    None => return Ok(None),
                    Some(1) => {
                        let length = self.character_data(current as f64)?.len() as u64;
                        match self.compare_boundary_points_position(
                            current as f64,
                            length,
                            end,
                            u64::from(end_offset),
                        )? {
                            None => return Ok(None),
                            Some(-1) => {
                                output.extend_from_slice(self.character_data(current as f64)?)
                            }
                            Some(_) => {}
                        }
                    }
                    Some(_) => {}
                }
            }
            current = self.following_node(current)?;
        }
        if end_text {
            let value = self.character_data(end)?;
            output.extend_from_slice(&value[..(end_offset as usize).min(value.len())]);
        }
        Ok(Some(output))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn node(tree: &mut TreeStore, metadata: &str) -> f64 {
        let handle = tree.allocate().unwrap();
        tree.set_data(handle, metadata).unwrap();
        handle
    }
    #[test]
    fn should_clip_same_text_slices_without_losing_surrogates() {
        let mut tree = TreeStore::new();
        let text = node(&mut tree, r#"{"kind":3,"value":[65,55358,56704,0,55296]}"#);
        assert_eq!(
            tree.range_text(text, 1, text, 2).unwrap(),
            Some(vec![55358])
        );
        assert_eq!(
            tree.range_text(text, 3, text, u32::MAX).unwrap(),
            Some(vec![0, 55296])
        );
        assert_eq!(tree.range_text(text, 4, text, 2).unwrap(), Some(vec![]));
        tree.release(text).unwrap();
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }
    #[test]
    fn should_collect_partial_boundaries_and_contained_text_while_excluding_cdata() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"root"}"#);
        let first = node(&mut tree, r#"{"kind":3,"value":"first"}"#);
        let cdata = node(&mut tree, r#"{"kind":4,"value":"ignored"}"#);
        let middle = node(&mut tree, r#"{"kind":3,"value":"middle"}"#);
        let last = node(&mut tree, r#"{"kind":3,"value":"last"}"#);
        for child in [first, cdata, middle, last] {
            tree.append(root, child).unwrap();
        }
        assert_eq!(
            tree.range_text(first, 2, last, 2).unwrap(),
            Some("rstmiddlela".encode_utf16().collect())
        );
        assert_eq!(
            tree.range_text(root, 0, root, 4).unwrap(),
            Some("firstmiddlelast".encode_utf16().collect())
        );
        assert_eq!(
            tree.range_text(root, 1, root, 3).unwrap(),
            Some("middle".encode_utf16().collect())
        );
        assert_eq!(tree.range_text(cdata, 0, cdata, 0).unwrap(), Some(vec![]));
        for handle in [first, cdata, middle, last, root] {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }
    #[test]
    fn should_reject_missing_metadata_without_activating_reserved_nodes() {
        let mut tree = TreeStore::new();
        let text = node(&mut tree, r#"{"kind":3,"value":"text"}"#);
        let reserved = tree.reserve_handles().unwrap();
        let before = tree.statistics();
        assert!(tree.range_text(reserved, 0, text, 1).is_err());
        assert!(tree.range_text(text, 0, reserved, 1).is_err());
        let after = tree.statistics();
        assert_eq!(before.allocations, after.allocations);
        assert_eq!(before.reserved_handles, after.reserved_handles);
        assert_eq!(before.data_updates, after.data_updates);
    }
}
