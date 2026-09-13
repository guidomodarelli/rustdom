//! Node-API adapter for the platform-independent tree store.
use super::{
    attributes,
    constants::{ATTRIBUTE_NODE, ELEMENT_NODE, HTML_NAMESPACE},
    data::{AttributeData, DomString, NodeData},
    error::TreeError,
    mutation_record::{MutationKind, MutationRecordDraft, MutationRecordState},
    mutation_record_binding::NativeMutationRecord,
    napi_error::to_napi_error,
    napi_string::string_result,
    node_constraints::ConstraintStatus,
    node_metadata,
    node_text::{NodeText, TextWriteAction},
    observer_delivery_binding::{NativeObserverDelivery, ObserverDeliveryInstruction},
    observer_registry::ObservationStatus,
    observer_registry_binding::{
        NativeObserverInterest, NativeObserverNotificationStatistics, NativeObserverOptionsInput,
        NativeObserverRegistryStatistics,
    },
    queries::{QueryEngine, QueryKind, QueryRequest},
    range_boundaries::{BoundaryMode, BoundaryPlan},
    range_clone_binding::{NativeRangeClone, RangeCloneInstruction},
    range_content_queries::ContentSelection,
    range_control::RangeComparison as CoreRangeComparison,
    range_deletion::{DeletionKind, DeletionPlan},
    range_extract_binding::{NativeRangeExtract, RangeExtractInstruction},
    range_insertion::InsertionPlan,
    range_queries::PointRelation,
    range_state_binding::NativeRange,
    range_surround::SurroundStatus,
    slot_assignment_binding::{NativeSlotAssignmentDriver, SlotAssignmentInstruction},
    store,
};
use napi::{
    Error, JsValue, Result, Status,
    bindgen_prelude::{ArrayBuffer, Either, Float64Array, Unknown, Utf16String},
};
use napi_derive::napi;

impl NativeTree {
    pub(super) fn mutation_record_state(
        &self,
        draft: MutationRecordDraft,
    ) -> super::error::Result<MutationRecordState> {
        self.store.mutation_record(draft)
    }
}

/// Scalar text setter decision; effects run in the host after the native borrow ends.
#[napi]
pub enum NodeTextWriteAction {
    Ignore = 0,
    Attribute = 1,
    CharacterData = 2,
    ReplaceChildren = 3,
}

/// Insertion constraints evaluated after the host's parent-kind and host-cycle gates.
#[napi]
pub enum NodeInsertionStatus {
    Ready = 0,
    ChildNotFound = 1,
    InvalidNodeType = 2,
    InvalidParentForNode = 3,
    InvalidDocumentStructure = 4,
}

impl From<ConstraintStatus> for NodeInsertionStatus {
    fn from(status: ConstraintStatus) -> Self {
        match status {
            ConstraintStatus::Ready => Self::Ready,
            ConstraintStatus::ChildNotFound => Self::ChildNotFound,
            ConstraintStatus::InvalidNodeType => Self::InvalidNodeType,
            ConstraintStatus::InvalidParentForNode => Self::InvalidParentForNode,
            ConstraintStatus::InvalidDocumentStructure => Self::InvalidDocumentStructure,
        }
    }
}

/// A transient read-only plan; the binding preserves the ordering of existing mutation/range hooks.
#[napi(object)]
pub struct NormalizationGroup {
    pub parent: f64,
    pub original_length: f64,
    pub appended_data: Utf16String,
    pub siblings: Vec<f64>,
}

/// Numeric host registry diagnostics, without retaining DOM objects.
#[napi(object)]
pub struct RootHostStatistics {
    pub hosted_roots: f64,
    pub host_owners: f64,
    pub root_capacity: f64,
    pub owner_capacity: f64,
}

/// Sparse name state contains numeric keys and owned strings, never JavaScript references.
#[napi(object)]
pub struct SlotableNameStatistics {
    pub named_nodes: f64,
    pub capacity: f64,
}

#[napi(object)]
pub struct SlotAssignmentPlan {
    pub changed: bool,
    pub nodes: Vec<f64>,
}

#[napi(object)]
pub struct SlotAssignmentStatistics {
    pub slots: f64,
    pub entries: f64,
    pub members: f64,
    pub slot_capacity: f64,
    pub member_capacity: f64,
    pub vector_capacity: f64,
}

#[napi(object)]
pub struct SlotBacklinkStatistics {
    pub assigned_nodes: f64,
    pub slot_owners: f64,
    pub node_capacity: f64,
    pub owner_capacity: f64,
    pub reference_capacity: f64,
}

#[napi(object)]
pub struct SlotSignalStatistics {
    pub pending_slots: f64,
    pub queue_entries: f64,
    pub queue_capacity: f64,
    pub membership_capacity: f64,
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

/// Range decisions are translated into the appropriate realm's DOM exceptions by the binding.
#[napi]
pub enum RangePointRelation {
    Before = -1,
    Inside = 0,
    After = 1,
    DifferentRoot = 2,
    InvalidNodeType = 3,
    InvalidOffset = 4,
    InconsistentRoots = 5,
}

/// Public setter intent; live references are updated only after the native decision returns.
#[napi]
pub enum RangeBoundaryMode {
    Start,
    End,
    StartBefore,
    StartAfter,
    EndBefore,
    EndAfter,
    SelectNode,
    SelectContents,
}

/// Ordered reference updates or a rejection to translate into a realm-specific exception.
#[napi]
pub enum RangeBoundaryAction {
    Start,
    End,
    BothStartFirst,
    BothEndFirst,
    InvalidNodeType,
    InvalidOffset,
    NoParent,
    InconsistentRoots,
}

#[napi]
pub enum RangeComparison {
    Before = -1,
    Equal = 0,
    After = 1,
    UnsupportedMethod = 2,
    DifferentRoot = 3,
    InconsistentRoots = 4,
}

#[napi]
pub enum RangeDeletionKind {
    Empty,
    CharacterData,
    Tree,
    InconsistentRoots,
}

#[napi]
pub enum RangeSurroundStatus {
    Ready,
    PartialNonText,
    InvalidParentType,
    InconsistentRoots,
}

#[napi(object)]
pub struct RangeInsertionPlan {
    pub start_node: f64,
    pub start_offset: f64,
    pub parent: f64,
    pub reference: f64,
    pub split_text: bool,
}
impl From<InsertionPlan> for RangeInsertionPlan {
    fn from(plan: InsertionPlan) -> Self {
        Self {
            start_node: plan.start.node as f64,
            start_offset: plan.start.offset,
            parent: plan.parent as f64,
            reference: plan.reference as f64,
            split_text: plan.split_text,
        }
    }
}

#[napi(object)]
pub struct RangeContentSelection {
    pub common_ancestor: f64,
    pub first_partial: f64,
    pub last_partial: f64,
    pub contained: Vec<f64>,
    pub has_doctype: bool,
    pub collapse_node: f64,
    pub collapse_offset: f64,
}
impl From<ContentSelection> for RangeContentSelection {
    fn from(selection: ContentSelection) -> Self {
        Self {
            common_ancestor: selection.common as f64,
            first_partial: selection.first_partial as f64,
            last_partial: selection.last_partial as f64,
            contained: selection
                .contained
                .into_iter()
                .map(|node| node as f64)
                .collect(),
            has_doctype: selection.has_doctype,
            collapse_node: selection.collapse.node as f64,
            collapse_offset: selection.collapse.offset,
        }
    }
}

#[napi(object)]
pub struct RangeDeletionPlan {
    pub kind: RangeDeletionKind,
    pub start_node: f64,
    pub start_offset: f64,
    pub start_count: f64,
    pub end_node: f64,
    pub end_offset: f64,
    pub start_character: bool,
    pub end_character: bool,
    pub nodes: Vec<f64>,
    pub collapse_node: f64,
    pub collapse_offset: f64,
}
impl From<DeletionPlan> for RangeDeletionPlan {
    fn from(plan: DeletionPlan) -> Self {
        Self {
            kind: match plan.kind {
                DeletionKind::Empty => RangeDeletionKind::Empty,
                DeletionKind::CharacterData => RangeDeletionKind::CharacterData,
                DeletionKind::Tree => RangeDeletionKind::Tree,
                DeletionKind::InconsistentRoots => RangeDeletionKind::InconsistentRoots,
            },
            start_node: plan.start.node as f64,
            start_offset: plan.start.offset,
            start_count: plan.start_count,
            end_node: plan.end.node as f64,
            end_offset: plan.end.offset,
            start_character: plan.start_character,
            end_character: plan.end_character,
            nodes: plan.nodes.into_iter().map(|node| node as f64).collect(),
            collapse_node: plan.collapse.node as f64,
            collapse_offset: plan.collapse.offset,
        }
    }
}

#[napi(object)]
pub struct RangeBoundaryPlan {
    pub action: RangeBoundaryAction,
    pub node: f64,
    pub start_offset: f64,
    pub end_offset: f64,
}

impl From<BoundaryPlan> for RangeBoundaryPlan {
    fn from(plan: BoundaryPlan) -> Self {
        let (action, node, start, end) = match plan {
            BoundaryPlan::Start { node, offset } => {
                (RangeBoundaryAction::Start, node, offset, offset)
            }
            BoundaryPlan::End { node, offset } => (RangeBoundaryAction::End, node, offset, offset),
            BoundaryPlan::Both {
                node,
                start,
                end,
                start_first,
            } => (
                if start_first {
                    RangeBoundaryAction::BothStartFirst
                } else {
                    RangeBoundaryAction::BothEndFirst
                },
                node,
                start,
                end,
            ),
            BoundaryPlan::InvalidNodeType => (RangeBoundaryAction::InvalidNodeType, 0, 0, 0),
            BoundaryPlan::InvalidOffset => (RangeBoundaryAction::InvalidOffset, 0, 0, 0),
            BoundaryPlan::NoParent => (RangeBoundaryAction::NoParent, 0, 0, 0),
            BoundaryPlan::InconsistentRoots => (RangeBoundaryAction::InconsistentRoots, 0, 0, 0),
        };
        Self {
            action,
            node: node as f64,
            start_offset: start as f64,
            end_offset: end as f64,
        }
    }
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

    /// Return the first HTML slot matching a lossless name within one fragment root.
    #[napi]
    pub fn find_slot(&self, root: f64, name: Utf16String) -> Result<f64> {
        self.store.find_slot(root, &name).map_err(to_napi_error)
    }

    #[napi]
    pub fn find_slot_for(&self, root: f64, slotable: f64) -> Result<f64> {
        self.store
            .find_slot_for(root, slotable)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn find_slotables(&self, slot: f64) -> Result<Vec<f64>> {
        self.store.find_slotables(slot).map_err(to_napi_error)
    }

    #[napi]
    pub fn find_flattened_slotables(&self, slot: f64) -> Result<Vec<f64>> {
        self.store
            .find_flattened_slotables(slot)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn get_slotable_name(&self, node: f64) -> Result<Either<&str, Utf16String>> {
        self.store
            .slotable_name(node)
            .map(|name| string_result(name).unwrap_or(Either::A("")))
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn set_slotable_name(&mut self, node: f64, name: Utf16String) -> Result<()> {
        self.store
            .set_slotable_name(node, &name)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn slotable_name_statistics(&self) -> SlotableNameStatistics {
        let (named_nodes, capacity) = self.store.slotable_names.statistics();
        SlotableNameStatistics {
            named_nodes: named_nodes as f64,
            capacity: capacity as f64,
        }
    }

    #[napi]
    pub fn slot_assignment_plan(&self, slot: f64) -> Result<SlotAssignmentPlan> {
        self.store
            .slot_assignment_plan(slot)
            .map(|plan| SlotAssignmentPlan {
                changed: plan.changed,
                nodes: plan.nodes,
            })
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn slot_assignment_step(
        &mut self,
        operation: &mut NativeSlotAssignmentDriver,
    ) -> Result<SlotAssignmentInstruction> {
        operation.step(&mut self.store)
    }

    #[napi]
    pub fn set_slot_assignment(&mut self, slot: f64, nodes: Vec<f64>) -> Result<()> {
        self.store
            .set_slot_assignment(slot, &nodes)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn cached_slotables(&self, slot: f64) -> Result<Vec<f64>> {
        self.store.cached_slotables(slot).map_err(to_napi_error)
    }

    #[napi]
    pub fn assigned_node_count(&self, slot: f64) -> Result<f64> {
        self.store
            .assigned_node_count(slot)
            .map(|count| count as f64)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn slot_backlink(&self, node: f64) -> Result<f64> {
        self.store.slot_backlink(node).map_err(to_napi_error)
    }

    #[napi]
    pub fn set_slot_backlink(&mut self, node: f64, slot: f64) -> Result<()> {
        self.store
            .set_slot_backlink(node, slot)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn event_parent(&self, node: f64) -> Result<f64> {
        self.store.event_parent(node).map_err(to_napi_error)
    }

    #[napi]
    pub fn queue_slot_signal(&mut self, slot: f64) -> Result<bool> {
        self.store.queue_slot_signal(slot).map_err(to_napi_error)
    }

    #[napi]
    pub fn allocate_mutation_observer(&mut self) -> Result<f64> {
        self.store
            .observer_registry
            .allocate()
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn release_mutation_observer(&mut self, observer: f64) -> Result<bool> {
        self.store
            .observer_registry
            .release(observer)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn observe_mutations(
        &mut self,
        observer: f64,
        target: f64,
        options: NativeObserverOptionsInput,
    ) -> Result<ObservationStatus> {
        self.store
            .observe_mutations(observer, target, options.into())
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn disconnect_mutation_observer(&mut self, observer: f64) -> Result<Vec<f64>> {
        self.store
            .observer_registry
            .disconnect(observer)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn interested_mutation_observers(
        &self,
        target: f64,
        kind: String,
        name: Option<Utf16String>,
        namespace: Option<Utf16String>,
    ) -> Result<Vec<NativeObserverInterest>> {
        let kind = MutationKind::parse(&kind).map_err(to_napi_error)?;
        let name = name.map(|name| DomString::from_units(&name));
        let namespace = namespace.map(|namespace| DomString::from_units(&namespace));
        self.store
            .interested_mutation_observers(target, kind, name.as_ref(), namespace.as_ref())
            .map(|interests| {
                interests
                    .into_iter()
                    .map(|interest| NativeObserverInterest {
                        observer: interest.observer as f64,
                        old_value: interest.old_value,
                    })
                    .collect()
            })
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn observer_registry_statistics(&self) -> NativeObserverRegistryStatistics {
        self.store.observer_registry.statistics().into()
    }

    #[napi]
    pub fn request_mutation_observer_microtask(&mut self) -> bool {
        self.store
            .observer_registry
            .notifications
            .request_microtask()
    }

    #[napi]
    pub fn begin_mutation_observer_notification(&mut self) -> Vec<f64> {
        self.store.observer_registry.notifications.begin()
    }

    #[napi]
    pub fn observer_notification_statistics(&self) -> NativeObserverNotificationStatistics {
        let stats = self.store.observer_registry.notifications.statistics();
        NativeObserverNotificationStatistics {
            pending_observers: stats.pending_observers as f64,
            capacity: stats.capacity as f64,
            microtask_queued: stats.microtask_queued,
        }
    }

    #[napi]
    pub fn start_mutation_observer_delivery(&mut self) -> NativeObserverDelivery {
        NativeObserverDelivery::from_driver(self.store.start_observer_delivery())
    }

    #[napi]
    pub fn mutation_observer_delivery_step(
        &mut self,
        operation: &mut NativeObserverDelivery,
    ) -> Result<ObserverDeliveryInstruction> {
        operation.step(&mut self.store)
    }

    #[napi]
    pub fn enqueue_mutation_record(
        &mut self,
        observer: f64,
        record: &NativeMutationRecord,
    ) -> Result<f64> {
        self.store
            .observer_registry
            .enqueue_record(observer, record.shared_state())
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn take_mutation_records(&mut self, observer: f64) -> Result<Vec<f64>> {
        self.store
            .observer_registry
            .take_records(observer)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn queued_mutation_record(
        &self,
        observer: f64,
        token: f64,
    ) -> Result<Option<NativeMutationRecord>> {
        self.store
            .observer_registry
            .queued_record(observer, token)
            .map(|record| record.map(NativeMutationRecord::from_shared))
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn take_slot_signals(&mut self) -> Vec<f64> {
        self.store.take_slot_signals()
    }

    #[napi]
    pub fn slot_signal_statistics(&self) -> SlotSignalStatistics {
        let state = self.store.slot_signals.statistics();
        SlotSignalStatistics {
            pending_slots: state.pending_slots as f64,
            queue_entries: state.queue_entries as f64,
            queue_capacity: state.queue_capacity as f64,
            membership_capacity: state.membership_capacity as f64,
        }
    }

    #[napi]
    pub fn slot_backlink_statistics(&self) -> SlotBacklinkStatistics {
        let stats = self.store.slot_backlinks.statistics();
        SlotBacklinkStatistics {
            assigned_nodes: stats.assigned_nodes as f64,
            slot_owners: stats.slot_owners as f64,
            node_capacity: stats.node_capacity as f64,
            owner_capacity: stats.owner_capacity as f64,
            reference_capacity: stats.reference_capacity as f64,
        }
    }

    #[napi]
    pub fn slot_assignment_statistics(&self) -> SlotAssignmentStatistics {
        let state = self.store.slot_assignments.statistics();
        SlotAssignmentStatistics {
            slots: state.slots as f64,
            entries: state.entries as f64,
            members: state.members as f64,
            slot_capacity: state.slot_capacity as f64,
            member_capacity: state.member_capacity as f64,
            vector_capacity: state.vector_capacity as f64,
        }
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
            .compare_boundary_points_position(
                left,
                u64::from(left_offset),
                right,
                u64::from(right_offset),
            )
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn range_point_relation(
        &mut self,
        node: f64,
        offset: u32,
        start: f64,
        start_offset: u32,
        end: f64,
        end_offset: u32,
    ) -> Result<RangePointRelation> {
        self.store
            .range_point_relation(node, offset, start, start_offset, end, end_offset)
            .map(|relation| match relation {
                PointRelation::Before => RangePointRelation::Before,
                PointRelation::Inside => RangePointRelation::Inside,
                PointRelation::After => RangePointRelation::After,
                PointRelation::DifferentRoot => RangePointRelation::DifferentRoot,
                PointRelation::InvalidNodeType => RangePointRelation::InvalidNodeType,
                PointRelation::InvalidOffset => RangePointRelation::InvalidOffset,
                PointRelation::InconsistentRoots => RangePointRelation::InconsistentRoots,
            })
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn range_intersects_node(
        &mut self,
        node: f64,
        start: f64,
        start_offset: u32,
        end: f64,
        end_offset: u32,
    ) -> Result<Option<bool>> {
        self.store
            .range_intersects_node(node, start, start_offset, end, end_offset)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn node_root(&self, handle: f64) -> Result<f64> {
        self.store.node_root(handle).map_err(to_napi_error)
    }
    #[napi]
    pub fn set_root_host(&mut self, root: f64, host: f64, shadow: bool) -> Result<()> {
        self.store
            .set_root_host(root, host, shadow)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn root_host(&self, root: f64) -> Result<f64> {
        self.store.root_host(root).map_err(to_napi_error)
    }
    #[napi]
    pub fn retarget(&self, node: f64, reference: f64) -> Result<f64> {
        self.store.retarget(node, reference).map_err(to_napi_error)
    }
    #[napi]
    pub fn shadow_including_root(&self, node: f64) -> Result<f64> {
        self.store
            .shadow_including_root(node)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn is_shadow_inclusive_ancestor(&self, ancestor: f64, node: f64) -> Result<bool> {
        self.store
            .is_shadow_inclusive_ancestor(ancestor, node)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn is_host_inclusive_ancestor(&self, ancestor: f64, node: f64) -> Result<bool> {
        self.store
            .is_host_inclusive_ancestor(ancestor, node)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn root_host_statistics(&self) -> RootHostStatistics {
        let state = self.store.root_host_statistics();
        RootHostStatistics {
            hosted_roots: state.hosted_roots as f64,
            host_owners: state.host_owners as f64,
            root_capacity: state.root_capacity as f64,
            owner_capacity: state.owner_capacity as f64,
        }
    }
    #[napi]
    pub fn pre_insert_constraints(
        &self,
        parent: f64,
        node: f64,
        child: f64,
    ) -> Result<NodeInsertionStatus> {
        self.store
            .pre_insert_constraints(parent, node, child)
            .map(NodeInsertionStatus::from)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn pre_replace_constraints(
        &self,
        parent: f64,
        node: f64,
        child: f64,
    ) -> Result<NodeInsertionStatus> {
        self.store
            .pre_replace_constraints(parent, node, child)
            .map(NodeInsertionStatus::from)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn text_write_action(
        &self,
        handle: f64,
        text_content: bool,
    ) -> Result<NodeTextWriteAction> {
        self.store
            .text_write_action(handle, text_content)
            .map(|action| match action {
                TextWriteAction::Ignore => NodeTextWriteAction::Ignore,
                TextWriteAction::Attribute => NodeTextWriteAction::Attribute,
                TextWriteAction::CharacterData => NodeTextWriteAction::CharacterData,
                TextWriteAction::ReplaceChildren => NodeTextWriteAction::ReplaceChildren,
            })
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn node_length(&self, handle: f64) -> Result<f64> {
        self.store.node_length(handle).map_err(to_napi_error)
    }
    #[napi]
    pub fn is_following(&mut self, node: f64, reference: f64) -> Result<bool> {
        self.store
            .is_following(node, reference)
            .map_err(to_napi_error)
    }
    #[napi]
    pub fn range_extract_step(
        &mut self,
        operation: &mut NativeRangeExtract,
        created: f64,
    ) -> Result<RangeExtractInstruction> {
        operation.step(&mut self.store, created)
    }

    #[napi]
    pub fn range_clone_step(
        &mut self,
        operation: &mut NativeRangeClone,
        created: f64,
    ) -> Result<RangeCloneInstruction> {
        operation.step(&mut self.store, created)
    }

    #[napi]
    pub fn range_fragment_context(
        &self,
        state: &NativeRange,
        html_document: bool,
    ) -> Result<Option<f64>> {
        let (start, end) = state.raw_points()?;
        self.store
            .range_fragment_context(start, end, html_document)
            .map(|context| context.map(|node| node as f64))
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn range_insertion_plan(
        &self,
        state: &NativeRange,
        node: f64,
    ) -> Result<Option<RangeInsertionPlan>> {
        let (start, end) = state.raw_points()?;
        self.store
            .range_insertion_plan(start, end, node)
            .map(|plan| plan.map(Into::into))
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn range_insertion_offset(
        &mut self,
        node: f64,
        parent: f64,
        reference: f64,
    ) -> Result<f64> {
        self.store
            .range_insertion_offset(node, parent, reference)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn range_surround_status(
        &self,
        state: &NativeRange,
        parent: f64,
    ) -> Result<RangeSurroundStatus> {
        let (start, end) = state.raw_points()?;
        self.store
            .range_surround_status(start, end, parent)
            .map(|status| match status {
                SurroundStatus::Ready => RangeSurroundStatus::Ready,
                SurroundStatus::PartialNonText => RangeSurroundStatus::PartialNonText,
                SurroundStatus::InvalidParentType => RangeSurroundStatus::InvalidParentType,
                SurroundStatus::InconsistentRoots => RangeSurroundStatus::InconsistentRoots,
            })
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn range_content_selection(
        &mut self,
        state: &NativeRange,
    ) -> Result<Option<RangeContentSelection>> {
        let (start, end) = state.raw_points()?;
        self.store
            .range_content_selection(start, end)
            .map(|selection| selection.map(Into::into))
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn range_deletion_plan(&mut self, state: &NativeRange) -> Result<RangeDeletionPlan> {
        let (start, end) = state.raw_points()?;
        self.store
            .range_deletion_plan(start, end)
            .map(Into::into)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn compare_range_states(
        &mut self,
        current: &NativeRange,
        how: u32,
        source: &NativeRange,
    ) -> Result<RangeComparison> {
        self.store
            .compare_ranges(how, current.inputs()?, source.inputs()?)
            .map(|result| match result {
                CoreRangeComparison::Before => RangeComparison::Before,
                CoreRangeComparison::Equal => RangeComparison::Equal,
                CoreRangeComparison::After => RangeComparison::After,
                CoreRangeComparison::UnsupportedMethod => RangeComparison::UnsupportedMethod,
                CoreRangeComparison::DifferentRoot => RangeComparison::DifferentRoot,
                CoreRangeComparison::InconsistentRoots => RangeComparison::InconsistentRoots,
            })
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn range_point_relation_from_state(
        &mut self,
        state: &NativeRange,
        node: f64,
        offset: u32,
    ) -> Result<RangePointRelation> {
        let (start, end) = state.inputs()?;
        self.range_point_relation(node, offset, start.0, start.1, end.0, end.1)
    }

    #[napi]
    pub fn range_intersects_node_from_state(
        &mut self,
        state: &NativeRange,
        node: f64,
    ) -> Result<Option<bool>> {
        let (start, end) = state.inputs()?;
        self.range_intersects_node(node, start.0, start.1, end.0, end.1)
    }

    #[napi]
    pub fn range_text_from_state(&mut self, state: &NativeRange) -> Result<Option<Utf16String>> {
        let (start, end) = state.inputs()?;
        self.range_text(start.0, start.1, end.0, end.1)
    }

    #[napi]
    pub fn range_boundary_plan_from_state(
        &mut self,
        state: &NativeRange,
        mode: RangeBoundaryMode,
        node: f64,
        offset: u32,
    ) -> Result<RangeBoundaryPlan> {
        let (start, end) = state.inputs()?;
        self.range_boundary_plan(mode, node, offset, start.0, start.1, end.0, end.1)
    }

    #[napi]
    pub fn common_ancestor_from_state(&self, state: &NativeRange) -> Result<f64> {
        let (start, end) = state.inputs()?;
        self.common_ancestor(start.0, end.0)
    }

    /// Primitive endpoints avoid allocating temporary input objects at each Node-API call.
    /// All three handles must be allocated; endpoint topology needs no additional metadata.
    #[allow(clippy::too_many_arguments)]
    #[napi]
    pub fn range_boundary_plan(
        &mut self,
        mode: RangeBoundaryMode,
        node: f64,
        offset: u32,
        start: f64,
        start_offset: u32,
        end: f64,
        end_offset: u32,
    ) -> Result<RangeBoundaryPlan> {
        let mode = match mode {
            RangeBoundaryMode::Start => BoundaryMode::Start,
            RangeBoundaryMode::End => BoundaryMode::End,
            RangeBoundaryMode::StartBefore => BoundaryMode::StartBefore,
            RangeBoundaryMode::StartAfter => BoundaryMode::StartAfter,
            RangeBoundaryMode::EndBefore => BoundaryMode::EndBefore,
            RangeBoundaryMode::EndAfter => BoundaryMode::EndAfter,
            RangeBoundaryMode::SelectNode => BoundaryMode::SelectNode,
            RangeBoundaryMode::SelectContents => BoundaryMode::SelectContents,
        };
        self.store
            .range_boundary_plan(
                mode,
                node,
                offset,
                (start, u64::from(start_offset)),
                (end, u64::from(end_offset)),
            )
            .map(Into::into)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn common_ancestor(&self, left: f64, right: f64) -> Result<f64> {
        self.store
            .common_ancestor(left, right)
            .map(|id| id as f64)
            .map_err(to_napi_error)
    }

    #[napi]
    pub fn range_text(
        &mut self,
        start: f64,
        start_offset: u32,
        end: f64,
        end_offset: u32,
    ) -> Result<Option<Utf16String>> {
        self.store
            .range_text(start, start_offset, end, end_offset)
            .map(|value| value.map(Into::into))
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
