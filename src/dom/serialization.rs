//! Iterative HTML serialization over native links and lossless DOM data.
use super::{
    constants::{COMMENT_NODE, DOCUMENT_TYPE_NODE, ELEMENT_NODE, HTML_NAMESPACE, TEXT_NODE},
    data::{DomString, NodeData},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};
use rustc_hash::FxHashSet;

/// Match the pinned parse5 serializer, including its legacy void names.
const VOID_NAMES: &[&str] = &[
    "area", "base", "basefont", "bgsound", "br", "col", "embed", "frame", "hr", "img", "input",
    "keygen", "link", "meta", "param", "source", "track", "wbr",
];
const RAW_TEXT_NAMES: &[&str] = &[
    "style",
    "script",
    "xmp",
    "iframe",
    "noembed",
    "noframes",
    "plaintext",
];

enum Visit {
    Node(NodeId),
    Close(NodeId),
    FinishTemplate(NodeId),
}

fn ascii(output: &mut Vec<u16>, value: &str) {
    output.extend(value.bytes().map(u16::from));
}
fn raw(output: &mut Vec<u16>, value: &DomString) {
    output.extend(value.units());
}
fn escaped(output: &mut Vec<u16>, value: &DomString, attribute: bool) {
    for unit in value.units() {
        match unit {
            0x26 => ascii(output, "&amp;"),
            0xa0 => ascii(output, "&nbsp;"),
            0x22 if attribute => ascii(output, "&quot;"),
            0x3c if !attribute => ascii(output, "&lt;"),
            0x3e if !attribute => ascii(output, "&gt;"),
            _ => output.push(unit),
        }
    }
}

fn unprefixed_html(data: &NodeData) -> Option<&str> {
    if data.namespace.as_ref().and_then(DomString::as_str) != Some(HTML_NAMESPACE)
        || data.prefix.is_some()
    {
        return None;
    }
    data.name.as_ref().and_then(DomString::as_str)
}

fn qualified_name(output: &mut Vec<u16>, name: &DomString, prefix: &Option<DomString>) {
    if let Some(prefix) = prefix {
        raw(output, prefix);
        ascii(output, ":");
    }
    raw(output, name);
}

impl TreeStore {
    fn serialization_data(&self, id: NodeId) -> Result<&NodeData> {
        self.data.get(&id).ok_or(TreeError::MissingData(id))
    }

    fn queue_children(&self, id: NodeId, pending: &mut Vec<Visit>) -> Result<()> {
        let mut child = self.links(id)?.last;
        while child != 0 {
            pending.push(Visit::Node(child));
            child = self.links(child)?.previous;
        }
        Ok(())
    }

    /// Preserve jsdom HTML serialization, including templates, qualified names and lone surrogates.
    pub fn serialize_html(
        &mut self,
        handle: f64,
        outer: bool,
        scripting: bool,
    ) -> Result<Vec<u16>> {
        let root = node_id(handle)?;
        self.validate_activation(root)?;
        let root_data = self.serialization_data(root)?;
        let mut output = Vec::new();
        let mut pending = Vec::new();
        let mut template_path = FxHashSet::default();
        if outer {
            pending.push(Visit::Node(root));
        } else if !unprefixed_html(root_data).is_some_and(|name| VOID_NAMES.contains(&name)) {
            let container = if unprefixed_html(root_data) == Some("template") {
                node_id(root_data.template_content)?
            } else {
                root
            };
            self.queue_children(container, &mut pending)?;
        }
        while let Some(visit) = pending.pop() {
            let id = match visit {
                Visit::FinishTemplate(id) => {
                    template_path.remove(&id);
                    continue;
                }
                Visit::Close(id) => {
                    let data = self.serialization_data(id)?;
                    ascii(&mut output, "</");
                    qualified_name(
                        &mut output,
                        data.name.as_ref().ok_or(TreeError::MissingData(id))?,
                        &data.prefix,
                    );
                    ascii(&mut output, ">");
                    continue;
                }
                Visit::Node(id) => id,
            };
            let data = self.serialization_data(id)?;
            match data.kind {
                ELEMENT_NODE => {
                    let name = data.name.as_ref().ok_or(TreeError::MissingData(id))?;
                    ascii(&mut output, "<");
                    qualified_name(&mut output, name, &data.prefix);
                    if let Some(is_value) = data.is_value.as_ref().filter(|value| !value.is_empty())
                        && !data.attributes.iter().any(|attribute| {
                            attribute.prefix.is_none() && attribute.name.as_str() == Some("is")
                        })
                    {
                        ascii(&mut output, " is=\"");
                        escaped(&mut output, is_value, true);
                        ascii(&mut output, "\"");
                    }
                    // jsdom's serialization adapter supplies qualified Attr.name values.
                    for attribute in &data.attributes {
                        ascii(&mut output, " ");
                        qualified_name(&mut output, &attribute.name, &attribute.prefix);
                        ascii(&mut output, "=\"");
                        escaped(&mut output, &attribute.value, true);
                        ascii(&mut output, "\"");
                    }
                    ascii(&mut output, ">");
                    if !unprefixed_html(data).is_some_and(|name| VOID_NAMES.contains(&name)) {
                        pending.push(Visit::Close(id));
                        let container = if unprefixed_html(data) == Some("template") {
                            let content = node_id(data.template_content)?;
                            if !template_path.insert(content) {
                                return Err(TreeError::Cycle(content));
                            }
                            pending.push(Visit::FinishTemplate(content));
                            content
                        } else {
                            id
                        };
                        self.queue_children(container, &mut pending)?;
                    }
                }
                TEXT_NODE => {
                    let parent = self.links(id)?.parent;
                    let parent_name = self.data.get(&parent).and_then(unprefixed_html);
                    if parent_name.is_some_and(|name| {
                        RAW_TEXT_NAMES.contains(&name) || (scripting && name == "noscript")
                    }) {
                        raw(&mut output, &data.value);
                    } else {
                        escaped(&mut output, &data.value, false);
                    }
                }
                COMMENT_NODE => {
                    ascii(&mut output, "<!--");
                    raw(&mut output, &data.value);
                    ascii(&mut output, "-->");
                }
                DOCUMENT_TYPE_NODE => {
                    ascii(&mut output, "<!DOCTYPE ");
                    raw(
                        &mut output,
                        data.name.as_ref().ok_or(TreeError::MissingData(id))?,
                    );
                    ascii(&mut output, ">");
                }
                _ => {}
            }
        }
        self.serializations += 1;
        Ok(output)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_reject_missing_serialization_data_without_consuming_reservations() {
        let mut tree = TreeStore::new();
        let reserved = tree.reserve_handles().unwrap();
        for outer in [false, true] {
            let before = tree.statistics();
            assert!(matches!(
                tree.serialize_html(reserved, outer, false),
                Err(TreeError::MissingData(_))
            ));
            let after = tree.statistics();
            assert_eq!(after.live_nodes, before.live_nodes);
            assert_eq!(after.capacity, before.capacity);
            assert_eq!(after.allocations, before.allocations);
            assert_eq!(after.reserved_handles, before.reserved_handles);
            assert_eq!(after.serializations, before.serializations);
        }
    }

    #[test]
    fn should_escape_html_and_preserve_isolated_utf16_units() {
        let mut tree = TreeStore::new();
        let root = tree.allocate().unwrap();
        let element = tree.allocate().unwrap();
        let text = tree.allocate().unwrap();
        tree.set_data(root, r#"{"kind":9}"#).unwrap();
        tree.set_data(element, r#"{"kind":1,"name":"p","namespace":"http://www.w3.org/1999/xhtml","attributes":[{"name":"title","namespace":null,"prefix":null,"value":"<&\""}]}"#).unwrap();
        tree.set_data(text, r#"{"kind":3,"value":[55296,38,60,160]}"#)
            .unwrap();
        tree.append(root, element).unwrap();
        tree.append(element, text).unwrap();
        let mut expected: Vec<u16> = "<p title=\"<&amp;&quot;\">".encode_utf16().collect();
        expected.push(55296);
        expected.extend("&amp;&lt;&nbsp;</p>".encode_utf16());
        assert_eq!(tree.serialize_html(root, false, false).unwrap(), expected);
    }

    #[test]
    fn should_reject_template_cycles_without_unbounded_recursion() {
        let mut tree = TreeStore::new();
        let fragment = tree.allocate().unwrap();
        let template = tree.allocate().unwrap();
        tree.set_data(fragment, r#"{"kind":11}"#).unwrap();
        tree.set_data(template, &format!(r#"{{"kind":1,"name":"template","namespace":"http://www.w3.org/1999/xhtml","templateContent":{fragment}}}"#)).unwrap();
        tree.append(fragment, template).unwrap();
        assert!(matches!(
            tree.serialize_html(fragment, false, false),
            Err(TreeError::Cycle(_))
        ));
    }

    #[test]
    fn should_preserve_existing_data_when_metadata_decoding_fails() {
        let mut tree = TreeStore::new();
        let text = tree.allocate().unwrap();
        tree.set_data(text, r#"{"kind":3,"value":"before"}"#)
            .unwrap();
        let error = tree.set_data(text, "invalid JSON").unwrap_err();
        assert!(std::error::Error::source(&error).is_some());
        assert_eq!(
            String::from_utf16(&tree.serialize_html(text, true, false).unwrap()).unwrap(),
            "before"
        );
        tree.release(text).unwrap();
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }
}
