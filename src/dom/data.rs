//! DOM data keeps well-formed strings compact and preserves isolated UTF-16 surrogates.
use super::constants::is_character_data;
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
#[serde(untagged)]
pub enum DomString {
    Text(String),
    Utf16(Vec<u16>),
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
            Self::Utf16(_) => None,
        }
    }
    pub fn is_empty(&self) -> bool {
        match self {
            Self::Text(value) => value.is_empty(),
            Self::Utf16(value) => value.is_empty(),
        }
    }
    pub fn units(&self) -> Units<'_> {
        match self {
            Self::Text(value) => Units::Text(value.encode_utf16()),
            Self::Utf16(value) => Units::Utf16(value.iter().copied()),
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
pub struct NodeData {
    pub kind: u16,
    pub name: Option<DomString>,
    pub namespace: Option<DomString>,
    pub prefix: Option<DomString>,
    pub value: DomString,
    pub attributes: Vec<AttributeData>,
    pub template_content: f64,
    pub is_value: Option<DomString>,
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
}
