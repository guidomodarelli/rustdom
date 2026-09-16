//! DOMImplementation decisions over UTF-16 values, without host references.
use super::constants::HTML_NAMESPACE;
use crate::xml::valid_xml_name;

const SVG_NAMESPACE: &str = "http://www.w3.org/2000/svg";

pub(super) fn content_type(namespace: Option<&[u16]>) -> &'static str {
    let matches = |expected: &str| {
        namespace.is_some_and(|actual| actual.iter().copied().eq(expected.encode_utf16()))
    };
    if matches(HTML_NAMESPACE) {
        "application/xhtml+xml"
    } else if matches(SVG_NAMESPACE) {
        "image/svg+xml"
    } else {
        "application/xml"
    }
}

pub(super) fn valid_qualified_name(name: &[u16]) -> bool {
    let mut parts = name.split(|unit| *unit == u16::from(b':'));
    if !valid_xml_name(parts.next().unwrap_or_default(), true) {
        return false;
    }
    match parts.next() {
        None => true,
        Some(local) => valid_xml_name(local, true) && parts.next().is_none(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_validate_both_qname_components_and_utf16_scalar_boundaries() {
        for name in ["node", "prefix:node", "_root", "é:node", "𐀀:𐀁"] {
            assert!(valid_qualified_name(
                &name.encode_utf16().collect::<Vec<_>>()
            ));
        }
        for name in [
            "", ":node", "node:", "a:b:c", "1node", "a:1node", "a b", "a/b",
        ] {
            assert!(!valid_qualified_name(
                &name.encode_utf16().collect::<Vec<_>>()
            ));
        }
        for name in [vec![0xd800], vec![0xdc00], vec![0xdb80, 0xdc00]] {
            assert!(!valid_qualified_name(&name));
        }
    }

    #[test]
    fn should_select_content_type_using_exact_namespace_values() {
        let html: Vec<u16> = HTML_NAMESPACE.encode_utf16().collect();
        let svg: Vec<u16> = SVG_NAMESPACE.encode_utf16().collect();
        assert_eq!(content_type(Some(&html)), "application/xhtml+xml");
        assert_eq!(content_type(Some(&svg)), "image/svg+xml");
        assert_eq!(content_type(None), "application/xml");
        assert_eq!(content_type(Some(&[])), "application/xml");
        assert_eq!(content_type(Some(&[0xd800])), "application/xml");
        assert_eq!(
            content_type(Some(
                &"HTTP://www.w3.org/1999/xhtml"
                    .encode_utf16()
                    .collect::<Vec<_>>()
            )),
            "application/xml"
        );
    }
}
