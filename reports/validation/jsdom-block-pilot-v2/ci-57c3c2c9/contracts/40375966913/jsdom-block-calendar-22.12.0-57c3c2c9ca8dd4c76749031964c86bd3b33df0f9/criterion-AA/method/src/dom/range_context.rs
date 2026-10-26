//! Select the DOM Parsing context from native endpoints and element metadata.
use super::{
    constants::{
        COMMENT_NODE, DOCUMENT_FRAGMENT_NODE, DOCUMENT_NODE, ELEMENT_NODE, HTML_NAMESPACE,
        TEXT_NODE,
    },
    error::{Result, TreeError},
    range_state::BoundaryPoint,
    store::{NodeId, TreeStore},
};

impl TreeStore {
    /// None is an invalid start type; zero asks the host to create the original synthetic body.
    pub fn range_fragment_context(
        &self,
        start: BoundaryPoint,
        end: BoundaryPoint,
        html_document: bool,
    ) -> Result<Option<NodeId>> {
        let links = self.links(start.node)?;
        self.links(end.node)?;
        let data = self
            .data
            .get(&start.node)
            .ok_or(TreeError::MissingData(start.node))?;
        let element = match data.kind {
            DOCUMENT_NODE | DOCUMENT_FRAGMENT_NODE => return Ok(Some(0)),
            ELEMENT_NODE => start.node,
            TEXT_NODE | COMMENT_NODE => {
                if links.parent == 0 {
                    return Ok(Some(0));
                }
                let parent = self
                    .data
                    .get(&links.parent)
                    .ok_or(TreeError::MissingData(links.parent))?;
                if parent.kind != ELEMENT_NODE {
                    return Ok(Some(0));
                }
                links.parent
            }
            _ => return Ok(None),
        };
        let context = self
            .data
            .get(&element)
            .ok_or(TreeError::MissingData(element))?;
        let default_body = html_document
            && context
                .name
                .as_ref()
                .is_some_and(|name| name.units().eq("html".encode_utf16()))
            && context
                .namespace
                .as_ref()
                .is_some_and(|namespace| namespace.units().eq(HTML_NAMESPACE.encode_utf16()));
        Ok(Some(if default_body { 0 } else { element }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn node(tree: &mut TreeStore, metadata: &str) -> u64 {
        let id = tree.allocate().unwrap();
        tree.set_data(id, metadata).unwrap();
        id as u64
    }
    fn point(node: u64) -> BoundaryPoint {
        BoundaryPoint { node, offset: 0.0 }
    }

    #[test]
    fn should_select_element_or_parent_element_without_crossing_fragment_roots() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"table"}"#);
        let text = node(&mut tree, r#"{"kind":3,"value":"text"}"#);
        let comment = node(&mut tree, r#"{"kind":8,"value":"note"}"#);
        let fragment = node(&mut tree, r#"{"kind":11}"#);
        tree.append(root as f64, text as f64).unwrap();
        tree.append(root as f64, comment as f64).unwrap();
        for start in [root, text, comment] {
            assert_eq!(
                tree.range_fragment_context(point(start), point(root), true)
                    .unwrap(),
                Some(root)
            );
        }
        tree.remove(text as f64).unwrap();
        assert_eq!(
            tree.range_fragment_context(point(text), point(root), true)
                .unwrap(),
            Some(0)
        );
        tree.append(fragment as f64, text as f64).unwrap();
        assert_eq!(
            tree.range_fragment_context(point(text), point(root), true)
                .unwrap(),
            Some(0)
        );
    }
    #[test]
    fn should_preserve_html_mode_namespace_case_and_utf16_metadata_in_default_body_selection() {
        let mut tree = TreeStore::new();
        for (name, namespace, html_document, default_body) in [
            ("html", HTML_NAMESPACE, true, true),
            ("html", HTML_NAMESPACE, false, false),
            ("HTML", HTML_NAMESPACE, true, false),
            ("html", "urn:xml", true, false),
            ("body", HTML_NAMESPACE, true, false),
        ] {
            let root = node(
                &mut tree,
                &format!(r#"{{"kind":1,"name":"{name}","namespace":"{namespace}"}}"#),
            );
            assert_eq!(
                tree.range_fragment_context(point(root), point(root), html_document)
                    .unwrap(),
                Some(if default_body { 0 } else { root })
            );
        }
        let root = node(
            &mut tree,
            &serde_json::json!({ "kind": 1, "name": [104, 116, 109, 108],
            "namespace": HTML_NAMESPACE.encode_utf16().collect::<Vec<_>>() })
            .to_string(),
        );
        assert_eq!(
            tree.range_fragment_context(point(root), point(root), true)
                .unwrap(),
            Some(0)
        );
    }
    #[test]
    fn should_validate_both_endpoints_before_type_decisions_without_consuming_reservations() {
        let mut tree = TreeStore::new();
        for kind in [2, 4, 7, 10] {
            let start = node(&mut tree, &format!(r#"{{"kind":{kind}}}"#));
            assert_eq!(
                tree.range_fragment_context(point(start), point(start), true)
                    .unwrap(),
                None
            );
        }
        let document = node(&mut tree, r#"{"kind":9}"#);
        let reserved = tree.reserve_handles().unwrap() as u64;
        let before = tree.statistics();
        assert!(
            tree.range_fragment_context(point(document), point(reserved), true)
                .is_err()
        );
        assert!(
            tree.range_fragment_context(point(reserved), point(document), true)
                .is_err()
        );
        assert_eq!(
            tree.range_fragment_context(point(document), point(document), true)
                .unwrap(),
            Some(0)
        );
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
    }
}
