//! Shared read-only insertion/replacement constraints after the host's parent and cycle gates.
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
pub(crate) enum ConstraintStatus {
    Ready,
    ChildNotFound,
    InvalidNodeType,
    InvalidParentForNode,
    InvalidDocumentStructure,
}

impl TreeStore {
    fn constraint_kind(&self, id: NodeId) -> Result<u16> {
        Ok(self.data.get(&id).ok_or(TreeError::MissingData(id))?.kind)
    }

    fn constraint_handles(
        &self,
        parent: f64,
        node: f64,
        child: Option<f64>,
    ) -> Result<(NodeId, NodeId, NodeId)> {
        let parent = node_id(parent)?;
        let node = node_id(node)?;
        let child = child.map(node_id).transpose()?.unwrap_or(0);
        self.links(parent)?;
        self.links(node)?;
        if child != 0 {
            self.links(child)?;
        }
        Ok((parent, node, child))
    }

    fn basic_constraints(
        &self,
        parent: NodeId,
        node: NodeId,
        child: NodeId,
    ) -> Result<ConstraintStatus> {
        if child != 0 && self.links(child)?.parent != parent {
            return Ok(ConstraintStatus::ChildNotFound);
        }
        let kind = self.constraint_kind(node)?;
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
            return Ok(ConstraintStatus::InvalidNodeType);
        }
        let parent_kind = self.constraint_kind(parent)?;
        // Preserve pinned CDATA behavior: only exclusive Text is rejected here.
        if (kind == TEXT_NODE && parent_kind == DOCUMENT_NODE)
            || (kind == DOCUMENT_TYPE_NODE && parent_kind != DOCUMENT_NODE)
        {
            return Ok(ConstraintStatus::InvalidParentForNode);
        }
        Ok(ConstraintStatus::Ready)
    }

    /// Zero excludes no child; replacement excludes exactly the old child's identity.
    fn has_child_kind(&self, parent: NodeId, kind: u16, excluded: NodeId) -> Result<bool> {
        let mut child = self.links(parent)?.first;
        while child != 0 {
            if child != excluded && self.constraint_kind(child)? == kind {
                return Ok(true);
            }
            child = self.links(child)?.next;
        }
        Ok(false)
    }

    fn fragment_structure(&self, node: NodeId) -> Result<(usize, bool)> {
        let mut element_count = 0;
        let mut has_text = false;
        let mut child = self.links(node)?.first;
        while child != 0 {
            let kind = self.constraint_kind(child)?;
            element_count += usize::from(kind == ELEMENT_NODE);
            has_text |= kind == TEXT_NODE;
            child = self.links(child)?.next;
        }
        Ok((element_count, has_text))
    }

    /// Replacement's fragment rule distinguishes exactly one existing Element from other counts.
    fn element_children(&self, parent: NodeId) -> Result<(usize, NodeId)> {
        let mut count = 0;
        let mut first = 0;
        let mut child = self.links(parent)?.first;
        while child != 0 {
            if self.constraint_kind(child)? == ELEMENT_NODE {
                count += 1;
                if first == 0 {
                    first = child;
                }
            }
            child = self.links(child)?.next;
        }
        Ok((count, first))
    }

    fn next_is_doctype(&self, child: NodeId) -> Result<bool> {
        if child == 0 {
            return Ok(false);
        }
        let next = self.links(child)?.next;
        Ok(next != 0 && self.constraint_kind(next)? == DOCUMENT_TYPE_NODE)
    }

    fn previous_is_element(&self, child: NodeId) -> Result<bool> {
        if child == 0 {
            return Ok(false);
        }
        let previous = self.links(child)?.previous;
        Ok(previous != 0 && self.constraint_kind(previous)? == ELEMENT_NODE)
    }

    fn blocks_inserted_document_element(&self, parent: NodeId, child: NodeId) -> Result<bool> {
        Ok(self.has_child_kind(parent, ELEMENT_NODE, 0)?
            || (child != 0 && self.constraint_kind(child)? == DOCUMENT_TYPE_NODE)
            || self.next_is_doctype(child)?)
    }

    /// Parent type and host-inclusive cycles are checked earlier by the existing DOM driver.
    pub fn pre_insert_constraints(
        &self,
        parent: f64,
        node: f64,
        child: f64,
    ) -> Result<ConstraintStatus> {
        let (parent, node, child) =
            self.constraint_handles(parent, node, if child == 0.0 { None } else { Some(child) })?;
        let status = self.basic_constraints(parent, node, child)?;
        if status != ConstraintStatus::Ready {
            return Ok(status);
        }
        if self.constraint_kind(parent)? != DOCUMENT_NODE {
            return Ok(ConstraintStatus::Ready);
        }
        let invalid = match self.constraint_kind(node)? {
            DOCUMENT_FRAGMENT_NODE => {
                let (element_count, has_text) = self.fragment_structure(node)?;
                element_count > 1
                    || has_text
                    || (element_count == 1
                        && self.blocks_inserted_document_element(parent, child)?)
            }
            ELEMENT_NODE => self.blocks_inserted_document_element(parent, child)?,
            DOCUMENT_TYPE_NODE => {
                self.has_child_kind(parent, DOCUMENT_TYPE_NODE, 0)?
                    || self.previous_is_element(child)?
                    || (child == 0 && self.has_child_kind(parent, ELEMENT_NODE, 0)?)
            }
            _ => false,
        };
        Ok(if invalid {
            ConstraintStatus::InvalidDocumentStructure
        } else {
            ConstraintStatus::Ready
        })
    }

    /// Replacement requires a child handle and preserves its distinct Document constraints.
    pub fn pre_replace_constraints(
        &self,
        parent: f64,
        node: f64,
        child: f64,
    ) -> Result<ConstraintStatus> {
        let (parent, node, child) = self.constraint_handles(parent, node, Some(child))?;
        let status = self.basic_constraints(parent, node, child)?;
        if status != ConstraintStatus::Ready {
            return Ok(status);
        }
        if self.constraint_kind(parent)? != DOCUMENT_NODE {
            return Ok(ConstraintStatus::Ready);
        }
        let invalid = match self.constraint_kind(node)? {
            DOCUMENT_FRAGMENT_NODE => {
                let (element_count, has_text) = self.fragment_structure(node)?;
                if element_count > 1 || has_text {
                    true
                } else {
                    let (existing_count, first_element) = self.element_children(parent)?;
                    element_count == 1
                        && ((existing_count == 1 && first_element != child)
                            || self.next_is_doctype(child)?)
                }
            }
            ELEMENT_NODE => {
                self.has_child_kind(parent, ELEMENT_NODE, child)? || self.next_is_doctype(child)?
            }
            DOCUMENT_TYPE_NODE => {
                self.has_child_kind(parent, DOCUMENT_TYPE_NODE, child)?
                    || self.previous_is_element(child)?
            }
            _ => false,
        };
        Ok(if invalid {
            ConstraintStatus::InvalidDocumentStructure
        } else {
            ConstraintStatus::Ready
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
                ConstraintStatus::ChildNotFound
            );
            let expected = match kind {
                DOCUMENT_NODE | 2 => ConstraintStatus::InvalidNodeType,
                DOCUMENT_TYPE_NODE => ConstraintStatus::InvalidParentForNode,
                _ => ConstraintStatus::Ready,
            };
            assert_eq!(
                tree.pre_insert_constraints(parent, candidate, 0.0).unwrap(),
                expected
            );
        }
    }

    #[test]
    fn should_exclude_only_the_replaced_child_from_document_element_constraints() {
        let mut tree = TreeStore::new();
        let document = node(&mut tree, DOCUMENT_NODE);
        let old = node(&mut tree, ELEMENT_NODE);
        let replacement = node(&mut tree, ELEMENT_NODE);
        let comment = node(&mut tree, COMMENT_NODE);
        tree.append(document, old).unwrap();
        tree.append(document, comment).unwrap();
        assert_eq!(
            tree.pre_insert_constraints(document, replacement, old)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
        assert_eq!(
            tree.pre_replace_constraints(document, replacement, old)
                .unwrap(),
            ConstraintStatus::Ready
        );
        assert_eq!(
            tree.pre_replace_constraints(document, old, old).unwrap(),
            ConstraintStatus::Ready
        );
        assert_eq!(
            tree.pre_replace_constraints(document, old, comment)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
    }

    #[test]
    fn should_preserve_exact_element_count_in_the_pinned_fragment_replacement_rule() {
        let mut tree = TreeStore::new();
        let document = node(&mut tree, DOCUMENT_NODE);
        let old = node(&mut tree, COMMENT_NODE);
        tree.append(document, old).unwrap();
        let fragment = node(&mut tree, DOCUMENT_FRAGMENT_NODE);
        let replacement = node(&mut tree, ELEMENT_NODE);
        tree.append(fragment, replacement).unwrap();
        assert_eq!(
            tree.pre_replace_constraints(document, fragment, old)
                .unwrap(),
            ConstraintStatus::Ready
        );
        let first = node(&mut tree, ELEMENT_NODE);
        tree.append(document, first).unwrap();
        assert_eq!(
            tree.pre_replace_constraints(document, fragment, old)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
        assert_eq!(
            tree.pre_replace_constraints(document, fragment, first)
                .unwrap(),
            ConstraintStatus::Ready
        );
        let second = node(&mut tree, ELEMENT_NODE);
        tree.append(document, second).unwrap();
        assert_eq!(
            tree.pre_replace_constraints(document, fragment, old)
                .unwrap(),
            ConstraintStatus::Ready
        );
        let text = node(&mut tree, TEXT_NODE);
        tree.append(fragment, text).unwrap();
        assert_eq!(
            tree.pre_replace_constraints(document, fragment, old)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
    }

    #[test]
    fn should_preserve_doctype_exclusion_and_immediate_previous_sibling_for_replacement() {
        let mut tree = TreeStore::new();
        let document = node(&mut tree, DOCUMENT_NODE);
        let old = node(&mut tree, DOCUMENT_TYPE_NODE);
        let element = node(&mut tree, ELEMENT_NODE);
        let first = node(&mut tree, COMMENT_NODE);
        let last = node(&mut tree, COMMENT_NODE);
        let replacement = node(&mut tree, DOCUMENT_TYPE_NODE);
        for child in [old, element, first, last] {
            tree.append(document, child).unwrap();
        }
        assert_eq!(
            tree.pre_replace_constraints(document, replacement, old)
                .unwrap(),
            ConstraintStatus::Ready
        );
        assert_eq!(
            tree.pre_replace_constraints(document, replacement, last)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
        tree.remove(old).unwrap();
        assert_eq!(
            tree.pre_replace_constraints(document, replacement, first)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
        assert_eq!(
            tree.pre_replace_constraints(document, replacement, last)
                .unwrap(),
            ConstraintStatus::Ready
        );
    }

    #[test]
    fn should_reject_missing_replacement_children_and_preserve_prefix_error_order_without_mutation()
    {
        let mut tree = TreeStore::new();
        let parent = node(&mut tree, ELEMENT_NODE);
        let invalid_kind = node(&mut tree, DOCUMENT_NODE);
        let child = node(&mut tree, COMMENT_NODE);
        assert_eq!(
            tree.pre_replace_constraints(parent, invalid_kind, child)
                .unwrap(),
            ConstraintStatus::ChildNotFound
        );
        tree.append(parent, child).unwrap();
        assert_eq!(
            tree.pre_replace_constraints(parent, invalid_kind, child)
                .unwrap(),
            ConstraintStatus::InvalidNodeType
        );
        let replacement = node(&mut tree, COMMENT_NODE);
        let reserved = tree.reserve_handles().unwrap();
        let before = tree.statistics();
        for invalid in [0.0, -1.0, f64::NAN, reserved] {
            assert!(
                tree.pre_replace_constraints(invalid, replacement, child)
                    .is_err()
            );
            assert!(
                tree.pre_replace_constraints(parent, invalid, child)
                    .is_err()
            );
            assert!(
                tree.pre_replace_constraints(parent, replacement, invalid)
                    .is_err()
            );
        }
        let after = tree.statistics();
        assert_eq!(after.allocations, before.allocations);
        assert_eq!(after.reserved_handles, before.reserved_handles);
        assert_eq!(after.mutations, before.mutations);
        assert_eq!(after.data_updates, before.data_updates);
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
            ConstraintStatus::Ready
        );
        for reference in [second, doctype] {
            assert_eq!(
                tree.pre_insert_constraints(document, element, reference)
                    .unwrap(),
                ConstraintStatus::InvalidDocumentStructure
            );
        }
        tree.remove(doctype).unwrap();
        tree.append(document, element).unwrap();
        assert_eq!(
            tree.pre_insert_constraints(document, element, element)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
        assert_eq!(
            tree.pre_insert_constraints(document, doctype, 0.0).unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
        assert_eq!(
            tree.pre_insert_constraints(document, doctype, first)
                .unwrap(),
            ConstraintStatus::Ready
        );
        tree.remove(first).unwrap();
        tree.remove(second).unwrap();
        tree.append(document, first).unwrap();
        tree.append(document, second).unwrap();
        assert_eq!(
            tree.pre_insert_constraints(document, doctype, first)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
        assert_eq!(
            tree.pre_insert_constraints(document, doctype, second)
                .unwrap(),
            ConstraintStatus::Ready
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
            ConstraintStatus::Ready
        );
        tree.append(fragment, cdata).unwrap();
        let first = node(&mut tree, ELEMENT_NODE);
        tree.append(fragment, first).unwrap();
        assert_eq!(
            tree.pre_insert_constraints(document, fragment, 0.0)
                .unwrap(),
            ConstraintStatus::Ready
        );
        let second = node(&mut tree, ELEMENT_NODE);
        tree.append(fragment, second).unwrap();
        assert_eq!(
            tree.pre_insert_constraints(document, fragment, 0.0)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
        );
        tree.remove(second).unwrap();
        let text = node(&mut tree, TEXT_NODE);
        tree.append(fragment, text).unwrap();
        let before = tree.statistics();
        assert_eq!(
            tree.pre_insert_constraints(document, fragment, 0.0)
                .unwrap(),
            ConstraintStatus::InvalidDocumentStructure
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
