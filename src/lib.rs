//! Parse HTML once in Rust and transfer a flat instruction tape across Node-API.
//! The JavaScript adapter owns browser objects; no JavaScript callbacks occur here.

mod dom;
mod xml;

use html5ever::interface::QuirksMode;
use html5ever::{ParseOpts, QualName, parse_document, parse_fragment, tendril::TendrilSink};
use markup5ever_rcdom::{Handle, NodeData, RcDom};
use napi_derive::napi;
use serde::Serialize;

/// Pinned html5ever 0.39 diagnostic for text foster-parenting (rules.rs, InTableText).
/// jsdom 27's adapter differs from the HTML5 tree here, so preserve its behavior.
const FOSTER_PARENTING_DIAGNOSTIC: &str = "Non-space table text";

/// Transfer a context attribute without losing XML namespaces or prefixes.
#[napi(object)]
pub struct ContextAttribute {
    pub name: String,
    pub value: String,
    pub namespace: Option<String>,
    pub prefix: Option<String>,
}

/// Keep traversal iterative so deeply nested input does not exhaust the call stack.
enum Visit {
    Node(Handle),
    Close,
    Template(Handle),
}

/// Borrow attribute strings while serializing one event; no intermediate JSON object tree.
#[derive(Serialize)]
struct TapeAttribute<'a> {
    name: &'a str,
    value: &'a str,
    namespace: &'a str,
    prefix: Option<&'a str>,
}

fn write_event(output: &mut Vec<u8>, first: &mut bool, event: &impl Serialize) {
    if !*first {
        output.push(b',');
    }
    *first = false;
    serde_json::to_writer(output, event).expect("serializing borrowed DOM data to memory");
}

/// Convert a completed HTML5 tree to an ordered tape, including inert templates.
fn encode(dom: RcDom, fragment: bool) -> String {
    let mut fallback_reason = dom
        .errors
        .borrow()
        .iter()
        .any(|error| error.as_ref() == FOSTER_PARENTING_DIAGNOSTIC)
        .then_some("table-foster-parenting");
    let mode = match dom.quirks_mode.get() {
        QuirksMode::NoQuirks => "no-quirks",
        QuirksMode::LimitedQuirks => "limited-quirks",
        QuirksMode::Quirks => "quirks",
    };
    let root = if fragment {
        dom.document.children.borrow()[0].clone()
    } else {
        dom.document.clone()
    };
    let mut pending: Vec<Visit> = root
        .children
        .borrow()
        .iter()
        .rev()
        .map(|node| Visit::Node(node.clone()))
        .collect();
    let mut output = b"{\"events\":[".to_vec();
    let mut first_event = true;
    while let Some(visit) = pending.pop() {
        let node = match visit {
            Visit::Close => {
                write_event(&mut output, &mut first_event, &["close"]);
                continue;
            }
            Visit::Template(contents) => {
                write_event(&mut output, &mut first_event, &["template"]);
                pending.push(Visit::Close);
                pending.extend(
                    contents
                        .children
                        .borrow()
                        .iter()
                        .rev()
                        .map(|child| Visit::Node(child.clone())),
                );
                continue;
            }
            Visit::Node(node) => node,
        };
        match &node.data {
            NodeData::Element {
                name,
                attrs,
                template_contents,
                ..
            } => {
                // html5ever supports customizable selects; pinned jsdom 27 still
                // uses the legacy insertion mode, including ignored child tags.
                if name.ns.as_ref() == "http://www.w3.org/1999/xhtml"
                    && name.local.as_ref() == "select"
                {
                    fallback_reason.get_or_insert("legacy-select");
                }
                let borrowed_attributes = attrs.borrow();
                let attributes: Vec<TapeAttribute<'_>> = borrowed_attributes
                    .iter()
                    .map(|attribute| TapeAttribute {
                        name: attribute.name.local.as_ref(),
                        value: attribute.value.as_ref(),
                        namespace: attribute.name.ns.as_ref(),
                        prefix: attribute.name.prefix.as_ref().map(|prefix| prefix.as_ref()),
                    })
                    .collect();
                write_event(
                    &mut output,
                    &mut first_event,
                    &("element", name.local.as_ref(), name.ns.as_ref(), attributes),
                );
                pending.push(Visit::Close);
                if let Some(contents) = template_contents.borrow().as_ref() {
                    pending.push(Visit::Template(contents.clone()));
                }
                pending.extend(
                    node.children
                        .borrow()
                        .iter()
                        .rev()
                        .map(|child| Visit::Node(child.clone())),
                );
            }
            NodeData::Text { contents } => write_event(
                &mut output,
                &mut first_event,
                &["text", contents.borrow().as_ref()],
            ),
            NodeData::Comment { contents } => write_event(
                &mut output,
                &mut first_event,
                &["comment", contents.as_ref()],
            ),
            NodeData::Doctype {
                name,
                public_id,
                system_id,
            } => write_event(
                &mut output,
                &mut first_event,
                &[
                    "doctype",
                    name.as_ref(),
                    public_id.as_ref(),
                    system_id.as_ref(),
                ],
            ),
            NodeData::Document | NodeData::ProcessingInstruction { .. } => {}
        }
    }
    output.extend_from_slice(b"],\"mode\":");
    serde_json::to_writer(&mut output, &mode).expect("serializing static document mode");
    output.extend_from_slice(b",\"fallbackReason\":");
    serde_json::to_writer(&mut output, &fallback_reason)
        .expect("serializing static fallback reason");
    output.push(b'}');
    String::from_utf8(output).expect("JSON serializer emits UTF-8")
}

/// Parse an HTML document with scripting disabled, matching ordinary jsdom input.
#[napi]
pub fn parse_document_tape(markup: String) -> String {
    let mut options = ParseOpts::default();
    options.tree_builder.scripting_enabled = false;
    encode(parse_document(RcDom::default(), options).one(markup), false)
}

/// Parse a fragment using the actual context name, namespace, and attributes.
#[napi]
pub fn parse_fragment_tape(
    markup: String,
    local_name: String,
    namespace: String,
    attributes: Vec<ContextAttribute>,
    scripting_enabled: bool,
) -> String {
    let context_name = QualName::new(None, namespace.into(), local_name.into());
    let context_attributes = attributes
        .into_iter()
        .map(|attribute| html5ever::Attribute {
            name: QualName::new(
                attribute.prefix.map(Into::into),
                attribute.namespace.unwrap_or_default().into(),
                attribute.name.into(),
            ),
            value: attribute.value.into(),
        })
        .collect();
    let mut options = ParseOpts::default();
    options.tree_builder.scripting_enabled = scripting_enabled;
    encode(
        parse_fragment(
            RcDom::default(),
            options,
            context_name,
            context_attributes,
            scripting_enabled,
        )
        .one(markup),
        true,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    #[test]
    fn should_decode_entities_and_repair_tables_when_parsing_html() {
        let tape: Value = serde_json::from_str(&parse_document_tape(
            "<!doctype html><table><tr><td>A&amp;B</table>".into(),
        ))
        .unwrap();
        let events = tape["events"].as_array().unwrap();
        assert!(events.iter().any(|event| event[1] == "tbody"));
        assert!(events.iter().any(|event| event == &json!(["text", "A&B"])));
        assert_eq!(tape["mode"], "no-quirks");
    }

    #[test]
    fn should_preserve_template_contents_when_encoding_a_fragment() {
        let tape: Value = serde_json::from_str(&parse_fragment_tape(
            "<template><b>inert</b></template>".into(),
            "div".into(),
            "http://www.w3.org/1999/xhtml".into(),
            vec![],
            false,
        ))
        .unwrap();
        assert!(
            tape["events"]
                .as_array()
                .unwrap()
                .contains(&json!(["template"]))
        );
        assert!(
            tape["events"]
                .as_array()
                .unwrap()
                .contains(&json!(["text", "inert"]))
        );
    }

    #[test]
    fn should_handle_deep_trees_without_recursive_encoding() {
        let markup = format!("{}text{}", "<div>".repeat(10_000), "</div>".repeat(10_000));
        let tape: Value = serde_json::from_str(&parse_document_tape(markup)).unwrap();
        assert!(
            tape["events"]
                .as_array()
                .unwrap()
                .contains(&json!(["text", "text"]))
        );
    }
}
