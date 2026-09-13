//! First-slot selection over ordinary native tree order with lossless slot-name comparison.
use super::{
    constants::{DOCUMENT_FRAGMENT_NODE, ELEMENT_NODE, HTML_NAMESPACE},
    data::NodeData,
    error::{Result, TreeError},
    store::{TreeStore, node_id},
};

/// Element snapshots are refreshed by the canonical attribute mutation boundary.
fn matches_slot(data: &NodeData, name: &[u16]) -> bool {
    if data.kind != ELEMENT_NODE
        || !data
            .name
            .as_ref()
            .is_some_and(|local_name| local_name.units().eq("slot".encode_utf16()))
        || !data
            .namespace
            .as_ref()
            .is_some_and(|namespace| namespace.units().eq(HTML_NAMESPACE.encode_utf16()))
    {
        return false;
    }
    let value = data.attributes.iter().find(|attribute| {
        attribute.namespace.is_none() && attribute.name.units().eq("name".encode_utf16())
    });
    match value {
        Some(attribute) => attribute.value.units().eq(name.iter().copied()),
        None => name.is_empty(),
    }
}

impl TreeStore {
    /// Find the first matching HTML slot inside one fragment without traversing template/host edges.
    pub fn find_slot(&self, root: f64, name: &[u16]) -> Result<f64> {
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
                .is_some_and(|data| matches_slot(data, name))
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
