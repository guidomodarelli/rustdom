//! Blob text/type rules and slice arithmetic, independent of JavaScript byte-buffer ownership.
pub(super) fn mime_type(value: &[u16]) -> String {
    if value.iter().any(|unit| !(0x20..=0x7e).contains(unit)) {
        return String::new();
    }
    value
        .iter()
        .map(|unit| (*unit as u8).to_ascii_lowercase() as char)
        .collect()
}

pub(super) fn normalize_endings(value: &[u16]) -> Vec<u16> {
    let mut output = Vec::with_capacity(value.len());
    let mut index = 0;
    while index < value.len() {
        if value[index] == 13 {
            output.push(10);
            index += 1;
            if value.get(index) == Some(&10) {
                index += 1;
            }
        } else {
            output.push(value[index]);
            index += 1;
        }
    }
    output
}

fn minimum(left: f64, right: f64) -> f64 {
    if left.is_nan() || right.is_nan() {
        f64::NAN
    } else if left == 0.0 && right == 0.0 {
        if left.is_sign_negative() || right.is_sign_negative() {
            -0.0
        } else {
            0.0
        }
    } else {
        left.min(right)
    }
}
fn maximum(left: f64, right: f64) -> f64 {
    if left.is_nan() || right.is_nan() {
        f64::NAN
    } else if left == 0.0 && right == 0.0 {
        if left.is_sign_negative() && right.is_sign_negative() {
            -0.0
        } else {
            0.0
        }
    } else {
        left.max(right)
    }
}

pub(super) fn slice_range(size: f64, start: Option<f64>, end: Option<f64>) -> (f64, f64) {
    let start = start.map_or(0.0, |value| {
        if value < 0.0 {
            maximum(size + value, 0.0)
        } else {
            minimum(value, size)
        }
    });
    let end = end.map_or(size, |value| {
        if value < 0.0 {
            maximum(size + value, 0.0)
        } else {
            minimum(value, size)
        }
    });
    (start, start + maximum(end - start, 0.0))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn text(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }
    #[test]
    fn should_validate_printable_ascii_and_lowercase_the_complete_mime_type() {
        assert_eq!(
            mime_type(&text(" TEXT/PLAIN; Charset=UTF-8 ")),
            " text/plain; charset=utf-8 "
        );
        for value in ["x\0y", "x\ty", "x\u{7f}y", "é", "🦀"] {
            assert_eq!(mime_type(&text(value)), "");
        }
    }
    #[test]
    fn should_normalize_only_line_endings_and_preserve_other_utf16_units() {
        assert_eq!(
            normalize_endings(&text("a\r\nb\rc\nd\r\r\n")),
            text("a\nb\nc\nd\n\n")
        );
        assert_eq!(
            normalize_endings(&[0xd800, 0, 13, 10, 0xdc00]),
            vec![0xd800, 0, 10, 0xdc00]
        );
    }
    #[test]
    fn should_clamp_slice_endpoints_and_keep_empty_spans_at_the_start() {
        let zero = slice_range(0.0, Some(-0.0), None);
        assert!(zero.0.is_sign_negative());
        assert!(!zero.1.is_sign_negative());
        assert_eq!(slice_range(6.0, None, None), (0.0, 6.0));
        assert_eq!(slice_range(6.0, Some(-3.0), Some(-1.0)), (3.0, 5.0));
        assert_eq!(slice_range(6.0, Some(5.0), Some(1.0)), (5.0, 5.0));
        assert_eq!(slice_range(6.0, Some(-100.0), Some(100.0)), (0.0, 6.0));
        let range = slice_range(6.0, Some(f64::NAN), None);
        assert!(range.0.is_nan() && range.1.is_nan());
    }
}
