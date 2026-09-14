//! Lossless XML escaping and XML 1.0 checks reused by the observable-property serializer.
use super::{
    input::{is_xml_char, valid_name},
    serialize_host::Host,
};
use napi::{Error, Result, ValueType, bindgen_prelude::Unknown};

pub(super) fn ascii(output: &mut Vec<u16>, value: &str) {
    output.extend(value.bytes().map(u16::from));
}

pub(super) fn escaped(value: &[u16], attribute: bool) -> Vec<u16> {
    let mut output = Vec::with_capacity(value.len());
    for unit in value {
        match unit {
            0x26 => ascii(&mut output, "&amp;"),
            0x3c => ascii(&mut output, "&lt;"),
            0x3e => ascii(&mut output, "&gt;"),
            0x22 if attribute => ascii(&mut output, "&quot;"),
            0x09 if attribute => ascii(&mut output, "&#x9;"),
            0x0a if attribute => ascii(&mut output, "&#xA;"),
            0x0d if attribute => ascii(&mut output, "&#xD;"),
            _ => output.push(*unit),
        }
    }
    output
}

pub(super) fn xml_chars(value: &[u16]) -> bool {
    char::decode_utf16(value.iter().copied())
        .all(|character| character.is_ok_and(|character| is_xml_char(character as u32)))
}
pub(super) fn xml_name(value: &[u16]) -> bool {
    valid_name(value, false)
}
pub(super) fn pubid(value: &[u16]) -> bool {
    value.iter().all(|unit| {
        matches!(unit, 0x20 | 0x0d | 0x0a | 0x41..=0x5a | 0x61..=0x7a | 0x30..=0x39)
            || "-'()+,./:=?;!*#@$_%"
                .bytes()
                .any(|allowed| *unit == u16::from(allowed))
    })
}

pub(super) enum Escaped<'env> {
    Text(Vec<u16>),
    Dynamic(Unknown<'env>),
}

/// Preserve custom replacement methods and their uncoerced result.
pub(super) fn escape_result<'env>(
    host: &Host<'env>,
    value: Unknown<'env>,
    attribute: bool,
) -> Result<Escaped<'env>> {
    if attribute && host.is_null(value)? {
        return Ok(Escaped::Text(Vec::new()));
    }
    if value.get_type()? == ValueType::String {
        return Ok(Escaped::Text(escaped(&host.string(value)?, attribute)));
    }
    let mut value = value;
    let replacements: &[(&str, &str)] = if attribute {
        &[
            ("/&/ug", "&amp;"),
            ("/\"/ug", "&quot;"),
            ("/</ug", "&lt;"),
            ("/>/ug", "&gt;"),
            ("/\\t/ug", "&#x9;"),
            ("/\\n/ug", "&#xA;"),
            ("/\\r/ug", "&#xD;"),
        ]
    } else {
        &[("/&/ug", "&amp;"), ("/</ug", "&lt;"), ("/>/ug", "&gt;")]
    };
    for (index, (pattern, replacement)) in replacements.iter().enumerate() {
        let method = host.get(value, "replace")?;
        let regex: Unknown = host.env.run_script(*pattern)?;
        let failure = if index == 0 {
            if attribute {
                "value.replace is not a function"
            } else {
                "node.data.replace is not a function"
            }
        } else {
            "value.replace is not a function"
        };
        value = host.call2(value, method, regex, host.text(replacement)?, failure)?;
    }
    Ok(Escaped::Dynamic(value))
}

/// Attribute interpolation uses the string hint; a root Text result can instead be returned unchanged.
pub(super) fn escape_value<'env>(
    host: &Host<'env>,
    value: Unknown<'env>,
    attribute: bool,
) -> Result<Vec<u16>> {
    match escape_result(host, value, attribute)? {
        Escaped::Text(value) => Ok(value),
        Escaped::Dynamic(value) => host.string(value),
    }
}

pub(super) fn require(condition: bool, message: &str) -> Result<()> {
    if condition {
        Ok(())
    } else {
        Err(Error::from_reason(message))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_escape_xml_without_replacing_isolated_utf16_units() {
        assert_eq!(
            escaped(&[0xd800, 38, 60, 62, 34, 9, 10, 13, 0xdc00], false),
            [
                vec![0xd800],
                "&amp;&lt;&gt;\"\t\n\r".encode_utf16().collect(),
                vec![0xdc00]
            ]
            .concat()
        );
        assert_eq!(
            escaped(&"<&>\"\t\n\r".encode_utf16().collect::<Vec<_>>(), true),
            "&lt;&amp;&gt;&quot;&#x9;&#xA;&#xD;"
                .encode_utf16()
                .collect::<Vec<_>>()
        );
    }
    #[test]
    fn should_distinguish_xml_character_name_and_public_identifier_rules() {
        assert!(xml_chars(&"🦀\t\n".encode_utf16().collect::<Vec<_>>()));
        assert!(!xml_chars(&[0xd800]));
        assert!(!xml_chars(&[0]));
        assert!(xml_name(&"p:valid".encode_utf16().collect::<Vec<_>>()));
        assert!(!xml_name(&"1invalid".encode_utf16().collect::<Vec<_>>()));
        assert!(pubid(&"a/b + c".encode_utf16().collect::<Vec<_>>()));
        assert!(!pubid(&[0x22]));
    }
}
