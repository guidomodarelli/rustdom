/** Public jsdom-compatible API and native operation diagnostics. */
export * from 'jsdom';

/** Process-wide parser route counts; each call returns an independent snapshot. */
export interface ParserStatistics {
  nativeDocument: number;
  nativeFragment: number;
  fallback: Record<string, number>;
}

/** Native allocation and operation counts without references to DOM objects. */
export interface NativeTreeStatistics {
  attributeCollections: number;
  attributeOwners: number;
  attributeHolders: number;
  liveNodes: number;
  capacity: number;
  allocations: number;
  releases: number;
  mutations: number;
  reservedHandles: number;
  dataNodes: number;
  dataUpdates: number;
  serializations: number;
  nativeQueries: number;
  queryFallbacks: number;
  selectorCacheHits: number;
  selectorCacheSize: number;
  indexedNodes: number;
  handleBatchSize: number;
}

/** Counts for NativeRange boxes in this loaded addon, including worker environments; never retains instances. */
export interface NativeRangeStatistics { live: number; created: number; released: number; }
/** Numeric host relationships and their compact storage capacities. */
export interface NativeRootHostStatistics { hostedRoots: number; hostOwners: number; rootCapacity: number; ownerCapacity: number; }
/** Only nonempty slotable names consume sparse native state. */
export interface NativeSlotableNameStatistics { namedNodes: number; capacity: number; }
/** Cached lists, reverse memberships and their retained storage. */
export interface NativeSlotAssignmentStatistics { slots: number; entries: number; members: number; slotCapacity: number; memberCapacity: number; vectorCapacity: number; }
/** Recorded slot links and capacities, including the reverse owner sets. */
export interface NativeSlotBacklinkStatistics { assignedNodes: number; slotOwners: number; nodeCapacity: number; ownerCapacity: number; referenceCapacity: number; }
/** Live queued slots and storage, including finalized numeric entries awaiting compaction or drain. */
export interface NativeSlotSignalStatistics { pendingSlots: number; queueEntries: number; queueCapacity: number; membershipCapacity: number; }
/** Forest diagnostics plus the addon-wide native Range lifetime counters. */
export interface NativeRuntimeStatistics extends NativeTreeStatistics { rootHosts: NativeRootHostStatistics; slotableNames: NativeSlotableNameStatistics; slotAssignments: NativeSlotAssignmentStatistics; slotBacklinks: NativeSlotBacklinkStatistics; slotSignals: NativeSlotSignalStatistics; rangeStates: NativeRangeStatistics; rangeClones: NativeRangeStatistics; rangeExtracts: NativeRangeStatistics; }

/** @returns A snapshot of actual native and compatibility parser calls. */
export function getParserStatistics(): ParserStatistics;
/** @returns A snapshot of native tree storage, caches and operation counts. */
export function getNativeTreeStatistics(): NativeRuntimeStatistics;
