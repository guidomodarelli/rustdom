/** Low-level Node-API contracts; ordinary DOM consumers should use the root API. */
import type { NativeTreeStatistics } from './index.cjs';

/** A contextual parser attribute, including optional XML metadata. */
export interface ContextAttribute { name: string; value: string; namespace?: string; prefix?: string; }
/** Stable native links; zero denotes a missing related node. */
export interface TreeLinks {
  id: number; parent: number; previous: number; next: number; first: number; last: number;
  childCount: number; childrenVersion: number;
}
/** Host GC-reference changes after a native attribute mutation. */
export interface AttributeDelta { previous: number; changed: boolean; attached: number; detached: number; released: number[]; }
/** Query modes accepted by the native matcher. */
export const QueryMode: { readonly All: 0; readonly First: 1; readonly Matches: 2; readonly Closest: 3 };
/** Canonical Attr metadata fields. */
export const AttributeField: { readonly Name: 0; readonly Namespace: 1; readonly Prefix: 2; readonly Value: 3; readonly QualifiedName: 4 };
/** Canonical DocumentType identifiers. */
export const DocumentTypeField: { readonly Name: 0; readonly PublicId: 1; readonly SystemId: 2 };

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
  /** Updates element metadata while preserving its canonical attribute collection. */
  setElementMetadata(element: number, encoded: string): void;
  /** Updates HTML element metadata while preserving its canonical attribute collection. */
  setHtmlElementMetadata(element: number, name: string): void;
  attributeIds(element: number): number[];
  attributeCount(element: number): number;
  attributeAt(element: number, index: number): number;
  attributeOwner(attribute: number): number;
  initializeAttributeOwner(attribute: number, element: number | null): void;
  containsAttribute(element: number, attribute: number): boolean;
  attributeByName(element: number, name: string, htmlDocument: boolean): number;
  attributeByNamespace(element: number, namespace: string | null, name: string): number;
  attributeNames(element: number, supported: boolean, htmlDocument: boolean): string[];
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
