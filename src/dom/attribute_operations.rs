//! DOM attribute lookup and mutation orchestration over canonical native records.
use super::{
    attribute_index::AttributeDelta,
    attributes::AttributeField,
    constants::{ELEMENT_NODE, HTML_NAMESPACE},
    data::{AttributeData, DomString, NodeData},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
    unicode_case::UnicodeCaseMapping,
};

impl TreeStore {
    /// Use the host's case data rather than silently inheriting a newer Rust Unicode table.
    pub fn set_unicode_version(&mut self, version: &str) -> Result<()> {
        self.unicode_case = UnicodeCaseMapping::for_version(version)?;
        Ok(())
    }
    fn element(&self, id: NodeId) -> Result<&NodeData> {
        self.data
            .get(&id)
            .filter(|data| data.kind == ELEMENT_NODE)
            .ok_or(TreeError::NotElement(id))
    }
    pub fn initialize_attribute_collection(&mut self, handle: f64) -> Result<()> {
        let id = node_id(handle)?;
        self.activate(id)?;
        self.attribute_collections.initialize(id);
        Ok(())
    }
    fn attribute_key(&self, id: NodeId) -> Result<Vec<u16>> {
        Ok(self
            .attribute_field(id as f64, AttributeField::QualifiedName)?
            .expect("validated Attr name"))
    }
    pub(crate) fn snapshot_attributes(&self, element: NodeId) -> Result<Vec<AttributeData>> {
        let mut values = Vec::new();
        if let Some(index) = self.attribute_collections.elements.get(&element) {
            values.reserve(index.ordered.len());
            for &id in &index.ordered {
                let data = self.attribute(id)?;
                values.push(AttributeData {
                    name: data.name.as_ref().expect("Attr name").clone(),
                    namespace: data.namespace.clone(),
                    prefix: data.prefix.clone(),
                    value: data.value.clone(),
                });
            }
        }
        Ok(values)
    }
    pub(crate) fn refresh_attribute_cache(&mut self, element: NodeId) -> Result<()> {
        let attributes = self.snapshot_attributes(element)?;
        if let Some(data) = self.data.get_mut(&element) {
            self.non_utf8_nodes -= usize::from(data.has_non_utf8());
            data.attributes = attributes;
            self.non_utf8_nodes += usize::from(data.has_non_utf8());
            self.data_updates += 1;
        }
        Ok(())
    }
    /// Update element metadata without replacing its canonical Attr collection.
    pub fn set_element_metadata(&mut self, handle: f64, data: NodeData) -> Result<()> {
        let id = node_id(handle)?;
        if data.kind != ELEMENT_NODE {
            return Err(TreeError::NotElement(id));
        }
        self.replace_data(handle, data)
    }
    pub fn attribute_ids(&self, handle: f64) -> Result<Vec<f64>> {
        let id = node_id(handle)?;
        self.links(id)?;
        Ok(self
            .attribute_collections
            .elements
            .get(&id)
            .map(|index| index.ordered.iter().map(|&id| id as f64).collect())
            .unwrap_or_default())
    }
    pub fn attribute_count(&self, handle: f64) -> Result<usize> {
        let id = node_id(handle)?;
        self.links(id)?;
        Ok(self
            .attribute_collections
            .elements
            .get(&id)
            .map_or(0, |index| index.ordered.len()))
    }
    pub fn attribute_at(&self, handle: f64, position: u32) -> Result<f64> {
        let id = node_id(handle)?;
        self.links(id)?;
        Ok(self
            .attribute_collections
            .elements
            .get(&id)
            .and_then(|index| index.ordered.get(position as usize))
            .copied()
            .unwrap_or(0) as f64)
    }
    pub fn attribute_owner(&self, handle: f64) -> Result<f64> {
        let id = node_id(handle)?;
        self.attribute(id)?;
        Ok(self
            .attribute_collections
            .owners
            .get(&id)
            .copied()
            .unwrap_or(0) as f64)
    }
    /// Constructor compatibility for an owner supplied before collection insertion.
    pub fn initialize_attribute_owner(
        &mut self,
        attribute: f64,
        element: Option<f64>,
    ) -> Result<()> {
        let id = node_id(attribute)?;
        self.attribute(id)?;
        if self.attribute_collections.has_references(id) {
            return Err(TreeError::AttributeInUse(id));
        }
        if let Some(element) = element {
            let element = node_id(element)?;
            self.element(element)?;
            self.attribute_collections.set_initial_owner(id, element);
        }
        Ok(())
    }
    pub fn contains_attribute(&self, element: f64, attribute: f64) -> Result<bool> {
        let element = node_id(element)?;
        let attribute = node_id(attribute)?;
        self.links(element)?;
        Ok(self
            .attribute_collections
            .elements
            .get(&element)
            .is_some_and(|index| index.ordered.contains(&attribute)))
    }
    pub fn attribute_by_name(
        &self,
        element: f64,
        name: &[u16],
        html_document: bool,
    ) -> Result<f64> {
        let element = node_id(element)?;
        let data = self.element(element)?;
        let folded;
        let name = if html_document
            && data.namespace.as_ref().and_then(DomString::as_str) == Some(HTML_NAMESPACE)
        {
            folded = name
                .iter()
                .map(|&unit| {
                    if (65..=90).contains(&unit) {
                        unit + 32
                    } else {
                        unit
                    }
                })
                .collect::<Vec<_>>();
            &folded
        } else {
            name
        };
        Ok(self
            .attribute_collections
            .elements
            .get(&element)
            .and_then(|index| index.names.get(name))
            .and_then(|entry| entry.first())
            .copied()
            .unwrap_or(0) as f64)
    }
    pub fn attribute_by_namespace(
        &self,
        element: f64,
        namespace: Option<&[u16]>,
        name: &[u16],
    ) -> Result<f64> {
        let element = node_id(element)?;
        self.element(element)?;
        let Some(index) = self.attribute_collections.elements.get(&element) else {
            return Ok(0.0);
        };
        for &id in &index.ordered {
            let data = self.attribute(id)?;
            let namespace_matches = match (&data.namespace, namespace) {
                (None, None) => true,
                (Some(actual), Some(expected)) => actual.units().eq(expected.iter().copied()),
                _ => false,
            };
            if namespace_matches
                && data
                    .name
                    .as_ref()
                    .expect("Attr name")
                    .units()
                    .eq(name.iter().copied())
            {
                return Ok(id as f64);
            }
        }
        Ok(0.0)
    }
    pub fn attribute_names(
        &self,
        element: f64,
        supported: bool,
        html_document: bool,
    ) -> Result<Vec<Vec<u16>>> {
        let id = node_id(element)?;
        let data = self.element(id)?;
        let filter_uppercase = supported
            && html_document
            && data.namespace.as_ref().and_then(DomString::as_str) == Some(HTML_NAMESPACE);
        let mut names = Vec::new();
        for attribute in self.attribute_ids(element)? {
            let name = self.attribute_key(attribute as NodeId)?;
            if supported && names.contains(&name) {
                continue;
            }
            if filter_uppercase
                && std::char::decode_utf16(name.iter().copied()).any(|character| {
                    character
                        .is_ok_and(|character| self.unicode_case.changes_when_lowercased(character))
                })
            {
                continue;
            }
            names.push(name);
        }
        Ok(names)
    }
    fn validate_attribute_insertion(&self, element: NodeId, attribute: NodeId) -> Result<()> {
        self.element(element)?;
        self.attribute(attribute)?;
        if self
            .attribute_collections
            .owners
            .get(&attribute)
            .is_some_and(|&owner| owner != element)
        {
            return Err(TreeError::AttributeInUse(attribute));
        }
        Ok(())
    }
    pub fn append_attribute(&mut self, element: f64, attribute: f64) -> Result<AttributeDelta> {
        let element_id = node_id(element)?;
        let attribute_id = node_id(attribute)?;
        self.validate_attribute_insertion(element_id, attribute_id)?;
        if self.contains_attribute(element, attribute)? {
            return Err(TreeError::AttributeInUse(attribute_id));
        }
        let name = self.attribute_key(attribute_id)?;
        self.attribute_collections.initialize(element_id);
        let delta = self
            .attribute_collections
            .append(element_id, attribute_id, name);
        self.refresh_attribute_cache(element_id)?;
        Ok(delta)
    }
    /// Select append/replace/no-op in native code, including the in-use guard.
    pub fn set_attribute(&mut self, element: f64, attribute: f64) -> Result<AttributeDelta> {
        let element_id = node_id(element)?;
        let attribute_id = node_id(attribute)?;
        self.validate_attribute_insertion(element_id, attribute_id)?;
        let data = self.attribute(attribute_id)?;
        let namespace = data
            .namespace
            .as_ref()
            .map(|value| value.units().collect::<Vec<_>>());
        let name = data
            .name
            .as_ref()
            .expect("Attr name")
            .units()
            .collect::<Vec<_>>();
        let previous = self.attribute_by_namespace(element, namespace.as_deref(), &name)?;
        if previous == attribute {
            return Ok(AttributeDelta {
                previous: attribute_id,
                ..AttributeDelta::default()
            });
        }
        if previous == 0.0 {
            self.append_attribute(element, attribute)
        } else {
            self.replace_attribute(element, previous, attribute)
        }
    }
    pub fn remove_attribute(&mut self, element: f64, attribute: f64) -> Result<AttributeDelta> {
        let element = node_id(element)?;
        let attribute = node_id(attribute)?;
        self.element(element)?;
        let name = self.attribute_key(attribute)?;
        self.attribute_collections.initialize(element);
        let delta = self.attribute_collections.remove(element, attribute, &name);
        if delta.changed {
            self.refresh_attribute_cache(element)?;
        }
        Ok(delta)
    }
    pub fn replace_attribute(
        &mut self,
        element: f64,
        old: f64,
        new: f64,
    ) -> Result<AttributeDelta> {
        let element = node_id(element)?;
        let old = node_id(old)?;
        let new = node_id(new)?;
        self.validate_attribute_insertion(element, new)?;
        self.attribute(old)?;
        if old != new
            && self
                .attribute_collections
                .elements
                .get(&element)
                .is_some_and(|index| index.ordered.contains(&new))
        {
            return Err(TreeError::AttributeInUse(new));
        }
        let name = self.attribute_key(new)?;
        self.attribute_collections.initialize(element);
        let delta = self.attribute_collections.replace(element, old, new, name);
        if delta.changed {
            self.refresh_attribute_cache(element)?;
        }
        Ok(delta)
    }
    pub(crate) fn release_attribute_references(&mut self, id: NodeId) -> Result<()> {
        let name = if self
            .data
            .get(&id)
            .is_some_and(|data| data.kind == super::constants::ATTRIBUTE_NODE)
        {
            Some(self.attribute_key(id)?)
        } else {
            None
        };
        let affected = self.attribute_collections.release_node(id, name.as_deref());
        for element in affected {
            self.refresh_attribute_cache(element)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_use_host_unicode_tables_for_supported_attribute_names() {
        let mut tree = TreeStore::new();
        let element = tree.allocate().unwrap();
        tree.initialize_attribute_collection(element).unwrap();
        tree.set_data(
            element,
            r#"{"kind":1,"name":"div","namespace":"http://www.w3.org/1999/xhtml"}"#,
        )
        .unwrap();
        // A7CB acquired lowercase in Unicode 16; A7CE acquired it in Unicode 17.
        // Sharp s and ligatures have explicit identity lowercase table entries.
        let names = ["lower", "UPPER", "ß", "ﬀ", "İ", "\u{a7cb}", "\u{a7ce}"];
        for name in names {
            let attribute = tree.allocate().unwrap();
            tree.initialize_attribute(
                attribute,
                &serde_json::json!({ "kind": 2, "name": name, "value": "case" }).to_string(),
            )
            .unwrap();
            tree.append_attribute(element, attribute).unwrap();
        }
        let all_names: Vec<Vec<u16>> = names
            .iter()
            .map(|name| name.encode_utf16().collect())
            .collect();
        for (version, expected) in [
            ("15.1", vec!["lower", "ß", "ﬀ", "\u{a7cb}", "\u{a7ce}"]),
            ("16.0", vec!["lower", "ß", "ﬀ", "\u{a7ce}"]),
            ("17.0", vec!["lower", "ß", "ﬀ"]),
        ] {
            tree.set_unicode_version(version).unwrap();
            let expected: Vec<Vec<u16>> = expected
                .iter()
                .map(|name| name.encode_utf16().collect())
                .collect();
            assert_eq!(
                tree.attribute_names(element, true, true).unwrap(),
                expected,
                "Unicode {version}"
            );
            assert_eq!(
                tree.attribute_names(element, false, true).unwrap(),
                all_names
            );
            assert_eq!(
                tree.attribute_names(element, true, false).unwrap(),
                all_names
            );
            // A rejected host version must leave the previous behavior intact.
            assert!(tree.set_unicode_version("unsupported").is_err());
            assert_eq!(tree.attribute_names(element, true, true).unwrap(), expected);
        }
    }
}
