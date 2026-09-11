//! Domain errors that do not depend on a Node.js runtime or JavaScript references.
use std::fmt;

#[derive(Debug, PartialEq, Eq)]
pub enum TreeError {
    InvalidHandle,
    UnknownHandle(u64),
    AlreadyAttached(u64),
    SelfSibling(u64),
    Cycle(u64),
    HandleExhausted,
}

pub type Result<T> = std::result::Result<T, TreeError>;

impl fmt::Display for TreeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
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

impl std::error::Error for TreeError {}
