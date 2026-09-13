//! First-slot selection over ordinary native tree order with lossless slot-name comparison.
use super::{
    constants::{DOCUMENT_FRAGMENT_NODE, ELEMENT_NODE, HTML_NAMESPACE},
    data::{DomString, NodeData},
    error::{Result, TreeError},
    slotable_names::supports_slotable_name,
    store::{TreeStore, node_id},
};

/// Compare ordinary metadata directly and preserve the lossless representation when supplied.
fn equals_text(value: &DomString, expected: &str) -> bool {
    match value {
        DomString::Text(value) => value == expected,
        DomString::Utf16(value) => value.iter().copied().eq(expected.encode_utf16()),
    }
}

fn is_html_slot(data: &NodeData) -> bool {
    data.kind == ELEMENT_NODE
        && data
            .name
            .as_ref()
            .is_some_and(|local_name| equals_text(local_name, "slot"))
        && data
            .namespace
            .as_ref()
            .is_some_and(|namespace| equals_text(namespace, HTML_NAMESPACE))
}

/// Element snapshots are refreshed by the canonical attribute mutation boundary.
fn slot_name(data: &NodeData) -> Option<&DomString> {
    data.attributes
        .iter()
        .find(|attribute| attribute.namespace.is_none() && equals_text(&attribute.name, "name"))
        .map(|attribute| &attribute.value)
}

fn same_name(left: Option<&DomString>, right: Option<&DomString>) -> bool {
    match (left, right) {
        (Some(DomString::Text(left)), Some(DomString::Text(right))) => left == right,
        (Some(left), Some(right)) => left.units().eq(right.units()),
        (Some(value), None) | (None, Some(value)) => value.is_empty(),
        (None, None) => true,
    }
}

fn matches_slot(
    data: &NodeData,
    empty_name: bool,
    accepts_name: &impl Fn(&DomString) -> bool,
) -> bool {
    if !is_html_slot(data) {
        return false;
    }
    match slot_name(data) {
        Some(value) => accepts_name(value),
        None => empty_name,
    }
}

impl TreeStore {
    /// Select the current slotables, without changing cached assignments or retaining objects.
    pub fn find_slotables(&self, slot: f64) -> Result<Vec<f64>> {
        let slot_id = node_id(slot)?;
        self.links(slot_id)?;
        let Some(data) = self.data.get(&slot_id).filter(|data| is_html_slot(data)) else {
            return Ok(Vec::new());
        };
        let root = self.node_root(slot)?;
        let Some(host) = self.root_hosts.shadow_host(root as u64) else {
            return Ok(Vec::new());
        };
        let name = slot_name(data);
        if self.find_slot_matching_name(root, name.is_none_or(DomString::is_empty), |value| {
            same_name(Some(value), name)
        })? != slot
        {
            return Ok(Vec::new());
        }
        // Only this host's immediate children can select a slot in its shadow root.
        let mut result = Vec::new();
        let mut child = self.links(host)?.first;
        while child != 0 {
            let links = self.links(child)?;
            if links.node_kind.is_some_and(supports_slotable_name)
                && same_name(self.slotable_names.get(child), name)
            {
                result.push(child as f64);
            }
            child = links.next;
        }
        Ok(result)
    }

    /// Find the first matching HTML slot inside one fragment without traversing template/host edges.
    pub fn find_slot(&self, root: f64, name: &[u16]) -> Result<f64> {
        self.find_slot_matching_name(root, name.is_empty(), |value| {
            value.units().eq(name.iter().copied())
        })
    }

    /// Read the native slotable name directly, without copying it across the JavaScript boundary.
    pub fn find_slot_for(&self, root: f64, slotable: f64) -> Result<f64> {
        let name = self.slotable_name(slotable)?;
        self.find_slot_matching_name(root, name.is_none_or(DomString::is_empty), |value| {
            name.map_or_else(|| value.is_empty(), |name| value.units().eq(name.units()))
        })
    }

    fn find_slot_matching_name(
        &self,
        root: f64,
        empty_name: bool,
        accepts_name: impl Fn(&DomString) -> bool,
    ) -> Result<f64> {
        let root = node_id(root)?;
        if self.links(root)?.node_kind != Some(DOCUMENT_FRAGMENT_NODE) {
            return Err(TreeError::NotDocumentFragment(root));
        }
        let stop = self.after_subtree(root)?;
        let mut current = root;
        while current != stop {
            if self
                .data
                .get(&current)
                .is_some_and(|data| matches_slot(data, empty_name, &accepts_name))
            {
                return Ok(current as f64);
            }
            current = self.following_node(current)?;
        }
        Ok(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::super::data::{AttributeData, DomString};
    use super::*;

    fn fragment(tree: &mut TreeStore) -> f64 {
        let handle = tree.allocate().unwrap();
        tree.set_data(handle, r#"{"kind":11}"#).unwrap();
        handle
    }

    fn element(
        tree: &mut TreeStore,
        namespace: &str,
        local_name: &str,
        name: Option<&[u16]>,
    ) -> f64 {
        let handle = tree.allocate().unwrap();
        tree.replace_data(
            handle,
            NodeData {
                kind: ELEMENT_NODE,
                name: Some(DomString::Text(local_name.into())),
                namespace: Some(DomString::Text(namespace.into())),
                attributes: name
                    .into_iter()
                    .map(|name| AttributeData {
                        name: DomString::Text("name".into()),
                        namespace: None,
                        prefix: None,
                        value: DomString::from_units(name),
                    })
                    .collect(),
                ..NodeData::default()
            },
        )
        .unwrap();
        handle
    }

    #[test]
    fn should_find_the_first_slot_in_current_ordinary_tree_order() {
        let mut tree = TreeStore::new();
        let root = fragment(&mut tree);
        let container = element(&mut tree, HTML_NAMESPACE, "div", None);
        let first = element(&mut tree, HTML_NAMESPACE, "slot", Some(&[65]));
        let second = element(&mut tree, HTML_NAMESPACE, "slot", Some(&[65]));
        tree.append(root, container).unwrap();
        tree.append(container, first).unwrap();
        tree.append(root, second).unwrap();
        assert_eq!(tree.find_slot(root, &[65]).unwrap(), first);
        tree.remove(second).unwrap();
        tree.prepend(root, second).unwrap();
        assert_eq!(tree.find_slot(root, &[65]).unwrap(), second);
        tree.remove(second).unwrap();
        assert_eq!(tree.find_slot(root, &[65]).unwrap(), first);
        assert_eq!(tree.find_slot(root, &[97]).unwrap(), 0.0);
    }

    #[test]
    fn should_select_immediate_host_children_for_only_the_first_named_slot() {
        let mut tree = TreeStore::new();
        let host = element(&mut tree, HTML_NAMESPACE, "div", None);
        let root = fragment(&mut tree);
        tree.set_root_host(root, host, true).unwrap();
        let first_slot = element(&mut tree, HTML_NAMESPACE, "slot", Some(&[65]));
        let duplicate = element(&mut tree, HTML_NAMESPACE, "slot", Some(&[65]));
        tree.append(root, first_slot).unwrap();
        tree.append(root, duplicate).unwrap();
        let first = element(&mut tree, HTML_NAMESPACE, "b", None);
        let second = element(&mut tree, HTML_NAMESPACE, "i", None);
        let descendant = element(&mut tree, HTML_NAMESPACE, "span", None);
        tree.append(host, first).unwrap();
        tree.append(host, second).unwrap();
        tree.append(first, descendant).unwrap();
        for node in [first, second, descendant] {
            tree.set_slotable_name(node, &[65]).unwrap();
        }
        let original = tree.find_slotables(first_slot).unwrap();
        assert_eq!(original, vec![first, second]);
        assert!(tree.find_slotables(duplicate).unwrap().is_empty());
        tree.set_slotable_name(first, &[66]).unwrap();
        assert_eq!(tree.find_slotables(first_slot).unwrap(), vec![second]);
        assert_eq!(original, vec![first, second]);
        tree.remove(duplicate).unwrap();
        tree.prepend(root, duplicate).unwrap();
        assert!(tree.find_slotables(first_slot).unwrap().is_empty());
        assert_eq!(tree.find_slotables(duplicate).unwrap(), vec![second]);
    }

    #[test]
    fn should_preserve_cdata_name_inheritance_and_ignore_comments_in_default_assignment() {
        let mut tree = TreeStore::new();
        let host = element(&mut tree, HTML_NAMESPACE, "div", None);
        let root = fragment(&mut tree);
        tree.set_root_host(root, host, true).unwrap();
        let slot = element(&mut tree, HTML_NAMESPACE, "slot", None);
        tree.append(root, slot).unwrap();
        let mut expected = Vec::new();
        for kind in [3, 8, 4] {
            let child = tree.allocate().unwrap();
            tree.replace_data(
                child,
                NodeData {
                    kind,
                    ..NodeData::default()
                },
            )
            .unwrap();
            tree.append(host, child).unwrap();
            if kind != 8 {
                expected.push(child);
            }
        }
        assert_eq!(tree.find_slotables(slot).unwrap(), expected);
        tree.set_root_host(root, host, false).unwrap();
        assert!(tree.find_slotables(slot).unwrap().is_empty());
        tree.set_root_host(root, host, true).unwrap();
        tree.release(host).unwrap();
        assert!(tree.find_slotables(slot).unwrap().is_empty());
    }

    #[test]
    fn should_preserve_query_resources_and_release_nodes_while_result_ids_remain_alive() {
        let mut tree = TreeStore::new();
        let host = element(&mut tree, HTML_NAMESPACE, "div", None);
        let root = fragment(&mut tree);
        tree.set_root_host(root, host, true).unwrap();
        let slot = element(&mut tree, HTML_NAMESPACE, "slot", Some(&[55296]));
        tree.append(root, slot).unwrap();
        let child = element(&mut tree, HTML_NAMESPACE, "b", None);
        tree.append(host, child).unwrap();
        tree.set_slotable_name(child, &[55296]).unwrap();
        let reserved = tree.reserve_handles().unwrap();
        let before = tree.statistics();
        for invalid in [-1.0, 0.0, 0.5, f64::NAN, reserved] {
            assert!(tree.find_slotables(invalid).is_err());
        }
        assert!(tree.find_slotables(host).unwrap().is_empty());
        let result = tree.find_slotables(slot).unwrap();
        assert_eq!(result, vec![child]);
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().mutations, before.mutations);
        assert_eq!(tree.statistics().data_updates, before.data_updates);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        for node in [child, slot, host, root, reserved] {
            tree.release(node).unwrap();
        }
        assert_eq!(result, vec![child]);
        assert_eq!(tree.statistics().live_nodes, 0.0);
        assert_eq!(tree.slotable_names.statistics(), (0, 0));
        assert_eq!(tree.root_host_statistics().hosted_roots, 0);
    }

    #[test]
    fn should_preserve_utf16_names_namespaces_and_canonical_attribute_updates() {
        let mut tree = TreeStore::new();
        let root = fragment(&mut tree);
        let wrong_namespace = element(&mut tree, "urn:other", "slot", None);
        let wrong_case = element(&mut tree, HTML_NAMESPACE, "SLOT", None);
        let slot = element(&mut tree, HTML_NAMESPACE, "slot", None);
        for child in [wrong_namespace, wrong_case, slot] {
            tree.append(root, child).unwrap();
        }
        assert_eq!(tree.find_slot(root, &[]).unwrap(), slot);
        tree.replace_data(
            slot,
            NodeData {
                kind: ELEMENT_NODE,
                name: Some(DomString::Utf16("slot".encode_utf16().collect())),
                namespace: Some(DomString::Utf16(HTML_NAMESPACE.encode_utf16().collect())),
                ..NodeData::default()
            },
        )
        .unwrap();
        assert_eq!(tree.find_slot(root, &[]).unwrap(), slot);
        tree.initialize_attribute_collection(slot).unwrap();
        let attribute = tree.allocate().unwrap();
        tree.initialize_attribute(
            attribute,
            r#"{"kind":2,"name":"name","value":[55296,0,56320]}"#,
        )
        .unwrap();
        tree.append_attribute(slot, attribute).unwrap();
        assert_eq!(tree.find_slot(root, &[55296, 0, 56320]).unwrap(), slot);
        assert_eq!(tree.find_slot(root, &[]).unwrap(), 0.0);
        tree.set_attribute_value(attribute, &[56320]).unwrap();
        assert_eq!(tree.find_slot(root, &[55296, 0, 56320]).unwrap(), 0.0);
        assert_eq!(tree.find_slot(root, &[56320]).unwrap(), slot);
        tree.remove_attribute(slot, attribute).unwrap();
        assert_eq!(tree.find_slot(root, &[]).unwrap(), slot);
    }

    #[test]
    fn should_keep_template_contents_and_nodes_outside_the_root_out_of_the_search() {
        let mut tree = TreeStore::new();
        let root = fragment(&mut tree);
        let outside = fragment(&mut tree);
        let content = fragment(&mut tree);
        let template = element(&mut tree, HTML_NAMESPACE, "template", None);
        let hidden = element(&mut tree, HTML_NAMESPACE, "slot", None);
        let following = element(&mut tree, HTML_NAMESPACE, "slot", None);
        tree.append(outside, root).unwrap();
        tree.append(outside, following).unwrap();
        tree.append(root, template).unwrap();
        tree.append(content, hidden).unwrap();
        tree.set_root_host(content, template, false).unwrap();
        assert_eq!(tree.find_slot(root, &[]).unwrap(), 0.0);
        assert_eq!(tree.find_slot(content, &[]).unwrap(), hidden);
    }

    #[test]
    fn should_reject_invalid_roots_without_mutating_or_retaining_resources() {
        let mut tree = TreeStore::new();
        let root = fragment(&mut tree);
        let slot = element(&mut tree, HTML_NAMESPACE, "slot", None);
        tree.append(root, slot).unwrap();
        let reserved = tree.reserve_handles().unwrap();
        let before = tree.statistics();
        for invalid in [-1.0, 0.0, 0.5, f64::NAN, reserved, slot] {
            assert!(tree.find_slot(invalid, &[]).is_err());
        }
        let found = tree.find_slot(root, &[]).unwrap();
        assert_eq!(found, slot);
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().mutations, before.mutations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        tree.release(slot).unwrap();
        tree.release(root).unwrap();
        tree.release(reserved).unwrap();
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }
}
