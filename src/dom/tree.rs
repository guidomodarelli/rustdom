//! Node-API adapter for the platform-independent tree store.
use super::{
    attributes,
    constants::{ATTRIBUTE_NODE, ELEMENT_NODE, HTML_NAMESPACE},
    data::{AttributeData, DomString, NodeData},
    error::TreeError,
    queries::{QueryEngine, QueryKind, QueryRequest},
    store,
};
use napi::{
    Error, Result, Status,
    bindgen_prelude::{Float64Array, Utf16String},
};
use napi_derive::napi;

#[napi(object)]
pub struct TreeLinks {
    pub id: f64,
    pub parent: f64,
    pub previous: f64,
    pub next: f64,
    pub first: f64,
    pub last: f64,
    pub child_count: f64,
    pub children_version: u32,
}

impl From<store::TreeLinks> for TreeLinks {
    fn from(links: store::TreeLinks) -> Self {
        Self {
            id: links.id,
            parent: links.parent,
            previous: links.previous,
            next: links.next,
            first: links.first,
            last: links.last,
            child_count: links.child_count,
            children_version: links.children_version,
        }
    }
}

#[napi(object)]
pub struct TreeStatistics {
    pub live_nodes: f64,
    pub capacity: f64,
    pub allocations: f64,
    pub releases: f64,
    pub mutations: f64,
    pub reserved_handles: f64,
    pub data_nodes: f64,
    pub data_updates: f64,
    pub serializations: f64,
    pub native_queries: f64,
    pub query_fallbacks: f64,
    pub selector_cache_hits: f64,
    pub selector_cache_size: u32,
}

/// Query operation vocabulary shared with the JavaScript adapter.
#[napi]
pub enum QueryMode {
    All = 0,
    First = 1,
    Matches = 2,
    Closest = 3,
}

/// Lossless Attr metadata fields shared with the host binding.
#[napi]
pub enum AttributeField {
    Name = 0,
    Namespace = 1,
    Prefix = 2,
    Value = 3,
    QualifiedName = 4,
}

/// Convert errors only at the JavaScript boundary; core tests never need Node symbols.
fn to_napi_error(error: TreeError) -> Error {
    let status = if matches!(&error, TreeError::HandleExhausted) {
        Status::GenericFailure
    } else {
        Status::InvalidArg
    };
    Error::new(status, error.to_string())
}

/// Decode a flat primitive array without allocating a JSON envelope per element.
fn html_data(name: String, attributes: Vec<String>) -> Result<NodeData> {
    if !attributes.len().is_multiple_of(2) {
        return Err(Error::new(
            Status::InvalidArg,
            "NativeTree HTML data: attributes require name/value pairs",
        ));
    }
    let mut pairs = attributes.into_iter();
    let mut data = NodeData {
        kind: ELEMENT_NODE,
        name: Some(DomString::Text(name)),
        namespace: Some(DomString::Text(HTML_NAMESPACE.to_owned())),
        ..NodeData::default()
    };
    while let Some(name) = pairs.next() {
        data.attributes.push(AttributeData {
            name: DomString::Text(name),
            namespace: None,
            prefix: None,
            value: DomString::Text(pairs.next().expect("validated pair")),
        });
    }
    Ok(data)
}

fn simple_data(kind: u16, value: String) -> NodeData {
    NodeData {
        kind,
        value: DomString::Text(value),
        ..NodeData::default()
    }
}

/// Own native topology while JavaScript maintains the corresponding GC ownership edges.
#[napi]
#[derive(Default)]
pub struct NativeTree {
    store: store::TreeStore,
    queries: QueryEngine,
}

#[napi]
impl NativeTree {
    /// Share the canonical allocation policy with JavaScript without duplicating constants.
    #[napi(getter)]
    pub fn handle_batch_size(&self) -> u32 {
        store::HANDLE_BATCH_SIZE as u32
    }

    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            store: store::TreeStore::new(),
            queries: QueryEngine::default(),
        }
    }

    /// Allocate a stable handle that is never reused.
    #[napi]
    pub fn allocate(&mut self) -> Result<f64> {
        self.store.allocate().map_err(to_napi_error)
    }

    /// Reserve a fixed handle batch without retaining nodes for unused entries.
    #[napi]
    pub fn reserve_handles(&mut self) -> Result<f64> {
        self.store.reserve_handles().map_err(to_napi_error)
    }

    /// Store lossless DOM data after private DOM construction or mutation.
    #[napi]
    pub fn set_data(&mut self, handle: f64, encoded: String) -> Result<()> {
        self.store.set_data(handle, &encoded).map_err(to_napi_error)
    }

    /// Avoid JSON construction and decoding for ordinary HTML elements.
    #[napi]
    pub fn set_html_element(
        &mut self,
        handle: f64,
        name: String,
        attributes: Vec<String>,
    ) -> Result<()> {
        self.store
            .replace_data(handle, html_data(name, attributes)?)
            .map_err(to_napi_error)
    }

    /// Plain text, comments and container nodes need no JSON envelope.
    #[napi]
    pub fn set_simple_data(&mut self, handle: f64, kind: u16, value: String) -> Result<()> {
        self.store
            .replace_data(handle, simple_data(kind, value))
            .map_err(to_napi_error)
    }

    /// Initialize canonical Attr metadata from the lossless wire representation.
    #[napi]
    pub fn initialize_attribute(&mut self, handle: f64, encoded: String) -> Result<()> {
        self.store
            .initialize_attribute(handle, &encoded)
            .map_err(to_napi_error)
    }

    /// Common unqualified attributes avoid a JSON envelope on the construction path.
    #[napi]
    pub fn initialize_plain_attribute(
        &mut self,
        handle: f64,
        name: String,
        value: String,
    ) -> Result<()> {
        self.store
            .replace_data(
                handle,
                NodeData {
                    kind: ATTRIBUTE_NODE,
                    name: Some(DomString::Text(name)),
                    value: DomString::Text(value),
                    ..NodeData::default()
                },
            )
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn attribute_field(
        &self,
        handle: f64,
        field: AttributeField,
    ) -> Result<Option<Utf16String>> {
        let field = match field {
            AttributeField::Name => attributes::AttributeField::Name,
            AttributeField::Namespace => attributes::AttributeField::Namespace,
            AttributeField::Prefix => attributes::AttributeField::Prefix,
            AttributeField::Value => attributes::AttributeField::Value,
            AttributeField::QualifiedName => attributes::AttributeField::QualifiedName,
        };
        self.store
            .attribute_field(handle, field)
            .map(|value| value.map(Into::into))
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn set_attribute_value(&mut self, handle: f64, value: Utf16String) -> Result<()> {
        self.store
            .set_attribute_value(handle, &value)
            .map_err(to_napi_error)
    }

    /// Build derived selector/serializer data from canonical Attr records entirely in Rust.
    #[napi]
    pub fn set_element_from_attributes(
        &mut self,
        handle: f64,
        encoded: String,
        attributes: Vec<f64>,
    ) -> Result<()> {
        let data = serde_json::from_str(&encoded)
            .map_err(TreeError::InvalidMetadata)
            .map_err(to_napi_error)?;
        self.store
            .set_element_from_attributes(handle, data, &attributes)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn set_html_element_from_attributes(
        &mut self,
        handle: f64,
        name: String,
        attributes: Vec<f64>,
    ) -> Result<()> {
        self.store
            .set_element_from_attributes(handle, html_data(name, vec![])?, &attributes)
            .map_err(to_napi_error)
    }

    /// Initialize canonical CharacterData without retaining a JavaScript copy.
    #[napi]
    pub fn set_character_data(&mut self, handle: f64, kind: u16, value: Utf16String) -> Result<()> {
        self.store
            .set_character_data(handle, kind, value.to_vec())
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn get_character_data(&self, handle: f64) -> Result<Utf16String> {
        self.store
            .character_data(handle)
            .map(|units| units.to_vec().into())
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn character_length(&self, handle: f64) -> Result<f64> {
        self.store
            .character_length(handle)
            .map(|length| length as f64)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn substring_data(&self, handle: f64, offset: u32, count: u32) -> Result<Utf16String> {
        self.store
            .substring_data(handle, offset, count)
            .map(Into::into)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn replace_character_data(
        &mut self,
        handle: f64,
        offset: u32,
        count: u32,
        value: Utf16String,
    ) -> Result<Utf16String> {
        self.store
            .replace_character_data(handle, offset, count, &value)
            .map(Into::into)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn whole_text(&self, handle: f64) -> Result<Utf16String> {
        self.store
            .whole_text(handle)
            .map(Into::into)
            .map_err(to_napi_error)
    }

    /// Serialize directly from native storage without replacing invalid UTF-16 code units.
    #[napi]
    pub fn serialize_html(
        &mut self,
        handle: f64,
        outer: bool,
        scripting: bool,
    ) -> Result<Utf16String> {
        self.store
            .serialize_html(handle, outer, scripting)
            .map(Into::into)
            .map_err(to_napi_error)
    }

    /// Match supported selectors against live data; None requests compatibility handling.
    #[napi]
    pub fn query(
        &mut self,
        selector: String,
        root: f64,
        document: f64,
        mode: QueryMode,
        quirks: bool,
    ) -> Result<Option<Float64Array>> {
        let kind = match mode {
            QueryMode::All => QueryKind::All,
            QueryMode::First => QueryKind::First,
            QueryMode::Matches => QueryKind::Matches,
            QueryMode::Closest => QueryKind::Closest,
        };
        self.queries
            .query(
                &mut self.store,
                QueryRequest {
                    source: &selector,
                    root,
                    document,
                    kind,
                    quirks,
                },
            )
            .map(|nodes| nodes.map(Into::into))
            .map_err(to_napi_error)
    }

    /// Inspect one authoritative native link record.
    #[napi]
    pub fn get_links(&mut self, handle: f64) -> Result<TreeLinks> {
        self.store
            .get_links(handle)
            .map(Into::into)
            .map_err(to_napi_error)
    }

    /// Append a detached node after validating all affected handles.
    #[napi]
    pub fn append(&mut self, parent: f64, child: f64) -> Result<f64> {
        self.store.append(parent, child).map_err(to_napi_error)
    }

    /// Prepend a detached node without exposing partial mutation on failure.
    #[napi]
    pub fn prepend(&mut self, parent: f64, child: f64) -> Result<f64> {
        self.store.prepend(parent, child).map_err(to_napi_error)
    }

    /// Insert before an existing sibling.
    #[napi]
    pub fn insert_before(&mut self, reference: f64, child: f64) -> Result<f64> {
        self.store
            .insert_before(reference, child)
            .map_err(to_napi_error)
    }

    /// Insert after an existing sibling.
    #[napi]
    pub fn insert_after(&mut self, reference: f64, child: f64) -> Result<f64> {
        self.store
            .insert_after(reference, child)
            .map_err(to_napi_error)
    }

    /// Detach one node while preserving its subtree.
    #[napi]
    pub fn remove(&mut self, handle: f64) -> Result<f64> {
        self.store.remove(handle).map_err(to_napi_error)
    }

    /// Traverse a subtree in preorder using one Node-API call.
    #[napi]
    pub fn descendants(&mut self, handle: f64) -> Result<Vec<f64>> {
        self.store.descendants(handle).map_err(to_napi_error)
    }

    /// Reclaim a collected owner; repeated release is harmless.
    #[napi]
    pub fn release(&mut self, handle: f64) -> Result<bool> {
        self.store.release(handle).map_err(to_napi_error)
    }

    /// Observe allocation and mutation counters without retaining nodes.
    #[napi]
    pub fn statistics(&self) -> TreeStatistics {
        let stats = self.store.statistics();
        TreeStatistics {
            live_nodes: stats.live_nodes,
            capacity: stats.capacity,
            allocations: stats.allocations,
            releases: stats.releases,
            mutations: stats.mutations,
            reserved_handles: stats.reserved_handles,
            data_nodes: stats.data_nodes,
            data_updates: stats.data_updates,
            serializations: stats.serializations,
            native_queries: (self.queries.calls - self.queries.fallbacks) as f64,
            query_fallbacks: self.queries.fallbacks as f64,
            selector_cache_hits: self.queries.cache_hits as f64,
            selector_cache_size: self.queries.cache_size() as u32,
        }
    }
}
