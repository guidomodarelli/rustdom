//! Pinned jsdom XML-driver doctype/entity interpretation with non-anchored matching.
use super::input::{Text, text};

#[derive(Debug, PartialEq, Eq)]
pub struct Doctype {
    pub name: Text,
    pub public_id: Text,
    pub system_id: Text,
}
#[derive(Debug, PartialEq, Eq)]
pub struct Entity {
    pub name: Text,
    pub value: Text,
}

pub fn js_space(unit: u16) -> bool {
    matches!(unit, 9..=13 | 32 | 0xa0 | 0x1680 | 0x2000..=0x200a | 0x2028 | 0x2029 | 0x202f | 0x205f | 0x3000 | 0xfeff)
}
fn ascii_lower(unit: u16) -> u16 {
    if (65..=90).contains(&unit) {
        unit + 32
    } else {
        unit
    }
}
fn matches(input: &[u16], offset: usize, pattern: &str, insensitive: bool) -> bool {
    input
        .get(offset..offset + pattern.len())
        .is_some_and(|units| {
            units.iter().zip(pattern.bytes()).all(|(unit, byte)| {
                if insensitive {
                    ascii_lower(*unit) == u16::from(byte.to_ascii_lowercase())
                } else {
                    *unit == u16::from(byte)
                }
            })
        })
}
fn whitespace(input: &[u16], offset: usize) -> Option<usize> {
    let mut cursor = offset;
    while input.get(cursor).is_some_and(|unit| js_space(*unit)) {
        cursor += 1;
    }
    (cursor > offset).then_some(cursor)
}
fn quoted(input: &[u16], offset: usize) -> Option<(Text, usize)> {
    if input.get(offset) != Some(&34) {
        return None;
    }
    let start = offset + 1;
    let end = start + input.get(start..)?.iter().position(|unit| *unit == 34)?;
    (end > start).then(|| (input[start..end].to_vec(), end + 1))
}
fn identifier(input: &[u16], offset: usize, custom: bool) -> Option<(Text, usize)> {
    let mut end = offset;
    while input
        .get(end)
        .is_some_and(|unit| !js_space(*unit) && (!custom || *unit != 62))
    {
        end += 1;
    }
    (end > offset).then(|| (input[offset..end].to_vec(), end))
}
fn external(input: &[u16], offset: usize, public: bool) -> Option<Doctype> {
    let start = whitespace(input, offset + "<!doctype".len())?;
    let (name, end) = identifier(input, start, false)?;
    let keyword_start = whitespace(input, end)?;
    let keyword = if public { "public" } else { "system" };
    if !matches(input, keyword_start, keyword, true) {
        return None;
    }
    let value_start = whitespace(input, keyword_start + keyword.len())?;
    let (first, end) = quoted(input, value_start)?;
    if public {
        let next = whitespace(input, end)?;
        let (system_id, _) = quoted(input, next)?;
        Some(Doctype {
            name,
            public_id: first,
            system_id,
        })
    } else {
        Some(Doctype {
            name,
            public_id: Vec::new(),
            system_id: first,
        })
    }
}

pub fn interpret(body: &[u16]) -> Option<Doctype> {
    let mut input = text("<!doctype ");
    input.extend_from_slice(body);
    input.push(62);
    if (0..input.len()).any(|offset| matches(&input, offset, "<!doctype html>", true)) {
        return Some(Doctype {
            name: text("html"),
            public_id: Vec::new(),
            system_id: Vec::new(),
        });
    }
    let starts: Vec<_> = (0..input.len())
        .filter(|offset| matches(&input, *offset, "<!doctype", true))
        .collect();
    for public in [true, false] {
        for offset in &starts {
            if let Some(value) = external(&input, *offset, public) {
                return Some(value);
            }
        }
    }
    for offset in starts {
        if let Some(start) = whitespace(&input, offset + "<!doctype".len())
            && let Some((name, _)) = identifier(&input, start, true)
        {
            return Some(Doctype {
                name,
                public_id: Vec::new(),
                system_id: Vec::new(),
            });
        }
    }
    None
}

pub fn entities(body: &[u16]) -> Vec<Entity> {
    let mut result = Vec::new();
    let mut cursor = 0;
    while cursor < body.len() {
        if !matches(body, cursor, "<!ENTITY ", false) {
            cursor += 1;
            continue;
        }
        let name_start = cursor + "<!ENTITY ".len();
        let mut name_end = name_start;
        while body.get(name_end).is_some_and(|unit| *unit != 32) {
            name_end += 1;
        }
        if name_end > name_start
            && body.get(name_end) == Some(&32)
            && let Some((value, after_quote)) = quoted(body, name_end + 1)
            && body.get(after_quote) == Some(&62)
        {
            result.push(Entity {
                name: body[name_start..name_end].to_vec(),
                value,
            });
            cursor = after_quote + 1;
            continue;
        }
        cursor += 1;
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_preserve_priority_quotes_whitespace_and_embedded_matches() {
        assert_eq!(interpret(&text(" HTML")).unwrap().name, text("HTML"));
        assert_eq!(
            interpret(&text(" r PUBLIC \"p\" \"s\"")).unwrap(),
            Doctype {
                name: text("r"),
                public_id: text("p"),
                system_id: text("s")
            }
        );
        assert_eq!(
            interpret(&text(" r PUBLIC '' 's'")).unwrap().public_id,
            Vec::<u16>::new()
        );
        assert_eq!(
            interpret(&text(" r SYSTEM \"\"")).unwrap().system_id,
            Vec::<u16>::new()
        );
        assert_eq!(
            interpret(&text(" r [<!ENTITY e \"<!doctype html>\">]"))
                .unwrap()
                .name,
            text("html")
        );
        assert_eq!(
            interpret(&text("\u{0085}r PUBLIC \"p\" \"s\""))
                .unwrap()
                .name,
            text("\u{0085}r")
        );
        assert_eq!(
            interpret(&text("\u{FEFF}r PUBLIC \"p\" \"s\""))
                .unwrap()
                .name,
            text("r")
        );
        assert_eq!(interpret(&text("   ")), None);
    }
    #[test]
    fn should_extract_only_exact_nonempty_entity_patterns_in_order() {
        let body = text(
            "<!ENTITY e \"first\"><!ENTITY e \"second\"><!ENTITY e ''><!ENTITY empty \"\"><!ENTITY bad! \"x\"><!entity lower \"y\"><!ENTITY spaced \"z\" >",
        );
        assert_eq!(
            entities(&body),
            [
                Entity {
                    name: text("e"),
                    value: text("first")
                },
                Entity {
                    name: text("e"),
                    value: text("second")
                },
                Entity {
                    name: text("bad!"),
                    value: text("x")
                }
            ]
        );
    }
}
