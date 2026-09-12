//! Domain errors that do not depend on a Node.js runtime or JavaScript references.
use std::fmt;

#[derive(Debug)]
pub enum TreeError {
    InvalidHandle,
    UnknownHandle(u64),
    AlreadyAttached(u64),
    SelfSibling(u64),
    Cycle(u64),
    HandleExhausted,
    InvalidMetadata(serde_json::Error),
    MissingData(u64),
    NotCharacterData(u64),
    NotAttribute(u64),
    NotElement(u64),
    NotDocumentType(u64),
    NotProcessingInstruction(u64),
    AttributeInUse(u64),
    AttributeCollectionInitialized(u64),
    UnsupportedUnicodeVersion(String),
    InvalidUnicodeCaseChanges,
    CharacterOffset { offset: u32, length: usize },
}

pub type Result<T> = std::result::Result<T, TreeError>;

impl fmt::Display for TreeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotDocumentType(id) => write!(
                formatter,
                "NativeTree: node {id} is not an initialized DocumentType"
            ),
            Self::NotProcessingInstruction(id) => write!(
                formatter,
                "NativeTree: node {id} is not an initialized ProcessingInstruction"
            ),
            Self::InvalidUnicodeCaseChanges => write!(
                formatter,
                "NativeTree: host Unicode case changes require an attached buffer of complete, strictly increasing valid u32 scalar values"
            ),
            Self::AttributeCollectionInitialized(id) => write!(
                formatter,
                "NativeTree: attribute collection for element {id} is initialized; use element metadata and attribute mutation APIs instead of a snapshot"
            ),
            Self::UnsupportedUnicodeVersion(version) => write!(
                formatter,
                "NativeTree: unsupported host Unicode version {version}"
            ),
            Self::NotElement(id) => write!(
                formatter,
                "NativeTree: node {id} is not an initialized Element"
            ),
            Self::AttributeInUse(id) => write!(
                formatter,
                "NativeTree: attribute {id} is already referenced by an element"
            ),
            Self::NotCharacterData(id) => {
                write!(formatter, "NativeTree: node {id} is not CharacterData")
            }
            Self::NotAttribute(id) => write!(
                formatter,
                "NativeTree: node {id} is not an initialized Attr"
            ),
            Self::CharacterOffset { offset, length } => write!(
                formatter,
                "NativeTree: CharacterData offset {offset} exceeds UTF-16 length {length}"
            ),
            Self::InvalidMetadata(_) => {
                write!(formatter, "NativeTree: invalid node metadata payload")
            }
            Self::MissingData(id) => write!(
                formatter,
                "NativeTree: metadata for node {id} is not initialized"
            ),
            Self::InvalidHandle => write!(
                formatter,
                "NativeTree: node handle must be a positive safe integer"
            ),
            Self::UnknownHandle(id) => write!(formatter, "NativeTree: unknown node handle {id}"),
            Self::AlreadyAttached(id) => write!(
                formatter,
                "NativeTree: remove attached node {id} before inserting it"
            ),
            Self::SelfSibling(id) => {
                write!(formatter, "NativeTree: node {id} cannot be its own sibling")
            }
            Self::Cycle(id) => write!(
                formatter,
                "NativeTree: inserting node {id} would create a cycle"
            ),
            Self::HandleExhausted => {
                write!(formatter, "NativeTree: safe node handle space exhausted")
            }
        }
    }
}

impl std::error::Error for TreeError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::InvalidMetadata(error) => Some(error),
            _ => None,
        }
    }
}
