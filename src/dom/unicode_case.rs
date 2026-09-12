//! Host-version case data for DOM supported-property-name filtering.
use super::error::{Result, TreeError};

/// Unicode scalar values exclude the surrogate interval.
const SCALAR_COUNT: usize = char::MAX as usize + 1 - 0x800;

/// Pin older hosts to maintained tables instead of the compiler's newer Unicode data.
#[derive(Default)]
pub(crate) enum UnicodeCaseMapping {
    Unicode15,
    Unicode16,
    #[default]
    Native,
    Host(Box<[u32]>),
}

impl UnicodeCaseMapping {
    pub(crate) fn for_version(version: &str) -> Result<Self> {
        let previous = unicode_case_mapping_15::UNICODE_VERSION;
        let compatible = unicode_case_mapping::UNICODE_VERSION;
        let native = std::char::UNICODE_VERSION;
        // Unicode 15.1 and 15.0 have identical lowercase mappings and SpecialCasing
        // records. Reuse 0.5.0's generated 15.0 tables for both host profiles.
        // Sources: unicode-org/unicodetools, unicodetools/data/ucd/{15.0.0,15.1.0}/
        // UnicodeData.txt (lowercase field) and SpecialCasing.txt (all records).
        if version == "15.1" || version == format!("{}.{}", previous.0, previous.1) {
            Ok(Self::Unicode15)
        } else if version == format!("{}.{}", compatible.0, compatible.1) {
            Ok(Self::Unicode16)
        } else if version == format!("{}.{}", native.0, native.1) {
            Ok(Self::Native)
        } else {
            Err(TreeError::UnsupportedUnicodeVersion(
                version.chars().take(16).collect(),
            ))
        }
    }

    /// Decode an owned, non-shared JavaScript ArrayBuffer using host byte order.
    pub(crate) fn from_host_buffer(bytes: &[u8]) -> Result<Self> {
        if !bytes.len().is_multiple_of(size_of::<u32>())
            || bytes.len() / size_of::<u32>() > SCALAR_COUNT
        {
            return Err(TreeError::InvalidUnicodeCaseChanges);
        }
        let changes: Box<[u32]> = bytes
            .as_chunks::<{ size_of::<u32>() }>()
            .0
            .iter()
            .copied()
            .map(u32::from_ne_bytes)
            .collect();
        Self::validate_host_changes(&changes)?;
        Ok(Self::Host(changes))
    }

    fn validate_host_changes(changes: &[u32]) -> Result<()> {
        if changes.len() > SCALAR_COUNT
            || changes
                .iter()
                .any(|&codepoint| char::from_u32(codepoint).is_none())
            || changes.windows(2).any(|pair| pair[0] >= pair[1])
        {
            return Err(TreeError::InvalidUnicodeCaseChanges);
        }
        Ok(())
    }

    pub(crate) fn changes_when_lowercased(&self, character: char) -> bool {
        let mapping = match self {
            Self::Unicode15 => unicode_case_mapping_15::to_lowercase(character),
            Self::Unicode16 => unicode_case_mapping::to_lowercase(character),
            Self::Native => {
                return !character.to_lowercase().eq(std::iter::once(character));
            }
            Self::Host(changes) => return changes.binary_search(&(character as u32)).is_ok(),
        };
        // Generated tables encode identity as either all zeros or the character
        // itself (e.g. sharp s and ligatures from SpecialCasing).
        mapping != [0, 0] && mapping != [character as u32, 0]
    }
}
