//! Iterative XML serialization with live public-property reads and no TreeStore borrow across JavaScript.
//! Observable rules derived from w3c-xmlserializer 5 (MIT; preserved in third-party/w3c-xmlserializer).
use super::{
    XML_NS,
    serialize_host::{CLEANUP_ERRORS, HeldValue, Host, IteratorRecord, LIVE_REFERENCES},
    serialize_namespaces::{self, AttributeContext},
    serialize_text::{
        Escaped, ascii, escape_result, escape_value, pubid, require, xml_chars, xml_name,
    },
};
use crate::dom::constants::{
    ATTRIBUTE_NODE, CDATA_SECTION_NODE, COMMENT_NODE, DOCUMENT_FRAGMENT_NODE, DOCUMENT_NODE,
    DOCUMENT_TYPE_NODE, ELEMENT_NODE, HTML_NAMESPACE, PROCESSING_INSTRUCTION_NODE, TEXT_NODE,
};
use napi::{
    Env, Error, JsValue, Result, Status, ValueType,
    bindgen_prelude::{Array, Either, Unknown, Utf16String},
};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

/// This pinned XML set includes menuitem, unlike the parse5 HTML serializer's set.
const VOID_NAMES: &[&str] = &[
    "area", "base", "basefont", "bgsound", "br", "col", "embed", "frame", "hr", "img", "input",
    "keygen", "link", "menuitem", "meta", "param", "source", "track", "wbr",
];
static LIVE_SERIALIZATIONS: AtomicU64 = AtomicU64::new(0);
static CREATED_SERIALIZATIONS: AtomicU64 = AtomicU64::new(0);

struct RunGuard;
impl Drop for RunGuard {
    fn drop(&mut self) {
        LIVE_SERIALIZATIONS.fetch_sub(1, Ordering::Relaxed);
    }
}

#[napi(object)]
pub struct XmlSerializationStatistics {
    pub live: f64,
    pub created: f64,
    pub references: f64,
    pub cleanup_errors: f64,
}

#[napi]
pub fn xml_serialization_statistics() -> XmlSerializationStatistics {
    XmlSerializationStatistics {
        live: LIVE_SERIALIZATIONS.load(Ordering::Relaxed) as f64,
        created: CREATED_SERIALIZATIONS.load(Ordering::Relaxed) as f64,
        references: LIVE_REFERENCES.load(Ordering::Relaxed) as f64,
        cleanup_errors: CLEANUP_ERRORS.load(Ordering::Relaxed) as f64,
    }
}

/// Serialize the host's fixed root snapshot with a fresh namespace scope for each root.
#[napi]
pub fn serialize_xml_forest(
    env: Env,
    roots: Array,
    require_well_formed: bool,
) -> Result<Utf16String> {
    invoke(env, || {
        let mut output = Vec::new();
        for index in 0..roots.len() {
            env.run_in_scope(|| {
                let root = roots.get::<Unknown>(index)?.ok_or_else(|| {
                    Error::from_reason("XML serialization: snapshot root is missing")
                })?;
                match serialize_value(env, root, require_well_formed)? {
                    Either::A(text) => output.extend_from_slice(&text),
                    Either::B(value) => {
                        output.extend(Host { env: &env }.concat_string(value.value(&env)?)?)
                    }
                }
                Ok(())
            })?;
        }
        Ok(output.into())
    })
}

#[derive(Clone)]
struct Scope {
    namespace: HeldValue,
    prefixes: HeldValue,
}

enum Frame {
    Node {
        node: HeldValue,
        scope: Scope,
    },
    Children {
        iterator: IteratorRecord,
        scope: Scope,
    },
    Close {
        name: HeldValue,
    },
}

struct Serializer {
    env: Env,
    well_formed: bool,
    prefix_index: u64,
    output: Vec<u16>,
    frames: Vec<Frame>,
    dynamic_result: Option<HeldValue>,
}

#[napi]
pub fn serialize_xml(
    env: Env,
    root: Unknown,
    require_well_formed: bool,
) -> Result<Either<Utf16String, HeldValue>> {
    invoke(env, || serialize_value(env, root, require_well_formed))
}

fn invoke<T>(env: Env, operation: impl FnOnce() -> Result<T>) -> Result<T> {
    LIVE_SERIALIZATIONS.fetch_add(1, Ordering::Relaxed);
    CREATED_SERIALIZATIONS.fetch_add(1, Ordering::Relaxed);
    let _guard = RunGuard;
    match operation() {
        Ok(value) => Ok(value),
        Err(error) => {
            // ToNapiValue preserves arbitrary thrown values; the ordinary Result wrapper constructs a JsError.
            env.throw(Host { env: &env }.capture_error(error))?;
            Err(Error::new(
                Status::PendingException,
                "XML serialization failed",
            ))
        }
    }
}

fn serialize_value(
    env: Env,
    root: Unknown,
    require_well_formed: bool,
) -> Result<Either<Utf16String, HeldValue>> {
    let cleanup_before = CLEANUP_ERRORS.load(Ordering::Relaxed);
    let mut serializer = Serializer {
        env,
        well_formed: require_well_formed,
        prefix_index: 1,
        output: Vec::new(),
        frames: Vec::new(),
        dynamic_result: None,
    };
    let result = (|| {
        let host = Host { env: &env };
        let map = host.null_map()?;
        host.set(map, host.text(XML_NS)?, host.array1(host.text("xml")?)?)?;
        serializer.frames.push(Frame::Node {
            node: HeldValue::new(&env, root)?,
            scope: Scope {
                namespace: HeldValue::new(&env, host.null()?)?,
                prefixes: HeldValue::new(&env, map)?,
            },
        });
        while let Some(frame) = serializer.frames.pop() {
            let result = env.run_in_scope(|| serializer.step(frame));
            if let Err(error) = result {
                let mut original = host.capture_error(error);
                for frame in serializer.frames.drain(..).rev() {
                    if let Frame::Children { iterator, .. } = frame {
                        original = host.close_after_error(&iterator, original);
                    }
                }
                return Err(original);
            }
        }
        Ok(())
    })();
    result?;
    require(
        CLEANUP_ERRORS.load(Ordering::Relaxed) == cleanup_before,
        "XML serialization: failed to release temporary Node-API references",
    )?;
    Ok(match serializer.dynamic_result {
        Some(value) => Either::B(value),
        None => Either::A(serializer.output.into()),
    })
}

impl Serializer {
    fn step(&mut self, frame: Frame) -> Result<()> {
        let env = self.env;
        let host = Host { env: &env };
        match frame {
            Frame::Close { name } => {
                ascii(&mut self.output, "</");
                self.output.extend(host.string(name.value(&env)?)?);
                ascii(&mut self.output, ">");
            }
            Frame::Children { iterator, scope } => {
                if let Some(child) = iterator.next(&host)? {
                    let child = HeldValue::new(&env, child)?;
                    self.frames.push(Frame::Children {
                        iterator,
                        scope: scope.clone(),
                    });
                    self.frames.push(Frame::Node { node: child, scope });
                }
            }
            Frame::Node { node, scope } => self.node(&host, node.value(&env)?, scope)?,
        }
        Ok(())
    }

    fn children(&mut self, host: &Host, node: Unknown, scope: Scope) -> Result<()> {
        let iterator = IteratorRecord::new(host, host.get(node, "childNodes")?)?;
        self.frames.push(Frame::Children { iterator, scope });
        Ok(())
    }

    fn node(&mut self, host: &Host, node: Unknown, scope: Scope) -> Result<()> {
        let kind = host.get(node, "nodeType")?;
        let kind = if kind.get_type()? == ValueType::Number {
            kind.coerce_to_number()?.get_double()?
        } else {
            f64::NAN
        };
        require(
            kind == f64::from(kind as u16),
            "Failed to serialize XML: only Nodes can be serialized.",
        )?;
        match kind as u16 {
            ELEMENT_NODE => self.element(host, node, scope),
            DOCUMENT_NODE => {
                if self.well_formed {
                    require(
                        !host.is_null(host.get(node, "documentElement")?)?,
                        "Failed to serialize XML: document does not have a document element.",
                    )?;
                }
                self.children(host, node, scope)
            }
            DOCUMENT_FRAGMENT_NODE => self.children(host, node, scope),
            ATTRIBUTE_NODE => Ok(()),
            TEXT_NODE => {
                if self.well_formed {
                    require(
                        xml_chars(&host.string(host.get(node, "data")?)?),
                        "Failed to serialize XML: text node data is not well-formed.",
                    )?;
                }
                match escape_result(host, host.get(node, "data")?, false)? {
                    Escaped::Text(value) => self.output.extend(value),
                    Escaped::Dynamic(value) => {
                        if self.frames.is_empty() {
                            self.dynamic_result = Some(HeldValue::new(host.env, value)?);
                        } else {
                            self.output.extend(host.concat_string(value)?);
                        }
                    }
                }
                Ok(())
            }
            COMMENT_NODE => {
                if self.well_formed {
                    require(
                        xml_chars(&host.string(host.get(node, "data")?)?),
                        "Failed to serialize XML: comment node data is not well-formed.",
                    )?;
                    let invalid = host
                        .method1(
                            host.get(node, "data")?,
                            "includes",
                            host.text("--")?,
                            "node.data.includes is not a function",
                        )?
                        .coerce_to_bool()?
                        || host
                            .method1(
                                host.get(node, "data")?,
                                "endsWith",
                                host.text("-")?,
                                "node.data.endsWith is not a function",
                            )?
                            .coerce_to_bool()?;
                    require(
                        !invalid,
                        "Failed to serialize XML: found hyphens in illegal places in comment node data.",
                    )?;
                }
                ascii(&mut self.output, "<!--");
                self.output.extend(host.string(host.get(node, "data")?)?);
                ascii(&mut self.output, "-->");
                Ok(())
            }
            CDATA_SECTION_NODE => {
                ascii(&mut self.output, "<![CDATA[");
                self.output.extend(host.string(host.get(node, "data")?)?);
                ascii(&mut self.output, "]]>");
                Ok(())
            }
            PROCESSING_INSTRUCTION_NODE => self.processing_instruction(host, node),
            DOCUMENT_TYPE_NODE => self.doctype(host, node),
            _ => require(
                false,
                "Failed to serialize XML: only Nodes can be serialized.",
            ),
        }
    }

    fn doctype(&mut self, host: &Host, node: Unknown) -> Result<()> {
        if self.well_formed {
            require(
                pubid(&host.string(host.get(node, "publicId")?)?),
                "Failed to serialize XML: document type node publicId is not well-formed.",
            )?;
            let invalid = !xml_chars(&host.string(host.get(node, "systemId")?)?)
                || (host
                    .method1(
                        host.get(node, "systemId")?,
                        "includes",
                        host.text("\"")?,
                        "node.systemId.includes is not a function",
                    )?
                    .coerce_to_bool()?
                    && host
                        .method1(
                            host.get(node, "systemId")?,
                            "includes",
                            host.text("'")?,
                            "node.systemId.includes is not a function",
                        )?
                        .coerce_to_bool()?);
            require(
                !invalid,
                "Failed to serialize XML: document type node systemId is not well-formed.",
            )?;
        }
        ascii(&mut self.output, "<!DOCTYPE ");
        self.output.extend(host.string(host.get(node, "name")?)?);
        if !host.equals_text(host.get(node, "publicId")?, "")? {
            ascii(&mut self.output, " PUBLIC \"");
            self.output
                .extend(host.string(host.get(node, "publicId")?)?);
            ascii(&mut self.output, "\"");
        } else if !host.equals_text(host.get(node, "systemId")?, "")? {
            ascii(&mut self.output, " SYSTEM");
        }
        if !host.equals_text(host.get(node, "systemId")?, "")? {
            ascii(&mut self.output, " \"");
            self.output
                .extend(host.string(host.get(node, "systemId")?)?);
            ascii(&mut self.output, "\"");
        }
        ascii(&mut self.output, ">");
        Ok(())
    }

    fn processing_instruction(&mut self, host: &Host, node: Unknown) -> Result<()> {
        if self.well_formed {
            let invalid = host
                .method1(
                    host.get(node, "target")?,
                    "includes",
                    host.text(":")?,
                    "node.target.includes is not a function",
                )?
                .coerce_to_bool()?
                || ascii_xml_target(host, host.get(node, "target")?)?;
            require(
                !invalid,
                "Failed to serialize XML: processing instruction node target is not well-formed.",
            )?;
            let invalid = !xml_chars(&host.string(host.get(node, "data")?)?)
                || host
                    .method1(
                        host.get(node, "data")?,
                        "includes",
                        host.text("?>")?,
                        "node.data.includes is not a function",
                    )?
                    .coerce_to_bool()?;
            require(
                !invalid,
                "Failed to serialize XML: processing instruction node data is not well-formed.",
            )?;
        }
        ascii(&mut self.output, "<?");
        self.output.extend(host.string(host.get(node, "target")?)?);
        ascii(&mut self.output, " ");
        self.output.extend(host.string(host.get(node, "data")?)?);
        ascii(&mut self.output, "?>");
        Ok(())
    }

    fn element(&mut self, host: &Host, node: Unknown, scope: Scope) -> Result<()> {
        if self.well_formed {
            let invalid = host
                .method1(
                    host.get(node, "localName")?,
                    "includes",
                    host.text(":")?,
                    "node.localName.includes is not a function",
                )?
                .coerce_to_bool()?
                || !xml_name(&host.string(host.get(node, "localName")?)?);
            require(
                !invalid,
                "Failed to serialize XML: element node localName is not a valid XML name.",
            )?;
        }
        ascii(&mut self.output, "<");
        let map = host.spread(scope.prefixes.value(host.env)?)?;
        let local_prefixes = host.null_map()?;
        let local_default = serialize_namespaces::record(host, node, map, local_prefixes)?;
        let mut inherited = scope.namespace.value(host.env)?;
        let namespace = host.get(node, "namespaceURI")?;
        let mut ignore_default = false;
        let qualified;
        if host.equals(inherited, namespace)? {
            if !host.is_null(local_default)? {
                ignore_default = true;
            }
            qualified = if host.equals_text(namespace, XML_NS)? {
                qualified_name(host, host.text("xml")?, host.get(node, "localName")?)?
            } else {
                host.get(node, "localName")?
            };
            self.output.extend(host.concat_string(qualified)?);
        } else {
            let mut prefix = host.get(node, "prefix")?;
            let mut candidate = serialize_namespaces::preferred(host, map, namespace, prefix)?;
            if host.equals_text(prefix, "xmlns")? {
                require(
                    !self.well_formed,
                    "Failed to serialize XML: element nodes can't have a prefix of \"xmlns\".",
                )?;
                candidate = host.text("xmlns")?;
            }
            if !host.is_null(candidate)? {
                qualified = qualified_name(host, candidate, host.get(node, "localName")?)?;
                if !host.is_null(local_default)? && !host.equals_text(local_default, XML_NS)? {
                    inherited = empty_to_null(host, local_default)?;
                }
                self.output.extend(host.concat_string(qualified)?);
            } else if !host.is_null(prefix)? {
                if host.has(local_prefixes, prefix)? {
                    prefix = serialize_namespaces::generate(
                        host,
                        map,
                        namespace,
                        &mut self.prefix_index,
                    )?;
                }
                if host.key(map, namespace)?.coerce_to_bool()? {
                    host.method1(
                        host.key(map, namespace)?,
                        "push",
                        prefix,
                        "map[ns].push is not a function",
                    )?;
                } else {
                    host.set(map, namespace, host.array1(prefix)?)?;
                }
                qualified = qualified_name(host, prefix, host.get(node, "localName")?)?;
                self.output.extend(host.string(qualified)?);
                ascii(&mut self.output, " xmlns:");
                self.output.extend(host.string(prefix)?);
                ascii(&mut self.output, "=\"");
                self.output.extend(escape_value(host, namespace, true)?);
                ascii(&mut self.output, "\"");
                if !host.is_null(local_default)? {
                    inherited = empty_to_null(host, local_default)?;
                }
            } else if host.is_null(local_default)? || !host.equals(local_default, namespace)? {
                ignore_default = true;
                qualified = host.get(node, "localName")?;
                inherited = namespace;
                self.output.extend(host.string(qualified)?);
                ascii(&mut self.output, " xmlns=\"");
                self.output.extend(escape_value(host, namespace, true)?);
                ascii(&mut self.output, "\"");
            } else {
                qualified = host.get(node, "localName")?;
                inherited = namespace;
                self.output.extend(host.concat_string(qualified)?);
            }
        }
        serialize_namespaces::attributes(
            host,
            node,
            AttributeContext {
                map,
                local_prefixes,
                ignore_default,
                well_formed: self.well_formed,
            },
            &mut self.prefix_index,
            &mut self.output,
        )?;
        let is_html = host.equals_text(namespace, HTML_NAMESPACE)?;
        if is_html
            && host.equals(
                host.get(host.get(node, "childNodes")?, "length")?,
                host.number(0)?,
            )?
            && is_void(host, host.get(node, "localName")?)?
        {
            ascii(&mut self.output, " />");
            return Ok(());
        } else if !is_html
            && host.equals(
                host.get(host.get(node, "childNodes")?, "length")?,
                host.number(0)?,
            )?
        {
            ascii(&mut self.output, "/>");
            return Ok(());
        }
        ascii(&mut self.output, ">");
        let child_scope = Scope {
            namespace: HeldValue::new(host.env, inherited)?,
            prefixes: HeldValue::new(host.env, map)?,
        };
        self.frames.push(Frame::Close {
            name: HeldValue::new(host.env, qualified)?,
        });
        if is_html && host.equals_text(host.get(node, "localName")?, "template")? {
            self.frames.push(Frame::Node {
                node: HeldValue::new(host.env, host.get(node, "content")?)?,
                scope: child_scope,
            });
        } else {
            self.children(host, node, child_scope)?;
        }
        Ok(())
    }
}

fn empty_to_null<'env>(host: &Host<'env>, value: Unknown<'env>) -> Result<Unknown<'env>> {
    if host.equals_text(value, "")? {
        host.null()
    } else {
        Ok(value)
    }
}
fn qualified_name<'env>(
    host: &Host<'env>,
    prefix: Unknown,
    local: Unknown,
) -> Result<Unknown<'env>> {
    let mut value = host.string(prefix)?;
    value.push(u16::from(b':'));
    value.extend(host.string(local)?);
    host.units(&value)
}
fn is_void(host: &Host, name: Unknown) -> Result<bool> {
    for candidate in VOID_NAMES {
        if host.equals_text(name, candidate)? {
            return Ok(true);
        }
    }
    Ok(false)
}
fn ascii_xml_target(host: &Host, target: Unknown) -> Result<bool> {
    if !host.equals(host.get(target, "length")?, host.number(3)?)? {
        return Ok(false);
    }
    for (index, expected) in b"xml".iter().enumerate() {
        let actual = host
            .method1(
                target,
                "charCodeAt",
                host.number(index as u32)?,
                "a.charCodeAt is not a function",
            )?
            .coerce_to_number()?
            .get_int32()?;
        if (actual | 32) != (i32::from(*expected) | 32) {
            return Ok(false);
        }
    }
    Ok(true)
}
