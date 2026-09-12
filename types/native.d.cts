/** Low-level Node-API contracts; ordinary DOM consumers should use the root API. */
import type { NativeTreeStatistics, NativeRangeStatistics } from './index.cjs';

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
