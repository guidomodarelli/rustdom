/** @module rustdom/native-tree Keeps Rust topology authoritative and JS ownership edges visible to V8 GC. */
'use strict';
const SymbolTree = require('symbol-tree');
const { NativeTree, NativeDomRect, NativeStorageArea, NativeBlobMetadata, NativeFileReaderState, NativeFormDataEntries, classReferenceStatistics, NativeRange, NativeRangeClone, NativeRangeExtract, NativeSlotAssignmentDriver, NativeMutationRecord, NativeObserverDelivery, NativeEventState, NativeListenerRegistry, NativeAbortState, NativeXmlParser, xmlSerializationStatistics, NativeTraversal, NativeTokenList, ObserverDeliveryAction, ObservationStatus, SlotAssignmentAction, QueryMode, AttributeField, DocumentTypeField, RangePointRelation, RangeBoundaryMode, RangeBoundaryAction, RangeComparison, RangeDeletionKind, RangeSurroundStatus, RangeMutationKind, RangeEndpoint, NodeTextWriteAction, NodeInsertionStatus } = require('../../dist/native.cjs');
const { writeNodeData, writeAttribute } = require('./data-bridge.cjs');
const { runContents } = require('./range-content-driver.cjs');
const { BOUNDARY_ROOT_ERROR_MESSAGE } = require('./range-errors.cjs');
/** Initialize native case data without assuming every host version was known at build time. */
const { initializeHostUnicode } = require('./host-unicode.cjs');
/** Shared pinned diagnostics; the exception realm remains specific to the calling operation. */
const RANGE_INVALID_TYPE_MESSAGE = "DocumentType Node can't be used as boundary point.";
const RANGE_OFFSET_MESSAGE = 'Offset out of bound.';
const RANGE_NO_PARENT_MESSAGE = 'The given Node has no parent.';
/** Pinned public comparison diagnostic, independent of which endpoint pair is selected. */
const RANGE_COMPARISON_METHOD_MESSAGE = "The comparison method provided must be one of 'START_TO_START', 'START_TO_END', 'END_TO_END', " +
  "or 'END_TO_START'.";
/** Preserve the reference implementation's host TypeError and rejection precedence after native normalization. */
const OBSERVATION_ERROR_MESSAGES = {
  [ObservationStatus.MissingMutationKind]: "The options object must set at least one of 'attributes', 'characterData', or 'childList' to true.",
  [ObservationStatus.AttributeOldValueWithoutAttributes]: "The options object may only set 'attributeOldValue' to true when 'attributes' is true or not present.",
  [ObservationStatus.AttributeFilterWithoutAttributes]: "The options object may only set 'attributeFilter' when 'attributes' is true or not present.",
  [ObservationStatus.CharacterOldValueWithoutCharacterData]: "The options object may only set 'characterDataOldValue' to true when 'characterData' is true or not present.",
};
/** Empty input lists are immutable binding data and need not be reallocated for every unobserved mutation. */
const EMPTY_NODE_HANDLES = Object.freeze([]);

/**
 * Execute topology changes in Rust, then replay them into V8-visible ownership edges.
 * @extends SymbolTree
 */
class NativeSymbolTree extends SymbolTree {
  /** @param {string} [description] - Debug description for the per-node ownership symbol. */
  constructor(description) {
    super(description);
    this._arena = new NativeTree();
    initializeHostUnicode(this._arena, process.versions.unicode);
    this._handleBatchSize = this._arena.handleBatchSize;
    this._objects = new Map();
    this._observers = new Map();
    this._activeObserverOwners = new Map();
    this._signalSlotOwners = [];
    this._nextHandle = 0;
    this._handleLimit = 0;
    const arena = this._arena;
    const objects = this._objects;
    const observers = this._observers;
    this._collectedObservers = new FinalizationRegistry((id) => {
      observers.delete(id);
      arena.releaseMutationObserver(id);
    });
    this._collected = new FinalizationRegistry((id) => {
      objects.delete(id);
      arena.release(id);
    });
    // Holdings contain only numeric IDs and a WeakRef to the target, never a node or window.
    this._collectedRanges = new FinalizationRegistry((registration) => {
      const start = objects.get(registration.start)?.deref();
      if (start) start._referencedRanges.delete(registration.reference);
      if (registration.end !== registration.start) {
        const end = objects.get(registration.end)?.deref();
        if (end) end._referencedRanges.delete(registration.reference);
      }
    });
  }

  /**
   * Read GC-visible edges without a native call on the hot traversal path.
   * @param {object|null} object - DOM node or a related null pointer.
   * @returns {object|null} Its cached ownership edges, never a separate public DOM wrapper.
   */
  _node(object) {
    if (!object) return null;
    return object[this.symbol] || super._node(object);
  }

  /**
   * Index only nodes that participate in topology or a native traversal.
   * @param {object} object - Real node entering native storage.
   * @returns {number} Its stable native handle.
   */
  _identify(object) {
    const record = this._node(object);
    if (record.nativeId === undefined) {
      if (this._nextHandle === this._handleLimit) {
        this._nextHandle = this._arena.reserveHandles();
        this._handleLimit = this._nextHandle + this._handleBatchSize;
      }
      record.nativeId = this._nextHandle++;
      record.nativeChildCount = 0;
      this._objects.set(record.nativeId, new WeakRef(object));
      this._collected.register(object, record.nativeId);
    }
    return record.nativeId;
  }

  /** @param {object} object - DOM node. @returns {number} A handle with initialized native metadata. */
  _ensure(object) {
    const id = this._identify(object);
    const record = this._node(object);
    if (!record.nativeDataReady) {
      writeNodeData(this._arena, record.nativeId, object, (node) => this._ensure(node));
      record.nativeDataReady = true;
    }
    return id;
  }

  /** @param {object} object - Mutated DOM implementation. @returns {void} Updates an indexed node's native data. */
  updateNodeData(object) {
    const record = this._node(object);
    if (record.nativeCharacterKind !== undefined || record.nativeAttribute || record.nativeImmutableMetadata) return;
    if (record.nativeId !== undefined) {
      writeNodeData(this._arena, record.nativeId, object, (node) => this._ensure(node));
      record.nativeDataReady = true;
    }
  }

  /** @param {object} node - CharacterData implementation. @param {number} kind - Final subclass kind. @param {string} value - Initial UTF-16 value. @returns {void} */
  initializeCharacterData(node, kind, value) {
    const id = this._identify(node);
    this._arena.setCharacterData(id, kind, value);
    const record = this._node(node);
    record.nativeCharacterKind = kind;
    record.nativeDataReady = true;
  }

  /** @param {object} node - CharacterData implementation. @returns {string} Its current native value. */
  characterData(node) { return this._arena.getCharacterData(this._identify(node)); }
  /** @param {object} node - CharacterData implementation. @param {string} value - Replacement value. @returns {void} */
  setCharacterData(node, value) { this._arena.setCharacterData(this._identify(node), this._node(node).nativeCharacterKind, value); }
  /** @param {object} node - CharacterData implementation. @returns {number} UTF-16 length without transferring text. */
  characterLength(node) { return this._arena.characterLength(this._identify(node)); }
  /** @param {object} node - CharacterData implementation. @param {number} offset - UTF-16 offset. @param {number} count - Requested units. @returns {string} Native slice. */
  substringData(node, offset, count) { return this._arena.substringData(this._identify(node), offset, count); }
  /** @param {object} node - CharacterData implementation. @param {number} offset - UTF-16 offset. @param {number} count - Units to replace. @param {string} value - New units. @returns {string} Previous value for observers. */
  replaceCharacterData(node, offset, count, value) { return this._arena.replaceCharacterData(this._identify(node), offset, count, value); }
  /** @param {object} node - Text or CDATA implementation. @returns {string} Adjacent text from the native tree. */
  wholeText(node) { return this._arena.wholeText(this._identify(node)); }

  /** @param {object} node - DocumentType implementation. @param {object} data - Initial identifiers. @returns {void} */
  initializeDocumentType(node, data) {
    this._arena.initializeDocumentType(this._identify(node), data.name, data.publicId, data.systemId);
    const record = this._node(node);
    record.nativeDataReady = true;
    record.nativeImmutableMetadata = true;
  }
  /** @param {object} node - DocumentType. @returns {string} Native qualified name. */
  documentTypeName(node) { return this._arena.documentTypeField(this._identify(node), DocumentTypeField.Name); }
  /** @param {object} node - DocumentType. @returns {string} Native public identifier. */
  documentTypePublicId(node) { return this._arena.documentTypeField(this._identify(node), DocumentTypeField.PublicId); }
  /** @param {object} node - DocumentType. @returns {string} Native system identifier. */
  documentTypeSystemId(node) { return this._arena.documentTypeField(this._identify(node), DocumentTypeField.SystemId); }
  /** @param {object} node - ProcessingInstruction. @param {string} target - Initial target. @returns {void} */
  initializeProcessingInstructionTarget(node, target) { this._arena.initializeProcessingInstructionTarget(this._identify(node), target); }
  /** @param {object} node - ProcessingInstruction. @returns {string} Native target. */
  processingInstructionTarget(node) { return this._arena.processingInstructionTarget(this._identify(node)); }
  /** @param {object} left - Context node. @param {object|null} right - Compared node. @returns {boolean} Native subtree equality. */
  equalNode(left, right) { return right !== null && this._arena.equalNode(this._ensure(left), this._ensure(right)); }
  /** @param {object} ancestor - Context node. @param {object|null} descendant - Candidate descendant. @returns {boolean} Native inclusive ancestry. */
  containsNode(ancestor, descendant) { return descendant !== null && this._arena.containsNode(this._ensure(ancestor), this._ensure(descendant)); }
  /** @param {object} left - Context node. @param {object} right - Compared node. @returns {number} Native document position bitmask. */
  compareDocumentPosition(left, right) { return this._arena.compareDocumentPosition(this._ensure(left), this._ensure(right)); }
  /** @param {object} node - Context node. @param {string|null} prefix - Requested prefix. @returns {string|null} Native namespace lookup. */
  lookupNamespaceURI(node, prefix) { return this._arena.lookupNamespaceUri(this._ensure(node), prefix); }
  /** @param {object} node - Context node. @param {string|null} namespace - Requested URI. @returns {string|null} Native prefix lookup. */
  lookupPrefix(node, namespace) { return this._arena.lookupPrefix(this._ensure(node), namespace); }
  /** @param {object} node - Context node. @param {string|null} namespace - Requested URI. @returns {boolean} Native default namespace comparison. */
  isDefaultNamespace(node, namespace) { return this._arena.isDefaultNamespace(this._ensure(node), namespace); }
  /** @param {object} node - Context node. @returns {string|null} Current native node value. */
  nodeValue(node) { return this._arena.nodeValue(this._ensure(node)); }
  /** @param {object} node - Context node. @returns {string|null} Native value or aggregated descendant text. */
  textContent(node) { return this._arena.textContent(this._ensure(node)); }

  /** @param {object} node - DOM implementation. @param {string|null} value - Converted public value. @param {boolean} contents - Select textContent semantics. @param {Function} setAttributeValue - Existing attribute mutation hook. @returns {void} Delivers the native decision with original mutation and reaction ordering. */
  setNodeText(node, value, contents, setAttributeValue) {
    if (value === null) value = '';
    switch (this._arena.textWriteAction(this._ensure(node), contents)) {
      case NodeTextWriteAction.Ignore: return;
      case NodeTextWriteAction.Attribute: setAttributeValue(node, value); return;
      case NodeTextWriteAction.CharacterData: node.replaceData(0, node.length, value); return;
      case NodeTextWriteAction.ReplaceChildren: {
        const child = value !== '' ? node._ownerDocument.createTextNode(value) : null;
        node._replaceAll(child); return;
      }
      default: throw new Error('rustdom Node text setter: unsupported native action');
    }
  }
  /** @param {object} root - Inclusive normalization context. @returns {object[]} Snapshot of Text candidates. */
  normalizationCandidates(root) { return this._arena.normalizationCandidates(this._ensure(root)).map((id) => this._object(id)); }
  /** @param {object} range - Range or StaticRange implementation. @param {object} data - Private constructor endpoints or an independent native copy. @returns {void} */
  initializeRangeState(range, data) {
    if (data.nativeCopy) {
      range._nativeRange = data.nativeCopy;
      range._rangeStartNode = data.startNode; range._rangeEndNode = data.endNode;
      return;
    }
    const { start, end } = data;
    range._nativeRange = new NativeRange();
    range._rangeStartNode = start?.node;
    range._rangeEndNode = end?.node;
    if (start) range._nativeRange.setStart(this._ensure(start.node), start.offset);
    if (end) range._nativeRange.setEnd(this._ensure(end.node), end.offset);
  }
  /** @param {object} range - Source Range implementation. @returns {object} Independent numeric state with GC-visible endpoint identities. */
  cloneRangeData(range) {
    return { nativeCopy: range._nativeRange.copy(), startNode: range._rangeStartNode, endNode: range._rangeEndNode };
  }
  /** @param {object} range - New clone with copied native state and a registered WeakRef. @returns {void} Attaches live ownership without rewriting native values. */
  attachRangeCopy(range) {
    const start = range._rangeStartNode; const end = range._rangeEndNode;
    range._rangeRegistration.start = this._ensure(start);
    if (!start._referencedRanges.has(range._weakRef)) start._referencedRanges.add(range._weakRef);
    range._rangeRegistration.end = this._ensure(end);
    if (!end._referencedRanges.has(range._weakRef)) end._referencedRanges.add(range._weakRef);
  }
  /** @param {object} range - Live Range implementation. @param {boolean} toStart - Public converted direction. @returns {void} Applies the native collapse decision to the correct ownership edge. */
  collapseRange(range, toStart) {
    const plan = range._nativeRange.collapsePlan(Boolean(toStart));
    const node = this._object(plan.node);
    if (plan.updateStart) range._setLiveRangeStart(node, plan.offset);
    else range._setLiveRangeEnd(node, plan.offset);
  }
  /** @param {object} range - Receiver Range. @param {number} how - Converted comparison method. @param {object} source - Other Range. @param {object} exceptionFactory - Original DOMException factory. @returns {number} Native relative ordering. */
  compareRanges(range, how, source, exceptionFactory) {
    const result = this._arena.compareRangeStates(range._nativeRange, how, source._nativeRange);
    switch (result) {
      case RangeComparison.Before: return -1;
      case RangeComparison.Equal: return 0;
      case RangeComparison.After: return 1;
      case RangeComparison.UnsupportedMethod:
        throw exceptionFactory.create(range._globalObject, [RANGE_COMPARISON_METHOD_MESSAGE, 'NotSupportedError']);
      case RangeComparison.DifferentRoot:
        throw exceptionFactory.create(range._globalObject, ['The two Ranges are not in the same tree.', 'WrongDocumentError']);
      case RangeComparison.InconsistentRoots: throw new Error(BOUNDARY_ROOT_ERROR_MESSAGE);
      default: throw new Error(`NativeTree: unsupported range comparison result ${result}`);
    }
  }
  /** @param {object} range - Live Range whose WeakRef was just created. @returns {void} Registers cleanup without a strong path back to the Range. */
  registerLiveRange(range) {
    const registration = { reference: range._weakRef, start: 0, end: 0 };
    range._rangeRegistration = registration;
    this._collectedRanges.register(range, registration);
  }
  /** @param {object} range - Live Range implementation. @param {object} node - New start node. @param {number} offset - Internal offset, already computed by the caller. @returns {void} */
  setLiveRangeStart(range, node, offset) {
    const id = this._ensure(node);
    const previous = range._rangeStartNode;
    if (previous && previous !== node && previous !== range._rangeEndNode) previous._referencedRanges.delete(range._weakRef);
    range._rangeRegistration.start = id;
    if (!node._referencedRanges.has(range._weakRef)) node._referencedRanges.add(range._weakRef);
    range._nativeRange.setStart(id, offset);
    range._rangeStartNode = node;
  }
  /** @param {object} range - Live Range implementation. @param {object} node - New end node. @param {number} offset - Internal offset, already computed by the caller. @returns {void} */
  setLiveRangeEnd(range, node, offset) {
    const id = this._ensure(node);
    const previous = range._rangeEndNode;
    if (previous && previous !== node && previous !== range._rangeStartNode) previous._referencedRanges.delete(range._weakRef);
    range._rangeRegistration.end = id;
    if (!node._referencedRanges.has(range._weakRef)) node._referencedRanges.add(range._weakRef);
    range._nativeRange.setEnd(id, offset);
    range._rangeEndNode = node;
  }
  /** @param {object} left - Boundary with node/offset. @param {object} right - Other boundary. @returns {number} Native relative order with the pinned same-root diagnostic. */
  compareBoundaryPointsPosition(left, right) {
    const result = this._arena.compareBoundaryPointsPosition(this._ensure(left.node), left.offset,
      this._ensure(right.node), right.offset);
    if (result === null) throw new Error(BOUNDARY_ROOT_ERROR_MESSAGE);
    return result;
  }
  /** @param {object} range - Live Range implementation. @param {object} node - Query node. @param {number} offset - Converted WebIDL offset. @param {object} exceptionFactory - Pinned DOMException factory. @returns {number|null} Relation or distinct-root signal. */
  rangePointPosition(range, node, offset, exceptionFactory) {
    const result = this._arena.rangePointRelationFromState(range._nativeRange, this._ensure(node), offset);
    switch (result) {
      case RangePointRelation.Before: return -1;
      case RangePointRelation.Inside: return 0;
      case RangePointRelation.After: return 1;
      case RangePointRelation.DifferentRoot: return null;
      case RangePointRelation.InvalidNodeType:
        throw exceptionFactory.create(node._globalObject, [RANGE_INVALID_TYPE_MESSAGE, 'InvalidNodeTypeError']);
      case RangePointRelation.InvalidOffset:
        throw exceptionFactory.create(node._globalObject, [RANGE_OFFSET_MESSAGE, 'IndexSizeError']);
      case RangePointRelation.InconsistentRoots: throw new Error(BOUNDARY_ROOT_ERROR_MESSAGE);
      default: throw new Error(`NativeTree: unsupported range point result ${result}`);
    }
  }
  /** @param {object} range - Live Range implementation. @param {object} node - Candidate intersection. @returns {boolean} Native overlap decision. */
  rangeIntersectsNode(range, node) {
    const result = this._arena.rangeIntersectsNodeFromState(range._nativeRange, this._ensure(node));
    if (result === null) throw new Error(BOUNDARY_ROOT_ERROR_MESSAGE);
    return result;
  }
  /** @param {object} left - First endpoint node. @param {object} right - Second endpoint node. @returns {object|null} Original inclusive common ancestor identity. */
  commonAncestor(left, right) { return this._object(this._arena.commonAncestor(this._ensure(left), this._ensure(right))); }
  /** @param {object} range - Range implementation with initialized native state. @returns {object|null} Original ancestor identity. */
  rangeCommonAncestor(range) { return this._object(this._arena.commonAncestorFromState(range._nativeRange)); }
  /**
   * Apply ordered live-reference updates after Rust accepts the requested boundary change.
   * @param {object} range - Live Range implementation.
   * @param {object} node - Requested node, or sibling reference for a relative setter.
   * @param {number} offset - WebIDL-converted offset; ignored for relative setters and selections.
   * @param {string} modeName - Key of the native RangeBoundaryMode vocabulary.
   * @param {object} exceptionFactory - Pinned DOMException factory.
   * @returns {void}
   */
  setRangeBoundary(range, node, offset, modeName, exceptionFactory) {
    const mode = RangeBoundaryMode[modeName];
    const plan = this._arena.rangeBoundaryPlanFromState(range._nativeRange, mode, this._ensure(node), offset);
    if (plan.action === RangeBoundaryAction.NoParent) {
      throw exceptionFactory.create(mode === RangeBoundaryMode.SelectNode ? node._globalObject : range._globalObject,
        [RANGE_NO_PARENT_MESSAGE, 'InvalidNodeTypeError']);
    }
    if (plan.action === RangeBoundaryAction.InvalidNodeType || plan.action === RangeBoundaryAction.InvalidOffset) {
      const relative = mode === RangeBoundaryMode.StartBefore || mode === RangeBoundaryMode.StartAfter ||
        mode === RangeBoundaryMode.EndBefore || mode === RangeBoundaryMode.EndAfter;
      const realm = mode === RangeBoundaryMode.SelectContents ? range._globalObject : (relative ? this.parent(node) : node)._globalObject;
      throw exceptionFactory.create(realm, plan.action === RangeBoundaryAction.InvalidNodeType
        ? [RANGE_INVALID_TYPE_MESSAGE, 'InvalidNodeTypeError'] : [RANGE_OFFSET_MESSAGE, 'IndexSizeError']);
    }
    if (plan.action === RangeBoundaryAction.InconsistentRoots) throw new Error(BOUNDARY_ROOT_ERROR_MESSAGE);
    const target = this._object(plan.node);
    switch (plan.action) {
      case RangeBoundaryAction.Start: range._setLiveRangeStart(target, plan.startOffset); break;
      case RangeBoundaryAction.End: range._setLiveRangeEnd(target, plan.endOffset); break;
      case RangeBoundaryAction.BothStartFirst:
        range._setLiveRangeStart(target, plan.startOffset); range._setLiveRangeEnd(target, plan.endOffset); break;
      case RangeBoundaryAction.BothEndFirst:
        range._setLiveRangeEnd(target, plan.endOffset); range._setLiveRangeStart(target, plan.startOffset); break;
      default: throw new Error(`NativeTree: unsupported range boundary action ${plan.action}`);
    }
  }
  /** @param {object} range - Live Range with updated native offsets. @param {number} moved - Native endpoint-move flags. @returns {void} Moves only changed V8 ownership edges, in start/end order. */
  applyRangeMoves(range, moved) {
    if (moved & RangeEndpoint.Start) {
      const point = range._nativeRange.start;
      range._setLiveRangeStart(this._object(point.node), point.offset);
    }
    if (moved & RangeEndpoint.End) {
      const point = range._nativeRange.end;
      range._setLiveRangeEnd(this._object(point.node), point.offset);
    }
  }
  /** @param {object} node - Changed CharacterData. @param {number} offset - Validated start. @param {number} count - Clamped removal length. @param {number} insertedLength - Inserted UTF-16 units. @returns {void} */
  adjustCharacterDataRanges(node, offset, count, insertedLength) {
    if (node._referencedRanges.size === 0) return;
    const id = this._ensure(node);
    for (const range of node._liveRanges()) range._nativeRange.applyCharacterData(id, offset, count, insertedLength);
  }
  /** @param {object} node - Original Text. @param {object} target - Split tail. @param {number} offset - Split position. @returns {void} */
  adjustSplitTextRanges(node, target, offset) {
    if (node._referencedRanges.size === 0) return;
    const sourceId = this._ensure(node); const targetId = this._ensure(target);
    for (const range of node._liveRanges()) this.applyRangeMoves(range, range._nativeRange.applyTreeMutation(RangeMutationKind.SplitText, sourceId, targetId, offset, 0));
  }
  /** @param {object} parent - Split Text's parent. @param {number} index - Original Text's current index. @returns {void} */
  adjustSplitParentRanges(parent, index) {
    if (parent._referencedRanges.size === 0) return;
    const id = this._ensure(parent);
    for (const range of parent._liveRanges()) range._nativeRange.applyTreeMutation(RangeMutationKind.SplitParent, id, id, index, 0);
  }
  /** @param {object} parent - Insertion parent. @param {number} index - Reference index. @param {number} count - Captured inserted count. @returns {void} */
  adjustInsertedRanges(parent, index, count) {
    if (parent._referencedRanges.size === 0) return;
    const id = this._ensure(parent);
    for (const range of parent._liveRanges()) this.applyRangeMoves(range, range._nativeRange.applyTreeMutation(RangeMutationKind.Insert, id, id, index, count));
  }
  /** @param {object} node - Descendant visited before removal. @param {object} parent - Removal parent. @param {number} index - Removal position. @returns {void} */
  adjustRemovedDescendantRanges(node, parent, index) {
    if (node._referencedRanges.size === 0) return;
    const sourceId = this._ensure(node); const parentId = this._ensure(parent);
    for (const range of node._liveRanges()) this.applyRangeMoves(range, range._nativeRange.applyTreeMutation(RangeMutationKind.RemoveDescendant, sourceId, parentId, index, 0));
  }
  /** @param {object} parent - Removal parent. @param {number} index - Removal position. @returns {void} */
  adjustRemovedParentRanges(parent, index) {
    if (parent._referencedRanges.size === 0) return;
    const id = this._ensure(parent);
    for (const range of parent._liveRanges()) range._nativeRange.applyTreeMutation(RangeMutationKind.RemoveParent, id, id, index, 0);
  }
  /** @param {object} node - Retained Text whose existing range set is iterated. @param {object} current - Continuous Text. @param {number} length - Previously accumulated UTF-16 length. @returns {void} */
  adjustNormalizedTextRanges(node, current, length) {
    if (node._referencedRanges.size === 0) return;
    const sourceId = this._ensure(current); const targetId = this._ensure(node);
    for (const range of node._liveRanges()) this.applyRangeMoves(range, range._nativeRange.applyTreeMutation(RangeMutationKind.NormalizeText, sourceId, targetId, 0, length));
  }
  /** @param {object} parent - Normalization parent. @param {object} target - Retained Text. @param {number} index - Continuous Text's current index. @param {number} length - Previously accumulated length. @returns {void} */
  adjustNormalizedParentRanges(parent, target, index, length) {
    if (parent._referencedRanges.size === 0) return;
    const parentId = this._ensure(parent); const targetId = this._ensure(target);
    for (const range of parent._liveRanges()) this.applyRangeMoves(range, range._nativeRange.applyTreeMutation(RangeMutationKind.NormalizeParent, parentId, targetId, index, length));
  }
  /** @param {object} range - Live Range implementation. @returns {string} Native UTF-16 stringification without retained nodes. */
  rangeText(range) {
    const result = this._arena.rangeTextFromState(range._nativeRange);
    if (result === null) throw new Error(BOUNDARY_ROOT_ERROR_MESSAGE);
    return result;
  }
  /** @param {object} range - Live Range implementation. @returns {object|null} Stable original identities and ordered work for deleteContents. */
  rangeDeletionPlan(range) {
    const plan = this._arena.rangeDeletionPlan(range._nativeRange);
    if (plan.kind === RangeDeletionKind.Empty) return null;
    if (plan.kind === RangeDeletionKind.InconsistentRoots) throw new Error(BOUNDARY_ROOT_ERROR_MESSAGE);
    plan.characterDataOnly = plan.kind === RangeDeletionKind.CharacterData;
    plan.startNode = this._object(plan.startNode); plan.endNode = this._object(plan.endNode);
    plan.collapseNode = this._object(plan.collapseNode);
    plan.nodes = plan.nodes.map((id) => this._object(id));
    return plan;
  }
  /** @param {object} range - Live Range implementation. @returns {object} Stable selection identities for cloneContents/extractContents. */
  rangeContentSelection(range) {
    const selection = this._arena.rangeContentSelection(range._nativeRange);
    if (selection === null) throw new Error(BOUNDARY_ROOT_ERROR_MESSAGE);
    selection.commonAncestor = this._object(selection.commonAncestor);
    selection.firstPartial = this._object(selection.firstPartial); selection.lastPartial = this._object(selection.lastPartial);
    selection.contained = selection.contained.map((id) => this._object(id));
    selection.collapseNode = this._object(selection.collapseNode);
    return selection;
  }
  /** @param {object} node - DOM implementation. @returns {object} Native root; empty inputs preserve the original parent-access TypeError. */
  nodeRoot(node) {
    if (!node) return super.parent(node);
    return this._object(this._arena.nodeRoot(this._ensure(node)));
  }
  /** @param {object} node - DOM implementation. @returns {number} Pinned DOM length in UTF-16 units or children. */
  nodeLength(node) { return this._arena.nodeLength(this._ensure(node)); }
  /** @param {object} root - Fragment implementation. @returns {object|null|undefined} Original host value with a V8-visible ownership edge. */
  rootHost(root) { return this._node(root).nativeHost; }
  /** @param {object} node - Real target implementation. @param {object|null} reference - Real reference node or a non-node target sentinel. @returns {object} Target visible from the reference after native host traversal. */
  retarget(node, reference) { return this._object(this._arena.retarget(this._ensure(node), reference ? this._ensure(reference) : 0)); }
  /** @param {object} node - Initialized Element or Text. @returns {string} Native slotable name, including its default empty value. */
  slotableName(node) { return this._arena.getSlotableName(this._ensure(node)); }
  /** @param {object} node - Initialized Element or Text. @param {string} name - Name supplied by the original mutation hook. @returns {void} Stores only nonempty names. */
  setSlotableName(node, name) { this._arena.setSlotableName(this._ensure(node), name); }
  /** @param {object} root - Selected shadow root. @param {object} node - Candidate, including CDATASection inheriting Text's name in jsdom. @returns {object|null} First matching slot with its original identity. */
  findSlot(root, node) { return node.nodeType === 1 || node.nodeType === 3 || node.nodeType === 4 ? this._object(this._arena.findSlotFor(this._ensure(root), this._ensure(node))) : null; }
  /** @param {object} slot - Real slot implementation. @returns {object[]} Current assigned candidates in host-child order, without changing cached assignments. */
  findSlotables(slot) { return this._arena.findSlotables(this._ensure(slot)).map((id) => this._object(id)); }
  /** @param {object} slot - Newly constructed slot. @returns {void} Creates only the V8-visible ownership array; native empty state is implicit. */
  initializeSlotAssignment(slot) { this._node(slot).nativeAssignedNodes = []; }
  /** @param {object} slot - Initialized slot. @returns {object} Captured objects and the native notification decision, before any effects. */
  slotAssignmentPlan(slot) {
    const id = this._ensure(slot); this._object(id);
    const plan = this._arena.slotAssignmentPlan(id);
    return { changed: plan.changed, nodes: plan.nodes.map((nodeId) => this._object(nodeId)) };
  }
  /** @param {object} slot - Slot owner. @param {object[]} nodes - Captured candidates kept alive across signaling. @returns {void} Commits numeric state before its V8 ownership mirror. */
  commitSlotAssignment(slot, nodes) {
    this._arena.setSlotAssignment(this._ensure(slot), nodes.map((node) => this._identify(node)));
    this._node(slot).nativeAssignedNodes = nodes;
  }
  /** @param {object} slot - Slot owner. @returns {object[]} Independent objects selected from the canonical cache. */
  cachedSlotables(slot) {
    const id = this._ensure(slot); this._object(id);
    return this._arena.cachedSlotables(id).map((nodeId) => this._object(nodeId));
  }
  /** @param {object} slot - Slot owner. @returns {number} Cached count without materializing an array. */
  assignedNodeCount(slot) { return this._arena.assignedNodeCount(this._ensure(slot)); }
  /** @param {object} node - Node implementation. @returns {object|null} Last recorded slot, independent of current topology or slot names. */
  slotBacklink(node) {
    const id = this._ensure(node); this._object(id);
    return this._object(this._arena.slotBacklink(id));
  }
  /** @param {object} node - Assignable implementation. @param {object|null} slot - Recorded slot or explicit reset. @returns {void} Commits native identity before updating the V8 ownership edge. */
  setSlotBacklink(node, slot) {
    this._arena.setSlotBacklink(this._ensure(node), slot ? this._ensure(slot) : 0);
    this._node(node).nativeAssignedSlot = slot;
  }
  /** @param {object} node - Node with the default event-parent algorithm. @returns {object|null} Recorded slot or ordinary parent selected by Rust. */
  eventParent(node) {
    const id = this._ensure(node); this._object(id);
    return this._object(this._arena.eventParent(id));
  }
  /** @param {object} slot - Signaled slot. @returns {void} Keeps one V8 owner only when the native queue accepts a new member. */
  queueSlotSignal(slot) {
    if (this._arena.queueSlotSignal(this._ensure(slot))) this._signalSlotOwners.push(slot);
  }
  /** @returns {object[]} Drains native order and resolves every identity before releasing the pending ownership array. */
  takeSlotSignals() {
    const slots = this._arena.takeSlotSignals().map((id) => this._object(id));
    this._signalSlotOwners = [];
    return slots;
  }
  /** @param {object} data - Complete mutation payload. @param {Function} createRecord - Real WebIDL factory effect. @returns {void} Prepares native payloads once and commits each wrapper in original order. */
  produceMutationRecords(data, createRecord) {
    const targetId = this._ensure(data.target); this._objects.get(targetId).deref();
    const prepared = this._arena.prepareMutationRecordBatch({ kind: data.type, target: targetId,
      previousSibling: data.previousSibling ? this._ensure(data.previousSibling) : 0,
      nextSibling: data.nextSibling ? this._ensure(data.nextSibling) : 0,
      attributeName: data.attributeName, attributeNamespace: data.attributeNamespace, oldValue: data.oldValue,
      addedNodes: data.addedNodes.length ? data.addedNodes.map((node) => this._ensure(node)) : EMPTY_NODE_HANDLES,
      removedNodes: data.removedNodes.length ? data.removedNodes.map((node) => this._ensure(node)) : EMPTY_NODE_HANDLES });
    if (prepared === null) return;
    const owners = [data.target, data.previousSibling, data.nextSibling, ...data.addedNodes, ...data.removedNodes];
    const observers = prepared.observers.map((id) => this._observers.get(id).deref());
    for (let index = 0; index < observers.length; index++) {
      const record = createRecord(prepared.payloads[prepared.payloadIndices[index]], owners);
      this.enqueueMutationRecord(observers[index], record);
    }
  }
  /** @param {object} observer - Real implementation, weakly indexed. @returns {number} Monotonic native creation-order ID. */
  allocateMutationObserver(observer) {
    const id = this._arena.allocateMutationObserver();
    this._observers.set(id, new WeakRef(observer));
    this._collectedObservers.register(observer, id);
    return id;
  }
  /** @param {object} observer - Live implementation. @param {object} target - Observed node. @param {object} options - Converted dictionary. @returns {void} */
  observeMutations(observer, target, options) {
    const status = this._arena.observeMutations(observer._id, this._identify(target), options);
    const message = OBSERVATION_ERROR_MESSAGES[status];
    if (message) throw new TypeError(message);
    if (status === ObservationStatus.Added) {
      target._observerOwners.add(observer);
    }
  }
  /** @param {object} observer - Anchored observer. @returns {void} Removes ownership from surviving targets; collected nodes no longer own anything. */
  disconnectMutationObserver(observer) {
    for (const id of this._arena.disconnectMutationObserver(observer._id)) this._objects.get(id)?.deref()?._observerOwners.delete(observer);
  }
  /** @param {object} observer - Selected observer. @param {object} record - Complete real MutationRecord implementation. @returns {void} Native order and payload ownership are committed before retaining the V8 owner. */
  enqueueMutationRecord(observer, record) {
    observer._selfReference.deref();
    const token = this._arena.enqueueMutationRecord(observer._id, record._nativeRecord);
    observer._recordOwners.set(token, record);
    this._activeObserverOwners.set(observer._id, observer);
  }
  /** @param {object} observer - Observer anchored for this synchronous drain. @returns {object[]} Existing record implementations in native queue order. */
  takeMutationRecords(observer) {
    observer._selfReference.deref();
    return this._arena.takeMutationRecords(observer._id).map((token) => {
      const record = observer._recordOwners.get(token);
      observer._recordOwners.delete(token);
      return record;
    });
  }
  /** @returns {boolean} Whether the host must enqueue a microtask at this exact point. */
  requestMutationObserverMicrotask() { return this._arena.requestMutationObserverMicrotask(); }
  /** @returns {object[]} Strong observer owners in the native batch's creation order; later activations use a new owner map. */
  beginMutationObserverNotification() {
    const owners = this._activeObserverOwners;
    const observers = this._arena.beginMutationObserverNotification();
    this._activeObserverOwners = new Map();
    return observers.map((id) => owners.get(id));
  }
  /** @param {Function} notifyObserver - Existing callback/error effect for a nonempty record batch. @param {Function} notifySlot - Existing slotchange effect. @returns {void} Runs native delivery control with callbacks outside the native borrow. */
  runObserverDelivery(notifyObserver, notifySlot) {
    const owners = { observers: this._activeObserverOwners, slots: this._signalSlotOwners };
    // Preserve every captured owner for this synchronous job, including slots detached by callbacks.
    new WeakRef(owners).deref();
    const operation = this._arena.startMutationObserverDelivery();
    this._activeObserverOwners = new Map(); this._signalSlotOwners = [];
    try {
      while (true) {
        const step = this._arena.mutationObserverDeliveryStep(operation);
        if (step.kind === ObserverDeliveryAction.Complete) return;
        if (step.kind === ObserverDeliveryAction.Observer) {
          const observer = owners.observers.get(step.observer);
          const records = step.records.map((token) => {
            const record = observer._recordOwners.get(token); observer._recordOwners.delete(token); return record;
          });
          notifyObserver(observer, records);
        } else {
          notifySlot(this._object(step.slot));
        }
        if (step.complete) return;
      }
    } finally { operation.cancel(); }
  }
  /**
   * Execute native assignment traversal and replay only ownership changes and signal effects.
   * @param {object} root - Root to traverse, or the single slot.
   * @param {boolean} subtree - Traverse the ordinary tree when true.
   * @param {Function} signal - Original synchronous signal scheduling boundary.
   * @returns {void}
   * @throws {Error} Propagates signal and native errors after cancelling retained controller state.
   */
  runSlotAssignments(root, subtree, signal) {
    const rootId = this._ensure(root); this._object(rootId);
    const operation = new NativeSlotAssignmentDriver(rootId, subtree);
    try {
      while (true) {
        const step = this._arena.slotAssignmentStep(operation);
        if (step.kind === SlotAssignmentAction.Complete) return;
        // Dereferencing pins the captured cursor and candidates for this synchronous job,
        // even if signal scheduling reenters DOM code and detaches them from the root.
        this._object(step.nextNode);
        const slot = this._object(step.slot); const nodes = step.nodes.map((id) => this._object(id));
        if (step.kind === SlotAssignmentAction.Signal) signal(slot);
        else {
          if (step.cacheChanged) this._node(slot).nativeAssignedNodes = nodes;
          for (const node of nodes) this._node(node).nativeAssignedSlot = slot;
          if (step.nextNode === 0) return;
        }
      }
    } finally { operation.cancel(); }
  }
  /** @param {object} slot - Input implementation anchoring its tree and host. @returns {object[]} Flattened original nodes; temporary IDs do not own them. */
  findFlattenedSlotables(slot) {
    const id = this._ensure(slot);
    // WeakRef.deref keeps the anchor through this job, including native allocation and ID resolution.
    // https://tc39.es/ecma262/multipage/managing-memory.html#sec-weakrefderef
    this._object(id);
    return this._arena.findFlattenedSlotables(id).map((nodeId) => this._object(nodeId));
  }
  /** @param {object} root - Fragment implementation, possibly still constructing. @param {object|null|undefined} host - Original host value. @param {boolean} shadow - ShadowRoot relationship rather than template ownership. @returns {void} Commits numeric links before changing the visible ownership edge. */
  setRootHost(root, host, shadow) {
    const record = this._node(root);
    if (!host) {
      if (record.nativeHost) this._arena.setRootHost(this._identify(root), 0, false);
      record.nativeHost = host; return;
    }
    this._arena.setRootHost(this._identify(root), this._identify(host), shadow);
    record.nativeHost = host;
  }
  /** @param {object} node - DOM implementation. @returns {object} Native shadow-including root; template hosts are not crossed. */
  shadowIncludingRoot(node) {
    if (!node) return super.parent(node);
    return this._object(this._arena.shadowIncludingRoot(this._ensure(node)));
  }
  /** @param {object} ancestor - Candidate ancestor. @param {object} node - Descendant candidate. @returns {boolean} Shadow-including ancestry. */
  isShadowInclusiveAncestor(ancestor, node) {
    return this._arena.isShadowInclusiveAncestor(this._ensure(ancestor), this._ensure(node));
  }
  /** @param {object|null} ancestor - Candidate ancestor. @param {object} node - Descendant candidate. @returns {boolean} Host-inclusive ancestry, including template hosts. */
  isHostInclusiveAncestor(ancestor, node) {
    if (!node) return super.parent(node);
    return Boolean(ancestor) && this._arena.isHostInclusiveAncestor(this._ensure(ancestor), this._ensure(node));
  }
  /** @param {object} parent - Validated insertion parent. @param {object} node - Candidate node. @param {object|null} child - Reference child or append. @param {object} exceptionFactory - Original DOMException factory. @returns {void} Throws in the parent's realm when native constraints reject insertion. */
  validateInsertionConstraints(parent, node, child, exceptionFactory) {
    const status = this._arena.preInsertConstraints(this._ensure(parent), this._ensure(node), child ? this._ensure(child) : 0);
    this._assertNodeConstraints(parent, node, status, exceptionFactory);
  }
  /** @param {object} parent - Validated replacement parent. @param {object} node - Replacement node. @param {object} child - Child being replaced. @param {object} exceptionFactory - Original DOMException factory. @returns {void} Preserves the distinct native replacement constraints and original exception realm. */
  validateReplacementConstraints(parent, node, child, exceptionFactory) {
    const status = this._arena.preReplaceConstraints(this._ensure(parent), this._ensure(node), this._ensure(child));
    this._assertNodeConstraints(parent, node, status, exceptionFactory);
  }
  /** @param {object} parent - Receiver implementation. @param {object} node - Candidate implementation. @param {number} status - Shared native rejection vocabulary. @param {object} exceptionFactory - Original exception factory. @returns {void} Delivers a rejection after the native borrow has ended. */
  _assertNodeConstraints(parent, node, status, exceptionFactory) {
    if (status === NodeInsertionStatus.Ready) return;
    let message;
    let name = 'HierarchyRequestError';
    switch (status) {
      case NodeInsertionStatus.ChildNotFound: message = 'The child can not be found in the parent.'; name = 'NotFoundError'; break;
      case NodeInsertionStatus.InvalidNodeType: message = `${node.nodeName} node can't be inserted in parent node.`; break;
      case NodeInsertionStatus.InvalidParentForNode: message = `${node.nodeName} node can't be inserted in ${parent.nodeName} parent.`; break;
      case NodeInsertionStatus.InvalidDocumentStructure: message = `Invalid insertion of ${node.nodeName} node in ${parent.nodeName} node.`; break;
      default: throw new Error('rustdom Node insertion: unsupported native constraint status');
    }
    throw exceptionFactory.create(parent._globalObject, [message, name]);
  }
  /** @param {object|null} ancestor - Candidate ancestor. @param {object|null} node - Descendant candidate. @returns {boolean} Parent-link ancestry only. */
  isInclusiveAncestor(ancestor, node) { return Boolean(ancestor && node) && this._arena.containsNode(this._ensure(ancestor), this._ensure(node)); }
  /** @param {object|null} node - Candidate following node. @param {object|null} reference - Reference node. @returns {boolean} Strict native preorder relation. */
  isFollowing(node, reference) { return Boolean(node && reference) && this._arena.isFollowing(this._ensure(node), this._ensure(reference)); }
  /** @param {object} range - Receiver Range. @param {object} fragmentFactory - Existing fragment factory. @param {Function} cloneNode - Existing clone hook. @param {object} exceptionFactory - Existing error factory. @returns {object} Cloned fragment. */
  cloneRangeContents(range, fragmentFactory, cloneNode, exceptionFactory) {
    return runContents(this, range, fragmentFactory, cloneNode, exceptionFactory, 'clone');
  }
  /** @param {object} range - Receiver Range. @param {object} fragmentFactory - Existing fragment factory. @param {Function} cloneNode - Existing clone hook. @param {object} exceptionFactory - Existing error factory. @returns {object} Extracted fragment after ordered mutations. */
  extractRangeContents(range, fragmentFactory, cloneNode, exceptionFactory) {
    return runContents(this, range, fragmentFactory, cloneNode, exceptionFactory, 'extract');
  }
  /** @param {object} range - Receiver Range. @returns {object|null} Existing context element or a request for the synthetic body. */
  rangeFragmentContext(range) {
    const context = this._arena.rangeFragmentContext(range._nativeRange, range._rangeStartNode._ownerDocument._parsingMode === 'html');
    if (context === null) throw new Error('Internal error: Invalid range start node');
    return this._object(context);
  }
  /** @param {object} range - Receiver Range. @param {object} node - Inserted node. @param {object} exceptionFactory - Original DOMException factory. @returns {object} Initial insertion geometry with stable node identities. */
  rangeInsertionPlan(range, node, exceptionFactory) {
    const plan = this._arena.rangeInsertionPlan(range._nativeRange, this._ensure(node));
    if (plan === null) throw exceptionFactory.create(node._globalObject, ['Invalid start node.', 'HierarchyRequestError']);
    plan.startNode = this._object(plan.startNode); plan.parent = this._object(plan.parent); plan.reference = this._object(plan.reference);
    return plan;
  }
  /** @param {object} node - Inserted node after removal. @param {object} parent - Captured insertion parent. @param {object|null} reference - Current reference. @returns {number} Offset evaluated after all preceding hooks. */
  rangeInsertionOffset(node, parent, reference) {
    return this._arena.rangeInsertionOffset(this._ensure(node), this._ensure(parent), reference ? this._ensure(reference) : 0);
  }
  /** @param {object} range - Receiver Range. @param {object} parent - Requested surrounding node. @param {object} exceptionFactory - Original DOMException factory. @returns {void} Preserves native preflight error ordering in the receiver realm. */
  validateRangeSurround(range, parent, exceptionFactory) {
    const status = this._arena.rangeSurroundStatus(range._nativeRange, this._ensure(parent));
    switch (status) {
      case RangeSurroundStatus.Ready: return;
      case RangeSurroundStatus.PartialNonText:
        throw exceptionFactory.create(range._globalObject, ['The Range has partially contains a non-Text node.', 'InvalidStateError']);
      case RangeSurroundStatus.InvalidParentType:
        throw exceptionFactory.create(range._globalObject, ['Invalid element type.', 'InvalidNodeTypeError']);
      case RangeSurroundStatus.InconsistentRoots: throw new Error(BOUNDARY_ROOT_ERROR_MESSAGE);
      default: throw new Error(`NativeTree: unsupported surround status ${status}`);
    }
  }
  /** @param {object} node - Candidate whose current state is re-read. @returns {object|null} Transient group with live wrapper identities. */
  normalizationGroup(node) {
    const group = this._arena.normalizationGroup(this._ensure(node));
    if (group === null) return null;
    group.parent = this._object(group.parent);
    group.siblings = group.siblings.map((id) => this._object(id));
    return group;
  }

  /** @param {object} node - Attr implementation. @param {number} kind - Attr type. @param {object} data - Initial metadata. @returns {void} */
  initializeAttribute(node, kind, data) {
    const id = this._identify(node);
    writeAttribute(this._arena, id, kind, data);
    const record = this._node(node);
    record.nativeAttribute = true;
    record.nativeDataReady = true;
  }
  /** @param {object} node - Attr. @returns {string} Native local name. */
  attributeName(node) { return this._arena.attributeField(this._identify(node), AttributeField.Name); }
  /** @param {object} node - Attr. @returns {string|null} Native namespace. */
  attributeNamespace(node) { return this._arena.attributeField(this._identify(node), AttributeField.Namespace); }
  /** @param {object} node - Attr. @returns {string|null} Native prefix. */
  attributePrefix(node) { return this._arena.attributeField(this._identify(node), AttributeField.Prefix); }
  /** @param {object} node - Attr. @returns {string} Native value. */
  attributeValue(node) { return this._arena.attributeField(this._identify(node), AttributeField.Value); }
  /** @param {object} node - Attr. @returns {string} Qualified name constructed in Rust. */
  attributeQualifiedName(node) { return this._arena.attributeField(this._identify(node), AttributeField.QualifiedName); }
  /** @param {object} node - Attr. @param {string} value - New value. @returns {void} */
  setAttributeValue(node, value) { this._arena.setAttributeValue(this._identify(node), value); }

  /** @param {object} element - Constructing element. @returns {void} Initializes native order and host GC roots. */
  initializeAttributeCollection(element) {
    this._arena.initializeAttributeCollection(this._identify(element));
    this._node(element).attributeRoots = new Map();
  }
  /** @param {object} element - Element. @returns {object[]} Ordered view of canonical native IDs. */
  attributeList(element) { return this._arena.attributeIds(this._identify(element)).map((id) => this._object(id)); }
  /** @param {object} element - Element. @returns {IterableIterator<number>} Native ordered positions without materializing Attr wrappers. */
  attributeIndices(element) { return this._arena.attributeIds(this._identify(element)).keys(); }
  /** @param {object} element - Element. @returns {number} Native collection size. */
  attributeCount(element) { return this._arena.attributeCount(this._identify(element)); }
  /** @param {object} element - Element. @param {number} index - Position. @returns {object|null} Attr identity. */
  attributeAt(element, index) { return this._object(this._arena.attributeAt(this._identify(element), index)); }
  /** @param {object} attribute - Attr. @returns {object|null} Canonical owner. */
  attributeOwner(attribute) { return this._object(this._arena.attributeOwner(this._identify(attribute))); }
  /** @param {object} attribute - Attr. @param {object|null} element - Constructor owner. @returns {void} */
  initializeAttributeOwner(attribute, element) {
    if (element) this._arena.initializeAttributeOwner(this._identify(attribute), this._ensure(element));
    this._node(attribute).attributeOwnerRoot = element;
  }
  /** @param {object} element - Element. @param {object} attribute - Attr. @returns {boolean} Native membership. */
  containsAttribute(element, attribute) { return this._arena.containsAttribute(this._identify(element), this._identify(attribute)); }
  /** @param {object} element - Element. @param {string} name - Qualified name. @param {boolean} [normalize] - HTML ASCII normalization. @returns {object|null} Attr from native name cache. */
  attributeByName(element, name, normalize = true) {
    return this._object(this._arena.attributeByName(this._ensure(element), name,
      normalize && element._ownerDocument._parsingMode === 'html'));
  }
  /** @param {object} element - Element. @param {string|null} namespace - Namespace. @param {string} name - Local name. @returns {object|null} Native namespace lookup. */
  attributeByNamespace(element, namespace, name) {
    return this._object(this._arena.attributeByNamespace(this._ensure(element), namespace, name));
  }
  /** @param {object} element - Element. @param {boolean} [supported] - NamedNodeMap supported-property filtering. @returns {string[]} Native ordered names. */
  attributeNames(element, supported = false) {
    return this._arena.attributeNames(this._ensure(element), supported, element._ownerDocument._parsingMode === 'html');
  }
  /**
   * Apply only GC-visible ownership edges after native commit. Native code owns order and cache decisions.
   * @param {object} element - Owner element.
   * @param {object} delta - Native reference changes.
   * @returns {object} Change record retaining the previous Attr for the caller.
   */
  _applyAttributeDelta(element, delta) {
    const previous = this._object(delta.previous);
    const roots = this._node(element).attributeRoots;
    if (delta.detached) this._node(this._object(delta.detached)).attributeOwnerRoot = null;
    if (delta.attached) {
      const attribute = this._object(delta.attached);
      roots.set(delta.attached, attribute);
      this._node(attribute).attributeOwnerRoot = element;
    }
    for (const id of delta.released) roots.delete(id);
    return { changed: delta.changed, previous };
  }
  /** @param {object} element - Element. @param {object} attribute - Attr. @returns {object} Native append effects. */
  appendAttribute(element, attribute) { return this._applyAttributeDelta(element, this._arena.appendAttribute(this._ensure(element), this._identify(attribute))); }
  /** @param {object} element - Element. @param {object} attribute - Attr. @returns {object} Native removal effects. */
  removeAttribute(element, attribute) { return this._applyAttributeDelta(element, this._arena.removeAttribute(this._ensure(element), this._identify(attribute))); }
  /** @param {object} element - Element. @param {object} oldAttribute - Prior Attr. @param {object} newAttribute - Replacement. @returns {object} Native replacement effects. */
  replaceAttribute(element, oldAttribute, newAttribute) { return this._applyAttributeDelta(element, this._arena.replaceAttribute(this._ensure(element), this._identify(oldAttribute), this._identify(newAttribute))); }
  /** @param {object} element - Element. @param {object} attribute - Attr. @returns {object} Native append/replace/no-op decision. */
  setAttribute(element, attribute) { return this._applyAttributeDelta(element, this._arena.setAttribute(this._ensure(element), this._identify(attribute))); }

  /** @param {object} node - DOM root. @param {boolean} outer - Include root markup. @param {boolean} scripting - Noscript serialization mode. @returns {string} HTML from native data. */
  serializeHTML(node, outer, scripting) { return this._arena.serializeHtml(this._ensure(node), outer, scripting); }

  /**
   * Resolve native query results to the same DOM implementations used by jsdom.
   * @param {string} selector - Already-converted DOMString selector.
   * @param {object} root - Query context.
   * @param {number} mode - Native query mode.
   * @returns {object[]|null} Results or null for compatibility handling.
   */
  _query(selector, root, mode) {
    const document = root._ownerDocument;
    if (document?._parsingMode !== 'html' || typeof selector !== 'string' || !selector.isWellFormed()) return null;
    let treeRoot = root;
    while (this.parent(treeRoot)) treeRoot = this.parent(treeRoot);
    if (treeRoot._host?._shadowRoot === treeRoot) return null;
    const result = this._arena.query(selector, this._ensure(root), this._ensure(document), mode, document._mode === 'quirks');
    return result == null ? null : Array.from(result, (id) => this._object(id));
  }
  /** @param {string} selector - Selector. @param {object} root - Context. @returns {object[]|null} Descendants or fallback. */
  queryAll(selector, root) { return this._query(selector, root, QueryMode.All); }
  /** @param {string} selector - Selector. @param {object} root - Context. @returns {object[]|null} First match or fallback. */
  queryFirst(selector, root) { return this._query(selector, root, QueryMode.First); }
  /** @param {string} selector - Selector. @param {object} root - Subject. @returns {object[]|null} Subject match or fallback. */
  matchNode(selector, root) { return this._query(selector, root, QueryMode.Matches); }
  /** @param {string} selector - Selector. @param {object} root - Original subject. @returns {object[]|null} Closest ancestor or fallback. */
  closestNode(selector, root) { return this._query(selector, root, QueryMode.Closest); }

  /** @param {number} id - Native handle or zero. @returns {object|null} The original JS node. */
  _object(id) {
    if (!id) return null;
    const object = this._objects.get(id)?.deref();
    if (!object) throw new Error(`NativeSymbolTree: reachable node ${id} was collected`);
    return object;
  }

  /** @param {object} object - Node to detach. @returns {object} The same node instance. */
  remove(object) {
    const record = this._node(object);
    if (record.nativeId === undefined) return super.remove(object);
    const parent = this._node(record.parent);
    const count = this._arena.remove(record.nativeId);
    super.remove(object);
    if (parent) parent.nativeChildCount = count;
    return object;
  }

  /** @param {object} parent - Parent node. @param {object} child - Detached child. @returns {object} The inserted child. */
  appendChild(parent, child) {
    const record = this._node(parent);
    const count = this._arena.append(this._ensure(parent), this._ensure(child));
    // Call non-dispatching base operations to avoid applying the native write twice.
    if (record.lastChild) super.insertAfter(record.lastChild, child);
    else super.appendChild(parent, child);
    record.nativeChildCount = count;
    return child;
  }

  /** @param {object} parent - Parent node. @param {object} child - Detached child. @returns {object} The inserted child. */
  prependChild(parent, child) {
    const record = this._node(parent);
    const count = this._arena.prepend(this._ensure(parent), this._ensure(child));
    if (record.firstChild) super.insertBefore(record.firstChild, child);
    else super.prependChild(parent, child);
    record.nativeChildCount = count;
    return child;
  }

  /** @param {object} reference - Following sibling. @param {object} child - Detached node. @returns {object} The inserted node. */
  insertBefore(reference, child) {
    const referenceNode = this._node(reference);
    const parent = this._node(referenceNode.parent);
    const count = this._arena.insertBefore(this._ensure(reference), this._ensure(child));
    super.insertBefore(reference, child);
    if (parent) parent.nativeChildCount = count;
    return child;
  }

  /** @param {object} reference - Preceding sibling. @param {object} child - Detached node. @returns {object} The inserted node. */
  insertAfter(reference, child) {
    const referenceNode = this._node(reference);
    const parent = this._node(referenceNode.parent);
    const count = this._arena.insertAfter(this._ensure(reference), this._ensure(child));
    super.insertAfter(reference, child);
    if (parent) parent.nativeChildCount = count;
    return child;
  }

  /** @param {object} object - Parent node. @returns {number} The native-maintained child count. */
  childrenCount(object) { return this._node(object).nativeChildCount || 0; }

  /**
   * Batch pure traversals in Rust; preserve live callback semantics when a filter is supplied.
   * @param {object} object - Inclusive subtree root.
   * @param {object} [options] - Existing SymbolTree array/filter/thisArg options.
   * @returns {object[]} Original nodes in document order.
   */
  treeToArray(object, options) {
    if (options?.filter) return super.treeToArray(object, options);
    const array = options?.array || [];
    if (object) for (const id of this._arena.descendants(this._ensure(object))) array.push(this._object(id));
    return array;
  }

  /** @returns {object} Allocation and operation counters without strong references to nodes. */
  statistics() {
    return { ...this._arena.statistics(), indexedNodes: this._objects.size, handleBatchSize: this._handleBatchSize,
      rootHosts: this._arena.rootHostStatistics(), slotableNames: this._arena.slotableNameStatistics(),
      slotAssignments: this._arena.slotAssignmentStatistics(),
      slotBacklinks: this._arena.slotBacklinkStatistics(),
      slotSignals: this._arena.slotSignalStatistics(),
      slotAssignmentDrivers: NativeSlotAssignmentDriver.statistics(),
      mutationRecords: NativeMutationRecord.statistics(),
      mutationObservers: this._arena.observerRegistryStatistics(),
      mutationNotifications: this._arena.observerNotificationStatistics(),
      observerDeliveries: NativeObserverDelivery.statistics(),
      eventStates: NativeEventState.statistics(),
      listenerRegistries: NativeListenerRegistry.statistics(),
      abortStates: NativeAbortState.statistics(),
      xmlParsers: NativeXmlParser.statistics(), xmlSerialization: xmlSerializationStatistics(), traversals: NativeTraversal.statistics(), tokenLists: NativeTokenList.statistics(), dataset: this._arena.datasetStatistics(), rectangles: NativeDomRect.statistics(), webStorage: NativeStorageArea.statistics(), blobs: NativeBlobMetadata.statistics(), fileReaders: NativeFileReaderState.statistics(), formData: NativeFormDataEntries.statistics(), napiClasses: classReferenceStatistics(),
      rangeStates: NativeRange.statistics(), rangeClones: NativeRangeClone.statistics(), rangeExtracts: NativeRangeExtract.statistics() };
  }
}

module.exports = NativeSymbolTree;
