//! Node-API event transport for the XML parser; all retained input/state is native.
use super::{Event, Parser, Tag};
use napi::bindgen_prelude::Utf16String;
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static LIVE: AtomicU64 = AtomicU64::new(0);
static CREATED: AtomicU64 = AtomicU64::new(0);
static RELEASED: AtomicU64 = AtomicU64::new(0);
static INPUT_UNITS: AtomicU64 = AtomicU64::new(0);
static EVENTS: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct NativeXmlAttribute {
    pub name: Utf16String,
    pub prefix: Utf16String,
    pub local: Utf16String,
    pub uri: Utf16String,
    pub value: Utf16String,
}
#[napi(object)]
pub struct NativeXmlTag {
    pub name: Utf16String,
    pub prefix: Utf16String,
    pub local: Utf16String,
    pub uri: Utf16String,
    pub attributes: Vec<NativeXmlAttribute>,
}
#[napi(object)]
pub struct NativeXmlEvent {
    pub kind: String,
    pub value: Option<Utf16String>,
    pub target: Option<Utf16String>,
    pub tag: Option<NativeXmlTag>,
    pub error_type: Option<String>,
}
#[napi(object)]
pub struct NativeXmlStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
    pub input_units: f64,
    pub events: f64,
}

#[napi(object)]
pub struct NativeXmlDoctype {
    pub name: Utf16String,
    pub public_id: Utf16String,
    pub system_id: Utf16String,
}

fn tag_output(tag: Tag) -> NativeXmlTag {
    NativeXmlTag {
        name: tag.name.into(),
        prefix: tag.prefix.into(),
        local: tag.local.into(),
        uri: tag.uri.into(),
        attributes: tag
            .attributes
            .into_iter()
            .map(|attribute| NativeXmlAttribute {
                name: attribute.name.into(),
                prefix: attribute.prefix.into(),
                local: attribute.local.into(),
                uri: attribute.uri.into(),
                value: attribute.value.into(),
            })
            .collect(),
    }
}
fn output(kind: &str, value: Option<Vec<u16>>) -> NativeXmlEvent {
    NativeXmlEvent {
        kind: kind.into(),
        value: value.map(Into::into),
        target: None,
        tag: None,
        error_type: None,
    }
}

#[napi]
pub struct NativeXmlParser {
    parser: Option<Parser>,
    input_units: u64,
}
impl Drop for NativeXmlParser {
    fn drop(&mut self) {
        INPUT_UNITS.fetch_sub(self.input_units, Ordering::Relaxed);
        LIVE.fetch_sub(1, Ordering::Relaxed);
        RELEASED.fetch_add(1, Ordering::Relaxed);
    }
}
#[napi]
impl NativeXmlParser {
    #[napi(constructor)]
    pub fn new(input: Utf16String, fragment: bool, filename: Option<String>) -> Self {
        let input_units = input.len() as u64;
        LIVE.fetch_add(1, Ordering::Relaxed);
        CREATED.fetch_add(1, Ordering::Relaxed);
        INPUT_UNITS.fetch_add(input_units, Ordering::Relaxed);
        Self {
            parser: Some(Parser::new(input.to_vec(), fragment, filename)),
            input_units,
        }
    }
    #[napi]
    pub fn next(&mut self) -> NativeXmlEvent {
        let Some(parser) = &mut self.parser else {
            return output("end", None);
        };
        EVENTS.fetch_add(1, Ordering::Relaxed);
        match parser.next() {
            Ok(Event::End) => output("end", None),
            Ok(Event::Text(value)) => output("text", Some(value)),
            Ok(Event::Comment(value)) => output("comment", Some(value)),
            Ok(Event::CData(value)) => output("cdata", Some(value)),
            Ok(Event::Doctype(value)) => output("doctype", Some(value)),
            Ok(Event::ResolvePrefix(value)) => output("resolvePrefix", Some(value)),
            Ok(Event::Close(value)) => output("closetag", Some(value)),
            Ok(Event::Open(tag)) => {
                let mut event = output("opentag", None);
                event.tag = Some(tag_output(tag));
                event
            }
            Ok(Event::ProcessingInstruction(target, body)) => {
                let mut event = output("processinginstruction", Some(body));
                event.target = Some(target.into());
                event
            }
            Err(error) => {
                let mut event = output("error", Some(error.message));
                event.error_type = Some(error.kind.into());
                event
            }
        }
    }
    #[napi]
    pub fn resolve_prefix(&mut self, namespace: Option<Utf16String>) -> NativeXmlEvent {
        let Some(parser) = &mut self.parser else {
            return output("end", None);
        };
        match parser.supply_namespace(namespace.map(|value| value.to_vec())) {
            Ok(()) => output("resolved", None),
            Err(error) => {
                let mut event = output("error", Some(error.message));
                event.error_type = Some(error.kind.into());
                event
            }
        }
    }
    #[napi]
    pub fn set_entity(&mut self, name: Utf16String, value: Utf16String) {
        if let Some(parser) = &mut self.parser {
            parser.set_entity(name.to_vec(), value.to_vec());
        }
    }
    #[napi]
    pub fn describe_doctype(body: Utf16String) -> Option<NativeXmlDoctype> {
        super::doctype::interpret(&body).map(|value| NativeXmlDoctype {
            name: value.name.into(),
            public_id: value.public_id.into(),
            system_id: value.system_id.into(),
        })
    }
    #[napi]
    pub fn apply_doctype_entities(&mut self, body: Utf16String) -> f64 {
        self.parser
            .as_mut()
            .map_or(0, |parser| parser.apply_doctype_entities(&body)) as f64
    }
    #[napi]
    pub fn close(&mut self) {
        self.parser = None;
        INPUT_UNITS.fetch_sub(self.input_units, Ordering::Relaxed);
        self.input_units = 0;
    }
    #[napi]
    pub fn statistics() -> NativeXmlStatistics {
        NativeXmlStatistics {
            live: LIVE.load(Ordering::Relaxed) as f64,
            created: CREATED.load(Ordering::Relaxed) as f64,
            released: RELEASED.load(Ordering::Relaxed) as f64,
            input_units: INPUT_UNITS.load(Ordering::Relaxed) as f64,
            events: EVENTS.load(Ordering::Relaxed) as f64,
        }
    }
}
