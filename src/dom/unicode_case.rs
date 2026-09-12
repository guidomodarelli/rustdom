//! Host-version case data for DOM supported-property-name filtering.
use super::error::{Result, TreeError};

/// Pin older hosts to maintained tables instead of the compiler's newer Unicode data.
#[derive(Clone, Copy, Default)]
pub(crate) enum UnicodeCaseMapping {
    Unicode15,
    Unicode16,
    #[default]
    Native,
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

    pub(crate) fn changes_when_lowercased(self, character: char) -> bool {
        let mapping = match self {
            Self::Unicode15 => unicode_case_mapping_15::to_lowercase(character),
            Self::Unicode16 => unicode_case_mapping::to_lowercase(character),
            Self::Native => {
                return !character.to_lowercase().eq(std::iter::once(character));
            }
        };
        // Generated tables encode identity as either all zeros or the character
        // itself (e.g. sharp s and ligatures from SpecialCasing).
        mapping != [0, 0] && mapping != [character as u32, 0]
    }
}
