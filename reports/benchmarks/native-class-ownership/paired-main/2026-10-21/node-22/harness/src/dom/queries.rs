//! Bounded selector compilation and live native query execution.
use super::{
    constants::{DOCUMENT_NODE, ELEMENT_NODE},
    error::Result,
    selector_element::SelectorElement,
    selector_syntax::{DomSelectors, Supported, Syntax},
    store::{NodeId, TreeStore, node_id},
};
use cssparser::{Parser as CssParser, ParserInput};
use lru::LruCache;
use selectors::{
    OpaqueElement,
    context::{
        MatchingContext, MatchingForInvalidation, MatchingMode, NeedsSelectorFlags, QuirksMode,
        SelectorCaches,
    },
    matching::matches_selector_list,
    parser::{ParseRelative, SelectorList},
};
use std::{cell::Cell, num::NonZeroUsize};
/// Bound retained query input and ASTs; larger inputs are evaluated without caching.
const SELECTOR_CACHE_CAPACITY: usize = 256;
const MAX_CACHED_SELECTOR_BYTES: usize = 4096;
pub struct QueryEngine {
    cache: LruCache<String, Option<SelectorList<DomSelectors>>>,
    pub calls: u64,
    pub fallbacks: u64,
    pub cache_hits: u64,
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum QueryKind {
    All,
    First,
    Matches,
    Closest,
}
pub struct QueryRequest<'a> {
    pub source: &'a str,
    pub root: f64,
    pub document: f64,
    pub kind: QueryKind,
    pub quirks: bool,
}
impl Default for QueryEngine {
    fn default() -> Self {
        Self {
            cache: LruCache::new(
                NonZeroUsize::new(SELECTOR_CACHE_CAPACITY).expect("positive cache capacity"),
            ),
            calls: 0,
            fallbacks: 0,
            cache_hits: 0,
        }
    }
}
impl QueryEngine {
    pub fn cache_size(&self) -> usize {
        self.cache.len()
    }
    fn compile(&mut self, source: &str) -> Option<SelectorList<DomSelectors>> {
        if let Some(cached) = self.cache.get(source) {
            self.cache_hits += 1;
            return cached.clone();
        }
        let syntax = Syntax {
            unsupported: Cell::new(false),
        };
        let mut input = ParserInput::new(source);
        let parsed =
            SelectorList::parse(&syntax, &mut CssParser::new(&mut input), ParseRelative::No)
                .ok()
                .filter(|selectors| {
                    !syntax.unsupported.get()
                        && selectors
                            .slice()
                            .iter()
                            .all(|selector| selector.visit(&mut Supported))
                });
        if source.len() <= MAX_CACHED_SELECTOR_BYTES {
            self.cache.put(source.to_owned(), parsed.clone());
        }
        parsed
    }

    /// Isolate unsupported data to the actual tree, including ancestors used by matching.
    fn compatible_tree(store: &TreeStore, mut root: NodeId) -> bool {
        if store.non_utf8_nodes == 0 && store.data.len() == store.nodes.len() {
            return true;
        }
        while store.nodes[&root].parent != 0 {
            root = store.nodes[&root].parent;
        }
        let mut pending = vec![root];
        while let Some(id) = pending.pop() {
            let Some(data) = store.data.get(&id) else {
                return false;
            };
            if data.has_non_utf8()
                || (data.kind == ELEMENT_NODE
                    && store.attribute_views(id).map_or(true, |mut attributes| {
                        attributes
                            .any(|attribute| attribute.map_or(true, |value| value.has_non_utf8()))
                    }))
            {
                return false;
            }
            let mut child = store.nodes[&id].first;
            while child != 0 {
                pending.push(child);
                child = store.nodes[&child].next;
            }
        }
        true
    }

    /// Return None only when the compatibility engine must handle the selector.
    pub fn query(
        &mut self,
        store: &mut TreeStore,
        request: QueryRequest<'_>,
    ) -> Result<Option<Vec<f64>>> {
        let QueryRequest {
            source,
            root,
            document,
            kind,
            quirks,
        } = request;
        self.calls += 1;
        let root = node_id(root)?;
        let document = node_id(document)?;
        store.validate_activation(root)?;
        store.validate_activation(document)?;
        store.activate(root)?;
        store.activate(document)?;
        if !Self::compatible_tree(store, root) {
            self.fallbacks += 1;
            return Ok(None);
        }
        let Some(selectors) = self.compile(source) else {
            self.fallbacks += 1;
            return Ok(None);
        };
        let mut caches = SelectorCaches::default();
        let mut context = MatchingContext::new(
            MatchingMode::Normal,
            None,
            &mut caches,
            if quirks {
                QuirksMode::Quirks
            } else {
                QuirksMode::NoQuirks
            },
            NeedsSelectorFlags::No,
            MatchingForInvalidation::No,
        );
        if store.data[&root].kind != DOCUMENT_NODE {
            context.scope_element = Some(OpaqueElement::new(&store.nodes[&root]));
        }
        let mut result = Vec::new();
        let compatibility = Cell::new(false);
        let mut current = if matches!(kind, QueryKind::Matches | QueryKind::Closest) {
            root
        } else {
            store.nodes[&root].first
        };
        while current != 0 {
            if store.data[&current].kind == ELEMENT_NODE {
                let element = SelectorElement {
                    store,
                    id: current,
                    document,
                    compatibility: &compatibility,
                };
                if matches_selector_list(&selectors, &element, &mut context) {
                    result.push(current as f64);
                    if kind != QueryKind::All {
                        break;
                    }
                }
            }
            if kind == QueryKind::Matches {
                break;
            }
            if kind == QueryKind::Closest {
                current = store.nodes[&current].parent;
                continue;
            }
            if store.nodes[&current].first != 0 {
                current = store.nodes[&current].first;
                continue;
            }
            loop {
                if current == root {
                    current = 0;
                    break;
                }
                if store.nodes[&current].next != 0 {
                    current = store.nodes[&current].next;
                    break;
                }
                current = store.nodes[&current].parent;
            }
        }
        if compatibility.get() {
            self.fallbacks += 1;
            return Ok(None);
        }
        Ok(Some(result))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dom::constants::HTML_NAMESPACE;

    #[test]
    fn should_count_query_errors_without_activating_reserved_handles() {
        let mut store = TreeStore::new();
        let reserved = store.reserve_handles().unwrap();
        let unknown = reserved + super::super::store::HANDLE_BATCH_SIZE as f64;
        let mut engine = QueryEngine::default();
        for (root, document) in [
            (reserved, unknown),
            (unknown, reserved),
            (reserved, f64::NAN),
        ] {
            let before = store.statistics();
            let attempts = engine.calls;
            assert!(
                engine
                    .query(
                        &mut store,
                        QueryRequest {
                            source: "*",
                            root,
                            document,
                            kind: QueryKind::All,
                            quirks: false,
                        }
                    )
                    .is_err()
            );
            let after = store.statistics();
            assert_eq!(after.live_nodes, before.live_nodes);
            assert_eq!(after.capacity, before.capacity);
            assert_eq!(after.allocations, before.allocations);
            assert_eq!(after.reserved_handles, before.reserved_handles);
            assert_eq!(engine.calls, attempts + 1);
            assert_eq!(engine.fallbacks, 0);
            assert_eq!(engine.cache_size(), 0);
        }
        assert!(
            engine
                .query(
                    &mut store,
                    QueryRequest {
                        source: "*",
                        root: reserved,
                        document: reserved,
                        kind: QueryKind::All,
                        quirks: false,
                    }
                )
                .unwrap()
                .is_none()
        );
        assert_eq!(store.statistics().allocations, 1.0);
        assert_eq!(engine.fallbacks, 1);
    }
    fn sample_tree() -> (TreeStore, f64, f64, f64) {
        let mut store = TreeStore::new();
        let document = store.allocate().unwrap();
        let parent = store.allocate().unwrap();
        let child = store.allocate().unwrap();
        store.set_data(document, r#"{"kind":9}"#).unwrap();
        store
            .set_data(
                parent,
                &format!(r#"{{"kind":1,"name":"div","namespace":"{HTML_NAMESPACE}"}}"#),
            )
            .unwrap();
        store.set_data(child, &format!(r#"{{"kind":1,"name":"span","namespace":"{HTML_NAMESPACE}","attributes":[{{"name":"class","value":"a"}}]}}"#)).unwrap();
        store.append(document, parent).unwrap();
        store.append(parent, child).unwrap();
        (store, document, parent, child)
    }

    #[test]
    fn should_match_live_data_with_reused_selector_syntax() {
        let (mut store, document, parent, child) = sample_tree();
        let mut engine = QueryEngine::default();
        let query = || QueryRequest {
            source: "div:has(> span.a)",
            root: document,
            document,
            kind: QueryKind::All,
            quirks: false,
        };
        assert_eq!(
            engine.query(&mut store, query()).unwrap(),
            Some(vec![parent])
        );
        store.set_data(child, &format!(r#"{{"kind":1,"name":"span","namespace":"{HTML_NAMESPACE}","attributes":[{{"name":"class","value":"b"}}]}}"#)).unwrap();
        assert_eq!(engine.query(&mut store, query()).unwrap(), Some(vec![]));
        assert!(engine.cache_hits > 0);
        assert_eq!(
            engine
                .query(
                    &mut store,
                    QueryRequest {
                        source: ":scope > span",
                        root: parent,
                        document,
                        kind: QueryKind::All,
                        quirks: false
                    }
                )
                .unwrap(),
            Some(vec![child])
        );
        assert_eq!(
            engine
                .query(
                    &mut store,
                    QueryRequest {
                        source: "div",
                        root: child,
                        document,
                        kind: QueryKind::Closest,
                        quirks: false
                    }
                )
                .unwrap(),
            Some(vec![parent])
        );
    }

    #[test]
    fn should_delegate_unsupported_syntax_without_disabling_unrelated_trees() {
        let (mut store, document, _parent, child) = sample_tree();
        let mut engine = QueryEngine::default();
        for source in ["[", ":checked", "span:nth-child(1 of .a)"] {
            assert!(
                engine
                    .query(
                        &mut store,
                        QueryRequest {
                            source,
                            root: document,
                            document,
                            kind: QueryKind::All,
                            quirks: false
                        }
                    )
                    .unwrap()
                    .is_none()
            );
        }
        store
            .set_data(child, r#"{"kind":3,"value":[55296]}"#)
            .unwrap();
        let other_document = store.allocate().unwrap();
        let other_element = store.allocate().unwrap();
        store.set_data(other_document, r#"{"kind":9}"#).unwrap();
        store
            .set_data(
                other_element,
                &format!(r#"{{"kind":1,"name":"span","namespace":"{HTML_NAMESPACE}"}}"#),
            )
            .unwrap();
        store.append(other_document, other_element).unwrap();
        assert_eq!(
            engine
                .query(
                    &mut store,
                    QueryRequest {
                        source: "span",
                        root: other_document,
                        document: other_document,
                        kind: QueryKind::All,
                        quirks: false
                    }
                )
                .unwrap(),
            Some(vec![other_element])
        );
    }
}
