//! Canonical Attr strings and qualified-name construction in native storage.
use super::{
    constants::{ATTRIBUTE_NODE, ELEMENT_NODE},
    data::{AttributeData, DomString, NodeData},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};

pub enum AttributeField {
    Name,
    Namespace,
    Prefix,
    Value,
    QualifiedName,
}

impl TreeStore {
    pub(crate) fn attribute(&self, id: NodeId) -> Result<&NodeData> {
        self.data
            .get(&id)
            .filter(|data| data.kind == ATTRIBUTE_NODE && data.name.is_some())
            .ok_or(TreeError::NotAttribute(id))
    }

    pub fn initialize_attribute(&mut self, handle: f64, encoded: &str) -> Result<()> {
        let data: NodeData = serde_json::from_str(encoded).map_err(TreeError::InvalidMetadata)?;
        let id = node_id(handle)?;
        if data.kind != ATTRIBUTE_NODE || data.name.is_none() {
            return Err(TreeError::NotAttribute(id));
        }
        self.replace_data(handle, data)
    }

    pub fn attribute_field(&self, handle: f64, field: AttributeField) -> Result<Option<Vec<u16>>> {
        let data = self.attribute(node_id(handle)?)?;
        let value = match field {
            AttributeField::Name => data.name.as_ref(),
            AttributeField::Namespace => data.namespace.as_ref(),
            AttributeField::Prefix => data.prefix.as_ref(),
            AttributeField::Value => Some(&data.value),
            AttributeField::QualifiedName => {
                let mut output = Vec::new();
                if let Some(prefix) = &data.prefix {
                    output.extend(prefix.units());
                    output.push(u16::from(b':'));
                }
                output.extend(data.name.as_ref().expect("validated Attr name").units());
                return Ok(Some(output));
            }
        };
        Ok(value.map(|value| value.units().collect()))
    }

    /// Change only the canonical value; element caches are rebuilt by the mutation hook.
    pub fn set_attribute_value(&mut self, handle: f64, units: &[u16]) -> Result<()> {
        let id = node_id(handle)?;
        self.attribute(id)?;
        let value = DomString::from_units(units);
        let data = self.data.get_mut(&id).expect("validated Attr");
        self.non_utf8_nodes -= usize::from(data.has_non_utf8());
        data.value = value;
        self.non_utf8_nodes += usize::from(data.has_non_utf8());
        self.data_updates += 1;
        if let Some(&owner) = self.attribute_collections.owners.get(&id) {
            self.refresh_attribute_cache(owner)?;
        }
        Ok(())
    }

    /// Build a snapshot from Attr data only when no canonical collection owns the element data.
    pub fn set_element_from_attributes(
        &mut self,
        handle: f64,
        mut data: NodeData,
        attributes: &[f64],
    ) -> Result<()> {
        let id = node_id(handle)?;
        if data.kind != ELEMENT_NODE {
            return Err(TreeError::MissingData(id));
        }
        let mut values = Vec::with_capacity(attributes.len());
        for handle in attributes {
            let attribute = self.attribute(node_id(*handle)?)?;
            values.push(AttributeData {
                name: attribute
                    .name
                    .as_ref()
                    .expect("validated Attr name")
                    .clone(),
                namespace: attribute.namespace.clone(),
                prefix: attribute.prefix.clone(),
                value: attribute.value.clone(),
            });
        }
        data.attributes = values;
        self.replace_snapshot(handle, data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_reject_snapshot_initializers_without_modifying_canonical_collections() {
        for populated in [false, true] {
            for include_attribute in [false, true] {
                let mut tree = TreeStore::new();
                let element = tree.allocate().unwrap();
                let current = tree.allocate().unwrap();
                let incoming = tree.allocate().unwrap();
                tree.initialize_attribute_collection(element).unwrap();
                let metadata = || NodeData {
                    kind: ELEMENT_NODE,
                    name: Some(DomString::Text("section".into())),
                    namespace: Some(DomString::Text(
                        super::super::constants::HTML_NAMESPACE.into(),
                    )),
                    ..NodeData::default()
                };
                tree.set_element_metadata(element, metadata()).unwrap();
                tree.initialize_attribute(current, r#"{"kind":2,"name":"id","value":"retained"}"#)
                    .unwrap();
                tree.initialize_attribute(
                    incoming,
                    r#"{"kind":2,"name":"title","value":"incoming"}"#,
                )
                .unwrap();
                if populated {
                    tree.append_attribute(element, current).unwrap();
                }
                let template = tree.reserve_handles().unwrap();
                let mut replacement = metadata();
                replacement.name = Some(DomString::Text("article".into()));
                replacement.template_content = template;
                let before = tree.statistics();
                let incoming_ids = if include_attribute {
                    vec![incoming]
                } else {
                    vec![]
                };

                let copied = tree.set_element_from_attributes(element, replacement, &incoming_ids);
                assert!(
                    matches!(copied, Err(TreeError::AttributeCollectionInitialized(id)) if id == element as u64)
                );
                let snapshot = if include_attribute {
                    r#"{"kind":1,"name":"article","attributes":[{"name":"title","value":"incoming"}]}"#
                } else {
                    r#"{"kind":1,"name":"article","attributes":[]}"#
                };
                assert!(
                    matches!(tree.set_data(element, snapshot), Err(TreeError::AttributeCollectionInitialized(id)) if id == element as u64)
                );
                let after = tree.statistics();
                assert_eq!(after.live_nodes, before.live_nodes);
                assert_eq!(after.reserved_handles, before.reserved_handles);
                assert_eq!(after.data_updates, before.data_updates);
                assert_eq!(after.attribute_holders, before.attribute_holders);
                assert_eq!(
                    tree.attribute_ids(element).unwrap(),
                    if populated { vec![current] } else { vec![] }
                );
                assert_eq!(
                    tree.attribute_owner(current).unwrap(),
                    if populated { element } else { 0.0 }
                );
                assert_eq!(tree.attribute_owner(incoming).unwrap(), 0.0);
                tree.set_element_metadata(element, metadata()).unwrap();
                let markup =
                    String::from_utf16(&tree.serialize_html(element, true, false).unwrap())
                        .unwrap();
                assert_eq!(
                    markup,
                    if populated {
                        "<section id=\"retained\"></section>"
                    } else {
                        "<section></section>"
                    }
                );
                for handle in [element, current, incoming] {
                    tree.release(handle).unwrap();
                }
                assert_eq!(tree.statistics().live_nodes, 0.0);
                assert_eq!(tree.statistics().attribute_holders, 0.0);
                assert_eq!(tree.statistics().attribute_owners, 0.0);
            }
        }
    }

    #[test]
    fn should_preserve_attr_names_namespaces_and_utf16_values() {
        let mut tree = TreeStore::new();
        let handle = tree.allocate().unwrap();
        tree.initialize_attribute(handle, r#"{"kind":2,"name":"label","prefix":"p","namespace":[117,114,110,58,55296],"value":[55296,0,56320]}"#).unwrap();
        assert_eq!(
            tree.attribute_field(handle, AttributeField::QualifiedName)
                .unwrap(),
            Some("p:label".encode_utf16().collect())
        );
        assert_eq!(
            tree.attribute_field(handle, AttributeField::Value).unwrap(),
            Some(vec![55296, 0, 56320])
        );
        tree.set_attribute_value(handle, &[65, 66]).unwrap();
        assert_eq!(
            tree.attribute_field(handle, AttributeField::Value).unwrap(),
            Some(vec![65, 66])
        );
        tree.release(handle).unwrap();
        assert!(tree.attribute_field(handle, AttributeField::Value).is_err());
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }

    #[test]
    fn should_reject_invalid_attr_snapshots_without_replacing_element_data() {
        let mut tree = TreeStore::new();
        let element = tree.allocate().unwrap();
        let attribute = tree.allocate().unwrap();
        tree.set_data(
            element,
            r#"{"kind":1,"name":"p","namespace":"http://www.w3.org/1999/xhtml"}"#,
        )
        .unwrap();
        tree.initialize_attribute(attribute, r#"{"kind":2,"name":"title","value":"before"}"#)
            .unwrap();
        let metadata = || NodeData {
            kind: ELEMENT_NODE,
            name: Some(DomString::Text("p".into())),
            namespace: Some(DomString::Text("http://www.w3.org/1999/xhtml".into())),
            ..NodeData::default()
        };
        tree.set_element_from_attributes(element, metadata(), &[attribute])
            .unwrap();
        assert!(
            tree.set_element_from_attributes(element, metadata(), &[element])
                .is_err()
        );
        assert_eq!(
            String::from_utf16(&tree.serialize_html(element, true, false).unwrap()).unwrap(),
            "<p title=\"before\"></p>"
        );
    }
}
