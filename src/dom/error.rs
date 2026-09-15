//! Domain errors that do not depend on a Node.js runtime or JavaScript references.
use std::fmt;

#[derive(Debug)]
pub enum TreeError {
    InvalidHandle,
    InvalidMutationRecordType,
    UninitializedRange,
    RangeContentProtocol(&'static str),
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
    NotDocumentFragment(u64),
    NotSlotable(u64),
    NotSlot(u64),
    SlotFlattenCycle(u64),
    SlotAssignmentProtocol(&'static str),
    NotProcessingInstruction(u64),
    AttributeInUse(u64),
    AttributeCollectionInitialized(u64),
    NonEmptyAttributeSnapshot(u64),
    UnsupportedUnicodeVersion(String),
    InvalidUnicodeCaseChanges,
    CharacterOffset { offset: u32, length: usize },
}

pub type Result<T> = std::result::Result<T, TreeError>;

impl fmt::Display for TreeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidMutationRecordType => write!(
                formatter,
                "NativeMutationRecord: kind must be attributes, characterData, or childList"
            ),
            Self::SlotAssignmentProtocol(reason) => {
                write!(formatter, "NativeSlotAssignmentDriver: {reason}")
            }
            Self::NotSlot(id) => write!(
                formatter,
                "NativeTree: node {id} must be an initialized HTML slot for assignment state"
            ),
            Self::SlotFlattenCycle(id) => write!(
                formatter,
                "NativeTree.findFlattenedSlotables: cycle involving node {id}"
            ),
            Self::RangeContentProtocol(reason) => write!(formatter, "NativeRangeContent: {reason}"),
            Self::UninitializedRange => write!(
                formatter,
                "NativeRange: the requested boundary is not initialized"
            ),
            Self::NotDocumentType(id) => write!(
                formatter,
                "NativeTree: node {id} is not an initialized DocumentType"
            ),
            Self::NotProcessingInstruction(id) => write!(
                formatter,
                "NativeTree: node {id} is not an initialized ProcessingInstruction"
            ),
            Self::NonEmptyAttributeSnapshot(id) => write!(
                formatter,
                "NativeTree: element {id} contains snapshot attributes; cannot initialize a canonical attribute collection from a nonempty snapshot"
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
            Self::NotDocumentFragment(id) => write!(
                formatter,
                "NativeTree: node {id} is not a DocumentFragment host root"
            ),
            Self::NotSlotable(id) => write!(
                formatter,
                "NativeTree: node {id} must be an initialized Element or Text for slotable-name state"
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
