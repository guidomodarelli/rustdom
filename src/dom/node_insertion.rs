//! Read-only insertion constraints after the host's parent-kind and host-cycle gates.
use super::{
    constants::{
        CDATA_SECTION_NODE, COMMENT_NODE, DOCUMENT_FRAGMENT_NODE, DOCUMENT_NODE,
        DOCUMENT_TYPE_NODE, ELEMENT_NODE, PROCESSING_INSTRUCTION_NODE, TEXT_NODE,
    },
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};

/// The host preserves the exception realm and original operation-specific diagnostic.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum InsertionStatus {
    Ready,
    ChildNotFound,
    InvalidNodeType,
    InvalidParentForNode,
    InvalidDocumentStructure,
}

impl TreeStore {
    fn insertion_kind(&self, id: NodeId) -> Result<u16> {
        Ok(self.data.get(&id).ok_or(TreeError::MissingData(id))?.kind)
    }

    fn has_insertion_child_kind(&self, parent: NodeId, kind: u16) -> Result<bool> {
        let mut child = self.links(parent)?.first;
        while child != 0 {
            if self.insertion_kind(child)? == kind {
                return Ok(true);
            }
            child = self.links(child)?.next;
        }
        Ok(false)
    }

    fn blocks_document_element(&self, parent: NodeId, child: NodeId) -> Result<bool> {
        if self.has_insertion_child_kind(parent, ELEMENT_NODE)? {
            return Ok(true);
        }
        if child == 0 {
            return Ok(false);
        }
        if self.insertion_kind(child)? == DOCUMENT_TYPE_NODE {
            return Ok(true);
        }
        let next = self.links(child)?.next;
        // jsdom 27 checks the immediate sibling, not every following sibling.
        Ok(next != 0 && self.insertion_kind(next)? == DOCUMENT_TYPE_NODE)
    }

    /// Parent type and host-inclusive cycles are checked earlier by the existing DOM driver.
    pub fn pre_insert_constraints(
        &self,
        parent: f64,
        node: f64,
        child: f64,
    ) -> Result<InsertionStatus> {
        let parent = node_id(parent)?;
        let node = node_id(node)?;
        let child = if child == 0.0 { 0 } else { node_id(child)? };
        self.links(parent)?;
        self.links(node)?;
        if child != 0 {
            self.links(child)?;
        }
        if child != 0 && self.links(child)?.parent != parent {
            return Ok(InsertionStatus::ChildNotFound);
        }
        let kind = self.insertion_kind(node)?;
        if !matches!(
            kind,
            DOCUMENT_FRAGMENT_NODE
                | DOCUMENT_TYPE_NODE
                | ELEMENT_NODE
                | TEXT_NODE
                | CDATA_SECTION_NODE
                | PROCESSING_INSTRUCTION_NODE
                | COMMENT_NODE
        ) {
            return Ok(InsertionStatus::InvalidNodeType);
        }
        let parent_kind = self.insertion_kind(parent)?;
        // Preserve pinned CDATA behavior: only exclusive Text is rejected here.
        if (kind == TEXT_NODE && parent_kind == DOCUMENT_NODE)
            || (kind == DOCUMENT_TYPE_NODE && parent_kind != DOCUMENT_NODE)
        {
            return Ok(InsertionStatus::InvalidParentForNode);
        }
        if parent_kind != DOCUMENT_NODE {
            return Ok(InsertionStatus::Ready);
        }
        let invalid = match kind {
            DOCUMENT_FRAGMENT_NODE => {
                let mut element_count = 0;
                let mut has_text = false;
                let mut current = self.links(node)?.first;
                while current != 0 {
                    let child_kind = self.insertion_kind(current)?;
                    element_count += usize::from(child_kind == ELEMENT_NODE);
                    has_text |= child_kind == TEXT_NODE;
                    current = self.links(current)?.next;
                }
                element_count > 1
                    || has_text
                    || (element_count == 1 && self.blocks_document_element(parent, child)?)
            }
            ELEMENT_NODE => self.blocks_document_element(parent, child)?,
            DOCUMENT_TYPE_NODE => {
                let previous = if child == 0 {
                    0
                } else {
                    self.links(child)?.previous
                };
                self.has_insertion_child_kind(parent, DOCUMENT_TYPE_NODE)?
                    || (previous != 0 && self.insertion_kind(previous)? == ELEMENT_NODE)
                    || (child == 0 && self.has_insertion_child_kind(parent, ELEMENT_NODE)?)
            }
            _ => false,
        };
        Ok(if invalid {
            InsertionStatus::InvalidDocumentStructure
        } else {
            InsertionStatus::Ready
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn node(tree: &mut TreeStore, kind: u16) -> f64 {
        let handle = tree.allocate().unwrap();
        tree.set_data(
            handle,
            &format!(r#"{{"kind":{kind},"name":"node","value":"data"}}"#),
        )
        .unwrap();
        handle
    }

    #[test]
    fn should_reject_foreign_references_before_node_type_and_preserve_valid_kinds() {
        let mut tree = TreeStore::new();
        let parent = node(&mut tree, ELEMENT_NODE);
        let foreign = node(&mut tree, COMMENT_NODE);
        for kind in [
            ELEMENT_NODE,
            DOCUMENT_NODE,
            DOCUMENT_FRAGMENT_NODE,
            DOCUMENT_TYPE_NODE,
            TEXT_NODE,
            CDATA_SECTION_NODE,
            PROCESSING_INSTRUCTION_NODE,
            COMMENT_NODE,
            2,
        ] {
            let candidate = node(&mut tree, kind);
            assert_eq!(
                tree.pre_insert_constraints(parent, candidate, foreign)
                    .unwrap(),
                InsertionStatus::ChildNotFound
            );
            let expected = match kind {
                DOCUMENT_NODE | 2 => InsertionStatus::InvalidNodeType,
                DOCUMENT_TYPE_NODE => InsertionStatus::InvalidParentForNode,
                _ => InsertionStatus::Ready,
            };
            assert_eq!(
                tree.pre_insert_constraints(parent, candidate, 0.0).unwrap(),
                expected
            );
        }
    }

    #[test]
    fn should_preserve_document_element_doctype_and_immediate_sibling_rules() {
        let mut tree = TreeStore::new();
        let document = node(&mut tree, DOCUMENT_NODE);
        let first = node(&mut tree, COMMENT_NODE);
        let second = node(&mut tree, COMMENT_NODE);
        let doctype = node(&mut tree, DOCUMENT_TYPE_NODE);
        let element = node(&mut tree, ELEMENT_NODE);
        for child in [first, second, doctype] {
            tree.append(document, child).unwrap();
        }
        assert_eq!(
            tree.pre_insert_constraints(document, element, first)
                .unwrap(),
            InsertionStatus::Ready
        );
        for reference in [second, doctype] {
            assert_eq!(
                tree.pre_insert_constraints(document, element, reference)
                    .unwrap(),
                InsertionStatus::InvalidDocumentStructure
            );
        }
        tree.remove(doctype).unwrap();
        tree.append(document, element).unwrap();
        assert_eq!(
            tree.pre_insert_constraints(document, element, element)
                .unwrap(),
            InsertionStatus::InvalidDocumentStructure
        );
        assert_eq!(
            tree.pre_insert_constraints(document, doctype, 0.0).unwrap(),
            InsertionStatus::InvalidDocumentStructure
        );
        assert_eq!(
            tree.pre_insert_constraints(document, doctype, first)
                .unwrap(),
            InsertionStatus::Ready
        );
        tree.remove(first).unwrap();
        tree.remove(second).unwrap();
        tree.append(document, first).unwrap();
        tree.append(document, second).unwrap();
        assert_eq!(
            tree.pre_insert_constraints(document, doctype, first)
                .unwrap(),
            InsertionStatus::InvalidDocumentStructure
        );
        assert_eq!(
            tree.pre_insert_constraints(document, doctype, second)
                .unwrap(),
            InsertionStatus::Ready
        );
    }

    #[test]
    fn should_distinguish_fragment_elements_exclusive_text_and_cdata_without_mutation() {
        let mut tree = TreeStore::new();
        let document = node(&mut tree, DOCUMENT_NODE);
        let fragment = node(&mut tree, DOCUMENT_FRAGMENT_NODE);
        let cdata = node(&mut tree, CDATA_SECTION_NODE);
        assert_eq!(
            tree.pre_insert_constraints(document, cdata, 0.0).unwrap(),
            InsertionStatus::Ready
        );
        tree.append(fragment, cdata).unwrap();
        let first = node(&mut tree, ELEMENT_NODE);
        tree.append(fragment, first).unwrap();
        assert_eq!(
            tree.pre_insert_constraints(document, fragment, 0.0)
                .unwrap(),
            InsertionStatus::Ready
        );
        let second = node(&mut tree, ELEMENT_NODE);
        tree.append(fragment, second).unwrap();
        assert_eq!(
            tree.pre_insert_constraints(document, fragment, 0.0)
                .unwrap(),
            InsertionStatus::InvalidDocumentStructure
        );
        tree.remove(second).unwrap();
        let text = node(&mut tree, TEXT_NODE);
        tree.append(fragment, text).unwrap();
        let before = tree.statistics();
        assert_eq!(
            tree.pre_insert_constraints(document, fragment, 0.0)
                .unwrap(),
            InsertionStatus::InvalidDocumentStructure
        );
        assert_eq!(tree.statistics().mutations, before.mutations);
        assert_eq!(tree.statistics().data_updates, before.data_updates);
    }

    #[test]
    fn should_reject_unallocated_handles_without_consuming_reservations() {
        let mut tree = TreeStore::new();
        let parent = node(&mut tree, ELEMENT_NODE);
        let child = node(&mut tree, COMMENT_NODE);
        let reserved = tree.reserve_handles().unwrap();
        let before = tree.statistics();
        for invalid in [-1.0, 0.5, f64::NAN, reserved] {
            assert!(tree.pre_insert_constraints(invalid, child, 0.0).is_err());
            assert!(tree.pre_insert_constraints(parent, invalid, 0.0).is_err());
            assert!(tree.pre_insert_constraints(parent, child, invalid).is_err());
        }
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
    }
}
