/** @file Realm/callback ownership for native NodeIterator and TreeWalker control. */
'use strict';
const { TraversalMethod, TraversalAction, TraversalMoveResult } = require('../../dist/native.cjs');
const conversions = require('webidl-conversions');

/**
 * Bind public traversal implementations to the private runtime's forest and exception realm.
 * @param {object} tree - NativeSymbolTree with V8-visible node ownership.
 * @param {object} DOMException - The runtime's generated exception factory.
 * @returns {object} Implementations consumed by the existing WebIDL wrappers.
 */
function createTraversalImplementations(tree, DOMException) {
  /** Shared ownership and callback suspension, with all navigation decisions in Rust. */
  class TraversalOwner {
    /** @param {object} globalObject - Exception realm. @param {Array} args - WebIDL constructor arguments. @param {object} privateData - Root, mask and converted filter. */
    constructor(globalObject, args, privateData) {
      this.root = privateData.root;
      this.whatToShow = privateData.whatToShow;
      this.filter = privateData.filter;
      this._globalObject = globalObject;
      this._currentOwner = this.root;
      this._idleTraversalOperation = null;
      this._nativeTraversal = tree._arena.createTraversal(tree._ensure(this.root), this.whatToShow, this.filter !== null);
    }

    /** @param {number} method - Native movement operation. @returns {object|null} Accepted implementation node. */
    _traverse(method) {
      const state = this._nativeTraversal;
      if (this.filter === null) {
        const node = tree._arena.traversalMove(state, method);
        if (node === TraversalMoveResult.Complete) return null;
        if (node === TraversalMoveResult.Recursive) {
          throw DOMException.create(this._globalObject, ['Recursive node filtering', 'InvalidStateError']);
        }
        return (this._currentOwner = tree._object(node));
      }
      const idle = this._idleTraversalOperation;
      this._idleTraversalOperation = null;
      const operation = idle ?? state.start(method);
      let candidate = this._currentOwner;
      try {
        let step = idle ? tree._arena.traversalRestartStep(state, operation, method) : tree._arena.traversalStep(state, operation);
        for (;;) {
          if (step.kind === TraversalAction.Complete) return null;
          if (step.kind === TraversalAction.Recursive) {
            throw DOMException.create(this._globalObject, ['Recursive node filtering', 'InvalidStateError']);
          }
          candidate = tree._object(step.node);
          if (step.kind === TraversalAction.Accepted) {
            this._currentOwner = candidate;
            return candidate;
          }
          let result;
          const { filter } = this;
          try { result = filter(candidate); }
          finally { state.active = false; }
          // Conversion is observable and may reenter this cursor after the active flag clears.
          result = conversions['unsigned short'](result);
          tree._ensure(candidate);
          step = tree._arena.traversalResumeStep(state, operation, result);
        }
      } finally {
        // Nested calls borrow another operation. Keep at most one idle object, including after throws.
        this._idleTraversalOperation ??= operation;
      }
    }
  }

  /** Public iterator owners; native state repairs its position before unlinking. */
  class NodeIteratorImpl extends TraversalOwner {
    /** @returns {object} The native reference node's strong V8 owner. */
    get referenceNode() { return this._currentOwner; }
    /** @returns {boolean} Native pointer orientation. */
    get pointerBeforeReferenceNode() { return this._nativeTraversal.before; }
    /** @returns {object|null} Next accepted node. */
    nextNode() { return this._traverse(TraversalMethod.IteratorNext); }
    /** @returns {object|null} Previous accepted node. */
    previousNode() { return this._traverse(TraversalMethod.IteratorPrevious); }
    /** @returns {void} The standard intentionally leaves detach inert. */
    detach() {}
    /** @param {object} removed - Node whose native links still describe its old position. @returns {void} */
    _preRemovingSteps(removed) {
      tree._arena.traversalPreRemove(this._nativeTraversal, tree._ensure(removed));
      this._currentOwner = tree._object(this._nativeTraversal.current);
    }
  }

  /** Public walker owners; currentNode may intentionally be outside root. */
  class TreeWalkerImpl extends TraversalOwner {
    /** @returns {object} Current node's strong V8 owner. */
    get currentNode() { return this._currentOwner; }
    /** @param {object} node - Current node, including detached/foreign-document nodes. */
    set currentNode(node) {
      if (node === null) throw DOMException.create(this._globalObject, ['Cannot set currentNode to null', 'NotSupportedError']);
      this._nativeTraversal.current = tree._ensure(node);
      this._currentOwner = node;
    }
    /** @returns {object|null} Accepted ancestor. */
    parentNode() { return this._traverse(TraversalMethod.Parent); }
    /** @returns {object|null} First accepted descendant at the child level. */
    firstChild() { return this._traverse(TraversalMethod.FirstChild); }
    /** @returns {object|null} Last accepted descendant at the child level. */
    lastChild() { return this._traverse(TraversalMethod.LastChild); }
    /** @returns {object|null} Previous accepted sibling or skipped sibling descendant. */
    previousSibling() { return this._traverse(TraversalMethod.PreviousSibling); }
    /** @returns {object|null} Next accepted sibling or skipped sibling descendant. */
    nextSibling() { return this._traverse(TraversalMethod.NextSibling); }
    /** @returns {object|null} Previous accepted node in tree order. */
    previousNode() { return this._traverse(TraversalMethod.PreviousNode); }
    /** @returns {object|null} Next accepted node in tree order. */
    nextNode() { return this._traverse(TraversalMethod.NextNode); }
  }
  return { NodeIteratorImpl, TreeWalkerImpl };
}

module.exports = { createTraversalImplementations };
