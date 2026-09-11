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
}

pub type Result<T> = std::result::Result<T, TreeError>;

impl fmt::Display for TreeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
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
