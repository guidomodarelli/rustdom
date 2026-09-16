/** @file Realm factories and GC-visible Range ownership around native Selection control. */
'use strict';
const { NativeSelectionState, SelectionOperation, selectionOperationResult } = require('../../dist/native.cjs');

/** @param {object} context - Actual Range/DOM helpers. @returns {Function} Private Selection implementation. */
function createSelectionImplementation(context) {
  const { Range, DOMException, implForWrapper, fireAnEvent } = context;
  const helpers = { ...context,
    /** @param {object} node - Actual implementation. @param {number} offset - Boundary offset. @returns {object} GC-visible boundary. */
    point(node, offset) { return { node, offset }; },
    /** @param {object} globalObject - Owning realm. @param {object} start - Start boundary. @param {object} end - End boundary. @returns {object} Actual Range implementation. */
    createRange(globalObject, start, end) { return Range.createImpl(globalObject, [], { start: { node: start.node, offset: start.offset }, end: { node: end.node, offset: end.offset } }); },
    /** @param {object} globalObject - Exception realm. @param {string} message - Native diagnostic. @param {string} kind - DOMException name. @returns {never} */
    throwDomException(globalObject, message, kind) { throw DOMException.create(globalObject, [message, kind]); },
    /** @param {string} method - Known Range operation. @param {unknown} value - Already-read non-callable method. @returns {never} Obtain the engine's intrinsic error without reading the real getter again. */
    throwRangeMethodError(method, value) {
      const receiver = {
        __proto__: null,
        _range: { __proto__: null, [method]: value },
        /** @returns {never} Match the reference expression for a non-callable Range stringifier. */
        toString() { return this._range.toString(); },
        /** @returns {never} Match the reference expression for a non-callable Range deletion method. */
        deleteFromDocument() { this._range.deleteContents(); },
      };
      return method === 'toString' ? receiver.toString() : receiver.deleteFromDocument();
    },
    /** @param {Document} document - Captured document wrapper. @returns {void} Preserve one timer per actual association change. */
    scheduleChange(document) { setTimeout(() => { fireAnEvent('selectionchange', implForWrapper(document)); }, 0); },
  };
  return class SelectionImpl {
    /** @param {object} globalObject - Actual realm; references stay visible to V8. */
    constructor(globalObject) { this._globalObject = globalObject; this._range = null; this._state = new NativeSelectionState(); }
    /** @returns {number} Canonical native direction. */
    get _direction() { return this._state.direction; }
    /** @param {number} value - Internal direction. */
    set _direction(value) { this._state.direction = value; }
    /** @param {number} operation - Native operation. @param {unknown[]} [args] - Converted arguments. @returns {*} Original result returned in the current native call scope; omitted arguments need no array allocation. */
    _run(operation, args) { return selectionOperationResult(this, operation, args, helpers); }
    /** @returns {object|null} Live anchor boundary. */
    get _anchor() { return this._run(SelectionOperation.Anchor); }
    /** @returns {object|null} Live focus boundary. */
    get _focus() { return this._run(SelectionOperation.Focus); }
    /** @returns {object|null} Anchor node. */
    get anchorNode() { return this._run(SelectionOperation.AnchorNode); }
    /** @returns {number} Anchor offset. */
    get anchorOffset() { return this._run(SelectionOperation.AnchorOffset); }
    /** @returns {object|null} Focus node. */
    get focusNode() { return this._run(SelectionOperation.FocusNode); }
    /** @returns {number} Focus offset. */
    get focusOffset() { return this._run(SelectionOperation.FocusOffset); }
    /** @returns {boolean} Whether the current Range is collapsed or absent. */
    get isCollapsed() { return this._run(SelectionOperation.IsCollapsed); }
    /** @returns {number} Current range count. */
    get rangeCount() { return this._run(SelectionOperation.RangeCount); }
    /** @returns {string} Reference Selection type. */
    get type() { return this._run(SelectionOperation.Type); }
    /** @param {number} index - Converted index. @returns {object} Shared Range. */
    getRangeAt(index) { return this._run(SelectionOperation.GetRangeAt, [index]); }
    /** @param {object} range - Actual Range. @returns {void} */
    addRange(range) { this._run(SelectionOperation.AddRange, [range]); }
    /** @param {object} range - Actual Range. @returns {void} */
    removeRange(range) { this._run(SelectionOperation.RemoveRange, [range]); }
    /** @returns {void} Clear association. */
    removeAllRanges() { this._run(SelectionOperation.RemoveAllRanges); }
    /** @returns {void} Reference alias. */
    empty() { this.removeAllRanges(); }
    /** @param {object|null} node - Actual node. @param {number} offset - Converted offset. @returns {void} */
    collapse(node, offset) { this._run(SelectionOperation.Collapse, [node, offset]); }
    /** @param {object|null} node - Actual node. @param {number} offset - Converted offset. @returns {void} Reference alias. */
    setPosition(node, offset) { this.collapse(node, offset); }
    /** @returns {void} Collapse to the current start. */
    collapseToStart() { this._run(SelectionOperation.CollapseToStart); }
    /** @returns {void} Collapse to the current end. */
    collapseToEnd() { this._run(SelectionOperation.CollapseToEnd); }
    /** @param {object} node - New focus node. @param {number} offset - Converted offset. @returns {void} */
    extend(node, offset) { this._run(SelectionOperation.Extend, [node, offset]); }
    /** @param {object} anchor - Anchor node. @param {number} anchorOffset - Anchor offset. @param {object} focus - Focus node. @param {number} focusOffset - Focus offset. @returns {void} */
    setBaseAndExtent(anchor, anchorOffset, focus, focusOffset) { this._run(SelectionOperation.SetBaseAndExtent, [anchor, anchorOffset, focus, focusOffset]); }
    /** @param {object} node - Parent node. @returns {void} */
    selectAllChildren(node) { this._run(SelectionOperation.SelectAllChildren, [node]); }
    /** @returns {void} Delete through the actual Range. */
    deleteFromDocument() { this._run(SelectionOperation.DeleteFromDocument); }
    /** @param {object} node - Candidate node. @param {boolean} partial - Partial containment flag. @returns {boolean} */
    containsNode(node, partial) { return this._run(SelectionOperation.ContainsNode, [node, partial]); }
    /** @returns {string} Current Range text. */
    toString() { return this._run(SelectionOperation.ToString); }
    /** @returns {boolean} Existing helper used by host integrations. */
    _isEmpty() { return this.rangeCount === 0; }
    /** @param {object|null} range - New association. @returns {void} */
    _associateRange(range) { this._run(SelectionOperation.AssociateRange, [range]); }
  };
}
module.exports = { createSelectionImplementation };
