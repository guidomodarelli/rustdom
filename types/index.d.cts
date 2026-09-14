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
/** V8-finalized assignment controller lifetimes across this addon. */
export interface NativeSlotAssignmentDriverStatistics { live: number; created: number; released: number; }
/** Immutable native MutationRecord boxes; counters do not retain instances. */
export interface NativeMutationRecordStatistics { live: number; created: number; released: number; }
/** Forest diagnostics plus the addon-wide native Range lifetime counters. */
/** Native observer membership and retained allocation capacity, without JavaScript references. */
export interface NativeMutationObserverStatistics { observers: number; observedNodes: number; registrations: number; observerCapacity: number; nodeCapacity: number; registrationCapacity: number; targetCapacity: number; queuedRecords: number; queueObservers: number; queueCapacity: number; queueMapCapacity: number; }
/** Native active membership and coalescing flag; callbacks and owners remain in the host. */
export interface NativeMutationNotificationStatistics { pendingObservers: number; capacity: number; microtaskQueued: boolean; }
export interface NativeObserverDeliveryStatistics { live: number; created: number; released: number; }
export interface NativeEventStatistics { live: number; created: number; released: number; }
export interface NativeListenerStatistics { live: number; created: number; released: number; listeners: number; eventTypes: number; }
export interface NativeAbortStatistics { live: number; created: number; released: number; links: number; algorithms: number; }
export interface NativeXmlStatistics { live: number; created: number; released: number; inputUnits: number; events: number; }
/** Active serialization calls and their temporary roots, including cleanup diagnostics. */
export interface NativeXmlSerializationStatistics { live: number; created: number; references: number; cleanupErrors: number; }
/** Lists and shared token-set allocations, without references to DOM owners. */
export interface NativeTokenListStatistics { live: number; created: number; released: number; sets: number; tokenUnits: number; }
/** Cumulative calls to stateless dataset algorithms; no owner references are stored in these counters. */
export interface NativeDatasetStatistics { reads: number; enumerations: number; namePlans: number; }
export interface NativeRuntimeStatistics extends NativeTreeStatistics { rootHosts: NativeRootHostStatistics; slotableNames: NativeSlotableNameStatistics; slotAssignments: NativeSlotAssignmentStatistics; slotBacklinks: NativeSlotBacklinkStatistics; slotSignals: NativeSlotSignalStatistics; slotAssignmentDrivers: NativeSlotAssignmentDriverStatistics; mutationRecords: NativeMutationRecordStatistics; mutationObservers: NativeMutationObserverStatistics; mutationNotifications: NativeMutationNotificationStatistics; observerDeliveries: NativeObserverDeliveryStatistics; eventStates: NativeEventStatistics; listenerRegistries: NativeListenerStatistics; abortStates: NativeAbortStatistics; xmlParsers: NativeXmlStatistics; xmlSerialization: NativeXmlSerializationStatistics; tokenLists: NativeTokenListStatistics; dataset: NativeDatasetStatistics; traversals: { live: number; created: number; released: number; operations: number; createdOperations: number }; rangeStates: NativeRangeStatistics; rangeClones: NativeRangeStatistics; rangeExtracts: NativeRangeStatistics; }

/** @returns A snapshot of actual native and compatibility parser calls. */
export function getParserStatistics(): ParserStatistics;
/** @returns A snapshot of native tree storage, caches and operation counts. */
export function getNativeTreeStatistics(): NativeRuntimeStatistics;
