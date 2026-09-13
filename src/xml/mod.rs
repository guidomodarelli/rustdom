//! Incremental XML 1.0 compatibility parser. No JavaScript callbacks or owners are retained here.
//! State transitions follow saxes 6 (ISC, third-party/saxes/LICENSE); character classes reuse xmlparser.
mod binding;
mod doctype;
mod input;
use input::{
    END, Input, NORMALIZED_NEWLINE, equals, is_name, is_name_start, is_space, is_xml_char, text,
    valid_name,
};
pub use input::{Text, XmlError};
use rustc_hash::{FxHashMap, FxHashSet};
use std::collections::VecDeque;

const XML_NS: &str = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NS: &str = "http://www.w3.org/2000/xmlns/";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Attribute {
    pub name: Text,
    pub prefix: Text,
    pub local: Text,
    pub value: Text,
    pub uri: Text,
}
#[derive(Clone, Debug, Default)]
pub struct Tag {
    pub name: Text,
    pub prefix: Text,
    pub local: Text,
    pub uri: Text,
    pub attributes: Vec<Attribute>,
    namespaces: FxHashMap<Text, Text>,
    external: FxHashMap<Text, Option<Text>>,
    self_closing: bool,
}

struct OpenFrame {
    name: Text,
    namespaces: FxHashMap<Text, Text>,
}
#[derive(Debug)]
pub enum Event {
    End,
    Text(Text),
    Comment(Text),
    CData(Text),
    Doctype(Text),
    ProcessingInstruction(Text, Text),
    Open(Tag),
    Close(Text),
    ResolvePrefix(Text),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum State {
    Begin,
    BeginWhitespace,
    Text,
    Entity,
    OpenWaka,
    OpenWakaBang,
    Doctype,
    DoctypeQuote,
    Dtd,
    DtdQuoted,
    DtdOpenWaka,
    DtdOpenBang,
    DtdComment,
    DtdCommentEnding,
    DtdCommentEnded,
    DtdPi,
    DtdPiEnding,
    Comment,
    CommentEnding,
    CommentEnded,
    CData,
    CDataEnding,
    CDataEnding2,
    PiFirst,
    PiRest,
    PiBody,
    PiEnding,
    DeclNameStart,
    DeclName,
    DeclEq,
    DeclValueStart,
    DeclValue,
    DeclSeparator,
    DeclEnding,
    OpenTag,
    OpenSlash,
    Attribute,
    AttributeName,
    AttributeNameSpace,
    AttributeValue,
    AttributeQuoted,
    AttributeClosed,
    CloseTag,
    CloseTagSpace,
    ResolveOpen,
}

enum NamespaceResolution {
    Bound(Option<Text>),
    External(Text),
}

pub struct Parser {
    input: Input,
    state: State,
    fragment: bool,
    saw_root: bool,
    closed_root: bool,
    declaration_possible: bool,
    doctype: bool,
    tags: Vec<OpenFrame>,
    tag: Tag,
    buffer: Text,
    name: Text,
    pi_target: Text,
    bang: Text,
    entity: Text,
    entity_return: State,
    quote: i64,
    forbidden: u8,
    declaration_expects: Vec<&'static str>,
    entities: FxHashMap<Text, Text>,
    pending: VecDeque<Event>,
    deferred_error: Option<XmlError>,
    waiting_prefix: Option<Text>,
    ended: bool,
}

impl Parser {
    pub fn new(input: Text, fragment: bool, filename: Option<String>) -> Self {
        Self {
            input: Input::new(input, filename),
            state: if fragment { State::Text } else { State::Begin },
            fragment,
            saw_root: fragment,
            closed_root: fragment,
            declaration_possible: !fragment,
            doctype: false,
            tags: Vec::new(),
            tag: Tag::default(),
            buffer: Vec::new(),
            name: Vec::new(),
            pi_target: Vec::new(),
            bang: Vec::new(),
            entity: Vec::new(),
            entity_return: State::Text,
            quote: 0,
            forbidden: 0,
            declaration_expects: vec!["version"],
            entities: [
                ("amp", "&"),
                ("gt", ">"),
                ("lt", "<"),
                ("quot", "\""),
                ("apos", "'"),
            ]
            .into_iter()
            .map(|(name, value)| (text(name), text(value)))
            .collect(),
            pending: VecDeque::new(),
            deferred_error: None,
            waiting_prefix: None,
            ended: false,
        }
    }
    pub fn set_entity(&mut self, name: Text, value: Text) {
        self.entities.entry(name).or_insert(value);
    }
    pub fn apply_doctype_entities(&mut self, body: &[u16]) -> usize {
        let previous = self.entities.len();
        for entity in doctype::entities(body) {
            self.set_entity(entity.name, entity.value);
        }
        self.entities.len() - previous
    }
    pub fn supply_namespace(&mut self, value: Option<Text>) -> Result<(), XmlError> {
        let Some(prefix) = self.waiting_prefix.take() else {
            return Err(self.input.fail("no namespace resolution is pending."));
        };
        self.tag.external.insert(prefix, value);
        Ok(())
    }
    pub fn next(&mut self) -> Result<Event, XmlError> {
        if let Some(event) = self.pending.pop_front() {
            return Ok(event);
        }
        if let Some(error) = self.deferred_error.take() {
            self.ended = true;
            return Err(error);
        }
        if self.ended {
            return Ok(Event::End);
        }
        if let Some(prefix) = &self.waiting_prefix {
            return Ok(Event::ResolvePrefix(prefix.clone()));
        }
        loop {
            if self.state == State::ResolveOpen {
                let result = self.finalize_open();
                if result.is_err() {
                    self.ended = true;
                }
                return result;
            }
            if !self.input.available() {
                return self.finish();
            }
            match self.step() {
                Ok(Some(event)) => return Ok(event),
                Ok(None) => {}
                Err(error) => {
                    self.ended = true;
                    return Err(error);
                }
            }
        }
    }
    fn finish(&mut self) -> Result<Event, XmlError> {
        self.ended = true;
        if !self.saw_root {
            return Err(self.input.fail("document must contain a root element."));
        }
        if let Some(tag) = self.tags.last() {
            return Err(self.message_parts("unclosed tag: ", &tag.name, ""));
        }
        if !matches!(self.state, State::Begin | State::Text) {
            return Err(self.input.fail("unexpected end."));
        }
        if !self.buffer.is_empty() {
            return Ok(Event::Text(std::mem::take(&mut self.buffer)));
        }
        Ok(Event::End)
    }
    fn message_parts(&self, prefix: &str, value: &[u16], suffix: &str) -> XmlError {
        let mut message = text(prefix);
        message.extend_from_slice(value);
        message.extend(text(suffix));
        self.input.error(message)
    }
    fn append_code(&mut self, code: i64) -> Result<(), XmlError> {
        self.input.append_scalar(&mut self.buffer, code)
    }
    fn qname(&self, name: &[u16]) -> Result<(Text, Text), XmlError> {
        let Some(colon) = name.iter().position(|unit| *unit == 58) else {
            return Ok((Vec::new(), name.to_vec()));
        };
        if colon == 0 || colon + 1 == name.len() || name[colon + 1..].contains(&58) {
            return Err(self.message_parts("malformed name: ", name, "."));
        }
        Ok((name[..colon].to_vec(), name[colon + 1..].to_vec()))
    }
    fn namespace_pair(&self, prefix: &[u16], uri: &[u16]) -> Result<(), XmlError> {
        if equals(prefix, "xml") && !equals(uri, XML_NS) {
            return Err(self
                .input
                .fail(&format!("xml prefix must be bound to {XML_NS}.")));
        }
        if equals(prefix, "xmlns") && !equals(uri, XMLNS_NS) {
            return Err(self
                .input
                .fail(&format!("xmlns prefix must be bound to {XMLNS_NS}.")));
        }
        if equals(uri, XMLNS_NS) {
            return Err(self.input.fail(&if prefix.is_empty() {
                format!("the default namespace may not be set to {XMLNS_NS}.")
            } else {
                format!("may not assign a prefix (even \"xmlns\") to the URI {XMLNS_NS}.")
            }));
        }
        if equals(uri, XML_NS) && !equals(prefix, "xml") {
            return Err(self.input.fail(&if prefix.is_empty() {
                format!("the default namespace may not be set to {XML_NS}.")
            } else {
                "may not assign the xml namespace to another prefix.".into()
            }));
        }
        Ok(())
    }
    fn push_attribute(&mut self) -> Result<(), XmlError> {
        let name = std::mem::take(&mut self.name);
        let value = std::mem::take(&mut self.buffer);
        let (prefix, local) = self.qname(&name)?;
        if equals(&prefix, "xmlns") || equals(&name, "xmlns") {
            let namespace_prefix = if prefix.is_empty() {
                Vec::new()
            } else {
                local.clone()
            };
            let trimmed = trim_js(&value);
            if !prefix.is_empty() && trimmed.is_empty() {
                return Err(self
                    .input
                    .fail("invalid attempt to undefine prefix in XML 1.0"));
            }
            self.namespace_pair(&namespace_prefix, &trimmed)?;
            self.tag.namespaces.insert(namespace_prefix, trimmed);
        }
        self.tag.attributes.push(Attribute {
            name,
            prefix,
            local,
            value,
            uri: Vec::new(),
        });
        Ok(())
    }
    fn namespace(&mut self, prefix: &[u16]) -> NamespaceResolution {
        if let Some(value) = self.tag.namespaces.get(prefix) {
            return NamespaceResolution::Bound(Some(value.clone()));
        }
        for tag in self.tags.iter().rev() {
            if let Some(value) = tag.namespaces.get(prefix) {
                return NamespaceResolution::Bound(Some(value.clone()));
            }
        }
        if equals(prefix, "xml") {
            return NamespaceResolution::Bound(Some(text(XML_NS)));
        }
        if equals(prefix, "xmlns") {
            return NamespaceResolution::Bound(Some(text(XMLNS_NS)));
        }
        if !self.fragment {
            return NamespaceResolution::Bound(None);
        }
        if let Some(value) = self.tag.external.get(prefix) {
            return NamespaceResolution::Bound(value.clone());
        }
        self.waiting_prefix = Some(prefix.to_vec());
        NamespaceResolution::External(prefix.to_vec())
    }
    fn unbound(&self, prefix: &[u16]) -> XmlError {
        self.message_parts("unbound namespace prefix: ", &json_quote(prefix), ".")
    }
    fn finalize_open(&mut self) -> Result<Event, XmlError> {
        let (prefix, local) = self.qname(&self.tag.name)?;
        let uri = match self.namespace(&prefix) {
            NamespaceResolution::Bound(value) => value.unwrap_or_default(),
            NamespaceResolution::External(prefix) => return Ok(Event::ResolvePrefix(prefix)),
        };
        if !prefix.is_empty() {
            if equals(&prefix, "xmlns") {
                return Err(self.input.fail("tags may not have \"xmlns\" as prefix."));
            }
            if uri.is_empty() {
                return Err(self.unbound(&prefix));
            }
        }
        self.tag.prefix = prefix;
        self.tag.local = local;
        self.tag.uri = uri;
        let mut seen = FxHashSet::default();
        for index in 0..self.tag.attributes.len() {
            let attribute = self.tag.attributes[index].clone();
            let (uri, key) = if attribute.prefix.is_empty() {
                (
                    if equals(&attribute.name, "xmlns") {
                        text(XMLNS_NS)
                    } else {
                        Vec::new()
                    },
                    attribute.name.clone(),
                )
            } else {
                let uri = match self.namespace(&attribute.prefix) {
                    NamespaceResolution::Bound(Some(value)) => value,
                    NamespaceResolution::Bound(None) => return Err(self.unbound(&attribute.prefix)),
                    NamespaceResolution::External(prefix) => {
                        return Ok(Event::ResolvePrefix(prefix));
                    }
                };
                let mut key = text("{");
                key.extend_from_slice(&uri);
                key.push(125);
                key.extend_from_slice(&attribute.local);
                (uri, key)
            };
            if !seen.insert(key.clone()) {
                return Err(self.message_parts("duplicate attribute: ", &key, "."));
            }
            self.tag.attributes[index].uri = uri;
        }
        let mut tag = std::mem::take(&mut self.tag);
        self.state = State::Text;
        if tag.self_closing {
            self.pending.push_back(Event::Close(tag.name.clone()));
            if self.tags.is_empty() {
                self.closed_root = true;
            }
        } else {
            self.tags.push(OpenFrame {
                name: tag.name.clone(),
                namespaces: std::mem::take(&mut tag.namespaces),
            });
        }
        Ok(Event::Open(tag))
    }
    fn entity_value(&self, value: &[u16]) -> Result<Text, XmlError> {
        if value.is_empty() {
            return Err(self.input.fail("empty entity name."));
        }
        if value[0] != 35 {
            if let Some(value) = self.entities.get(value) {
                return Ok(value.clone());
            }
            return Err(self.input.fail(if valid_name(value, true) {
                "undefined entity."
            } else {
                "disallowed character in entity name."
            }));
        }
        let (digits, radix) = if value.get(1) == Some(&120) {
            (&value[2..], 16)
        } else {
            (&value[1..], 10)
        };
        let number = if digits.is_empty() {
            None
        } else {
            digits.iter().try_fold(0u32, |number, unit| {
                char::from_u32(u32::from(*unit))
                    .and_then(|character| character.to_digit(radix))
                    .and_then(|digit| number.checked_mul(radix)?.checked_add(digit))
            })
        };
        match number.filter(|number| is_xml_char(*number)) {
            Some(number) => Ok(input::scalar(i64::from(number)).unwrap()),
            None => Err(self.input.fail("malformed character entity.")),
        }
    }
    fn scan_text(&mut self) -> Result<Option<Event>, XmlError> {
        let outside = self.tags.is_empty();
        let mut non_space = false;
        loop {
            let code = self.input.read()?;
            match code {
                60 => {
                    self.state = State::OpenWaka;
                    self.forbidden = 0;
                    break;
                }
                38 => {
                    self.state = State::Entity;
                    self.entity_return = State::Text;
                    self.forbidden = 0;
                    non_space = true;
                    break;
                }
                END => break,
                NORMALIZED_NEWLINE => {
                    self.buffer.push(10);
                    self.forbidden = 0;
                }
                _ => {
                    if outside {
                        non_space |= !is_space(code);
                    } else if code == 93 {
                        self.forbidden = (self.forbidden + 1).min(2);
                    } else {
                        if code == 62 && self.forbidden == 2 {
                            return Err(self
                                .input
                                .fail("the string \"]]>\" is disallowed in char data."));
                        }
                        self.forbidden = 0;
                    }
                    self.buffer.extend_from_slice(self.input.raw_last());
                }
            }
        }
        let outside_error = outside && non_space && !self.fragment;
        if self.state == State::OpenWaka && !self.buffer.is_empty() {
            if outside_error {
                self.deferred_error = Some(self.input.fail("text data outside of root node."));
            }
            return Ok(Some(Event::Text(std::mem::take(&mut self.buffer))));
        }
        if outside_error {
            return Err(self.input.fail("text data outside of root node."));
        }
        Ok(None)
    }
    fn close_tag(&mut self) -> Result<Event, XmlError> {
        self.state = State::Text;
        let name = std::mem::take(&mut self.name);
        if name.is_empty() {
            return Err(self.input.fail("weird empty close tag."));
        }
        let Some(tag) = self.tags.pop() else {
            return Err(self.message_parts("unmatched closing tag: ", &name, "."));
        };
        if tag.name != name {
            self.deferred_error = Some(self.input.fail("unexpected close tag."));
        } else if self.tags.is_empty() {
            self.closed_root = true;
        }
        Ok(Event::Close(tag.name))
    }
    fn step(&mut self) -> Result<Option<Event>, XmlError> {
        use State::*;
        match self.state {
            Begin => {
                if self.input.units.first() == Some(&0xfeff) {
                    self.input.index += 1;
                    self.input.column += 1;
                }
                self.state = BeginWhitespace;
            }
            BeginWhitespace => {
                let before = self.input.index;
                let code = self.input.skip_spaces()?;
                if self.input.previous != before {
                    self.declaration_possible = false;
                }
                if code == 60 {
                    self.state = OpenWaka;
                } else if code != END {
                    self.input.unread();
                    self.state = Text;
                    self.declaration_possible = false;
                }
            }
            Text => return self.scan_text(),
            Entity => {
                if self.input.capture(&mut self.entity, &[59])? == 59 {
                    let value = self.entity_value(&self.entity)?;
                    self.buffer.extend(value);
                    self.entity.clear();
                    self.state = self.entity_return;
                }
            }
            OpenWaka => {
                let code = self.input.read()?;
                if is_name_start(code) {
                    self.state = OpenTag;
                    self.input.unread();
                    self.declaration_possible = false;
                } else {
                    self.state = match code {
                        47 => CloseTag,
                        33 => {
                            self.bang.clear();
                            OpenWakaBang
                        }
                        63 => PiFirst,
                        _ => return Err(self.input.fail("disallowed character in tag name")),
                    };
                    if code != 63 {
                        self.declaration_possible = false;
                    }
                }
            }
            OpenWakaBang => {
                let code = self.input.normalized()?;
                self.input.append_scalar(&mut self.bang, code)?;
                if equals(&self.bang, "--") {
                    self.state = Comment;
                    self.bang.clear();
                } else if equals(&self.bang, "[CDATA[") {
                    if !self.fragment && (!self.saw_root || self.closed_root) {
                        return Err(self.input.fail("text data outside of root node."));
                    }
                    self.state = CData;
                    self.bang.clear();
                } else if equals(&self.bang, "DOCTYPE") {
                    if self.doctype || self.saw_root {
                        return Err(self
                            .input
                            .fail("inappropriately located doctype declaration."));
                    }
                    self.state = Doctype;
                    self.bang.clear();
                } else if self.bang.len() >= 7 {
                    return Err(self.input.fail("incorrect syntax."));
                }
            }
            Doctype => {
                let code = self.input.capture(&mut self.buffer, &[34, 39, 91, 62])?;
                match code {
                    62 => {
                        self.state = Text;
                        self.doctype = true;
                        return Ok(Some(Event::Doctype(std::mem::take(&mut self.buffer))));
                    }
                    END => {}
                    91 => {
                        self.append_code(code)?;
                        self.state = Dtd;
                    }
                    _ => {
                        self.append_code(code)?;
                        self.quote = code;
                        self.state = DoctypeQuote;
                    }
                }
            }
            DoctypeQuote | DtdQuoted => {
                if self.input.capture(&mut self.buffer, &[self.quote])? != END {
                    self.append_code(self.quote)?;
                    self.state = if self.state == DoctypeQuote {
                        Doctype
                    } else {
                        Dtd
                    };
                }
            }
            Dtd => {
                let code = self.input.capture(&mut self.buffer, &[34, 39, 60, 93])?;
                if code != END {
                    self.append_code(code)?;
                    self.state = match code {
                        93 => Doctype,
                        60 => DtdOpenWaka,
                        _ => {
                            self.quote = code;
                            DtdQuoted
                        }
                    };
                }
            }
            DtdOpenWaka => {
                let code = self.input.normalized()?;
                self.append_code(code)?;
                self.state = match code {
                    33 => {
                        self.bang.clear();
                        DtdOpenBang
                    }
                    63 => DtdPi,
                    _ => Dtd,
                };
            }
            DtdOpenBang => {
                let code = self.input.normalized()?;
                self.append_code(code)?;
                self.input.append_scalar(&mut self.bang, code)?;
                if !equals(&self.bang, "-") {
                    self.state = if equals(&self.bang, "--") {
                        DtdComment
                    } else {
                        Dtd
                    };
                    self.bang.clear();
                }
            }
            DtdComment => {
                if self.input.capture(&mut self.buffer, &[45])? != END {
                    self.buffer.push(45);
                    self.state = DtdCommentEnding;
                }
            }
            DtdCommentEnding => {
                let code = self.input.normalized()?;
                self.append_code(code)?;
                self.state = if code == 45 {
                    DtdCommentEnded
                } else {
                    DtdComment
                };
            }
            DtdCommentEnded => {
                let code = self.input.normalized()?;
                self.append_code(code)?;
                if code != 62 {
                    return Err(self.input.fail("malformed comment."));
                }
                self.state = Dtd;
            }
            DtdPi => {
                if self.input.capture(&mut self.buffer, &[63])? != END {
                    self.buffer.push(63);
                    self.state = DtdPiEnding;
                }
            }
            DtdPiEnding => {
                let code = self.input.normalized()?;
                self.append_code(code)?;
                if code == 62 {
                    self.state = Dtd;
                }
            }
            Comment => {
                if self.input.capture(&mut self.buffer, &[45])? != END {
                    self.state = CommentEnding;
                }
            }
            CommentEnding => {
                let code = self.input.normalized()?;
                if code == 45 {
                    self.state = CommentEnded;
                    return Ok(Some(Event::Comment(std::mem::take(&mut self.buffer))));
                }
                self.buffer.push(45);
                self.append_code(code)?;
                self.state = Comment;
            }
            CommentEnded => {
                if self.input.normalized()? != 62 {
                    return Err(self.input.fail("malformed comment."));
                }
                self.state = Text;
            }
            CData => {
                if self.input.capture(&mut self.buffer, &[93])? != END {
                    self.state = CDataEnding;
                }
            }
            CDataEnding => {
                let code = self.input.normalized()?;
                if code == 93 {
                    self.state = CDataEnding2;
                } else {
                    self.buffer.push(93);
                    self.append_code(code)?;
                    self.state = CData;
                }
            }
            CDataEnding2 => {
                let code = self.input.normalized()?;
                if code == 62 {
                    self.state = Text;
                    return Ok(Some(Event::CData(std::mem::take(&mut self.buffer))));
                }
                if code == 93 {
                    self.buffer.push(93);
                } else {
                    self.buffer.extend([93, 93]);
                    self.append_code(code)?;
                    self.state = CData;
                }
            }
            PiFirst => {
                let code = self.input.normalized()?;
                if is_name_start(code) && code != 58 {
                    self.input.append_scalar(&mut self.pi_target, code)?;
                    self.state = PiRest;
                } else {
                    return Err(self.input.fail(if code == 63 || is_space(code) {
                        "processing instruction without a target."
                    } else {
                        "disallowed character in processing instruction name."
                    }));
                }
            }
            PiRest => loop {
                let code = self.input.normalized()?;
                if code == END {
                    break;
                }
                if is_name(code) && code != 58 {
                    self.pi_target.extend_from_slice(self.input.raw_last());
                    continue;
                }
                if code != 63 && !is_space(code) {
                    return Err(self
                        .input
                        .fail("disallowed character in processing instruction name."));
                }
                self.state = if equals(&self.pi_target, "xml") {
                    if !self.declaration_possible {
                        return Err(self
                            .input
                            .fail("an XML declaration must be at the start of the document."));
                    }
                    if code == 63 {
                        DeclEnding
                    } else {
                        DeclNameStart
                    }
                } else if code == 63 {
                    PiEnding
                } else {
                    PiBody
                };
                break;
            },
            PiBody => {
                if self.buffer.is_empty() {
                    let code = self.input.normalized()?;
                    if code == 63 {
                        self.state = PiEnding;
                    } else if !is_space(code) {
                        self.append_code(code)?;
                    }
                } else if self.input.capture(&mut self.buffer, &[63])? != END {
                    self.state = PiEnding;
                }
            }
            PiEnding => {
                let code = self.input.normalized()?;
                self.declaration_possible = false;
                if code == 62 {
                    if String::from_utf16_lossy(&self.pi_target).eq_ignore_ascii_case("xml") {
                        return Err(self.input.fail(
                            "the XML declaration must appear at the start of the document.",
                        ));
                    }
                    self.state = Text;
                    return Ok(Some(Event::ProcessingInstruction(
                        std::mem::take(&mut self.pi_target),
                        std::mem::take(&mut self.buffer),
                    )));
                }
                self.buffer.push(63);
                if code != 63 {
                    self.append_code(code)?;
                    self.state = PiBody;
                }
            }
            DeclNameStart => {
                let code = self.input.skip_spaces()?;
                if code == 63 {
                    self.state = DeclEnding;
                } else if code != END {
                    self.name.clear();
                    self.input.append_scalar(&mut self.name, code)?;
                    self.state = DeclName;
                }
            }
            DeclName => {
                let code = self
                    .input
                    .capture(&mut self.buffer, &[61, 63, 9, 10, 13, 32])?;
                if code == 63 {
                    return Err(self.input.fail("XML declaration is incomplete."));
                }
                if code == 61 || is_space(code) {
                    self.name.append(&mut self.buffer);
                    if !self
                        .declaration_expects
                        .iter()
                        .any(|name| equals(&self.name, name))
                    {
                        return Err(self.input.fail(&match self.name.len() {
                            0 => "did not expect any more name/value pairs.".into(),
                            1 => format!(
                                "expected the name {}.",
                                self.declaration_expects
                                    .first()
                                    .copied()
                                    .unwrap_or("undefined")
                            ),
                            _ => format!("expected one of {}", self.declaration_expects.join(", ")),
                        }));
                    }
                    self.state = if code == 61 { DeclValueStart } else { DeclEq };
                }
            }
            DeclEq | DeclValueStart => {
                let code = self.input.normalized()?;
                if code == 63 {
                    return Err(self.input.fail("XML declaration is incomplete."));
                }
                if is_space(code) {
                    return Ok(None);
                }
                if self.state == DeclEq {
                    if code != 61 {
                        return Err(self.input.fail("value required."));
                    }
                    self.state = DeclValueStart;
                } else {
                    if !matches!(code, 34 | 39) {
                        return Err(self.input.fail("value must be quoted."));
                    }
                    self.quote = code;
                    self.state = DeclValue;
                }
            }
            DeclValue => {
                let code = self.input.capture(&mut self.buffer, &[self.quote, 63])?;
                if code == 63 {
                    return Err(self.input.fail("XML declaration is incomplete."));
                }
                if code == END {
                    return Ok(None);
                }
                let value = std::mem::take(&mut self.buffer);
                if equals(&self.name, "version") {
                    if value.len() < 3
                        || value[..2] != [49, 46]
                        || !value[2..].iter().all(|unit| (48..=57).contains(unit))
                    {
                        return Err(self.input.fail("version number must match /^1\\.[0-9]+$/."));
                    }
                    self.declaration_expects = vec!["encoding", "standalone"];
                } else if equals(&self.name, "encoding") {
                    if !value
                        .first()
                        .is_some_and(|unit| (65..=90).contains(unit) || (97..=122).contains(unit))
                        || !value.iter().all(|unit| {
                            (65..=90).contains(unit)
                                || (97..=122).contains(unit)
                                || (48..=57).contains(unit)
                                || [46, 95, 45].contains(unit)
                        })
                    {
                        return Err(self
                            .input
                            .fail("encoding value must match /^[A-Za-z0-9][A-Za-z0-9._-]*$/."));
                    }
                    self.declaration_expects = vec!["standalone"];
                } else if equals(&self.name, "standalone") {
                    if !equals(&value, "yes") && !equals(&value, "no") {
                        return Err(self
                            .input
                            .fail("standalone value must match \"yes\" or \"no\"."));
                    }
                    self.declaration_expects.clear();
                }
                self.name.clear();
                self.state = DeclSeparator;
            }
            DeclSeparator => {
                let code = self.input.normalized()?;
                if code == 63 {
                    self.state = DeclEnding;
                } else {
                    if !is_space(code) {
                        return Err(self.input.fail("whitespace required."));
                    }
                    self.state = DeclNameStart;
                }
            }
            DeclEnding => {
                if self.input.normalized()? != 62 {
                    return Err(self
                        .input
                        .fail("The character ? is disallowed anywhere in XML declarations."));
                }
                if self.declaration_expects.contains(&"version") {
                    return Err(self.input.fail("XML declaration must contain a version."));
                }
                self.declaration_possible = false;
                self.pi_target.clear();
                self.name.clear();
                self.state = Text;
            }
            OpenTag => {
                let code = self.input.capture_name(&mut self.name)?;
                if code == END {
                    return Ok(None);
                }
                self.tag = Tag {
                    name: std::mem::take(&mut self.name),
                    ..Tag::default()
                };
                self.saw_root = true;
                if !self.fragment && self.closed_root {
                    return Err(self.input.fail("documents may contain only one root."));
                }
                self.state = match code {
                    62 => ResolveOpen,
                    47 => OpenSlash,
                    _ => {
                        if !is_space(code) {
                            return Err(self.input.fail("disallowed character in tag name."));
                        }
                        Attribute
                    }
                };
            }
            OpenSlash => {
                if self.input.read()? != 62 {
                    return Err(self
                        .input
                        .fail("forward-slash in opening tag not followed by >."));
                }
                self.tag.self_closing = true;
                self.state = ResolveOpen;
            }
            Attribute => {
                let code = self.input.skip_spaces()?;
                if code == END {
                    return Ok(None);
                }
                if is_name_start(code) {
                    self.input.unread();
                    self.state = AttributeName;
                } else {
                    self.state = match code {
                        62 => ResolveOpen,
                        47 => OpenSlash,
                        _ => {
                            return Err(self.input.fail("disallowed character in attribute name."));
                        }
                    };
                }
            }
            AttributeName => {
                let code = self.input.capture_name(&mut self.name)?;
                self.state = if code == 61 {
                    AttributeValue
                } else if is_space(code) {
                    AttributeNameSpace
                } else if code == END {
                    AttributeName
                } else {
                    return Err(self.input.fail(if code == 62 {
                        "attribute without value."
                    } else {
                        "disallowed character in attribute name."
                    }));
                };
            }
            AttributeNameSpace => {
                let code = self.input.skip_spaces()?;
                if code != END {
                    if code != 61 {
                        return Err(self.input.fail("attribute without value."));
                    }
                    self.state = AttributeValue;
                }
            }
            AttributeValue => {
                let code = self.input.normalized()?;
                if matches!(code, 34 | 39) {
                    self.quote = code;
                    self.state = AttributeQuoted;
                } else if !is_space(code) {
                    return Err(self.input.fail("unquoted attribute value."));
                }
            }
            AttributeQuoted => loop {
                let code = self.input.read()?;
                if code == self.quote {
                    self.push_attribute()?;
                    self.state = AttributeClosed;
                    break;
                }
                match code {
                    END => break,
                    38 => {
                        self.state = Entity;
                        self.entity_return = AttributeQuoted;
                        break;
                    }
                    10 | NORMALIZED_NEWLINE | 9 => self.buffer.push(32),
                    60 => return Err(self.input.fail("disallowed character.")),
                    _ => self.buffer.extend_from_slice(self.input.raw_last()),
                }
            },
            AttributeClosed => {
                let code = self.input.normalized()?;
                self.state = if is_space(code) {
                    Attribute
                } else {
                    match code {
                        62 => ResolveOpen,
                        47 => OpenSlash,
                        _ => {
                            return Err(self.input.fail(if is_name_start(code) {
                                "no whitespace between attributes."
                            } else {
                                "disallowed character in attribute name."
                            }));
                        }
                    }
                };
            }
            CloseTag => {
                let code = self.input.capture_name(&mut self.name)?;
                if code == 62 {
                    return Ok(Some(self.close_tag()?));
                }
                if is_space(code) {
                    self.state = CloseTagSpace;
                } else if code != END {
                    return Err(self.input.fail("disallowed character in closing tag."));
                }
            }
            CloseTagSpace => match self.input.skip_spaces()? {
                62 => return Ok(Some(self.close_tag()?)),
                END => {}
                _ => return Err(self.input.fail("disallowed character in closing tag.")),
            },
            ResolveOpen => unreachable!(),
        }
        Ok(None)
    }
}

fn trim_js(value: &[u16]) -> Text {
    let space = |unit: &u16| doctype::js_space(*unit);
    let start = value
        .iter()
        .position(|unit| !space(unit))
        .unwrap_or(value.len());
    let end = value
        .iter()
        .rposition(|unit| !space(unit))
        .map_or(start, |index| index + 1);
    value[start..end].to_vec()
}
fn json_quote(value: &[u16]) -> Text {
    let mut output = vec![34];
    let mut index = 0;
    while index < value.len() {
        let unit = value[index];
        if (0xd800..=0xdbff).contains(&unit)
            && value
                .get(index + 1)
                .is_some_and(|low| (0xdc00..=0xdfff).contains(low))
        {
            output.extend_from_slice(&value[index..index + 2]);
            index += 2;
            continue;
        }
        match unit {
            34 | 92 => {
                output.push(92);
                output.push(unit);
            }
            0..=31 | 0xd800..=0xdfff => output.extend(text(&format!("\\u{unit:04x}"))),
            _ => output.push(unit),
        }
        index += 1;
    }
    output.push(34);
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_preserve_namespace_resolution_and_attribute_order() {
        let mut parser = Parser::new(text("<p:r a='x' p:b='y'/>"), true, None);
        assert!(
            matches!(parser.next().unwrap(), Event::ResolvePrefix(prefix) if prefix == text("p"))
        );
        parser.supply_namespace(Some(text("urn:p"))).unwrap();
        let Event::Open(tag) = parser.next().unwrap() else {
            panic!("expected open");
        };
        assert_eq!(tag.name, text("p:r"));
        assert_eq!(tag.uri, text("urn:p"));
        assert_eq!(
            tag.attributes
                .iter()
                .map(|attribute| attribute.name.clone())
                .collect::<Vec<_>>(),
            [text("a"), text("p:b")]
        );
        assert!(tag.attributes[0].uri.is_empty());
        assert_eq!(tag.attributes[1].uri, text("urn:p"));
        assert!(matches!(parser.next().unwrap(), Event::Close(name) if name == text("p:r")));
        assert!(matches!(parser.next().unwrap(), Event::End));
    }
    #[test]
    fn should_emit_comment_and_close_before_the_corresponding_fatal_error() {
        let mut comment = Parser::new(text("<r><!--a--b--></r>"), false, None);
        assert!(matches!(comment.next().unwrap(), Event::Open(_)));
        assert!(matches!(comment.next().unwrap(), Event::Comment(value) if value == text("a")));
        assert_eq!(
            comment.next().unwrap_err().message,
            text("1:11: malformed comment.")
        );
        let mut close = Parser::new(text("<r><a></r>"), false, None);
        close.next().unwrap();
        close.next().unwrap();
        assert!(matches!(close.next().unwrap(), Event::Close(name) if name == text("a")));
        assert_eq!(
            close.next().unwrap_err().message,
            text("1:10: unexpected close tag.")
        );
    }
    #[test]
    fn should_preserve_entity_values_without_recursive_expansion() {
        let mut parser = Parser::new(text("<r>&custom;&#13;&amp;</r>"), false, None);
        parser.set_entity(text("custom"), text("&other;"));
        parser.next().unwrap();
        assert!(
            matches!(parser.next().unwrap(), Event::Text(value) if value == text("&other;\r&"))
        );
        assert!(matches!(parser.next().unwrap(), Event::Close(_)));
    }
}
