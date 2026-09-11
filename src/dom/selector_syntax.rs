//! CSS vocabulary, parser policy and supported syntax, independent of DOM traversal.
use cssparser::{CowRcStr, ParseError, Parser as CssParser, SourceLocation, ToCss};
use precomputed_hash::PrecomputedHash;
use rustc_hash::FxHasher;
use selectors::{
    SelectorImpl,
    parser::{
        Component, NonTSPseudoClass, Parser, PseudoElement, RelativeSelector,
        SelectorParseErrorKind,
    },
    visitor::SelectorVisitor,
};
use std::{
    borrow::Borrow,
    cell::Cell,
    fmt,
    hash::{Hash, Hasher},
};
#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct Name {
    pub(super) value: String,
    hash: u32,
}
impl From<&str> for Name {
    fn from(value: &str) -> Self {
        let mut hasher = FxHasher::default();
        value.hash(&mut hasher);
        Self {
            value: value.to_owned(),
            hash: hasher.finish() as u32,
        }
    }
}
impl Default for Name {
    fn default() -> Self {
        Self::from("")
    }
}
impl Borrow<str> for Name {
    fn borrow(&self) -> &str {
        &self.value
    }
}
impl PrecomputedHash for Name {
    fn precomputed_hash(&self) -> u32 {
        self.hash
    }
}
impl ToCss for Name {
    fn to_css<W: fmt::Write>(&self, destination: &mut W) -> fmt::Result {
        cssparser::serialize_identifier(&self.value, destination)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct Value(String);
impl From<&str> for Value {
    fn from(value: &str) -> Self {
        Self(value.to_owned())
    }
}
impl AsRef<str> for Value {
    fn as_ref(&self) -> &str {
        &self.0
    }
}
impl ToCss for Value {
    fn to_css<W: fmt::Write>(&self, destination: &mut W) -> fmt::Result {
        cssparser::serialize_string(&self.0, destination)
    }
}

/// Dynamic and pseudo-element selectors are delegated, never represented as fake matches.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) enum UnsupportedPseudo {}
impl ToCss for UnsupportedPseudo {
    fn to_css<W: fmt::Write>(&self, _destination: &mut W) -> fmt::Result {
        match *self {}
    }
}
impl NonTSPseudoClass for UnsupportedPseudo {
    type Impl = DomSelectors;
    fn is_active_or_hover(&self) -> bool {
        match *self {}
    }
    fn is_user_action_state(&self) -> bool {
        match *self {}
    }
}
impl PseudoElement for UnsupportedPseudo {
    type Impl = DomSelectors;
}

#[derive(Clone, Debug)]
pub(super) struct DomSelectors;
impl SelectorImpl for DomSelectors {
    type ExtraMatchingData<'a> = ();
    type AttrValue = Value;
    type Identifier = Name;
    type LocalName = Name;
    type NamespaceUrl = Name;
    type NamespacePrefix = Name;
    type BorrowedNamespaceUrl = str;
    type BorrowedLocalName = str;
    type NonTSPseudoClass = UnsupportedPseudo;
    type PseudoElement = UnsupportedPseudo;
}

pub(super) struct Syntax {
    pub(super) unsupported: Cell<bool>,
}
impl<'i> Parser<'i> for Syntax {
    type Impl = DomSelectors;
    type Error = SelectorParseErrorKind<'i>;
    fn parse_nth_child_of(&self) -> bool {
        true
    }
    fn parse_is_and_where(&self) -> bool {
        true
    }
    fn parse_has(&self) -> bool {
        true
    }
    fn parse_non_ts_pseudo_class(
        &self,
        location: SourceLocation,
        name: CowRcStr<'i>,
    ) -> std::result::Result<UnsupportedPseudo, ParseError<'i, Self::Error>> {
        self.unsupported.set(true);
        Err(
            location.new_custom_error(SelectorParseErrorKind::UnsupportedPseudoClassOrElement(
                name,
            )),
        )
    }
    fn parse_non_ts_functional_pseudo_class<'t>(
        &self,
        name: CowRcStr<'i>,
        parser: &mut CssParser<'i, 't>,
        _after_part: bool,
    ) -> std::result::Result<UnsupportedPseudo, ParseError<'i, Self::Error>> {
        self.unsupported.set(true);
        Err(
            parser.new_custom_error(SelectorParseErrorKind::UnsupportedPseudoClassOrElement(
                name,
            )),
        )
    }
    fn parse_pseudo_element(
        &self,
        location: SourceLocation,
        name: CowRcStr<'i>,
    ) -> std::result::Result<UnsupportedPseudo, ParseError<'i, Self::Error>> {
        self.unsupported.set(true);
        Err(
            location.new_custom_error(SelectorParseErrorKind::UnsupportedPseudoClassOrElement(
                name,
            )),
        )
    }
    fn parse_functional_pseudo_element<'t>(
        &self,
        name: CowRcStr<'i>,
        parser: &mut CssParser<'i, 't>,
    ) -> std::result::Result<UnsupportedPseudo, ParseError<'i, Self::Error>> {
        self.unsupported.set(true);
        Err(
            parser.new_custom_error(SelectorParseErrorKind::UnsupportedPseudoClassOrElement(
                name,
            )),
        )
    }
}

pub(super) struct Supported;
impl SelectorVisitor for Supported {
    type Impl = DomSelectors;
    fn visit_simple_selector(&mut self, component: &Component<DomSelectors>) -> bool {
        matches!(
            component,
            Component::LocalName(_)
                | Component::ID(_)
                | Component::Class(_)
                | Component::AttributeInNoNamespaceExists { .. }
                | Component::AttributeInNoNamespace { .. }
                | Component::AttributeOther(_)
                | Component::ExplicitUniversalType
                | Component::ExplicitAnyNamespace
                | Component::ExplicitNoNamespace
                | Component::DefaultNamespace(_)
                | Component::Namespace(_, _)
                | Component::Negation(_)
                | Component::Root
                | Component::Empty
                | Component::Scope
                | Component::Nth(_)
                | Component::Where(_)
                | Component::Is(_)
                | Component::Has(_)
                | Component::Combinator(_)
                | Component::RelativeSelectorAnchor
        )
    }
    fn visit_relative_selector_list(&mut self, list: &[RelativeSelector<DomSelectors>]) -> bool {
        list.iter().all(|relative| relative.selector.visit(self))
    }
}
