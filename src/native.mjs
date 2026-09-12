/** @module rustdom/native Exposes explicit ESM names for the real Node-API addon. */
import native from './native.cjs';
/** Reexport the canonical addon objects without allocating native instances or duplicating enum values. */
export const {
  NativeTree, NativeRange, QueryMode, AttributeField, DocumentTypeField, NodeTextWriteAction,
  RangePointRelation, RangeBoundaryMode, RangeBoundaryAction, RangeComparison, RangeDeletionKind, RangeSurroundStatus,
  RangeMutationKind, RangeEndpoint,
  NativeRangeClone, RangeCloneAction,
  NativeRangeExtract, RangeExtractAction,
  parseDocumentTape, parseFragmentTape,
} = native;
export default native;
