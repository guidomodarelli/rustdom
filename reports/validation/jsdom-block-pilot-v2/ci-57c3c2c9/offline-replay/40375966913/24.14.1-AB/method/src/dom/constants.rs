//! DOM protocol values shared by native data consumers.
pub const JS_MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;
pub const HTML_NAMESPACE: &str = "http://www.w3.org/1999/xhtml";
pub const CLASS_ATTRIBUTE_NAME: &str = "class";
pub const ID_ATTRIBUTE_NAME: &str = "id";
pub const NAME_ATTRIBUTE_NAME: &str = "name";
/// jsdom's pinned quirks class matcher folds every UTF-16 unit with this mask.
pub const QUIRKS_CLASS_CASE_MASK: u16 = 0x20;
pub const XMLNS_NAMESPACE: &str = "http://www.w3.org/2000/xmlns/";
pub const XMLNS_NAME: &str = "xmlns";
pub const ELEMENT_NODE: u16 = 1;
pub const ATTRIBUTE_NODE: u16 = 2;
pub const TEXT_NODE: u16 = 3;
pub const CDATA_SECTION_NODE: u16 = 4;
pub const PROCESSING_INSTRUCTION_NODE: u16 = 7;
pub const COMMENT_NODE: u16 = 8;
pub const DOCUMENT_NODE: u16 = 9;
pub const DOCUMENT_TYPE_NODE: u16 = 10;
pub const DOCUMENT_FRAGMENT_NODE: u16 = 11;

/// CharacterData owns arbitrary UTF-16 code units, including unpaired surrogates.
pub fn is_character_data(kind: u16) -> bool {
    matches!(
        kind,
        TEXT_NODE | CDATA_SECTION_NODE | PROCESSING_INSTRUCTION_NODE | COMMENT_NODE
    )
}
