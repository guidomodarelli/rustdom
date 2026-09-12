//! Node-API adapter for the platform-independent tree store.
use super::{
    attributes,
    constants::{ATTRIBUTE_NODE, ELEMENT_NODE, HTML_NAMESPACE},
    data::{AttributeData, DomString, NodeData},
    error::TreeError,
    node_metadata,
    node_text::NodeText,
    queries::{QueryEngine, QueryKind, QueryRequest},
    store,
};
use napi::{
    Error, JsValue, Result, Status,
    bindgen_prelude::{ArrayBuffer, Either, Float64Array, Unknown, Utf16String},
};
use napi_derive::napi;

/// Node-API copies borrowed UTF-8 directly into V8; preserve isolated UTF-16 units on the fallback.
fn string_result(value: Option<&DomString>) -> Option<Either<&str, Utf16String>> {
    value.map(|value| match value {
        DomString::Text(value) => Either::A(value.as_str()),
        DomString::Utf16(value) => Either::B(value.clone().into()),
    })
}

/// A transient read-only plan; the binding preserves the ordering of existing mutation/range hooks.
#[napi(object)]
pub struct NormalizationGroup {
    pub parent: f64,
    pub original_length: f64,
    pub appended_data: Utf16String,
    pub siblings: Vec<f64>,
}

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
    pub attribute_collections: f64,
    pub attribute_owners: f64,
    pub attribute_holders: f64,
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

/// Binding ownership changes returned only after a native collection mutation commits.
#[napi(object)]
pub struct AttributeDelta {
    pub previous: f64,
    pub changed: bool,
    pub attached: f64,
    pub detached: f64,
    pub released: Vec<f64>,
}
impl From<super::attribute_index::AttributeDelta> for AttributeDelta {
    fn from(delta: super::attribute_index::AttributeDelta) -> Self {
        Self {
            previous: delta.previous as f64,
            changed: delta.changed,
            attached: delta.attached as f64,
            detached: delta.detached as f64,
            released: delta.released.into_iter().map(|id| id as f64).collect(),
        }
    }
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

/// Immutable document type fields shared with the host binding.
#[napi]
pub enum DocumentTypeField {
    Name = 0,
    PublicId = 1,
    SystemId = 2,
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

    #[napi]
    pub fn initialize_document_type(
        &mut self,
        handle: f64,
        name: Utf16String,
        public_id: Utf16String,
        system_id: Utf16String,
    ) -> Result<()> {
        self.store
            .initialize_document_type(handle, &name, &public_id, &system_id)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn document_type_field(
        &self,
        handle: f64,
        field: DocumentTypeField,
    ) -> Result<Utf16String> {
        let field = match field {
            DocumentTypeField::Name => node_metadata::DocumentTypeField::Name,
            DocumentTypeField::PublicId => node_metadata::DocumentTypeField::PublicId,
            DocumentTypeField::SystemId => node_metadata::DocumentTypeField::SystemId,
        };
        self.store
            .document_type_field(handle, field)
            .map(Into::into)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn initialize_processing_instruction_target(
        &mut self,
        handle: f64,
        target: Utf16String,
    ) -> Result<()> {
        self.store
            .initialize_processing_instruction_target(handle, &target)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn processing_instruction_target(&self, handle: f64) -> Result<Utf16String> {
        self.store
            .processing_instruction_target(handle)
            .map(Into::into)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn equal_node(&self, left: f64, right: f64) -> Result<bool> {
        self.store.equal_node(left, right).map_err(to_napi_error)
    }

    #[napi]
    pub fn contains_node(&self, ancestor: f64, descendant: f64) -> Result<bool> {
        self.store
            .contains_node(ancestor, descendant)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn lookup_namespace_uri(
        &self,
        handle: f64,
        prefix: Option<Utf16String>,
    ) -> Result<Option<Either<&str, Utf16String>>> {
        self.store
            .lookup_namespace_uri(handle, prefix.as_deref())
            .map(string_result)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn lookup_prefix(
        &self,
        handle: f64,
        namespace: Option<Utf16String>,
    ) -> Result<Option<Either<&str, Utf16String>>> {
        self.store
            .lookup_prefix(handle, namespace.as_deref())
            .map(string_result)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn is_default_namespace(
        &self,
        handle: f64,
        namespace: Option<Utf16String>,
    ) -> Result<bool> {
        self.store
            .is_default_namespace(handle, namespace.as_deref())
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn node_value(&self, handle: f64) -> Result<Option<Either<&str, Utf16String>>> {
        self.store
            .node_value(handle)
            .map(string_result)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn normalization_candidates(&self, handle: f64) -> Result<Vec<f64>> {
        self.store
            .normalization_candidates(handle)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn compare_boundary_points_position(
        &mut self,
        left: f64,
        left_offset: u32,
        right: f64,
        right_offset: u32,
    ) -> Result<Option<i32>> {
        self.store
            .compare_boundary_points_position(left, left_offset, right, right_offset)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn normalization_group(&self, handle: f64) -> Result<Option<NormalizationGroup>> {
        self.store
            .normalization_group(handle)
            .map(|group| {
                group.map(|group| NormalizationGroup {
                    parent: group.parent as f64,
                    original_length: group.original_length as f64,
                    appended_data: group.appended_data.into(),
                    siblings: group.siblings.into_iter().map(|id| id as f64).collect(),
                })
            })
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn text_content(&self, handle: f64) -> Result<Option<Either<&str, Utf16String>>> {
        self.store
            .text_content(handle)
            .map(|value| match value {
                Some(NodeText::Value(value)) => string_result(Some(value)),
                Some(NodeText::Descendants(value)) => Some(Either::B(value.into())),
                None => None,
            })
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn compare_document_position(&mut self, left: f64, right: f64) -> Result<u16> {
        self.store
            .compare_document_position(left, right)
            .map_err(to_napi_error)
    }

    /// Store lossless snapshot data; initialized attribute collections require metadata APIs.
    #[napi]
    pub fn set_data(&mut self, handle: f64, encoded: String) -> Result<()> {
        self.store.set_data(handle, &encoded).map_err(to_napi_error)
    }

    /// Store an HTML snapshot without JSON; reject an already initialized attribute collection.
    #[napi]
    pub fn set_html_element(
        &mut self,
        handle: f64,
        name: String,
        attributes: Vec<String>,
    ) -> Result<()> {
        self.store
            .replace_snapshot(handle, html_data(name, attributes)?)
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

    /// Copy Attr records to snapshot data before an element's canonical collection is initialized.
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

    #[napi]
    pub fn initialize_attribute_collection(&mut self, element: f64) -> Result<()> {
        self.store
            .initialize_attribute_collection(element)
            .map_err(to_napi_error)
    }
    /// Select the Unicode case tables matching the JavaScript host.
    #[napi]
    pub fn set_unicode_version(&mut self, version: String) -> Result<()> {
        self.store
            .set_unicode_version(&version)
            .map_err(to_napi_error)
    }
    /// Select bundled tables if available; return false without changing state otherwise.
    #[napi]
    pub fn try_set_unicode_version(&mut self, version: String) -> bool {
        self.store.try_set_unicode_version(&version)
    }
    /// Install the host's sorted set of scalars whose default lowercase differs.
    #[napi]
    pub fn set_host_unicode_case_changes(&mut self, changes: Unknown<'_>) -> Result<()> {
        if !changes.is_arraybuffer()? {
            return Err(to_napi_error(TreeError::InvalidUnicodeCaseChanges));
        }
        // SAFETY: the native ArrayBuffer brand was checked without invoking JavaScript;
        // SharedArrayBuffer and other objects cannot reach napi-rs's borrowed byte view.
        let changes = unsafe { changes.cast::<ArrayBuffer<'_>>()? };
        if changes.is_detached()? {
            return Err(to_napi_error(TreeError::InvalidUnicodeCaseChanges));
        }
        self.store
            .set_host_unicode_case_buffer(&changes)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn set_element_metadata(&mut self, element: f64, encoded: String) -> Result<()> {
        let data = serde_json::from_str(&encoded)
            .map_err(TreeError::InvalidMetadata)
            .map_err(to_napi_error)?;
        self.store
            .set_element_metadata(element, data)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn set_html_element_metadata(&mut self, element: f64, name: String) -> Result<()> {
        self.store
            .set_element_metadata(element, html_data(name, vec![])?)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn attribute_ids(&self, element: f64) -> Result<Vec<f64>> {
        self.store.attribute_ids(element).map_err(to_napi_error)
    }
    #[napi]
    pub fn attribute_count(&self, element: f64) -> Result<f64> {
        self.store
            .attribute_count(element)
            .map(|count| count as f64)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn attribute_at(&self, element: f64, index: u32) -> Result<f64> {
        self.store
            .attribute_at(element, index)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn attribute_owner(&self, attribute: f64) -> Result<f64> {
        self.store.attribute_owner(attribute).map_err(to_napi_error)
    }
    #[napi]
    pub fn initialize_attribute_owner(
        &mut self,
        attribute: f64,
        element: Option<f64>,
    ) -> Result<()> {
        self.store
            .initialize_attribute_owner(attribute, element)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn contains_attribute(&self, element: f64, attribute: f64) -> Result<bool> {
        self.store
            .contains_attribute(element, attribute)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn attribute_by_name(
        &self,
        element: f64,
        name: Utf16String,
        html_document: bool,
    ) -> Result<f64> {
        self.store
            .attribute_by_name(element, &name, html_document)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn attribute_by_namespace(
        &self,
        element: f64,
        namespace: Option<Utf16String>,
        name: Utf16String,
    ) -> Result<f64> {
        self.store
            .attribute_by_namespace(element, namespace.as_deref(), &name)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn attribute_names(
        &self,
        element: f64,
        supported: bool,
        html_document: bool,
    ) -> Result<Vec<Utf16String>> {
        self.store
            .attribute_names(element, supported, html_document)
            .map(|names| names.into_iter().map(Into::into).collect())
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn append_attribute(&mut self, element: f64, attribute: f64) -> Result<AttributeDelta> {
        self.store
            .append_attribute(element, attribute)
            .map(Into::into)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn remove_attribute(&mut self, element: f64, attribute: f64) -> Result<AttributeDelta> {
        self.store
            .remove_attribute(element, attribute)
            .map(Into::into)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn replace_attribute(
        &mut self,
        element: f64,
        old: f64,
        new: f64,
    ) -> Result<AttributeDelta> {
        self.store
            .replace_attribute(element, old, new)
            .map(Into::into)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn set_attribute(&mut self, element: f64, attribute: f64) -> Result<AttributeDelta> {
        self.store
            .set_attribute(element, attribute)
            .map(Into::into)
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
            attribute_collections: stats.attribute_collections,
            attribute_owners: stats.attribute_owners,
            attribute_holders: stats.attribute_holders,
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
