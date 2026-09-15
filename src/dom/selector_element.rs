//! Servo's element view over immutable native data during a query.
use super::{
    attribute_view::AttributeView,
    constants::{ELEMENT_NODE, HTML_NAMESPACE, TEXT_NODE},
    data::{DomString, NodeData},
    selector_syntax::{DomSelectors, Name, UnsupportedPseudo, Value},
    store::{NodeId, TreeStore},
};
use selectors::{
    Element, OpaqueElement,
    attr::{AttrSelectorOperation, CaseSensitivity, NamespaceConstraint},
    bloom::BloomFilter,
    context::MatchingContext,
    matching::ElementSelectorFlags,
};
use std::{cell::Cell, fmt};
#[derive(Clone, Copy)]
pub(super) struct SelectorElement<'a> {
    pub(super) store: &'a TreeStore,
    pub(super) id: NodeId,
    pub(super) document: NodeId,
    pub(super) compatibility: &'a Cell<bool>,
}
impl fmt::Debug for SelectorElement<'_> {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("NativeElement")
            .field("id", &self.id)
            .finish()
    }
}
impl<'a> SelectorElement<'a> {
    fn case_matches(&self, value: &str, expected: &str, case: CaseSensitivity) -> bool {
        let matches = case.eq(value.as_bytes(), expected.as_bytes());
        // Preserve jsdom's method-specific quirks behavior for case-ambiguous IDs/classes.
        if matches && value != expected {
            self.compatibility.set(true);
        }
        matches
    }
    fn element(&self, id: NodeId) -> Option<Self> {
        self.store
            .data
            .get(&id)
            .filter(|data| data.kind == ELEMENT_NODE)
            .map(|_| Self {
                store: self.store,
                id,
                document: self.document,
                compatibility: self.compatibility,
            })
    }
    fn data(&self) -> &'a NodeData {
        &self.store.data[&self.id]
    }
    fn attributes(&self) -> impl Iterator<Item = AttributeView<'a>> + '_ {
        self.store
            .attribute_views_for_data(self.id, self.data())
            .filter_map(|attribute| match attribute {
                Ok(value) => Some(value),
                Err(_) => {
                    self.compatibility.set(true);
                    None
                }
            })
    }
    fn sibling(&self, mut id: NodeId, previous: bool) -> Option<Self> {
        while id != 0 {
            if let Some(element) = self.element(id) {
                return Some(element);
            }
            id = if previous {
                self.store.nodes[&id].previous
            } else {
                self.store.nodes[&id].next
            };
        }
        None
    }
    fn attribute(&self, name: &str) -> Option<&str> {
        let html = self.is_html_element_in_html_document();
        self.attributes()
            .find(|attribute| {
                attribute
                    .namespace
                    .and_then(DomString::as_str)
                    .unwrap_or("")
                    .is_empty()
                    && attribute.name.as_str().is_some_and(|candidate| {
                        if html {
                            candidate.eq_ignore_ascii_case(name)
                        } else {
                            candidate == name
                        }
                    })
            })
            .and_then(|attribute| attribute.value.as_str())
    }
}

impl Element for SelectorElement<'_> {
    type Impl = DomSelectors;
    fn opaque(&self) -> OpaqueElement {
        OpaqueElement::new(&self.store.nodes[&self.id])
    }
    fn parent_element(&self) -> Option<Self> {
        self.element(self.store.nodes[&self.id].parent)
    }
    // The JS boundary delegates shadow-tree queries before invoking this adapter.
    fn parent_node_is_shadow_root(&self) -> bool {
        false
    }
    fn containing_shadow_host(&self) -> Option<Self> {
        None
    }
    fn is_pseudo_element(&self) -> bool {
        false
    }
    fn prev_sibling_element(&self) -> Option<Self> {
        self.sibling(self.store.nodes[&self.id].previous, true)
    }
    fn next_sibling_element(&self) -> Option<Self> {
        self.sibling(self.store.nodes[&self.id].next, false)
    }
    fn first_element_child(&self) -> Option<Self> {
        self.sibling(self.store.nodes[&self.id].first, false)
    }
    fn is_html_element_in_html_document(&self) -> bool {
        self.has_namespace(HTML_NAMESPACE)
    }
    fn has_local_name(&self, name: &str) -> bool {
        self.data()
            .name
            .as_ref()
            .and_then(DomString::as_str)
            .is_some_and(|actual| {
                if self.is_html_element_in_html_document() {
                    actual.eq_ignore_ascii_case(name)
                } else {
                    actual == name
                }
            })
    }
    fn has_namespace(&self, namespace: &str) -> bool {
        self.data()
            .namespace
            .as_ref()
            .and_then(DomString::as_str)
            .unwrap_or("")
            == namespace
    }
    fn is_same_type(&self, other: &Self) -> bool {
        self.data().namespace.as_ref().and_then(DomString::as_str)
            == other.data().namespace.as_ref().and_then(DomString::as_str)
            && other
                .data()
                .name
                .as_ref()
                .and_then(DomString::as_str)
                .is_some_and(|name| self.has_local_name(name))
    }
    fn attr_matches(
        &self,
        namespace: &NamespaceConstraint<&Name>,
        name: &Name,
        operation: &AttrSelectorOperation<&Value>,
    ) -> bool {
        let html = self.is_html_element_in_html_document();
        self.attributes().any(|attribute| {
            let namespace_matches = match namespace {
                NamespaceConstraint::Any => true,
                NamespaceConstraint::Specific(expected) => {
                    attribute
                        .namespace
                        .and_then(DomString::as_str)
                        .unwrap_or("")
                        == expected.value
                }
            };
            if !html
                && attribute.name.as_str().is_some_and(|actual| {
                    actual != name.value && actual.eq_ignore_ascii_case(&name.value)
                })
            {
                // jsdom's single/all/matches paths differ for foreign attribute casing.
                self.compatibility.set(true);
            }
            namespace_matches
                && attribute.name.as_str().is_some_and(|actual| {
                    if html {
                        actual.eq_ignore_ascii_case(&name.value)
                    } else {
                        actual == name.value
                    }
                })
                && attribute
                    .value
                    .as_str()
                    .is_some_and(|value| operation.eval_str(value))
        })
    }
    fn match_non_ts_pseudo_class(
        &self,
        pseudo: &UnsupportedPseudo,
        _context: &mut MatchingContext<DomSelectors>,
    ) -> bool {
        match *pseudo {}
    }
    fn match_pseudo_element(
        &self,
        pseudo: &UnsupportedPseudo,
        _context: &mut MatchingContext<DomSelectors>,
    ) -> bool {
        match *pseudo {}
    }
    fn apply_selector_flags(&self, _flags: ElementSelectorFlags) {} // Query matching does not schedule style invalidation.
    fn is_link(&self) -> bool {
        self.attribute("href").is_some()
            && (self.has_local_name("a")
                || self.has_local_name("area")
                || self.has_local_name("link"))
    }
    fn is_html_slot_element(&self) -> bool {
        self.is_html_element_in_html_document() && self.has_local_name("slot")
    }
    fn has_id(&self, id: &Name, case: CaseSensitivity) -> bool {
        self.attribute("id")
            .is_some_and(|value| self.case_matches(value, &id.value, case))
    }
    fn has_class(&self, name: &Name, case: CaseSensitivity) -> bool {
        self.attribute("class").is_some_and(|value| {
            value
                .split_ascii_whitespace()
                .any(|class| self.case_matches(class, &name.value, case))
        })
    }
    fn has_custom_state(&self, _name: &Name) -> bool {
        false
    } // Unsupported pseudo classes cannot enter the matcher.
    fn imported_part(&self, _name: &Name) -> Option<Name> {
        None
    }
    fn is_part(&self, _name: &Name) -> bool {
        false
    }
    fn is_empty(&self) -> bool {
        let mut child = self.store.nodes[&self.id].first;
        while child != 0 {
            let data = &self.store.data[&child];
            if data.kind == ELEMENT_NODE || (data.kind == TEXT_NODE && !data.value.is_empty()) {
                return false;
            }
            child = self.store.nodes[&child].next;
        }
        true
    }
    fn is_root(&self) -> bool {
        self.store.nodes[&self.id].parent == self.document
    }
    fn add_element_unique_hashes(&self, _filter: &mut BloomFilter) -> bool {
        false
    }
}
