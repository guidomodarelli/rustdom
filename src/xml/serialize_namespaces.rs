//! Namespace and attribute control preserving w3c-xmlserializer's shallow maps and read order.
use super::{
    XML_NS, XMLNS_NS,
    serialize_host::{Host, IteratorRecord},
    serialize_text::{ascii, escape_value, require, xml_name},
};
use napi::{JsValue, Result, bindgen_prelude::Unknown};

pub(super) fn preferred<'env>(
    host: &Host<'env>,
    map: Unknown,
    namespace: Unknown<'env>,
    prefix: Unknown<'env>,
) -> Result<Unknown<'env>> {
    let candidates = host.key(map, namespace)?;
    if !candidates.coerce_to_bool()? {
        return host.null();
    }
    if host
        .method1(
            candidates,
            "includes",
            prefix,
            "candidateList.includes is not a function",
        )?
        .coerce_to_bool()?
    {
        return Ok(prefix);
    }
    let length = host
        .get(candidates, "length")?
        .coerce_to_number()?
        .get_double()?;
    host.key(candidates, host.float(length - 1.0)?)
}

pub(super) fn generate<'env>(
    host: &Host<'env>,
    map: Unknown,
    namespace: Unknown,
    index: &mut u64,
) -> Result<Unknown<'env>> {
    let prefix = host.text(&format!("ns{}", *index))?;
    *index += 1;
    host.set(map, namespace, host.array1(prefix)?)?;
    Ok(prefix)
}

pub(super) fn record<'env>(
    host: &Host<'env>,
    element: Unknown,
    map: Unknown,
    local_prefixes: Unknown,
) -> Result<Unknown<'env>> {
    let mut default_namespace = host.null()?;
    let mut index = 0;
    loop {
        let length = host
            .get(host.get(element, "attributes")?, "length")?
            .coerce_to_number()?
            .get_double()?;
        if f64::from(index) >= length || length.is_nan() {
            break;
        }
        let attribute = host.key(host.get(element, "attributes")?, host.number(index)?)?;
        index += 1;
        if !host.equals_text(host.get(attribute, "namespaceURI")?, XMLNS_NS)? {
            continue;
        }
        if host.is_null(host.get(attribute, "prefix")?)? {
            default_namespace = host.get(attribute, "value")?;
            continue;
        }
        let mut namespace = host.get(attribute, "value")?;
        if host.equals_text(namespace, XML_NS)? {
            continue;
        }
        if host.is_null(namespace)? {
            namespace = host.text("")?;
        }
        if host.has(map, namespace)?
            && host
                .method1(
                    host.key(map, namespace)?,
                    "includes",
                    host.get(attribute, "localName")?,
                    "map[namespaceDefinition].includes is not a function",
                )?
                .coerce_to_bool()?
        {
            continue;
        }
        if !host.has(map, namespace)? {
            host.set(map, namespace, host.env.create_array(0)?.to_unknown())?;
        }
        host.method1(
            host.key(map, namespace)?,
            "push",
            host.get(attribute, "localName")?,
            "map[namespaceDefinition].push is not a function",
        )?;
        host.set(local_prefixes, host.get(attribute, "localName")?, namespace)?;
    }
    Ok(default_namespace)
}

#[derive(Clone, Copy)]
pub(super) struct AttributeContext<'env> {
    pub map: Unknown<'env>,
    pub local_prefixes: Unknown<'env>,
    pub ignore_default: bool,
    pub well_formed: bool,
}

pub(super) fn attributes(
    host: &Host,
    element: Unknown,
    context: AttributeContext,
    prefix_index: &mut u64,
    output: &mut Vec<u16>,
) -> Result<()> {
    let seen = host.null_map()?;
    let iterator = IteratorRecord::new(host, host.get(element, "attributes")?)?;
    while let Some(attribute) = iterator.next(host)? {
        let result = attribute_one(host, attribute, context, seen, prefix_index, output);
        if let Err(error) = result {
            return Err(host.close_after_error(&iterator, error));
        }
    }
    Ok(())
}

fn attribute_one(
    host: &Host,
    attribute: Unknown,
    context: AttributeContext,
    seen: Unknown,
    prefix_index: &mut u64,
    output: &mut Vec<u16>,
) -> Result<()> {
    let AttributeContext {
        map,
        local_prefixes,
        ignore_default,
        well_formed,
    } = context;
    if well_formed {
        let existing = host.key(seen, host.get(attribute, "namespaceURI")?)?;
        if existing.coerce_to_bool()?
            && host
                .method1(
                    host.key(seen, host.get(attribute, "namespaceURI")?)?,
                    "has",
                    host.get(attribute, "localName")?,
                    "namespaceLocalnames[attr.namespaceURI].has is not a function",
                )?
                .coerce_to_bool()?
        {
            require(false, "Found duplicated attribute")?;
        }
    }
    if !host
        .key(seen, host.get(attribute, "namespaceURI")?)?
        .coerce_to_bool()?
    {
        let namespace = host.get(attribute, "namespaceURI")?;
        host.set(seen, namespace, host.new_set()?)?;
    }
    host.method1(
        host.key(seen, host.get(attribute, "namespaceURI")?)?,
        "add",
        host.get(attribute, "localName")?,
        "namespaceLocalnames[attr.namespaceURI].add is not a function",
    )?;
    let namespace = host.get(attribute, "namespaceURI")?;
    let mut prefix = host.null()?;
    if !host.is_null(namespace)? {
        prefix = preferred(host, map, namespace, host.get(attribute, "prefix")?)?;
        if host.equals_text(namespace, XMLNS_NS)? {
            if host.equals_text(host.get(attribute, "value")?, XML_NS)? {
                return Ok(());
            }
            if host.is_null(host.get(attribute, "prefix")?)? && ignore_default {
                return Ok(());
            }
            if !host.is_null(host.get(attribute, "prefix")?)? {
                let local = host.key(local_prefixes, host.get(attribute, "localName")?)?;
                if !host.equals(local, host.get(attribute, "value")?)?
                    && host
                        .method1(
                            host.key(map, host.get(attribute, "value")?)?,
                            "includes",
                            host.get(attribute, "localName")?,
                            "map[attr.value].includes is not a function",
                        )?
                        .coerce_to_bool()?
                {
                    return Ok(());
                }
            }
            if well_formed && host.equals_text(host.get(attribute, "value")?, XMLNS_NS)? {
                require(
                    false,
                    "The XMLNS namespace is reserved and cannot be applied as an element's namespace via XML parsing",
                )?;
            }
            if well_formed && host.equals_text(host.get(attribute, "value")?, "")? {
                require(
                    false,
                    "Namespace prefix declarations cannot be used to undeclare a namespace",
                )?;
            }
            if host.equals_text(host.get(attribute, "prefix")?, "xmlns")? {
                prefix = host.text("xmlns")?;
            }
        } else if host.is_null(prefix)? {
            prefix = generate(host, map, namespace, prefix_index)?;
            ascii(output, " xmlns:");
            output.extend(host.string(prefix)?);
            ascii(output, "=\"");
            output.extend(escape_value(host, namespace, true)?);
            ascii(output, "\"");
        }
    }
    ascii(output, " ");
    if !host.is_null(prefix)? {
        output.extend(host.string(prefix)?);
        ascii(output, ":");
    }
    if well_formed {
        let includes = host
            .method1(
                host.get(attribute, "localName")?,
                "includes",
                host.text(":")?,
                "attr.localName.includes is not a function",
            )?
            .coerce_to_bool()?;
        let invalid = includes
            || !xml_name(&host.string(host.get(attribute, "localName")?)?)
            || (host.equals_text(host.get(attribute, "localName")?, "xmlns")?
                && host.is_null(namespace)?);
        require(!invalid, "Invalid attribute localName value")?;
    }
    output.extend(host.string(host.get(attribute, "localName")?)?);
    ascii(output, "=\"");
    output.extend(escape_value(host, host.get(attribute, "value")?, true)?);
    ascii(output, "\"");
    Ok(())
}
