//! UTF-16 input accounting compatible with saxes 6 XML 1.0 mode.
//! Derived behavior: saxes contributors, ISC; see third-party/saxes/LICENSE.
use xmlparser::XmlCharExt;

pub type Text = Vec<u16>;
pub const END: i64 = -1;
pub const NORMALIZED_NEWLINE: i64 = -2;
pub const NON_FINITE: i64 = -3;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct XmlError {
    pub kind: &'static str,
    pub message: Text,
    pub line: usize,
    pub column: usize,
}

pub fn text(value: &str) -> Text {
    value.encode_utf16().collect()
}
pub fn equals(value: &[u16], expected: &str) -> bool {
    value.iter().copied().eq(expected.encode_utf16())
}
pub fn is_space(code: i64) -> bool {
    matches!(code, 9 | 10 | 13 | 32)
}
pub fn is_name_start(code: i64) -> bool {
    u32::try_from(code)
        .ok()
        .and_then(char::from_u32)
        .is_some_and(|character| character.is_xml_name_start())
}
pub fn is_name(code: i64) -> bool {
    u32::try_from(code)
        .ok()
        .and_then(char::from_u32)
        .is_some_and(|character| character.is_xml_name())
}
pub fn is_xml_char(code: u32) -> bool {
    char::from_u32(code).is_some_and(|character| character.is_xml_char())
}
pub fn valid_name(value: &[u16], namespace: bool) -> bool {
    let mut characters = char::decode_utf16(value.iter().copied());
    let Some(Ok(first)) = characters.next() else {
        return false;
    };
    first.is_xml_name_start()
        && (!namespace || first != ':')
        && characters.all(|value| {
            value.is_ok_and(|character| character.is_xml_name() && (!namespace || character != ':'))
        })
}
pub fn scalar(code: i64) -> Option<Text> {
    let value = u32::try_from(code).ok()?;
    if value > 0x10ffff {
        return None;
    }
    if value <= 0xffff {
        Some(vec![value as u16])
    } else {
        let value = value - 0x10000;
        Some(vec![
            0xd800 + (value >> 10) as u16,
            0xdc00 + (value & 0x3ff) as u16,
        ])
    }
}

pub struct Input {
    pub units: Text,
    pub index: usize,
    pub previous: usize,
    pub line: usize,
    pub column: usize,
    pub filename: Option<String>,
}

impl Input {
    pub fn new(units: Text, filename: Option<String>) -> Self {
        Self {
            units,
            index: 0,
            previous: 0,
            line: 1,
            column: 0,
            filename,
        }
    }
    pub fn available(&self) -> bool {
        self.index < self.units.len()
    }
    pub fn error(&self, message: impl AsRef<[u16]>) -> XmlError {
        let prefix = self
            .filename
            .as_ref()
            .filter(|name| !name.is_empty())
            .map_or(String::new(), |name| format!("{name}:"));
        let mut complete = text(&format!("{prefix}{}:{}: ", self.line, self.column));
        complete.extend_from_slice(message.as_ref());
        XmlError {
            kind: "SyntaxError",
            message: complete,
            line: self.line,
            column: self.column,
        }
    }
    pub fn fail(&self, message: &str) -> XmlError {
        self.error(text(message))
    }
    pub fn read(&mut self) -> Result<i64, XmlError> {
        self.previous = self.index;
        let Some(&unit) = self.units.get(self.index) else {
            self.index += 1;
            return Ok(END);
        };
        self.index += 1;
        self.column += 1;
        match unit {
            10 => {
                self.line += 1;
                self.column = 0;
                Ok(10)
            }
            13 => {
                if self.units.get(self.index) == Some(&10) {
                    self.index += 1;
                }
                self.line += 1;
                self.column = 0;
                Ok(NORMALIZED_NEWLINE)
            }
            0xd800..=0xdbff => {
                let following = self.units.get(self.index).copied();
                self.index += 1;
                let Some(following) = following else {
                    return Ok(NON_FINITE);
                };
                let code =
                    0x10000 + (i64::from(unit) - 0xd800) * 0x400 + i64::from(following) - 0xdc00;
                if code > 0x10ffff {
                    Err(self.fail("disallowed character."))
                } else {
                    Ok(code)
                }
            }
            0xdc00..=0xdfff | 0xfffe..=0xffff | 0..=8 | 11..=12 | 14..=31 => {
                Err(self.fail("disallowed character."))
            }
            _ => Ok(i64::from(unit)),
        }
    }
    pub fn normalized(&mut self) -> Result<i64, XmlError> {
        Ok(match self.read()? {
            NORMALIZED_NEWLINE => 10,
            code => code,
        })
    }
    pub fn unread(&mut self) {
        self.index = self.previous;
        self.column -= 1;
    }
    pub fn raw_last(&self) -> &[u16] {
        &self.units[self.previous.min(self.units.len())..self.index.min(self.units.len())]
    }
    pub fn append_scalar(&self, output: &mut Text, code: i64) -> Result<(), XmlError> {
        let Some(value) = scalar(code) else {
            return Err(XmlError {
                kind: "RangeError",
                message: text("Invalid code point NaN"),
                line: self.line,
                column: self.column,
            });
        };
        output.extend(value);
        Ok(())
    }
    pub fn capture(&mut self, output: &mut Text, terminators: &[i64]) -> Result<i64, XmlError> {
        loop {
            let code = self.read()?;
            if code == END {
                return Ok(END);
            }
            let normalized = if code == NORMALIZED_NEWLINE { 10 } else { code };
            if terminators.contains(&normalized) {
                return Ok(normalized);
            }
            if code == NORMALIZED_NEWLINE {
                output.push(10);
            } else {
                output.extend_from_slice(self.raw_last());
            }
        }
    }
    pub fn capture_name(&mut self, output: &mut Text) -> Result<i64, XmlError> {
        loop {
            let code = self.read()?;
            if !is_name(code) {
                return Ok(if code == NORMALIZED_NEWLINE { 10 } else { code });
            }
            output.extend_from_slice(self.raw_last());
        }
    }
    pub fn skip_spaces(&mut self) -> Result<i64, XmlError> {
        loop {
            let code = self.normalized()?;
            if !is_space(code) {
                return Ok(code);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_normalize_newlines_and_count_scalar_columns_over_utf16_offsets() {
        let mut input = Input::new(text("a\r\n😀\rb"), None);
        assert_eq!(input.read().unwrap(), 97);
        assert_eq!(input.read().unwrap(), NORMALIZED_NEWLINE);
        assert_eq!((input.line, input.column, input.index), (2, 0, 3));
        assert_eq!(input.read().unwrap(), 0x1f600);
        assert_eq!((input.column, input.index), (1, 5));
        assert_eq!(input.read().unwrap(), NORMALIZED_NEWLINE);
        assert_eq!(input.read().unwrap(), 98);
        assert_eq!((input.line, input.column), (3, 1));
    }
    #[test]
    fn should_preserve_saxes_surrogate_behavior_and_reject_disallowed_units() {
        let mut input = Input::new(vec![0xd800, 60], None);
        assert_eq!(input.read().unwrap(), 0x243c);
        assert_eq!(input.raw_last(), [0xd800, 60]);
        let mut input = Input::new(vec![0xdc00], Some("file".into()));
        assert_eq!(
            input.read().unwrap_err().message,
            text("file:1:1: disallowed character.")
        );
        assert_eq!(Input::new(vec![0xd800], None).read().unwrap(), NON_FINITE);
    }
}
