//! DOM protocol values shared by native data consumers.
pub const HTML_NAMESPACE: &str = "http://www.w3.org/1999/xhtml";
pub const ELEMENT_NODE: u16 = 1;
pub const ATTRIBUTE_NODE: u16 = 2;
pub const TEXT_NODE: u16 = 3;
pub const CDATA_SECTION_NODE: u16 = 4;
pub const PROCESSING_INSTRUCTION_NODE: u16 = 7;
pub const COMMENT_NODE: u16 = 8;
pub const DOCUMENT_NODE: u16 = 9;
pub const DOCUMENT_TYPE_NODE: u16 = 10;

/// CharacterData owns arbitrary UTF-16 code units, including unpaired surrogates.
pub fn is_character_data(kind: u16) -> bool {
    matches!(
        kind,
        TEXT_NODE | CDATA_SECTION_NODE | PROCESSING_INSTRUCTION_NODE | COMMENT_NODE
    )
}
