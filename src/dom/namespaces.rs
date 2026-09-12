//! Namespace resolution over live native metadata, preserving pinned jsdom precedence.
use super::{
    constants::{
        ATTRIBUTE_NODE, DOCUMENT_FRAGMENT_NODE, DOCUMENT_NODE, DOCUMENT_TYPE_NODE, ELEMENT_NODE,
        XMLNS_NAME, XMLNS_NAMESPACE,
    },
    data::{DomString, NodeData},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};

fn same_units(value: Option<&DomString>, expected: Option<&[u16]>) -> bool {
    match (value, expected) {
        (None, None) => true,
        (Some(value), Some(expected)) => value.units().eq(expected.iter().copied()),
        _ => false,
    }
}

fn same_text(value: Option<&DomString>, expected: &str) -> bool {
    value.is_some_and(|value| match value {
        DomString::Text(value) => value == expected,
        DomString::Utf16(value) => value.iter().copied().eq(expected.encode_utf16()),
    })
}

impl TreeStore {
    fn namespace_data(&self, id: NodeId) -> Result<&NodeData> {
        self.data.get(&id).ok_or(TreeError::MissingData(id))
    }

    fn namespace_parent(&self, id: NodeId) -> Result<NodeId> {
        let parent = self.links(id)?.parent;
        Ok(
            if parent != 0 && self.namespace_data(parent)?.kind == ELEMENT_NODE {
                parent
            } else {
                0
            },
        )
    }

    fn namespace_start(&self, id: NodeId) -> Result<NodeId> {
        Ok(match self.namespace_data(id)?.kind {
            ELEMENT_NODE => id,
            ATTRIBUTE_NODE => self
                .attribute_collections
                .owners
                .get(&id)
                .copied()
                .unwrap_or(0),
            DOCUMENT_TYPE_NODE | DOCUMENT_FRAGMENT_NODE => 0,
            DOCUMENT_NODE => {
                let mut child = self.links(id)?.first;
                while child != 0 && self.namespace_data(child)?.kind != ELEMENT_NODE {
                    child = self.links(child)?.next;
                }
                child
            }
            _ => self.namespace_parent(id)?,
        })
    }

    pub fn lookup_namespace_uri(
        &self,
        handle: f64,
        prefix: Option<&[u16]>,
    ) -> Result<Option<&DomString>> {
        let mut element = self.namespace_start(node_id(handle)?)?;
        let prefix = prefix.filter(|prefix| !prefix.is_empty());
        while element != 0 {
            let data = self.namespace_data(element)?;
            if data.namespace.is_some() && same_units(data.prefix.as_ref(), prefix) {
                return Ok(data.namespace.as_ref());
            }
            for attribute in self.attribute_views(element)? {
                let attribute = attribute?;
                if !same_text(attribute.namespace, XMLNS_NAMESPACE) {
                    continue;
                }
                let matches = match prefix {
                    Some(prefix) => {
                        same_text(attribute.prefix, XMLNS_NAME)
                            && same_units(Some(attribute.name), Some(prefix))
                    }
                    None => {
                        attribute.prefix.is_none() && same_text(Some(attribute.name), XMLNS_NAME)
                    }
                };
                if matches {
                    return Ok((!attribute.value.is_empty()).then_some(attribute.value));
                }
            }
            element = self.namespace_parent(element)?;
        }
        Ok(None)
    }

    pub fn is_default_namespace(&self, handle: f64, namespace: Option<&[u16]>) -> Result<bool> {
        Ok(same_units(
            self.lookup_namespace_uri(handle, None)?,
            namespace.filter(|namespace| !namespace.is_empty()),
        ))
    }

    pub fn lookup_prefix(
        &self,
        handle: f64,
        namespace: Option<&[u16]>,
    ) -> Result<Option<&DomString>> {
        let id = node_id(handle)?;
        self.namespace_data(id)?;
        let Some(namespace) = namespace.filter(|namespace| !namespace.is_empty()) else {
            return Ok(None);
        };
        let mut element = self.namespace_start(id)?;
        while element != 0 {
            let data = self.namespace_data(element)?;
            if data.prefix.is_some() && same_units(data.namespace.as_ref(), Some(namespace)) {
                return Ok(data.prefix.as_ref());
            }
            for attribute in self.attribute_views(element)? {
                let attribute = attribute?;
                // jsdom 27 checks the declaration prefix/value here; URI lookup also checks its namespace.
                if same_text(attribute.prefix, XMLNS_NAME)
                    && same_units(Some(attribute.value), Some(namespace))
                {
                    return Ok(Some(attribute.name));
                }
            }
            element = self.namespace_parent(element)?;
        }
        Ok(None)
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
    fn units(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }
    fn observed(result: Result<Option<&DomString>>) -> Option<Vec<u16>> {
        result.unwrap().map(|value| value.units().collect())
    }

    #[test]
    fn should_follow_live_declarations_and_preserve_element_namespace_precedence() {
        let mut tree = TreeStore::new();
        let parent = node(
            &mut tree,
            r#"{"kind":1,"name":"parent","namespace":"urn:own","prefix":"p"}"#,
        );
        let child = node(&mut tree, r#"{"kind":1,"name":"child"}"#);
        tree.append(parent, child).unwrap();
        tree.initialize_attribute_collection(parent).unwrap();
        let declaration = node(
            &mut tree,
            r#"{"kind":2,"name":"p","prefix":"xmlns","namespace":"http://www.w3.org/2000/xmlns/","value":"urn:declared"}"#,
        );
        tree.append_attribute(parent, declaration).unwrap();
        assert_eq!(
            observed(tree.lookup_namespace_uri(child, Some(&units("p")))),
            Some(units("urn:own"))
        );
        assert_eq!(
            observed(tree.lookup_prefix(child, Some(&units("urn:declared")))),
            Some(units("p"))
        );
        tree.set_attribute_value(declaration, &units("urn:updated"))
            .unwrap();
        assert_eq!(
            observed(tree.lookup_prefix(child, Some(&units("urn:updated")))),
            Some(units("p"))
        );
        assert_eq!(
            observed(tree.lookup_prefix(child, Some(&units("urn:declared")))),
            None
        );
        tree.remove(child).unwrap();
        assert_eq!(
            observed(tree.lookup_namespace_uri(child, Some(&units("p")))),
            None
        );
        for handle in [parent, child, declaration] {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_resolve_documents_attributes_and_text_without_crossing_fragment_boundaries() {
        let mut tree = TreeStore::new();
        let document = node(&mut tree, r#"{"kind":9}"#);
        let doctype = node(&mut tree, r#"{"kind":10,"name":"root"}"#);
        let element = node(
            &mut tree,
            r#"{"kind":1,"name":"root","namespace":"urn:root"}"#,
        );
        let text = node(&mut tree, r#"{"kind":3,"value":"text"}"#);
        let fragment = node(&mut tree, r#"{"kind":11}"#);
        let attribute = node(&mut tree, r#"{"kind":2,"name":"key","value":"value"}"#);
        tree.append(document, doctype).unwrap();
        tree.append(document, element).unwrap();
        tree.append(element, text).unwrap();
        tree.initialize_attribute_collection(element).unwrap();
        tree.append_attribute(element, attribute).unwrap();
        for handle in [document, element, text, attribute] {
            assert_eq!(
                observed(tree.lookup_namespace_uri(handle, Some(&[]))),
                Some(units("urn:root"))
            );
            assert!(
                tree.is_default_namespace(handle, Some(&units("urn:root")))
                    .unwrap()
            );
        }
        for handle in [doctype, fragment] {
            assert!(tree.is_default_namespace(handle, Some(&[])).unwrap());
            assert_eq!(observed(tree.lookup_namespace_uri(handle, None)), None);
        }
        tree.remove(element).unwrap();
        tree.append(fragment, element).unwrap();
        assert_eq!(observed(tree.lookup_namespace_uri(document, None)), None);
        assert_eq!(observed(tree.lookup_namespace_uri(fragment, None)), None);
        for handle in [attribute, text, element, document, doctype, fragment] {
            tree.release(handle).unwrap();
        }
        assert_eq!(tree.statistics().live_nodes, 0.0);
    }

    #[test]
    fn should_preserve_utf16_declarations_and_empty_namespace_undeclarations() {
        let mut tree = TreeStore::new();
        let element = node(
            &mut tree,
            r#"{"kind":1,"name":"root","attributes":[{"name":"xmlns","namespace":"http://www.w3.org/2000/xmlns/","prefix":null,"value":[55296]},{"name":"p","namespace":"http://www.w3.org/2000/xmlns/","prefix":"xmlns","value":""}]}"#,
        );
        assert_eq!(
            observed(tree.lookup_namespace_uri(element, None)),
            Some(vec![55296])
        );
        assert!(tree.is_default_namespace(element, Some(&[55296])).unwrap());
        assert_eq!(
            observed(tree.lookup_namespace_uri(element, Some(&units("p")))),
            None
        );
        assert_eq!(observed(tree.lookup_prefix(element, Some(&[]))), None);
        tree.release(element).unwrap();
        assert!(tree.lookup_namespace_uri(element, None).is_err());
    }
}
