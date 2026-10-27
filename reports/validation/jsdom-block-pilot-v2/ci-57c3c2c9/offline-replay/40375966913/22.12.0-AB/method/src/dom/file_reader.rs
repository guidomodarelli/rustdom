//! FileReader state transitions and complete nonfatal byte decoding.
use encoding_rs::{Encoding, REPLACEMENT, UTF_8, UTF_16BE, UTF_16LE};

#[derive(Clone, Copy, Default, Debug, PartialEq, Eq)]
#[repr(u32)]
pub(super) enum ReadyState {
    #[default]
    Empty = 0,
    Loading = 1,
    Done = 2,
}

#[derive(Default)]
pub(super) struct ReaderState {
    pub ready: ReadyState,
    terminated: bool,
}
impl ReaderState {
    pub fn begin(&mut self) -> bool {
        if self.ready == ReadyState::Loading {
            return false;
        }
        self.ready = ReadyState::Loading;
        true
    }
    pub fn abort(&mut self) -> bool {
        if self.ready == ReadyState::Empty || self.ready == ReadyState::Done {
            return false;
        }
        self.ready = ReadyState::Done;
        self.terminated = true;
        true
    }
    /// The reference uses one shared flag, consumed by whichever scheduled stage runs first.
    pub fn enter_stage(&mut self) -> bool {
        if self.terminated {
            self.terminated = false;
            false
        } else {
            true
        }
    }
    pub fn finish(&mut self) {
        self.ready = ReadyState::Done;
    }
}

pub(super) fn encoding_for_label(label: &str) -> &'static Encoding {
    if label
        .trim_matches(['\t', '\n', '\r', '\u{c}', ' '])
        .eq_ignore_ascii_case("replacement")
    {
        REPLACEMENT
    } else {
        Encoding::for_label(label.as_bytes()).unwrap_or(UTF_8)
    }
}

pub(super) fn decode_text(input: &[u8], label: &str) -> String {
    let fallback = encoding_for_label(label);
    let (encoding, mut data) = Encoding::for_bom(input)
        .map_or((fallback, input), |(encoding, length)| {
            (encoding, &input[length..])
        });
    // @exodus/bytes legacyHookDecode emits a single replacement for an unfinished
    // UTF16 lead surrogate plus an odd final byte, rather than two replacements.
    let mut suffix = false;
    if (encoding == UTF_16LE || encoding == UTF_16BE) && data.len() % 2 != 0 {
        let mut remove = 1;
        if data.len() >= 3 {
            let index = data.len() - 3;
            let unit = if encoding == UTF_16LE {
                u16::from_le_bytes([data[index], data[index + 1]])
            } else {
                u16::from_be_bytes([data[index], data[index + 1]])
            };
            if (0xd800..0xdc00).contains(&unit) {
                remove = 3;
            }
        }
        data = &data[..data.len() - remove];
        suffix = true;
    }
    let (decoded, _) = encoding.decode_without_bom_handling(data);
    let mut result = decoded.into_owned();
    if suffix {
        result.push('\u{fffd}');
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_reject_overlapping_reads_and_consume_shared_abort_once() {
        let mut state = ReaderState::default();
        assert!(!state.abort());
        assert!(state.begin());
        assert!(!state.begin());
        assert!(state.abort());
        assert_eq!(state.ready, ReadyState::Done);
        assert!(state.begin());
        assert!(!state.enter_stage());
        assert!(state.enter_stage());
        state.finish();
        assert_eq!(state.ready, ReadyState::Done);
        assert!(!state.abort());
    }
    #[test]
    fn should_preserve_bom_priority_fallback_and_replacement_encoding() {
        assert_eq!(decode_text(&[0xef, 0xbb, 0xbf, 65], "windows-1252"), "A");
        assert_eq!(decode_text(&[0xff, 0xfe, 65, 0], "utf-8"), "A");
        assert_eq!(decode_text(&[0x80], "windows-1252"), "€");
        assert_eq!(decode_text(b"text", "unknown label"), "text");
        assert_eq!(decode_text(b"text", "replacement"), "\u{fffd}");
        assert_eq!(decode_text(&[], "replacement"), "");
    }
    #[test]
    fn should_match_legacy_utf16_incomplete_suffix_handling() {
        assert_eq!(decode_text(&[0, 0xd8, 0xff], "utf-16le"), "\u{fffd}");
        assert_eq!(decode_text(&[0xd8, 0, 0xff], "utf-16be"), "\u{fffd}");
        assert_eq!(decode_text(&[65, 0, 0xff], "utf-16le"), "A\u{fffd}");
    }
}
