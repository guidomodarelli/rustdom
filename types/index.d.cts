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
/** Forest diagnostics plus the addon-wide native Range lifetime counters. */
export interface NativeRuntimeStatistics extends NativeTreeStatistics { rangeStates: NativeRangeStatistics; }

/** @returns A snapshot of actual native and compatibility parser calls. */
export function getParserStatistics(): ParserStatistics;
/** @returns A snapshot of native tree storage, caches and operation counts. */
export function getNativeTreeStatistics(): NativeRuntimeStatistics;
