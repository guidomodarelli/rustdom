//! DOM data keeps well-formed strings compact and preserves isolated UTF-16 surrogates.
use super::constants::is_character_data;
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
#[serde(untagged)]
pub enum DomString {
    Text(String),
    Utf16(Vec<u16>),
    /// Only internal CharacterData construction can produce undefined; JSON input cannot.
    #[serde(skip)]
    Undefined,
}

impl Default for DomString {
    fn default() -> Self {
        Self::Text(String::new())
    }
}

pub enum Units<'a> {
    Text(std::str::EncodeUtf16<'a>),
    Utf16(std::iter::Copied<std::slice::Iter<'a, u16>>),
}

impl Iterator for Units<'_> {
    type Item = u16;
    fn next(&mut self) -> Option<u16> {
        match self {
            Self::Text(units) => units.next(),
            Self::Utf16(units) => units.next(),
        }
    }
}

impl DomString {
    /// Keep ordinary names/values compact while preserving isolated surrogate units.
    pub fn from_units(units: &[u16]) -> Self {
        match String::from_utf16(units) {
            Ok(value) => Self::Text(value),
            Err(_) => Self::Utf16(units.to_vec()),
        }
    }
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Self::Text(value) => Some(value),
            Self::Utf16(_) | Self::Undefined => None,
        }
    }
    pub fn is_empty(&self) -> bool {
        match self {
            Self::Text(value) => value.is_empty(),
            Self::Utf16(value) => value.is_empty(),
            Self::Undefined => false,
        }
    }
    /// Compare exposed UTF-16 units across storage representations; stored-kind equality is separate.
    pub(super) fn code_units_equal(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Text(actual), Self::Text(expected)) => actual == expected,
            _ => self.units().eq(other.units()),
        }
    }
    /// Avoid decoding ordinary UTF-8 metadata for a known textual query or DOM literal.
    pub(super) fn code_units_equal_str(&self, expected: &str) -> bool {
        match self {
            Self::Text(actual) => actual == expected,
            _ => self.units().eq(expected.encode_utf16()),
        }
    }
    pub fn units(&self) -> Units<'_> {
        match self {
            Self::Text(value) => Units::Text(value.encode_utf16()),
            Self::Utf16(value) => Units::Utf16(value.iter().copied()),
            Self::Undefined => Units::Text("undefined".encode_utf16()),
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AttributeData {
    pub name: DomString,
    pub namespace: Option<DomString>,
    pub prefix: Option<DomString>,
    pub value: DomString,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields, rename_all = "camelCase")]
pub struct DocumentTypeData {
    pub public_id: DomString,
    pub system_id: DomString,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields, rename_all = "camelCase")]
pub struct NodeData {
    pub kind: u16,
    pub name: Option<DomString>,
    pub namespace: Option<DomString>,
    pub prefix: Option<DomString>,
    pub value: DomString,
    pub attributes: Vec<AttributeData>,
    pub template_content: f64,
    pub is_value: Option<DomString>,
    // Allocate doctype-specific strings only for doctypes, not for every DOM node.
    pub doctype: Option<Box<DocumentTypeData>>,
}

impl NodeData {
    /// Only selector-relevant names/attributes require UTF-8; CharacterData uses length for :empty.
    pub fn has_non_utf8(&self) -> bool {
        (!is_character_data(self.kind) && self.value.as_str().is_none())
            || [&self.name, &self.namespace, &self.prefix, &self.is_value]
                .into_iter()
                .any(|value| value.as_ref().is_some_and(|text| text.as_str().is_none()))
            || self.attributes.iter().any(|attribute| {
                attribute.name.as_str().is_none()
                    || attribute.value.as_str().is_none()
                    || [&attribute.namespace, &attribute.prefix]
                        .into_iter()
                        .any(|value| value.as_ref().is_some_and(|text| text.as_str().is_none()))
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_preserve_surrogates_and_nul_in_dom_strings() {
        let data: NodeData = serde_json::from_str(r#"{"kind":3,"value":[55296,0,56320]}"#).unwrap();
        assert_eq!(
            data.value.units().collect::<Vec<_>>(),
            vec![55296, 0, 56320]
        );
        // Supported CSS selectors only inspect CharacterData emptiness, not its Unicode text.
        assert!(!data.has_non_utf8());
        let text: DomString = serde_json::from_str(r#""🦀 & text""#).unwrap();
        assert_eq!(
            String::from_utf16(&text.units().collect::<Vec<_>>()).unwrap(),
            "🦀 & text"
        );
    }

    #[test]
    fn should_compare_exact_code_units_without_normalizing_storage_or_unicode() {
        for text in ["", "ordinary", "é", "e\u{301}", "🦀", "\0"] {
            let utf8 = DomString::Text(text.into());
            let utf16 = DomString::Utf16(text.encode_utf16().collect());
            assert!(utf8.code_units_equal(&utf16));
            assert!(utf16.code_units_equal(&utf8));
            assert!(utf16.code_units_equal_str(text));
        }
        assert!(!DomString::Text("é".into()).code_units_equal_str("e\u{301}"));
        assert!(DomString::Utf16(vec![0xd800]).code_units_equal(&DomString::Utf16(vec![0xd800])));
        assert!(!DomString::Utf16(vec![0xd800]).code_units_equal_str("�"));
        assert!(!DomString::Utf16(vec![0xd800]).code_units_equal(&DomString::Utf16(vec![0xd820])));
    }
}
