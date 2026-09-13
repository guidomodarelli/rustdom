/** Low-level Node-API contracts; ordinary DOM consumers should use the root API. */
import type { NativeTreeStatistics, NativeRangeStatistics, NativeRootHostStatistics, NativeSlotableNameStatistics, NativeSlotAssignmentStatistics, NativeSlotBacklinkStatistics, NativeSlotSignalStatistics, NativeSlotAssignmentDriverStatistics, NativeMutationRecordStatistics, NativeMutationObserverStatistics, NativeMutationNotificationStatistics, NativeObserverDeliveryStatistics } from './index.cjs';

/** Native delivery steps; only nonempty observer queues produce Observer instructions. */
export const ObserverDeliveryAction: { readonly Complete: 0; readonly Observer: 1; readonly Slot: 2 };
export interface ObserverDeliveryInstruction { kind: typeof ObserverDeliveryAction[keyof typeof ObserverDeliveryAction]; observer: number; slot: number; records: number[]; complete: boolean; }
/** A numeric-only captured batch tied to a weak originating-forest identity. The public constructor creates a completed empty operation. */
export class NativeObserverDelivery {
  constructor();
  cancel(): void;
  readonly complete: boolean;
  readonly remainingObservers: number;
  readonly remainingSlots: number;
  static statistics(): NativeObserverDeliveryStatistics;
}

/** Forward-only native registration results; invalid options leave existing membership unchanged. */
export const ObservationStatus: { readonly Added: 0; readonly Replaced: 1; readonly MissingMutationKind: 2; readonly AttributeOldValueWithoutAttributes: 3; readonly AttributeFilterWithoutAttributes: 4; readonly CharacterOldValueWithoutCharacterData: 5 };
export interface NativeObserverOptionsInput { attributes?: boolean; characterData?: boolean; childList?: boolean; subtree?: boolean; attributeOldValue?: boolean; characterDataOldValue?: boolean; attributeFilter?: string[]; }
export interface NativeObserverInterest { observer: number; oldValue: boolean; }
export interface NativePreparedMutation { observer: number; record: NativeMutationRecord; }
/** Native payload wrappers are shared; each observer references its immutable payload by index. */
export interface NativeMutationBatch { observers: number[]; payloadIndices: number[]; payloads: NativeMutationRecord[]; }

/** Complete scalar payload; zero represents a missing sibling, and text fields preserve null versus empty. */
export interface NativeMutationRecordInput {
  kind: 'attributes' | 'characterData' | 'childList'; target: number; previousSibling: number; nextSibling: number;
  attributeName?: string | null; attributeNamespace?: string | null; oldValue?: string | null;
  addedNodes: number[]; removedNodes: number[];
}
/** Immutable text and node-ID snapshots; validates allocated handles in the supplied forest before construction. */
export class NativeMutationRecord {
  constructor(tree: NativeTree, input: NativeMutationRecordInput);
  readonly kind: 'attributes' | 'characterData' | 'childList'; readonly target: number;
  readonly previousSibling: number; readonly nextSibling: number;
  readonly attributeName: string | null; readonly attributeNamespace: string | null; readonly oldValue: string | null;
  readonly addedNodes: number[]; readonly removedNodes: number[];
  static statistics(): NativeMutationRecordStatistics;
}

/** A signal precedes its commit; Applied instructions carry GC ownership changes only. */
export const SlotAssignmentAction: { readonly Complete: 0; readonly Signal: 1; readonly Applied: 2 };
/** Numeric action values returned by the native assignment driver, without reverse mapping. */
export type SlotAssignmentAction = typeof SlotAssignmentAction[keyof typeof SlotAssignmentAction];
export interface SlotAssignmentInstruction { kind: SlotAssignmentAction; slot: number; nodes: number[]; nextNode: number; cacheChanged: boolean; }
/** Numeric-only synchronous operation. The first tree step validates allocation and slot role. */
export class NativeSlotAssignmentDriver {
  constructor(root: number, subtree: boolean);
  cancel(): void;
  readonly complete: boolean;
  static statistics(): NativeSlotAssignmentDriverStatistics;
}

/** A contextual parser attribute, including optional XML metadata. */
export interface ContextAttribute { name: string; value: string; namespace?: string; prefix?: string; }
/** Stable native links; zero denotes a missing related node. */
export interface TreeLinks {
  id: number; parent: number; previous: number; next: number; first: number; last: number;
  childCount: number; childrenVersion: number;
}
/** Host GC-reference changes after a native attribute mutation. */
export interface AttributeDelta { previous: number; changed: boolean; attached: number; detached: number; released: number[]; }
/** Read-only normalization decision; mutation and range hooks run after the plan is returned. */
export interface NormalizationGroup { parent: number; originalLength: number; appendedData: string; siblings: number[]; }
/** Scalar setter decisions; the host delivers the selected existing mutation hooks. */
export const NodeTextWriteAction: { readonly Ignore: 0; readonly Attribute: 1; readonly CharacterData: 2; readonly ReplaceChildren: 3 };
/** Constraints after parent-kind and host-cycle validation; zero child handle means append. */
export const NodeInsertionStatus: { readonly Ready: 0; readonly ChildNotFound: 1; readonly InvalidNodeType: 2; readonly InvalidParentForNode: 3; readonly InvalidDocumentStructure: 4 };
/** Query modes accepted by the native matcher. */
export const QueryMode: { readonly All: 0; readonly First: 1; readonly Matches: 2; readonly Closest: 3 };
/** Canonical Attr metadata fields. */
export const AttributeField: { readonly Name: 0; readonly Namespace: 1; readonly Prefix: 2; readonly Value: 3; readonly QualifiedName: 4 };
/** Canonical DocumentType identifiers. */
export const DocumentTypeField: { readonly Name: 0; readonly PublicId: 1; readonly SystemId: 2 };
/** Native Range decision vocabulary; DOM bindings create errors in the relevant realm. */
export const RangePointRelation: { readonly Before: -1; readonly Inside: 0; readonly After: 1; readonly DifferentRoot: 2; readonly InvalidNodeType: 3; readonly InvalidOffset: 4; readonly InconsistentRoots: 5 };
/** Intent for a transient native boundary plan. */
export const RangeBoundaryMode: { readonly Start: 0; readonly End: 1; readonly StartBefore: 2; readonly StartAfter: 3; readonly EndBefore: 4; readonly EndAfter: 5; readonly SelectNode: 6; readonly SelectContents: 7 };
/** Ordered host reference updates, or rejection without live Range mutation. */
export const RangeBoundaryAction: { readonly Start: 0; readonly End: 1; readonly BothStartFirst: 2; readonly BothEndFirst: 3; readonly InvalidNodeType: 4; readonly InvalidOffset: 5; readonly NoParent: 6; readonly InconsistentRoots: 7 };
/** Node and offsets are zero for rejected plans; successful plans retain no native resources. */
export interface RangeBoundaryPlan { action: typeof RangeBoundaryAction[keyof typeof RangeBoundaryAction]; node: number; startOffset: number; endOffset: number; }

/** Independent snapshot; offsets preserve internal JavaScript Number values without revalidating public setters. */
export interface NativeBoundaryPoint { node: number; offset: number; }
/** Transient collapse decision; numeric state changes only when the host applies the selected endpoint update. */
export interface NativeCollapsePlan extends NativeBoundaryPoint { updateStart: boolean; }
/** Ordered host-reference update; plans never change the original state or own the referenced node. */
export interface NativeRangeUpdate extends NativeBoundaryPoint { start: boolean; }
/** Tree mutation stages used by the host; all arguments are already derived from a validated DOM operation. */
export const RangeMutationKind: { readonly SplitText: 0; readonly SplitParent: 1; readonly Insert: 2; readonly RemoveDescendant: 3; readonly RemoveParent: 4; readonly NormalizeText: 5; readonly NormalizeParent: 6 };
/** Bit flags identifying changed node identities; zero means only offsets changed or no adjustment was needed. */
export const RangeEndpoint: { readonly Start: 1; readonly End: 2 };
/** Ordering or rejection returned by a complete native Range comparison. */
export const RangeComparison: { readonly Before: -1; readonly Equal: 0; readonly After: 1; readonly UnsupportedMethod: 2; readonly DifferentRoot: 3; readonly InconsistentRoots: 4 };
/** Read-only deletion action, delivered to existing mutation hooks by the host. */
export const RangeDeletionKind: { readonly Empty: 0; readonly CharacterData: 1; readonly Tree: 2; readonly InconsistentRoots: 3 };
/** Original endpoints and outermost removal identities; no mutation is applied by this plan. */
export interface RangeDeletionPlan { kind: typeof RangeDeletionKind[keyof typeof RangeDeletionKind]; startNode: number; startOffset: number;
  startCount: number; endNode: number; endOffset: number; startCharacter: boolean; endCharacter: boolean; nodes: number[];
  collapseNode: number; collapseOffset: number; }
/** Read-only content selection; zero partial IDs mean no partial child on that side. */
export interface RangeContentSelection { commonAncestor: number; firstPartial: number; lastPartial: number; contained: number[];
  hasDoctype: boolean; collapseNode: number; collapseOffset: number; }
/** surroundContents preflight; later mutation/hierarchy errors remain distinct. */
export const RangeSurroundStatus: { readonly Ready: 0; readonly PartialNonText: 1; readonly InvalidParentType: 2; readonly InconsistentRoots: 3 };
/** Initial insertion geometry, before hierarchy checks and host mutation hooks; zero reference means append. */
export interface RangeInsertionPlan { startNode: number; startOffset: number; parent: number; reference: number; splitText: boolean; }
/** V8-finalized native endpoint state. Numeric handles do not own DOM nodes; host bindings retain node references. */
export class NativeRange {
  constructor();
  static statistics(): NativeRangeStatistics;
  readonly start: NativeBoundaryPoint | null;
  readonly end: NativeBoundaryPoint | null;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly collapsed: boolean;
  setStart(node: number, offset: number): void;
  setEnd(node: number, offset: number): void;
  copy(): NativeRange;
  collapsePlan(toStart: boolean): NativeCollapsePlan;
  /** Mutation inputs come from the host's validated DOM operation. Handles must be positive safe integers; no tree is owned or consulted. */
  characterDataPlan(node: number, offset: number, count: number, insertedLength: number): NativeRangeUpdate[];
  splitTextPlan(source: number, target: number, offset: number): NativeRangeUpdate[];
  splitParentPlan(parent: number, index: number): NativeRangeUpdate[];
  insertPlan(parent: number, index: number, count: number): NativeRangeUpdate[];
  removeDescendantPlan(source: number, parent: number, index: number): NativeRangeUpdate[];
  removeParentPlan(parent: number, index: number): NativeRangeUpdate[];
  normalizeTextPlan(source: number, target: number, length: number): NativeRangeUpdate[];
  normalizeParentPlan(parent: number, target: number, index: number, length: number): NativeRangeUpdate[];
  /** Updates offsets in place; node identities remain unchanged. No DOM nodes are owned or consulted. */
  applyCharacterData(node: number, offset: number, count: number, insertedLength: number): void;
  /** Updates numeric state and returns RangeEndpoint move bits. The host must synchronously move changed ownership edges before exposing the Range again. */
  applyTreeMutation(kind: typeof RangeMutationKind[keyof typeof RangeMutationKind], source: number, target: number, index: number, count: number): number;
}

/** Effect instructions for cloneContents; only a creation requests a nonzero completed-node handle on the next step. */
export const RangeCloneAction: { readonly CreateFragment: 0; readonly CloneNode: 1; readonly SliceData: 2; readonly AppendChild: 3; readonly PinNodes: 4; readonly Complete: 5; readonly InvalidDoctype: 6; readonly InconsistentRoots: 7 };
/** Numeric instruction; unused scalar fields are zero/false, and nodes exists only for PinNodes. */
export interface RangeCloneInstruction { kind: typeof RangeCloneAction[keyof typeof RangeCloneAction]; node: number; parent: number;
  offset: number; count: number; deep: boolean; nodes?: number[]; }
/** Snapshot controller. It owns no DOM nodes or source Range; the host retains and delivers referenced nodes synchronously. */
export class NativeRangeClone {
  constructor(state: NativeRange);
  readonly complete: boolean;
  /** Releases frame buffers immediately; further steps reject. Idempotent after failure/completion. */
  cancel(): void;
  static statistics(): NativeRangeStatistics;
}
/** Extraction extends the shared content effects with removal of original CharacterData. */
export const RangeExtractAction: { readonly CreateFragment: 0; readonly CloneNode: 1; readonly SliceData: 2; readonly AppendChild: 3; readonly PinNodes: 4; readonly Complete: 5; readonly InvalidDoctype: 6; readonly InconsistentRoots: 7; readonly ReplaceData: 8 };
/** Complete carries parent/offset for the final root-Range collapse; zero parent preserves the mutation-driven position. */
export interface RangeExtractInstruction extends Omit<RangeCloneInstruction, 'kind'> { kind: typeof RangeExtractAction[keyof typeof RangeExtractAction]; }
/** Numeric extraction controller; no ownership of DOM nodes or the source Range. */
export class NativeRangeExtract {
  constructor(state: NativeRange);
  readonly complete: boolean;
  cancel(): void;
  static statistics(): NativeRangeStatistics;
}
/** Owns a native forest. Handles are positive safe integers and are never reused. */
export class NativeTree {
  constructor();
  readonly handleBatchSize: number;
  allocate(): number;
  reserveHandles(): number;
  initializeDocumentType(handle: number, name: string, publicId: string, systemId: string): void;
  documentTypeField(handle: number, field: typeof DocumentTypeField[keyof typeof DocumentTypeField]): string;
  initializeProcessingInstructionTarget(handle: number, target: string): void;
  processingInstructionTarget(handle: number): string;
  equalNode(left: number, right: number): boolean;
  containsNode(ancestor: number, descendant: number): boolean;
  /** Generic geometry requires allocated handles; root/order/ancestry require no metadata. */
  nodeRoot(handle: number): number;
  /** Register a fragment host before or after metadata initialization; host zero clears the relation. */
  setRootHost(root: number, host: number, shadow: boolean): void;
  rootHost(root: number): number;
  /** Retargets a node through shadow hosts; reference zero represents a non-node target. */
  retarget(node: number, reference: number): number;
  /** Finds the first HTML slot with an exact UTF-16 name inside a DocumentFragment; zero means no match. */
  findSlot(root: number, name: string): number;
  /** Finds a slot using an Element/Text's native name without transferring the string through JavaScript. */
  findSlotFor(root: number, slotable: number): number;
  /** Computes current candidates for the first matching HTML slot in its registered shadow root; does not update assignment caches. */
  findSlotables(slot: number): number[];
  /** Expands assigned/fallback slots in order with temporary numeric state; rejects cycles in malformed raw graphs. */
  findFlattenedSlotables(slot: number): number[];
  /** Captures current candidates and whether they differ from cache; does not commit before signaling. */
  slotAssignmentPlan(slot: number): { changed: boolean; nodes: number[] };
  /** Resume after delivering Signal, or applying the prior ownership update; native errors cancel the operation. */
  slotAssignmentStep(operation: NativeSlotAssignmentDriver): SlotAssignmentInstruction;
  /** Commits the previously captured snapshot; errors leave the old cache intact. */
  setSlotAssignment(slot: number, nodes: number[]): void;
  cachedSlotables(slot: number): number[];
  assignedNodeCount(slot: number): number;
  slotAssignmentStatistics(): NativeSlotAssignmentStatistics;
  /** Reads the recorded backlink; zero means absent. Unlike findSlot, this does not recompute assignment. */
  slotBacklink(node: number): number;
  /** Records an initialized HTML slot for Element/Text/CDATA, or clears with zero; invalid inputs leave state intact. */
  setSlotBacklink(node: number, slot: number): void;
  /** Selects the recorded slot or ordinary parent; ShadowRoot/Document event-specific overrides are separate. */
  eventParent(node: number): number;
  slotBacklinkStatistics(): NativeSlotBacklinkStatistics;
  /** Queues an initialized HTML slot once, preserving its first position; returns whether it was newly accepted. */
  queueSlotSignal(slot: number): boolean;
  allocateMutationObserver(): number;
  releaseMutationObserver(observer: number): boolean;
  observeMutations(observer: number, target: number, options: NativeObserverOptionsInput): typeof ObservationStatus[keyof typeof ObservationStatus];
  disconnectMutationObserver(observer: number): number[];
  interestedMutationObservers(target: number, kind: 'attributes' | 'characterData' | 'childList', name?: string | null, namespace?: string | null): NativeObserverInterest[];
  observerRegistryStatistics(): NativeMutationObserverStatistics;
  requestMutationObserverMicrotask(): boolean;
  beginMutationObserverNotification(): number[];
  observerNotificationStatistics(): NativeMutationNotificationStatistics;
  startMutationObserverDelivery(): NativeObserverDelivery;
  mutationObserverDeliveryStep(operation: NativeObserverDelivery): ObserverDeliveryInstruction;
  /** Queue an immutable payload and return its binding token; no JavaScript object is retained natively. */
  enqueueMutationRecord(observer: number, record: NativeMutationRecord): number;
  /** Prepare selected payloads without enqueuing; text fields preserve null, trailing NUL and UTF-16. */
  prepareMutationRecords(input: NativeMutationRecordInput): NativePreparedMutation[];
  prepareMutationRecordBatch(input: NativeMutationRecordInput): NativeMutationBatch | null;
  /** Drain tokens in insertion order, releasing the queue's payload shares. */
  takeMutationRecords(observer: number): number[];
  /** Inspect a queued payload through an independent native wrapper, or null when that token is absent. */
  queuedMutationRecord(observer: number, token: number): NativeMutationRecord | null;
  /** Takes the current batch and resets native queue storage before the caller delivers any callbacks. */
  takeSlotSignals(): number[];
  slotSignalStatistics(): NativeSlotSignalStatistics;
  /** Default empty names consume no entry; nonempty state survives valid Element/Text metadata updates. */
  getSlotableName(node: number): string;
  setSlotableName(node: number, name: string): void;
  slotableNameStatistics(): NativeSlotableNameStatistics;
  shadowIncludingRoot(node: number): number;
  isShadowInclusiveAncestor(ancestor: number, node: number): boolean;
  isHostInclusiveAncestor(ancestor: number, node: number): boolean;
  rootHostStatistics(): NativeRootHostStatistics;
  /** Read-only child membership, node-kind and Document constraints; caller handles parent validity and host-inclusive cycles first. */
  preInsertConstraints(parent: number, node: number, child: number): typeof NodeInsertionStatus[keyof typeof NodeInsertionStatus];
  /** Replacement's distinct Document constraints; all handles must be allocated and child cannot be zero. Parent/cycle gates remain with the caller. */
  preReplaceConstraints(parent: number, node: number, child: number): typeof NodeInsertionStatus[keyof typeof NodeInsertionStatus];
  /** Select nodeValue (false) or textContent (true) effects without changing native state. */
  textWriteAction(handle: number, textContent: boolean): typeof NodeTextWriteAction[keyof typeof NodeTextWriteAction];
  nodeLength(handle: number): number;
  isFollowing(node: number, reference: number): boolean;
  compareDocumentPosition(left: number, right: number): number;
  lookupNamespaceUri(handle: number, prefix: string | null): string | null;
  lookupPrefix(handle: number, namespace: string | null): string | null;
  isDefaultNamespace(handle: number, namespace: string | null): boolean;
  nodeValue(handle: number): string | null;
  textContent(handle: number): string | null;
  normalizationCandidates(handle: number): number[];
  normalizationGroup(handle: number): NormalizationGroup | null;
  /** Returns null for distinct tree roots; offsets remain subject to public Range validation. */
  compareBoundaryPointsPosition(left: number, leftOffset: number, right: number, rightOffset: number): -1 | 0 | 1 | null;
  rangePointRelation(node: number, offset: number, start: number, startOffset: number, end: number, endOffset: number): typeof RangePointRelation[keyof typeof RangePointRelation];
  rangeIntersectsNode(node: number, start: number, startOffset: number, end: number, endOffset: number): boolean | null;
  /**
   * Mirrors pinned stringifier short-circuits: null only when a containment comparison encounters distinct roots.
   * Disconnected Text endpoints can concatenate their partial data without reaching that comparison.
   */
  rangeText(start: number, startOffset: number, end: number, endOffset: number): string | null;
  /**
   * Requires allocated node, start and end handles before any plan or DOM rejection.
   * Endpoint topology requires no metadata; reservations remain unallocated on rejection.
   * @throws InvalidArg when any handle is malformed, reserved, released or unknown.
   */
  rangeBoundaryPlan(mode: typeof RangeBoundaryMode[keyof typeof RangeBoundaryMode], node: number, offset: number, start: number, startOffset: number, end: number, endOffset: number): RangeBoundaryPlan;
  /** Returns zero for distinct roots. */
  commonAncestor(left: number, right: number): number;
  rangePointRelationFromState(state: NativeRange, node: number, offset: number): typeof RangePointRelation[keyof typeof RangePointRelation];
  rangeIntersectsNodeFromState(state: NativeRange, node: number): boolean | null;
  rangeTextFromState(state: NativeRange): string | null;
  rangeBoundaryPlanFromState(state: NativeRange, mode: typeof RangeBoundaryMode[keyof typeof RangeBoundaryMode], node: number, offset: number): RangeBoundaryPlan;
  commonAncestorFromState(state: NativeRange): number;
  compareRangeStates(current: NativeRange, how: number, source: NativeRange): typeof RangeComparison[keyof typeof RangeComparison];
  rangeDeletionPlan(state: NativeRange): RangeDeletionPlan;
  /** Returns null for distinct roots; all endpoint handles must be allocated. */
  rangeContentSelection(state: NativeRange): RangeContentSelection | null;
  rangeSurroundStatus(state: NativeRange, parent: number): typeof RangeSurroundStatus[keyof typeof RangeSurroundStatus];
  /** Null rejects the start type; zero requests a synthetic body. Both endpoint handles must already be allocated. */
  rangeFragmentContext(state: NativeRange, htmlDocument: boolean): number | null;
  /** Advances numeric control only; created must be zero except when supplying an allocated result of the preceding creation. */
  rangeCloneStep(operation: NativeRangeClone, created: number): RangeCloneInstruction;
  rangeExtractStep(operation: NativeRangeExtract, created: number): RangeExtractInstruction;
  /** Returns null for an invalid start. Both endpoint handles and the inserted node must be allocated. */
  rangeInsertionPlan(state: NativeRange, node: number): RangeInsertionPlan | null;
  /** Re-reads topology after splitting/removing nodes. A zero reference means append. */
  rangeInsertionOffset(node: number, parent: number, reference: number): number;
  /** Replaces snapshot data; rejects elements with an initialized canonical attribute collection. */
  setData(handle: number, encoded: string): void;
  /** Snapshot transfer requires well-formed name/value pairs and no initialized attribute collection. */
  setHtmlElement(handle: number, name: string, attributes: string[]): void;
  /** Direct transfer for well-formed text, comments or containers. */
  setSimpleData(handle: number, kind: number, value: string): void;
  initializeAttribute(handle: number, encoded: string): void;
  initializePlainAttribute(handle: number, name: string, value: string): void;
  attributeField(handle: number, field: typeof AttributeField[keyof typeof AttributeField]): string | null;
  setAttributeValue(handle: number, value: string): void;
  /** Copies Attr data into a snapshot; rejects an initialized attribute collection, even for an empty list. */
  setElementFromAttributes(handle: number, encoded: string, attributes: number[]): void;
  /** Copies Attr data into an HTML snapshot; rejects an initialized attribute collection. */
  setHtmlElementFromAttributes(handle: number, name: string, attributes: number[]): void;
  /**
   * Initializes before metadata or after an empty Element snapshot; idempotent for existing collections.
   * @throws InvalidArg for non-Element metadata or snapshot attributes without a canonical collection.
   */
  initializeAttributeCollection(element: number): void;
  setUnicodeVersion(version: string): void;
  /** Selects bundled tables; returns false without changing state for an unknown profile. */
  trySetUnicodeVersion(version: string): boolean;
  /** Copies a Uint32Array's complete non-shared buffer of strictly increasing host lowercase-change scalars. */
  setHostUnicodeCaseChanges(changes: ArrayBuffer): void;
  /** Updates metadata or retypes an empty snapshot; rejects existing nonempty snapshots without a canonical index. */
  setElementMetadata(element: number, encoded: string): void;
  /** Updates HTML metadata while preserving canonical attributes; rejects existing nonempty snapshot-only data. */
  setHtmlElementMetadata(element: number, name: string): void;
  attributeIds(element: number): number[];
  attributeCount(element: number): number;
  attributeAt(element: number, index: number): number;
  attributeOwner(attribute: number): number;
  /** A non-null validated owner establishes canonical collection state; nonempty snapshots are rejected atomically. */
  initializeAttributeOwner(attribute: number, element: number | null): void;
  containsAttribute(element: number, attribute: number): boolean;
  attributeByName(element: number, name: string, htmlDocument: boolean): number;
  attributeByNamespace(element: number, namespace: string | null, name: string): number;
  attributeNames(element: number, supported: boolean, htmlDocument: boolean): string[];
  /** Attribute mutations initialize empty snapshots implicitly and reject nonempty snapshot-only data. */
  appendAttribute(element: number, attribute: number): AttributeDelta;
  removeAttribute(element: number, attribute: number): AttributeDelta;
  replaceAttribute(element: number, oldAttribute: number, newAttribute: number): AttributeDelta;
  setAttribute(element: number, attribute: number): AttributeDelta;
  /** Initializes canonical UTF-16 CharacterData; supported kinds are 3, 4, 7 and 8. */
  setCharacterData(handle: number, kind: number, value: string): void;
  getCharacterData(handle: number): string;
  characterLength(handle: number): number;
  substringData(handle: number, offset: number, count: number): string;
  replaceCharacterData(handle: number, offset: number, count: number, value: string): string;
  wholeText(handle: number): string;
  serializeHtml(handle: number, outer: boolean, scripting: boolean): string;
  query(selector: string, root: number, document: number,
    mode: typeof QueryMode[keyof typeof QueryMode], quirks: boolean): Float64Array | null;
  getLinks(handle: number): TreeLinks;
  append(parent: number, child: number): number;
  prepend(parent: number, child: number): number;
  insertBefore(reference: number, child: number): number;
  insertAfter(reference: number, child: number): number;
  remove(handle: number): number;
  descendants(handle: number): number[];
  release(handle: number): boolean;
  statistics(): Omit<NativeTreeStatistics, 'indexedNodes' | 'handleBatchSize'>;
}

/** Parses well-formed HTML input to the native event tape, returned as JSON. */
export function parseDocumentTape(markup: string): string;
/** Parses a fragment using the supplied context and attributes. */
export function parseFragmentTape(markup: string, contextName: string, contextNamespace: string,
  attributes: ContextAttribute[], scriptingEnabled: boolean): string;
